import { exec, execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, link, lstat, mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { promisify } from "node:util";

import { appendRunLog, readRunLog, requireAgent } from "../agents/index.js";
import {
  appendTaskEvidence,
  readTaskEvidence,
  type TaskEvidenceCandidateSubject,
  type TaskEvidenceRecord,
  type TaskEvidenceResult,
  type TaskEvidenceType,
  TASK_EVIDENCE_REFERENCE_MAX_LENGTH,
  TASK_EVIDENCE_SUMMARY_MAX_LENGTH,
} from "./evidence.js";
import {
  TASK_APK_OPERATIONS,
  runTaskApkOperation,
  type TaskApkOperation,
  type TaskApkOperationRunner,
} from "./apk-verification.js";
import { withLocalMutationLock } from "./lock.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const DEFAULT_TASK_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
export const TASK_VERIFICATION_REFERENCE_MAX_LENGTH = TASK_EVIDENCE_REFERENCE_MAX_LENGTH;
export const TASK_VERIFICATION_SUMMARY_MAX_LENGTH = TASK_EVIDENCE_SUMMARY_MAX_LENGTH;
const MAX_TASK_ATTRIBUTION_COMMITS = 128;
const MAX_TASK_ATTRIBUTION_FILES = 512;
const MAX_TASK_EPOCH_COMMITS = 4096;
const MAX_TASK_ATTRIBUTION_OUTPUT_COMMITS = 16;
const MAX_TASK_ATTRIBUTION_OUTPUT_FILES = 128;
const MAX_ARCHIVE_REFERENCE_FILES = 4096;
const MAX_ARCHIVE_REFERENCE_FILE_BYTES = 1024 * 1024;
const MAX_ARCHIVE_REFERENCE_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_ARCHIVE_REFERENCE_MATCHES = 256;
const MAX_ARCHIVE_REFERENCE_DIRECTORIES = 4096;
const MAX_ARCHIVE_REFERENCE_DEPTH = 32;

export const TASK_STATES = [
  "todo",
  "doing",
  "review",
  "done",
  "blocked",
  "canceled",
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const ACTIVE_TASK_STATES = [
  "todo",
  "doing",
  "review",
  "blocked",
] as const;
export type ActiveTaskState = (typeof ACTIVE_TASK_STATES)[number];

export type DependencyIssueKind = "missing" | "cycle";

export interface DependencyIssue {
  kind: DependencyIssueKind;
  taskId: string;
  message: string;
}

export const TASK_MODES = [
  "discovery",
  "mvp",
  "product",
  "production",
  "maintenance",
  "audit",
  "adopt",
] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export const TASK_RISKS = ["low", "medium", "high", "critical"] as const;
export type TaskRisk = (typeof TASK_RISKS)[number];

export const TASK_BASELINES_PATH = ".agentic/task-baselines.jsonl";

export const TASK_VERIFICATION_TYPES = ["automated", "manual"] as const;
export type TaskVerificationType = (typeof TASK_VERIFICATION_TYPES)[number];

export const TASK_VERIFICATION_ENVIRONMENTS = ["static", "ci", "local", "live"] as const;
export type TaskVerificationEnvironment = (typeof TASK_VERIFICATION_ENVIRONMENTS)[number];

export const TASK_VERIFICATION_PROFILES = ["deterministic", "integration", "trusted", "report"] as const;
export type TaskVerificationProfile = (typeof TASK_VERIFICATION_PROFILES)[number];

export interface TaskVerificationCheck {
  id: string;
  type: TaskVerificationType;
  required: boolean;
  environment: TaskVerificationEnvironment;
  profile: TaskVerificationProfile;
  /** Explicitly declares that this check measures a benchmark result. */
  evidenceType?: "benchmark";
  /** Read-only APK operation dispatched by the currently running APK process. */
  apkOperation?: TaskApkOperation;
  command?: string;
  instruction?: string;
  artifact?: string;
  evidence?: string;
  evidenceRef?: string;
  summary?: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  state: TaskState;
  owner: string;
  mode: TaskMode;
  lane: string;
  type?: string;
  scope: string[];
  risk: TaskRisk;
  parallel: boolean;
  dependsOn: string[];
  tags: string[];
  goal: string;
  contextFiles: string[];
  allowedFiles: string[];
  forbiddenFiles: string[];
  steps: string[];
  acceptanceCriteria: string[];
  correctnessAssumptions?: string[];
  invariants?: string[];
  requiredEvidence?: string[];
  reviewQuestions?: string[];
  counterexampleSearches?: string[];
  /** Structured checks; absent only on in-memory legacy task objects. */
  verification?: TaskVerificationCheck[];
  /** Backward-compatible automated command projection. */
  verificationCommands: string[];
  documentationUpdates: string[];
  notes: string[];
}

export interface ProjectTaskFile {
  path: string;
  task: ProjectTask;
}

export interface NextTaskSelection {
  path: string;
  task: ProjectTask;
  contextCommand: string;
}

export class TaskFormatError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid task file:\n- ${issues.join("\n- ")}`);
    this.name = "TaskFormatError";
    this.issues = issues;
  }
}

type SectionKey =
  | "goal"
  | "contextFiles"
  | "allowedFiles"
  | "forbiddenFiles"
  | "steps"
  | "acceptanceCriteria"
  | "correctnessAssumptions"
  | "invariants"
  | "requiredEvidence"
  | "reviewQuestions"
  | "counterexampleSearches"
  | "verification"
  | "verificationCommands"
  | "documentationUpdates"
  | "notes";

const SECTION_TITLES: Record<string, SectionKey> = {
  Goal: "goal",
  "Context files": "contextFiles",
  "Files allowed to edit": "allowedFiles",
  "Files forbidden to edit": "forbiddenFiles",
  Steps: "steps",
  "Acceptance criteria": "acceptanceCriteria",
  "Correctness assumptions": "correctnessAssumptions",
  Invariants: "invariants",
  "Required evidence": "requiredEvidence",
  "Review questions": "reviewQuestions",
  "Counterexample searches": "counterexampleSearches",
  Verification: "verification",
  "Verification commands": "verificationCommands",
  "Documentation updates": "documentationUpdates",
  Notes: "notes",
};

const SECTION_ORDER: readonly [SectionKey, string][] = [
  ["goal", "Goal"],
  ["contextFiles", "Context files"],
  ["allowedFiles", "Files allowed to edit"],
  ["forbiddenFiles", "Files forbidden to edit"],
  ["steps", "Steps"],
  ["acceptanceCriteria", "Acceptance criteria"],
  ["correctnessAssumptions", "Correctness assumptions"],
  ["invariants", "Invariants"],
  ["requiredEvidence", "Required evidence"],
  ["reviewQuestions", "Review questions"],
  ["counterexampleSearches", "Counterexample searches"],
  ["verificationCommands", "Verification commands"],
  ["documentationUpdates", "Documentation updates"],
  ["notes", "Notes"],
];

function requireOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
  issues: string[],
): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  issues.push(`${label} must be one of: ${allowed.join(", ")}.`);
  return allowed[0];
}

type ListParseMode = "prose" | "single-line";

function indentationColumns(value: string): number {
  let columns = 0;
  for (const character of value) {
    columns += character === "\t" ? 4 - (columns % 4) : 1;
  }
  return columns;
}

function removeIndentColumns(line: string, columnsToRemove: number): string {
  let columns = 0;
  let index = 0;
  while (index < line.length && columns < columnsToRemove) {
    const character = line[index];
    if (character !== " " && character !== "\t") {
      break;
    }
    columns += character === "\t" ? 4 - (columns % 4) : 1;
    index += 1;
  }

  return `${" ".repeat(Math.max(0, columns - columnsToRemove))}${line.slice(index)}`;
}

function parseList(
  text: string,
  section: string,
  mode: ListParseMode = "prose",
): string[] {
  const lines = text.split("\n");
  const marker = (line: string): { indent: number; content: string } | undefined => {
    const leading = /^[ \t]*/.exec(line)?.[0] ?? "";
    const match = /^(?:-\s+|\d+\.\s+)(.*)$/.exec(line.slice(leading.length));
    return match
      ? { indent: indentationColumns(leading), content: match[1].trim() }
      : undefined;
  };
  const markerIndents = lines
    .map((line) => marker(line)?.indent)
    .filter((indent): indent is number => indent !== undefined);
  if (mode === "prose" && markerIndents.length === 0) {
    const plainText = text.trim();
    return plainText.length > 0 ? [plainText] : [];
  }
  const baseIndent = markerIndents.length > 0 ? Math.min(...markerIndents) : 0;
  const items: string[] = [];
  let current: string[] | undefined;
  let pendingBlankLines = 0;

  const fail = (lineNumber: number, reason: string): never => {
    throw new TaskFormatError([`Section "${section}" line ${lineNumber} ${reason}`]);
  };
  const flush = (): void => {
    if (!current) {
      return;
    }
    const value = current.join("\n").trim();
    const normalized = value.replace(/^`(.+)`$/, "$1").trim();
    if (normalized.length > 0) {
      items.push(normalized);
    }
    current = undefined;
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const parsedMarker = marker(line);
    if (line.trim().length === 0) {
      if (current) {
        pendingBlankLines += 1;
      }
      return;
    }

    if (parsedMarker && parsedMarker.indent <= baseIndent) {
      flush();
      current = [parsedMarker.content];
      pendingBlankLines = 0;
      return;
    }

    if (mode === "single-line") {
      fail(
        lineNumber,
        `must keep each ${section === "Verification" ? "JSON check" : "entry"} on a single physical list line; multiline continuation is unsupported.`,
      );
    }

    if (!current) {
      fail(lineNumber, "must start with a bullet or numbered list item.");
    }
    const currentItem = current!;

    const leading = /^[ \t]*/.exec(line)?.[0] ?? "";
    const indent = indentationColumns(leading);
    if (indent < baseIndent + 2) {
      fail(
        lineNumber,
        `has unsupported continuation indentation; indent continuation content at least two columns deeper than the shallowest list marker.`,
      );
    }
    if (pendingBlankLines > 1) {
      fail(lineNumber, "has more than one blank line before a continuation; use one blank line for a paragraph break.");
    }

    if (pendingBlankLines === 1) {
      currentItem.push("");
    }
    currentItem.push(removeIndentColumns(line, baseIndent + 2));
    pendingBlankLines = 0;
  });

  flush();
  return items;
}

function parseSteps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^\d+\.\s+/, ""))
    .filter((line) => line.length > 0);
}

function parseCsv(text: string): string[] {
  if (text === "none") {
    return [];
  }

  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function renderCsv(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.join(",");
}

function renderList(
  items: readonly string[],
  section: string,
  mode: ListParseMode = "prose",
): string {
  return items.map((item) => {
    if (mode === "single-line" && /[\r\n]/.test(item)) {
      throw new TaskFormatError([`Section "${section}" must keep each entry on one physical list line.`]);
    }

    const lines = item.split(/\r\n|\n|\r/);
    return lines
      .map((line, index) => index === 0 ? `- ${line}` : line.length === 0 ? "" : `  ${line}`)
      .join("\n");
  }).join("\n");
}

function renderSteps(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function renderVerification(checks: readonly TaskVerificationCheck[]): string {
  return checks
    .map((check) => `- \`${JSON.stringify(check)}\``)
    .join("\n");
}

function addVerificationIssue(
  issues: string[],
  checkNumber: number,
  message: string,
): void {
  issues.push(`Verification check ${checkNumber} ${message}`);
}

function parseVerificationBoolean(
  value: unknown,
  checkNumber: number,
  issues: string[],
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  addVerificationIssue(issues, checkNumber, "required must be true or false.");
  return false;
}

function parseVerificationString(
  value: unknown,
  field: string,
  checkNumber: number,
  issues: string[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    addVerificationIssue(issues, checkNumber, `${field} must be a non-empty string when provided.`);
    return undefined;
  }

  return value;
}

function validateVerificationReference(
  value: string | undefined,
  field: "artifact" | "evidence" | "evidenceRef",
  checkNumber: number,
  issues: string[],
): void {
  if (value === undefined) return;
  if (/[\r\n]/.test(value)) {
    addVerificationIssue(issues, checkNumber, `${field} must be a single-line short locator/reference; put narrative context in summary or Notes.`);
  }
  if (value.length > TASK_VERIFICATION_REFERENCE_MAX_LENGTH) {
    addVerificationIssue(issues, checkNumber, `${field} is a short locator/reference and must be at most ${TASK_VERIFICATION_REFERENCE_MAX_LENGTH} characters; put narrative context in summary or Notes.`);
  }
}

function validateVerificationSummary(
  value: string | undefined,
  checkNumber: number,
  issues: string[],
): void {
  if (value === undefined) return;
  if (/[\r\n]/.test(value)) {
    addVerificationIssue(issues, checkNumber, "summary must be single-line; use Notes for multiline narrative.");
  }
  if (value.length > TASK_VERIFICATION_SUMMARY_MAX_LENGTH) {
    addVerificationIssue(issues, checkNumber, `summary must be at most ${TASK_VERIFICATION_SUMMARY_MAX_LENGTH} characters.`);
  }
}

function parseVerificationCheck(
  value: unknown,
  checkNumber: number,
  issues: string[],
): TaskVerificationCheck | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addVerificationIssue(issues, checkNumber, "must be a JSON object.");
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const id = parseVerificationString(raw.id, "id", checkNumber, issues) ?? `check-${checkNumber}`;
  const type = raw.type;
  const environment = raw.environment;
  const profile = raw.profile;

  if (!(TASK_VERIFICATION_TYPES as readonly unknown[]).includes(type)) {
    addVerificationIssue(issues, checkNumber, `type must be one of: ${TASK_VERIFICATION_TYPES.join(", ")}.`);
  }
  if (!(TASK_VERIFICATION_ENVIRONMENTS as readonly unknown[]).includes(environment)) {
    addVerificationIssue(issues, checkNumber, `environment must be one of: ${TASK_VERIFICATION_ENVIRONMENTS.join(", ")}.`);
  }
  if (!(TASK_VERIFICATION_PROFILES as readonly unknown[]).includes(profile)) {
    addVerificationIssue(issues, checkNumber, `profile must be one of: ${TASK_VERIFICATION_PROFILES.join(", ")}.`);
  }

  const command = parseVerificationString(raw.command, "command", checkNumber, issues);
  const instruction = parseVerificationString(raw.instruction, "instruction", checkNumber, issues);
  const artifact = parseVerificationString(raw.artifact, "artifact", checkNumber, issues);
  const evidence = parseVerificationString(raw.evidence, "evidence", checkNumber, issues);
  const evidenceRef = parseVerificationString(raw.evidenceRef, "evidenceRef", checkNumber, issues);
  const summary = parseVerificationString(raw.summary, "summary", checkNumber, issues);
  const evidenceType = parseVerificationString(raw.evidenceType, "evidenceType", checkNumber, issues);
  const apkOperation = parseVerificationString(raw.apkOperation, "apkOperation", checkNumber, issues);
  const validApkOperation = apkOperation !== undefined
    && (TASK_APK_OPERATIONS as readonly string[]).includes(apkOperation);

  if (apkOperation !== undefined && !validApkOperation) {
    addVerificationIssue(issues, checkNumber, `apkOperation must be one of: ${TASK_APK_OPERATIONS.join(", ")}.`);
  }

  validateVerificationReference(artifact, "artifact", checkNumber, issues);
  validateVerificationReference(evidence, "evidence", checkNumber, issues);
  validateVerificationReference(evidenceRef, "evidenceRef", checkNumber, issues);
  validateVerificationSummary(summary, checkNumber, issues);
  if (evidence !== undefined && evidenceRef !== undefined) {
    addVerificationIssue(
      issues,
      checkNumber,
      "evidence and evidenceRef are incompatible aliases; provide only evidenceRef (or legacy evidence), and put narrative context in summary or Notes.",
    );
  }

  if (evidenceType !== undefined && evidenceType !== "benchmark") {
    addVerificationIssue(issues, checkNumber, 'evidenceType must be "benchmark" when provided.');
  }
  if (evidenceType === "benchmark" && (type !== "automated" || (environment !== "local" && environment !== "static"))) {
    addVerificationIssue(issues, checkNumber, 'evidenceType "benchmark" requires an automated check in a local or static environment.');
  }

  if (type === "automated" && !command && !validApkOperation) {
    addVerificationIssue(issues, checkNumber, "automated checks require command or a valid apkOperation.");
  }
  if (type === "manual" && !instruction) {
    addVerificationIssue(issues, checkNumber, "manual checks require instruction.");
  }
  if (apkOperation && type !== "automated") {
    addVerificationIssue(issues, checkNumber, "apkOperation requires type automated.");
  }
  if (apkOperation && environment !== "local") {
    addVerificationIssue(issues, checkNumber, "apkOperation requires environment local.");
  }
  if (apkOperation && command) {
    addVerificationIssue(issues, checkNumber, "command and apkOperation are mutually exclusive.");
  }
  if (command && instruction) {
    addVerificationIssue(issues, checkNumber, "must define command or instruction, not both.");
  }

  return {
    id,
    type: type as TaskVerificationType,
    required: parseVerificationBoolean(raw.required, checkNumber, issues),
    environment: environment as TaskVerificationEnvironment,
    profile: profile as TaskVerificationProfile,
    ...(evidenceType === "benchmark" ? { evidenceType } : {}),
    ...(validApkOperation ? { apkOperation: apkOperation as TaskApkOperation } : {}),
    ...(command ? { command } : {}),
    ...(instruction ? { instruction } : {}),
    ...(artifact ? { artifact } : {}),
    ...(evidence ? { evidence } : {}),
    ...(evidenceRef ? { evidenceRef } : {}),
    ...(summary ? { summary } : {}),
  };
}

function parseStructuredVerification(
  text: string,
  issues: string[],
): TaskVerificationCheck[] {
  const entries = parseList(text, "Verification", "single-line");
  const checks: TaskVerificationCheck[] = [];
  const ids = new Set<string>();

  entries.forEach((entry, index) => {
    let value: unknown;
    try {
      value = JSON.parse(entry);
    } catch (error: unknown) {
      addVerificationIssue(
        issues,
        index + 1,
        `must be valid JSON (${error instanceof Error ? error.message : String(error)}).`,
      );
      return;
    }

    const check = parseVerificationCheck(value, index + 1, issues);
    if (!check) {
      return;
    }
    if (ids.has(check.id)) {
      addVerificationIssue(issues, index + 1, `id "${check.id}" must be unique.`);
    }
    ids.add(check.id);
    checks.push(check);
  });

  if (checks.length === 0) {
    issues.push("Verification must include at least one check.");
  }

  return checks;
}

export function normalizeVerificationCommands(
  commands: readonly string[],
): TaskVerificationCheck[] {
  return commands.map((command, index) => ({
    id: `check-${index + 1}`,
    type: "automated",
    required: true,
    environment: "local",
    profile: "deterministic",
    command,
  }));
}

export function getTaskVerification(task: ProjectTask): TaskVerificationCheck[] {
  return task.verification ?? normalizeVerificationCommands(task.verificationCommands);
}

function verificationCommandsFromChecks(checks: readonly TaskVerificationCheck[]): string[] {
  return checks
    .filter((check) => check.type === "automated" && check.command)
    .map((check) => check.command!);
}

function readRequiredMetadata(
  lines: readonly string[],
  label: string,
  issues: string[],
): string {
  const prefix = `${label}:`;
  const line = lines.find((entry) => entry.startsWith(prefix));

  if (!line) {
    issues.push(`${label} is required.`);
    return "";
  }

  const value = line.slice(prefix.length).trim();
  if (value.length === 0) {
    issues.push(`${label} must not be empty.`);
  }

  return value;
}

function parseSections(lines: readonly string[], issues: string[]): Partial<Record<SectionKey, string>> {
  const sections: Partial<Record<SectionKey, string>> = {};
  const seenSections = new Set<SectionKey>();
  let current: SectionKey | undefined;
  let buffer: string[] = [];

  function flush(): void {
    if (current) {
      const sectionLines = [...buffer];
      while (sectionLines[0]?.trim().length === 0) {
        sectionLines.shift();
      }
      while (sectionLines.at(-1)?.trim().length === 0) {
        sectionLines.pop();
      }
      sections[current] = sectionLines.join("\n");
    }
  }

  function reportUnsupportedHeading(lineNumber: number, title: string): void {
    const boundedTitle = title.length > 80 ? `${title.slice(0, 77)}...` : title;
    issues.push(`Unsupported task section heading at line ${lineNumber}: ${JSON.stringify(boundedTitle)}.`);
  }

  for (const [index, line] of lines.entries()) {
    const markdownHeading = /^( {0,3})(#{1,6})(?:[ \t]+|$)(.*)$/.exec(line);
    if (line.startsWith("## ")) {
      flush();
      const title = line.slice(3).trim();
      const section = SECTION_TITLES[title];
      if (!section) {
        reportUnsupportedHeading(index + 1, title);
        current = undefined;
      } else if (seenSections.has(section)) {
        issues.push(`Duplicate task section heading at line ${index + 1}: ${JSON.stringify(title)}.`);
        current = undefined;
      } else {
        seenSections.add(section);
        current = section;
      }
      buffer = [];
      continue;
    }

    if (line.startsWith("##\t") || (!current && index > 0 && markdownHeading)) {
      reportUnsupportedHeading(index + 1, line.startsWith("##\t")
        ? line.slice(3).trim()
        : markdownHeading?.[3]?.trim() ?? "");
      current = undefined;
      buffer = [];
      continue;
    }

    if (current) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function requireSection(
  sections: Partial<Record<SectionKey, string>>,
  key: SectionKey,
  title: string,
  issues: string[],
): string {
  const section = sections[key];

  if (section === undefined) {
    issues.push(`Section "${title}" is required.`);
    return "";
  }

  return section;
}

function parseBoolean(value: string, issues: string[]): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  issues.push("Parallel must be true or false.");
  return false;
}

function defaultLane(mode: TaskMode): string {
  if (mode === "adopt") {
    return "adoption";
  }

  if (mode === "discovery") {
    return "planning";
  }

  return "implementation";
}

function normalizeLegacyState(value: string): string {
  return value === "in-progress" ? "doing" : value;
}

export function parseTaskMarkdown(markdown: string): ProjectTask {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const issues: string[] = [];
  const heading = lines[0]?.trim() ?? "";
  const headingMatch = /^# Task ([^\s]+) - (.+)$/.exec(heading);

  if (!headingMatch) {
    issues.push('Heading must match "# Task <id> - <title>".');
  }

  const stateValue = lines.some((line) => line.startsWith("State:"))
    ? readRequiredMetadata(lines, "State", issues)
    : normalizeLegacyState(readRequiredMetadata(lines, "Status", issues));
  const ownerValue = lines.some((line) => line.startsWith("Owner:"))
    ? readRequiredMetadata(lines, "Owner", issues)
    : "none";
  const modeValue = readRequiredMetadata(lines, "Mode", issues);
  const riskValue = readRequiredMetadata(lines, "Risk", issues);
  const dependsOnValue = readRequiredMetadata(lines, "Depends on", issues);
  const state = requireOneOf(stateValue, TASK_STATES, "State", issues);
  const mode = requireOneOf(modeValue, TASK_MODES, "Mode", issues);
  const sections = parseSections(lines, issues);
  const scope = lines.some((line) => line.startsWith("Scope:"))
    ? parseCsv(readRequiredMetadata(lines, "Scope", issues))
    : [];
  const tags = lines.some((line) => line.startsWith("Tags:"))
    ? parseCsv(readRequiredMetadata(lines, "Tags", issues))
    : [];
  const hasStructuredVerification = sections.verification !== undefined;
  const hasLegacyVerification = sections.verificationCommands !== undefined;
  if (!hasStructuredVerification && !hasLegacyVerification) {
    issues.push('Section "Verification" or "Verification commands" is required.');
  }
  const verification = hasStructuredVerification
    ? parseStructuredVerification(sections.verification ?? "", issues)
    : normalizeVerificationCommands(parseList(sections.verificationCommands ?? "", "Verification commands"));
  const verificationCommands = verificationCommandsFromChecks(verification);
  const optionalLists = {
    correctnessAssumptions: sections.correctnessAssumptions === undefined
      ? undefined
      : parseList(sections.correctnessAssumptions, "Correctness assumptions"),
    invariants: sections.invariants === undefined ? undefined : parseList(sections.invariants, "Invariants"),
    requiredEvidence: sections.requiredEvidence === undefined ? undefined : parseList(sections.requiredEvidence, "Required evidence"),
    reviewQuestions: sections.reviewQuestions === undefined ? undefined : parseList(sections.reviewQuestions, "Review questions"),
    counterexampleSearches: sections.counterexampleSearches === undefined
      ? undefined
      : parseList(sections.counterexampleSearches, "Counterexample searches"),
  };

  const task: ProjectTask = {
    id: headingMatch?.[1] ?? "",
    title: headingMatch?.[2] ?? "",
    state,
    owner: ownerValue,
    mode,
    lane: lines.some((line) => line.startsWith("Lane:"))
      ? readRequiredMetadata(lines, "Lane", issues)
      : defaultLane(mode),
    ...(lines.some((line) => line.startsWith("Type:"))
      ? { type: readRequiredMetadata(lines, "Type", issues) }
      : {}),
    scope,
    risk: requireOneOf(riskValue, TASK_RISKS, "Risk", issues),
    parallel: lines.some((line) => line.startsWith("Parallel:"))
      ? parseBoolean(readRequiredMetadata(lines, "Parallel", issues), issues)
      : false,
    dependsOn: parseCsv(dependsOnValue),
    tags,
    goal: requireSection(sections, "goal", "Goal", issues).trim(),
    contextFiles: parseList(
      requireSection(sections, "contextFiles", "Context files", issues),
      "Context files",
      "single-line",
    ),
    allowedFiles: parseList(
      requireSection(sections, "allowedFiles", "Files allowed to edit", issues),
      "Files allowed to edit",
      "single-line",
    ),
    forbiddenFiles: parseList(
      requireSection(
        sections,
        "forbiddenFiles",
        "Files forbidden to edit",
        issues,
      ),
      "Files forbidden to edit",
      "single-line",
    ),
    steps: parseSteps(requireSection(sections, "steps", "Steps", issues)),
    acceptanceCriteria: parseList(
      requireSection(sections, "acceptanceCriteria", "Acceptance criteria", issues),
      "Acceptance criteria",
    ),
    ...(optionalLists.correctnessAssumptions && optionalLists.correctnessAssumptions.length > 0
      ? { correctnessAssumptions: optionalLists.correctnessAssumptions } : {}),
    ...(optionalLists.invariants && optionalLists.invariants.length > 0
      ? { invariants: optionalLists.invariants } : {}),
    ...(optionalLists.requiredEvidence && optionalLists.requiredEvidence.length > 0
      ? { requiredEvidence: optionalLists.requiredEvidence } : {}),
    ...(optionalLists.reviewQuestions && optionalLists.reviewQuestions.length > 0
      ? { reviewQuestions: optionalLists.reviewQuestions } : {}),
    ...(optionalLists.counterexampleSearches && optionalLists.counterexampleSearches.length > 0
      ? { counterexampleSearches: optionalLists.counterexampleSearches } : {}),
    ...(hasStructuredVerification ? { verification } : {}),
    verificationCommands,
    documentationUpdates: parseList(
      requireSection(
        sections,
        "documentationUpdates",
        "Documentation updates",
        issues,
      ),
      "Documentation updates",
    ),
    notes: parseList(requireSection(sections, "notes", "Notes", issues), "Notes"),
  };

  if (task.dependsOn.length === 0 && dependsOnValue !== "none") {
    issues.push('Depends on must be "none" or a comma-separated task id list.');
  }

  if (task.owner.length === 0) {
    issues.push("Owner must not be empty.");
  }

  if ((task.state === "doing" || task.state === "review") && task.owner === "none") {
    issues.push("Owner must be registered agent id for doing or review tasks.");
  }

  if (task.owner === "none" && !["todo", "blocked", "canceled"].includes(task.state)) {
    issues.push("Owner none is only allowed for todo, blocked, or canceled tasks.");
  }

  if (task.goal.length === 0) {
    issues.push("Goal must not be empty.");
  }

  if (task.lane.length === 0) {
    issues.push("Lane must not be empty.");
  }

  if (task.contextFiles.length === 0) {
    issues.push("Context files must include at least one item.");
  }

  if (verification.length === 0 && !hasStructuredVerification) {
    issues.push("Verification commands must include at least one item.");
  }

  if (issues.length > 0) {
    throw new TaskFormatError(issues);
  }

  return task;
}

export function renderTaskMarkdown(task: ProjectTask): string {
  const verification = getTaskVerification(task);
  const sectionOrder = SECTION_ORDER.filter(([key]) => (
    key !== "verification" &&
    key !== "verificationCommands" &&
    (!([
      "correctnessAssumptions",
      "invariants",
      "requiredEvidence",
      "reviewQuestions",
      "counterexampleSearches",
    ] as string[]).includes(key) || ((task[key] as string[] | undefined)?.length ?? 0) > 0)
  ));
  const verificationIndex = sectionOrder.findIndex(([key]) => key === "documentationUpdates");
  sectionOrder.splice(verificationIndex, 0, [
    task.verification === undefined ? "verificationCommands" : "verification",
    task.verification === undefined ? "Verification commands" : "Verification",
  ]);
  const sections = sectionOrder.map(([key, title]) => {
    const value = task[key];
    const content = key === "goal"
      ? task.goal
      : key === "steps"
        ? renderSteps(value as string[])
        : key === "verification"
          ? renderVerification(verification)
          : renderList(
            value as string[],
            title,
            (["contextFiles", "allowedFiles", "forbiddenFiles"] as SectionKey[]).includes(key)
              ? "single-line"
              : "prose",
          );

    return [`## ${title}`, "", content].join("\n");
  });

  return [
    `# Task ${task.id} - ${task.title}`,
    "",
    `State: ${task.state}`,
    `Owner: ${task.owner}`,
    `Mode: ${task.mode}`,
    `Lane: ${task.lane}`,
    ...(task.type ? [`Type: ${task.type}`] : []),
    `Scope: ${renderCsv(task.scope)}`,
    `Risk: ${task.risk}`,
    `Parallel: ${task.parallel ? "true" : "false"}`,
    `Depends on: ${renderCsv(task.dependsOn)}`,
    `Tags: ${renderCsv(task.tags)}`,
    "",
    sections.join("\n\n"),
    "",
  ].join("\n");
}

function taskSortValue(task: ProjectTask): number {
  const numeric = Number.parseInt(task.id, 10);
  return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : numeric;
}

export async function loadTaskFile(path: string): Promise<ProjectTaskFile> {
  return {
    path,
    task: parseTaskMarkdown(await readFile(path, "utf8")),
  };
}

export async function writeTaskFile(path: string, task: ProjectTask): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderTaskMarkdown(task), "utf8");
}

export async function listTaskFiles(
  rootDirectory: string,
  taskDirectory = ".tasks",
): Promise<ProjectTaskFile[]> {
  const directory = join(rootDirectory, taskDirectory);
  const entries = await readdir(directory).catch(() => []);
  const files: ProjectTaskFile[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    files.push(await loadTaskFile(join(directory, entry)));
  }

  return files.sort((left, right) => {
    const byId = taskSortValue(left.task) - taskSortValue(right.task);
    return byId === 0 ? left.path.localeCompare(right.path) : byId;
  });
}

export async function listArchivedTaskFiles(
  rootDirectory: string,
  taskDirectory = ".tasks",
  excludedPaths: readonly string[] = [],
): Promise<ProjectTaskFile[]> {
  const archiveDirectory = join(rootDirectory, taskDirectory, "archive");
  const excluded = new Set(excludedPaths.map((path) => normalizeRepoPath(path)));
  const entries = await readdir(archiveDirectory).catch(() => []);
  const files: ProjectTaskFile[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    const path = join(archiveDirectory, entry);
    if (!excluded.has(normalizeRepoPath(path))) files.push(await loadTaskFile(path));
  }

  return files.sort((left, right) => {
    const byId = taskSortValue(left.task) - taskSortValue(right.task);
    return byId === 0 ? left.path.localeCompare(right.path) : byId;
  });
}

export async function allTaskFiles(
  rootDirectory: string,
  taskDirectory = ".tasks",
): Promise<ProjectTaskFile[]> {
  const [active, archived] = await Promise.all([
    listTaskFiles(rootDirectory, taskDirectory),
    listArchivedTaskFiles(rootDirectory, taskDirectory),
  ]);
  return [...active, ...archived].sort((left, right) => {
    const byId = taskSortValue(left.task) - taskSortValue(right.task);
    return byId === 0 ? left.path.localeCompare(right.path) : byId;
  });
}

export interface TaskArchiveResult {
  taskId: string;
  sourcePath: string;
  archivePath: string;
}

export type TaskArchiveReferenceKind = "active-task" | "immutable-history" | "tracked-text";

export interface TaskArchiveReference {
  path: string;
  line: number;
  literal: string;
  kind: TaskArchiveReferenceKind;
}

export interface TaskArchivePlan {
  taskId: string;
  state: TaskState;
  sourcePath: string;
  archivePath: string;
  dependents: DepEdge[];
  references: TaskArchiveReference[];
  blockers: string[];
  canArchive: boolean;
}

export interface TaskArchivePreviewResult {
  plans: TaskArchivePlan[];
}

export interface TaskArchiveAllResult {
  archived: TaskArchiveResult[];
  skipped: TaskArchivePlan[];
}

function isArchiveTerminalState(state: TaskState): boolean {
  return state === "done" || state === "canceled";
}

function archiveRelativePath(rootDirectory: string, path: string): string {
  return relative(rootDirectory, path).replace(/\\/g, "/");
}

function archiveReferenceKind(
  path: string,
  rootDirectory: string,
  taskDirectory: string,
  activeFiles: readonly ProjectTaskFile[],
): TaskArchiveReferenceKind {
  const normalized = normalizeRepoPath(path);
  const activeTaskPaths = new Set(activeFiles.map((file) => archiveRelativePath(rootDirectory, file.path)));
  if (activeTaskPaths.has(normalized)) return "active-task";
  const normalizedTaskDirectory = normalizeRepoPath(taskDirectory).replace(/\/$/, "");
  if (
    normalized.startsWith(`${normalizedTaskDirectory}/archive/`)
    || normalized.startsWith("docs/releases/")
    || normalized.startsWith("docs/history/")
  ) {
    return "immutable-history";
  }
  return "tracked-text";
}

interface ArchiveReferenceScanResult {
  references: Map<string, TaskArchiveReference[]>;
  blockers: string[];
}

function archiveErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; stderr?: unknown };
    const stderr = typeof candidate.stderr === "string" ? candidate.stderr.trim() : "";
    if (stderr) return stderr;
    if (typeof candidate.message === "string") return candidate.message;
  }
  return String(error);
}

function isIntentionalNonGitError(error: unknown): boolean {
  return /not a git repository|not a git repo/i.test(archiveErrorMessage(error));
}

async function listFallbackArchiveReferencePaths(
  rootDirectory: string,
  activeFiles: readonly ProjectTaskFile[],
): Promise<string[]> {
  const paths = new Set(activeFiles.map((file) => archiveRelativePath(rootDirectory, file.path)));
  let discovered = paths.size;
  let directories = 0;

  async function visit(directory: string, relativeDirectory: string, depth: number): Promise<void> {
    directories += 1;
    if (directories > MAX_ARCHIVE_REFERENCE_DIRECTORIES) {
      throw new Error(`Archive reference scan exceeds the ${MAX_ARCHIVE_REFERENCE_DIRECTORIES}-directory safety limit while walking a non-Git directory.`);
    }
    if (depth > MAX_ARCHIVE_REFERENCE_DEPTH) {
      throw new Error(`Archive reference scan exceeds the ${MAX_ARCHIVE_REFERENCE_DEPTH}-level depth safety limit while walking a non-Git directory.`);
    }
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!relativeDirectory && [".git", "node_modules"].includes(entry.name)) continue;
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Archive reference scan cannot inspect symbolic link ${relativePath}; scan fails closed.`);
      }
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath, depth + 1);
        continue;
      }
      if (!paths.has(normalizeRepoPath(relativePath))) discovered += 1;
      if (discovered > MAX_ARCHIVE_REFERENCE_FILES) {
        throw new Error(`Archive reference scan exceeds the ${MAX_ARCHIVE_REFERENCE_FILES}-file safety limit while walking a non-Git directory.`);
      }
      paths.add(normalizeRepoPath(relativePath));
    }
  }

  await visit(rootDirectory, "", 0);
  return [...paths].sort();
}

async function listArchiveReferencePaths(
  rootDirectory: string,
  taskDirectory: string,
  activeFiles: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[],
): Promise<string[]> {
  let isGitRepository = false;
  try {
    const result = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDirectory,
      encoding: "utf8",
      maxBuffer: 1024,
      windowsHide: true,
    });
    isGitRepository = result.stdout.trim() === "true";
  } catch (error: unknown) {
    if (isIntentionalNonGitError(error)) {
      return listFallbackArchiveReferencePaths(rootDirectory, activeFiles);
    }
    throw new Error(`Archive reference scan cannot determine repository state: ${archiveErrorMessage(error)}`);
  }

  if (!isGitRepository) return listFallbackArchiveReferencePaths(rootDirectory, activeFiles);

  const [tracked, untracked] = await Promise.all([
    gitPaths(rootDirectory, ["ls-files", "--cached", "-z"]),
    gitPaths(rootDirectory, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const activePaths = activeFiles.map((file) => archiveRelativePath(rootDirectory, file.path));
  const archivedPaths = archivedFiles.map((file) => archiveRelativePath(rootDirectory, file.path));
  const candidates = [...new Set([...tracked, ...untracked, ...activePaths, ...archivedPaths].map(normalizeGitPath))].sort();
  const normalizedTaskDirectory = normalizeRepoPath(taskDirectory).replace(/\/$/, "");
  const resolved: string[] = [];
  for (const candidate of candidates) {
    if (await pathExists(join(rootDirectory, candidate))) {
      resolved.push(candidate);
      continue;
    }
    const prefix = `${normalizedTaskDirectory}/`;
    if (!candidate.startsWith(prefix) || candidate.startsWith(`${prefix}archive/`)) {
      resolved.push(candidate);
      continue;
    }
    const archiveCandidate = `${prefix}archive/${candidate.slice(prefix.length)}`;
    resolved.push(await pathExists(join(rootDirectory, archiveCandidate)) ? archiveCandidate : candidate);
  }
  return resolved;
}

function lineNumberAtOffset(bytes: Buffer, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (bytes[index] === 0x0a) line += 1;
  }
  return line;
}

async function scanArchiveReferences(
  rootDirectory: string,
  taskDirectory: string,
  candidates: readonly ProjectTaskFile[],
  activeFiles: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[],
): Promise<ArchiveReferenceScanResult> {
  const references = new Map<string, TaskArchiveReference[]>();
  const blockers: string[] = [];
  if (candidates.length === 0) return { references, blockers };

  let trackedPaths: string[];
  try {
    trackedPaths = await listArchiveReferencePaths(rootDirectory, taskDirectory, activeFiles, archivedFiles);
  } catch (error: unknown) {
    blockers.push(archiveErrorMessage(error));
    trackedPaths = activeFiles.map((file) => archiveRelativePath(rootDirectory, file.path)).sort();
  }
  if (trackedPaths.length > MAX_ARCHIVE_REFERENCE_FILES) {
    blockers.push(`Archive reference scan exceeds the ${MAX_ARCHIVE_REFERENCE_FILES}-file safety limit.`);
    trackedPaths = trackedPaths.slice(0, MAX_ARCHIVE_REFERENCE_FILES);
  }

  const tokens = candidates.map((file) => {
    const sourcePath = archiveRelativePath(rootDirectory, file.path);
    const fileName = sourcePath.split("/").pop()!;
    const taskPath = `${normalizeRepoPath(taskDirectory).replace(/\/$/, "")}/${fileName}`;
    return {
      taskId: file.task.id,
      sourcePath,
      literals: [taskPath, taskPath.replace(/\//g, "\\")],
    };
  });
  let totalBytes = 0;
  let matchCount = 0;

  for (const trackedPath of trackedPaths) {
    const absolutePath = join(rootDirectory, trackedPath);
    let size: number;
    try {
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        blockers.push(`Archive reference scan cannot inspect symbolic link ${trackedPath}; scan fails closed.`);
        continue;
      }
      size = metadata.size;
    } catch (error: unknown) {
      blockers.push(`Archive reference scan cannot inspect ${trackedPath}: ${archiveErrorMessage(error)}`);
      continue;
    }
    if (size > MAX_ARCHIVE_REFERENCE_FILE_BYTES) {
      blockers.push(`Archive reference scan cannot inspect ${trackedPath}; file exceeds the ${MAX_ARCHIVE_REFERENCE_FILE_BYTES}-byte safety limit.`);
      continue;
    }
    totalBytes += size;
    if (totalBytes > MAX_ARCHIVE_REFERENCE_TOTAL_BYTES) {
      blockers.push(`Archive reference scan exceeds the ${MAX_ARCHIVE_REFERENCE_TOTAL_BYTES}-byte safety limit.`);
      break;
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(absolutePath);
    } catch (error: unknown) {
      blockers.push(`Archive reference scan cannot read ${trackedPath}: ${archiveErrorMessage(error)}`);
      continue;
    }
    for (const token of tokens) {
      if (normalizeRepoPath(trackedPath) === normalizeRepoPath(token.sourcePath)) continue;
      for (const literal of token.literals) {
        const needle = Buffer.from(literal, "utf8");
        let offset = bytes.indexOf(needle);
        while (offset >= 0) {
          matchCount += 1;
          if (matchCount > MAX_ARCHIVE_REFERENCE_MATCHES) {
            blockers.push(`Archive reference scan exceeds the ${MAX_ARCHIVE_REFERENCE_MATCHES}-match safety limit.`);
            break;
          }
          const line = lineNumberAtOffset(bytes, offset);
          const existing = references.get(token.taskId) ?? [];
          if (!existing.some((reference) => reference.path === trackedPath && reference.line === line && reference.literal === literal)) {
            existing.push({
              path: trackedPath,
              line,
              literal,
              kind: archiveReferenceKind(trackedPath, rootDirectory, taskDirectory, activeFiles),
            });
            references.set(token.taskId, existing);
          }
          offset = bytes.indexOf(needle, offset + needle.length);
        }
        if (matchCount > MAX_ARCHIVE_REFERENCE_MATCHES) break;
      }
      if (matchCount > MAX_ARCHIVE_REFERENCE_MATCHES) break;
    }
    if (matchCount > MAX_ARCHIVE_REFERENCE_MATCHES) break;
  }

  return { references, blockers: [...new Set(blockers)] };
}

function archivePlanError(plan: TaskArchivePlan): Error {
  return new Error([
    `Task ${plan.taskId} cannot be archived safely.`,
    ...plan.blockers.map((blocker) => `- ${blocker}`),
  ].join("\n"));
}

function archivePlanSafetySignature(plan: TaskArchivePlan, taskDirectory: string): string {
  const normalizedTaskDirectory = normalizeRepoPath(taskDirectory).replace(/\/$/, "");
  const canonicalReferencePath = (path: string): string => {
    const normalized = normalizeRepoPath(path);
    const archivePrefix = `${normalizedTaskDirectory}/archive/`;
    return normalized.startsWith(archivePrefix)
      ? `${normalizedTaskDirectory}/${normalized.slice(archivePrefix.length)}`
      : normalized;
  };
  return JSON.stringify({
    taskId: plan.taskId,
    state: plan.state,
    sourcePath: plan.sourcePath,
    archivePath: plan.archivePath,
    canArchive: plan.canArchive,
    references: plan.references.map((reference) => ({
      path: canonicalReferencePath(reference.path),
      line: reference.line,
      literal: reference.literal,
    })),
  });
}

async function fileSha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

/** Move without overwriting a destination; link/unlink preserves the source bytes exactly. */
async function moveArchiveFile(source: string, destination: string): Promise<void> {
  await link(source, destination);
  try {
    await unlink(source);
  } catch (error: unknown) {
    await unlink(destination).catch(() => undefined);
    throw error;
  }
}

export async function previewArchiveTasks(
  rootDirectory: string,
  taskDirectory: string,
  taskIds?: readonly string[],
): Promise<TaskArchivePreviewResult> {
  const activeFiles = await listTaskFiles(rootDirectory, taskDirectory);
  const candidates = taskIds === undefined
    ? activeFiles.filter((file) => isArchiveTerminalState(file.task.state))
    : taskIds.map((taskId) => {
      const file = activeFiles.find((entry) => entry.task.id === taskId);
      if (!file) throw new Error(`Task file not found for id: ${taskId}`);
      return file;
    });
  const archivePathForFile = (file: ProjectTaskFile): string => {
    const sourcePath = archiveRelativePath(rootDirectory, file.path);
    return `${normalizeRepoPath(taskDirectory).replace(/\/$/, "")}/archive/${sourcePath.split("/").pop()!}`;
  };
  const existingArchivePaths: string[] = [];
  for (const candidate of candidates) {
    const archivePath = archivePathForFile(candidate);
    if (await pathExists(join(rootDirectory, archivePath))) existingArchivePaths.push(join(rootDirectory, archivePath));
  }
  let archivedFiles: ProjectTaskFile[] = [];
  const archiveBlockers: string[] = [];
  try {
    archivedFiles = candidates.length === 0
      ? []
      : await listArchivedTaskFiles(rootDirectory, taskDirectory, existingArchivePaths);
  } catch (error: unknown) {
    archiveBlockers.push(`Archive preview cannot parse existing archive files: ${archiveErrorMessage(error)}; repair the archive before moving terminal tasks.`);
  }
  const scan = await scanArchiveReferences(rootDirectory, taskDirectory, candidates, activeFiles, archivedFiles);
  const plans = await Promise.all(candidates.map(async (file): Promise<TaskArchivePlan> => {
    const sourcePath = archiveRelativePath(rootDirectory, file.path);
    const archivePath = archivePathForFile(file);
    const blockers: string[] = [];
    if (!isArchiveTerminalState(file.task.state)) {
      blockers.push(`state is ${file.task.state}; only done or canceled tasks can be archived.`);
    }
    if (await pathExists(join(rootDirectory, archivePath))) {
      blockers.push(`Archive path already exists: ${archivePath}`);
    }
    if (scan.references.has(file.task.id)) {
      for (const reference of scan.references.get(file.task.id)!) {
        blockers.push(`literal reference ${reference.path}:${reference.line} (${reference.kind}) uses ${reference.literal}; retain the task or update the reference in a separate scoped task.`);
      }
    }
    blockers.push(...archiveBlockers);
    blockers.push(...scan.blockers);
    const dependents = findTaskDependents(activeFiles, file.task.id, archivedFiles);
    return {
      taskId: file.task.id,
      state: file.task.state,
      sourcePath,
      archivePath,
      dependents,
      references: scan.references.get(file.task.id) ?? [],
      blockers,
      canArchive: blockers.length === 0,
    };
  }));
  return { plans };
}

async function applyArchiveTasks(
  rootDirectory: string,
  taskDirectory: string,
  taskIds?: readonly string[],
): Promise<TaskArchiveAllResult> {
  return withTaskMutationLock(rootDirectory, taskDirectory, "task archive", undefined, async () => {
    const preview = await previewArchiveTasks(rootDirectory, taskDirectory, taskIds);
    const previewSourceHashes = new Map<string, string>();
    for (const plan of preview.plans.filter((candidate) => candidate.canArchive)) {
      previewSourceHashes.set(plan.taskId, await fileSha256(join(rootDirectory, plan.sourcePath)));
    }
    const finalPreview = await previewArchiveTasks(rootDirectory, taskDirectory, taskIds);
    if (JSON.stringify(preview.plans) !== JSON.stringify(finalPreview.plans)) {
      throw new Error("Archive preview changed before mutation; re-run the preview and apply the current plan.");
    }
    const currentPreview = finalPreview;
    const skipped = currentPreview.plans.filter((plan) => !plan.canArchive);
    if (taskIds !== undefined && taskIds.length === 1 && skipped.length > 0) {
      throw archivePlanError(skipped[0]);
    }
    const archived: TaskArchiveResult[] = [];
    if (currentPreview.plans.some((plan) => plan.canArchive)) {
      await mkdir(join(rootDirectory, taskDirectory, "archive"), { recursive: true });
    }
    const expectedSourceHashes = new Map<string, string>();
    for (const plan of currentPreview.plans.filter((candidate) => candidate.canArchive)) {
      const hash = await fileSha256(join(rootDirectory, plan.sourcePath));
      if (previewSourceHashes.get(plan.taskId) !== hash) {
        throw new Error(`Archive source changed during preview for task ${plan.taskId}; re-run the preview and apply the current plan.`);
      }
      expectedSourceHashes.set(plan.taskId, hash);
    }
    const moved: TaskArchiveResult[] = [];
    try {
      for (const plan of currentPreview.plans.filter((candidate) => candidate.canArchive)) {
        const source = join(rootDirectory, plan.sourcePath);
        const destination = join(rootDirectory, plan.archivePath);
        const latestPlan = await previewArchiveTask(rootDirectory, taskDirectory, plan.taskId);
        if (archivePlanSafetySignature(latestPlan, taskDirectory) !== archivePlanSafetySignature(plan, taskDirectory)) {
          throw new Error(`Archive plan changed before mutation for task ${plan.taskId}; re-run the preview and apply the current plan.`);
        }
        if (!(await pathExists(source))) throw new Error(`Archive source no longer exists: ${plan.sourcePath}`);
        if (await fileSha256(source) !== expectedSourceHashes.get(plan.taskId)) {
          throw new Error(`Archive source changed before mutation: ${plan.sourcePath}`);
        }
        await moveArchiveFile(source, destination);
        const result = { taskId: plan.taskId, sourcePath: plan.sourcePath, archivePath: plan.archivePath };
        moved.push(result);
        archived.push(result);
      }
    } catch (error: unknown) {
      const rollbackErrors: string[] = [];
      for (const result of [...moved].reverse()) {
        try {
          await moveArchiveFile(join(rootDirectory, result.archivePath), join(rootDirectory, result.sourcePath));
        } catch (rollbackError: unknown) {
          rollbackErrors.push(`${result.taskId}: ${archiveErrorMessage(rollbackError)}`);
        }
      }
      if (rollbackErrors.length > 0) {
        throw new Error(`Archive mutation failed: ${archiveErrorMessage(error)}; rollback failed: ${rollbackErrors.join("; ")}`);
      }
      throw error;
    }
    return { archived, skipped };
  });
}

export async function previewArchiveTask(
  rootDirectory: string,
  taskDirectory: string,
  taskId: string,
): Promise<TaskArchivePlan> {
  const result = await previewArchiveTasks(rootDirectory, taskDirectory, [taskId]);
  return result.plans[0];
}

export async function archiveTask(
  rootDirectory: string,
  taskDirectory: string,
  taskId: string,
): Promise<TaskArchiveResult> {
  const result = await applyArchiveTasks(rootDirectory, taskDirectory, [taskId]);
  return result.archived[0];
}

export async function archiveAllTasks(
  rootDirectory: string,
  taskDirectory: string,
): Promise<TaskArchiveAllResult> {
  return applyArchiveTasks(rootDirectory, taskDirectory);
}

export async function findTaskFile(
  rootDirectory: string,
  taskId: string,
  taskDirectory = ".tasks",
): Promise<string> {
  const directory = join(rootDirectory, taskDirectory);
  const entries = await readdir(directory);
  const match = entries.find((entry) => entry.startsWith(`${taskId}-`) && entry.endsWith(".md"));

  if (match) {
    return join(directory, match);
  }

  const archiveDirectory = join(directory, "archive");
  const archiveEntries = await readdir(archiveDirectory).catch(() => []);
  const archiveMatch = archiveEntries.find((entry) =>
    entry.startsWith(`${taskId}-`) && entry.endsWith(".md"),
  );

  if (archiveMatch) {
    return join(archiveDirectory, archiveMatch);
  }

  throw new Error(`Task file not found for id: ${taskId}`);
}

function completedTaskIds(files: readonly ProjectTaskFile[]): Set<string> {
  return new Set(files.filter((file) => file.task.state === "done").map((file) => file.task.id));
}

export function selectNextTask(
  files: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[] = [],
): NextTaskSelection | undefined {
  const completed = new Set([
    ...completedTaskIds(files),
    ...completedTaskIds(archivedFiles),
  ]);
  const next = [...files]
    .sort((left, right) => {
      const byId = taskSortValue(left.task) - taskSortValue(right.task);
      return byId === 0 ? left.path.localeCompare(right.path) : byId;
    })
    .find((file) => (
      file.task.state === "todo" &&
      file.task.dependsOn.every((dependency) => completed.has(dependency))
    ));

  if (!next) {
    return undefined;
  }

  return {
    ...next,
    contextCommand: `pnpm exec apk context ${next.task.id} --level 2`,
  };
}

export function renderTasksTable(files: readonly ProjectTaskFile[]): string {
  const rows = [
    "id    state     owner       lane            risk    par  title",
    ...files.map(({ task }) => [
      task.id.padEnd(5),
      task.state.padEnd(9),
      task.owner.padEnd(11),
      task.lane.padEnd(15),
      task.risk.padEnd(7),
      (task.parallel ? "yes" : "no").padEnd(4),
      task.title,
    ].join(" ")),
  ];

  return `${rows.join("\n")}\n`;
}

export function renderNextTask(selection: NextTaskSelection | undefined): string {
  if (!selection) {
    return "No actionable todo tasks found.\n";
  }

  return [
    `Task: ${selection.task.id}`,
    `Title: ${selection.task.title}`,
    `State: ${selection.task.state}`,
    `Owner: ${selection.task.owner}`,
    `Mode: ${selection.task.mode}`,
    `Lane: ${selection.task.lane}`,
    `Risk: ${selection.task.risk}`,
    `Path: ${selection.path}`,
    `Context: ${selection.contextCommand}`,
    "",
  ].join("\n");
}

export function validateTaskDependencies(
  files: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[] = [],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const allIds = new Set([
    ...files.map((file) => file.task.id),
    ...archivedFiles.map((file) => file.task.id),
  ]);

  for (const file of files) {
    for (const depId of file.task.dependsOn) {
      if (!allIds.has(depId)) {
        issues.push({
          kind: "missing",
          taskId: file.task.id,
          message: `Task ${file.task.id} depends on ${depId}, which does not exist.`,
        });
      }
    }
  }

  const adjList = new Map<string, string[]>();
  for (const file of files) {
    adjList.set(file.task.id, file.task.dependsOn);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function detectCycle(nodeId: string, path: string[]): boolean {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cyclePath = path.slice(cycleStart);
      issues.push({
        kind: "cycle",
        taskId: nodeId,
        message: `Dependency cycle detected: ${[...cyclePath, nodeId].join(" -> ")}.`,
      });
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const deps = adjList.get(nodeId) ?? [];
    for (const depId of deps) {
      if (allIds.has(depId)) {
        detectCycle(depId, path);
      }
    }

    inStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const file of files) {
    detectCycle(file.task.id, []);
  }

  return issues.sort((a, b) => {
    const byTaskId = a.taskId.localeCompare(b.taskId);
    if (byTaskId !== 0) return byTaskId;
    const kindOrder: Record<string, number> = { cycle: 0, missing: 1 };
    const byKind = (kindOrder[a.kind] ?? 0) - (kindOrder[b.kind] ?? 0);
    if (byKind !== 0) return byKind;
    return a.message.localeCompare(b.message);
  });
}

export interface DepEdge {
  id: string;
  title: string;
  state: TaskState;
  archived: boolean;
}

export interface TaskDepsResult {
  id: string;
  title: string;
  state: TaskState;
  path: string;
  prerequisites: DepEdge[];
  dependents: DepEdge[];
  missingDeps: string[];
  cycleIssues: string[];
}

export function findTaskDependents(
  files: readonly ProjectTaskFile[],
  taskId: string,
  archivedFiles: readonly ProjectTaskFile[] = [],
): DepEdge[] {
  return [...files, ...archivedFiles]
    .filter((file) => file.task.dependsOn.includes(taskId))
    .map((file) => ({
      id: file.task.id,
      title: file.task.title,
      state: file.task.state,
      archived: archivedFiles.some((a) => a.task.id === file.task.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildTaskDeps(
  files: readonly ProjectTaskFile[],
  taskId: string,
  filePath: string,
  archivedFiles: readonly ProjectTaskFile[] = [],
): TaskDepsResult | undefined {
  const file = files.find((f) => f.task.id === taskId)
    ?? archivedFiles.find((f) => f.task.id === taskId);
  if (!file) {
    return undefined;
  }

  const allIds = new Set([
    ...files.map((f) => f.task.id),
    ...archivedFiles.map((f) => f.task.id),
  ]);
  const prerequisites: DepEdge[] = file.task.dependsOn.map((depId) => {
    const depFile = files.find((f) => f.task.id === depId);
    const archivedDep = archivedFiles.find((f) => f.task.id === depId);
    const isArchived = depFile === undefined && archivedDep !== undefined;
    return {
      id: depId,
      title: (depFile ?? archivedDep)?.task.title ?? "(unknown)",
      state: (depFile ?? archivedDep)?.task.state ?? ("done" as TaskState),
      archived: isArchived,
    };
  });

  const missingDeps = file.task.dependsOn.filter((depId) => !allIds.has(depId));
  const dependents = findTaskDependents(files, taskId, archivedFiles);

  const depIssues = validateTaskDependencies(files, archivedFiles).filter(
    (issue) => issue.taskId === taskId || issue.message.includes(taskId),
  );
  const cycleIssues = depIssues
    .filter((issue) => issue.kind === "cycle")
    .map((issue) => issue.message);

  return {
    id: file.task.id,
    title: file.task.title,
    state: file.task.state,
    path: filePath,
    prerequisites,
    dependents,
    missingDeps,
    cycleIssues,
  };
}

export interface TaskCreateInput {
  title: string;
  mode: TaskMode;
  lane: string;
  type?: string;
  scope: string[];
  risk: TaskRisk;
  parallel: boolean;
  dependsOn: string[];
  tags: string[];
  goal: string;
  contextFiles: string[];
  allowedFiles: string[];
  forbiddenFiles: string[];
  steps: string[];
  acceptanceCriteria: string[];
  correctnessAssumptions?: string[];
  invariants?: string[];
  requiredEvidence?: string[];
  reviewQuestions?: string[];
  counterexampleSearches?: string[];
  verification?: TaskVerificationCheck[];
  /** Backward-compatible input for flat command verification. */
  verificationCommands?: string[];
  documentationUpdates: string[];
  notes: string[];
}

export interface TaskCreateResult {
  id: string;
  path: string;
  task: ProjectTask;
}

export interface TaskCreateError extends Error {
  name: "TaskCreateError";
}

export interface TaskFileScopeResult {
  changedFiles: string[];
  outOfScopeFiles: string[];
  forbiddenTouchedFiles: string[];
  attribution?: TaskScopeAttribution;
}

export interface TaskScopeSnapshot extends TaskFileScopeResult {
  comparisonKnown: boolean;
  diagnostics: string[];
}

export class TaskGitComparisonError extends Error {
  readonly args: string[];

  constructor(args: readonly string[], cause?: unknown) {
    const detail = (cause instanceof Error ? cause.message : String(cause ?? "unknown error"))
      .replace(/\s+/g, " ")
      .slice(0, 320);
    super(`Git comparison failed for ${args.join(" ")}: ${detail}`);
    this.name = "TaskGitComparisonError";
    this.args = [...args];
  }
}

export interface TaskScopeAttribution {
  baselineId: string;
  attributedFiles: string[];
  carriedForwardFiles: string[];
  preExistingFiles: string[];
  bookkeepingFiles: string[];
  excludedFiles: string[];
  excludedCommits: TaskCommitAttribution[];
  mergeCommits?: TaskMergeAttribution[];
  lineageStatus: TaskBaselineLineageStatus;
  diagnostics: string[];
}

export type TaskBaselinePhase = "claim" | "release" | "block" | "epoch";

export type TaskBaselineLineageStatus = "clean" | "attributed" | "intervening" | "unresolved";

export interface TaskCommitAttribution {
  sha: string;
  taskId: string;
  kind: "task-candidate" | "completion-bookkeeping";
  files: string[];
}

export interface TaskMergeAttribution {
  sha: string;
  parents: string[];
  files: string[];
  inheritedFrom: string[];
}

export interface TaskClaimBaseline {
  baselineId: string;
  taskId: string;
  owner: string;
  time: string;
  repository: "git" | "none";
  headSha?: string;
  taskFile: string;
  dirtyFiles: Record<string, string>;
  bookkeepingPaths: string[];
  diagnostics: string[];
  /** Lifecycle event that produced this record. Legacy records default to `claim`. */
  phase?: TaskBaselinePhase;
  /** Stable identity of the append-only verification epoch. Legacy records omit it. */
  epochId?: string;
  /** The baseline/epoch immediately preceding this epoch. */
  predecessorBaselineId?: string;
  predecessorEpochId?: string;
  /** Explicit operator/agent reason for starting an epoch. */
  epochReason?: string;
  /** Task-owned paths carried across an epoch boundary with their start fingerprints. */
  carriedForwardFiles?: Array<{ path: string; sha256: string }>;
  /** Candidate identity carried across an epoch boundary. */
  carriedForwardCandidateId?: string;
  /** Contract identity captured at the epoch boundary. */
  taskContractHash?: string;
  /** Authoritative baseline lineage result; only set by `readTaskBaseline`. */
  lineageStatus?: TaskBaselineLineageStatus;
  lineageDiagnostic?: string;
  /** Git HEAD against which `lineageStatus` and other-task proofs were resolved. */
  lineageHeadSha?: string;
  /** Committed changes proven to belong to another task's bounded candidate. */
  provenOtherTaskCommits?: TaskCommitAttribution[];
  /** Merge nodes whose changed paths were inherited from already-proven parents. */
  mergeCommits?: TaskMergeAttribution[];
}

export class TaskBaselineFormatError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid task baseline:\n- ${issues.join("\n- ")}`);
    this.name = "TaskBaselineFormatError";
    this.issues = issues;
  }
}

export interface TaskVerifyCommandResult {
  command: string;
  exitCode: number;
  apkOperation?: TaskApkOperation;
  resolvedApkIdentity?: string;
}

export type TaskVerifyCheckStatus = TaskEvidenceResult;

export interface TaskVerifyCheckResult {
  id: string;
  type: TaskVerificationType;
  evidenceType?: "benchmark";
  artifact?: string;
  apkOperation?: TaskApkOperation;
  resolvedApkIdentity?: string;
  required: boolean;
  status: TaskVerifyCheckStatus;
  command?: string;
  reason?: string;
}

export interface TaskVerifyResult extends TaskFileScopeResult {
  taskId: string;
  runId: string;
  subject: TaskEvidenceCandidateSubject;
  checkResults: TaskVerifyCheckResult[];
  evidenceWritten: number;
  commandsRun: TaskVerifyCommandResult[];
  commandsSkipped: boolean;
  passed: boolean;
  nextStep: string;
  diagnostics: string[];
}

export interface TaskVerifyOptions {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  owner?: string;
  checkFilesOnly?: boolean;
  changedFiles?: string[];
  runCommand?: (command: string) => Promise<number>;
  runApkOperation?: TaskApkOperationRunner;
  profile?: TaskVerificationProfile | "all";
  commandTimeoutMs?: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "-")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function nextTaskId(
  files: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[] = [],
): string {
  const all = [...files, ...archivedFiles];
  const maxId = all.reduce((max, file) => {
    const num = Number.parseInt(file.task.id, 10);
    return !Number.isNaN(num) && num > max ? num : max;
  }, 0);
  return String(maxId + 1).padStart(4, "0");
}

export function buildTaskFileName(id: string, title: string): string {
  return `${id}-${slugify(title)}.md`;
}

async function withTaskMutationLock<T>(
  rootDirectory: string,
  taskDirectory: string,
  command: string,
  taskId: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const lockPath = join(rootDirectory, taskDirectory, ".apk.lock");
  return withLocalMutationLock({
    path: lockPath,
    kind: "task-mutation",
    command,
    taskId,
  }, run);
}

export async function createTask(
  rootDirectory: string,
  taskDirectory: string,
  input: TaskCreateInput,
): Promise<TaskCreateResult> {
  return withTaskMutationLock(rootDirectory, taskDirectory, "task create", undefined, async () => {
    const files = await listTaskFiles(rootDirectory, taskDirectory);
    const archived = await listArchivedTaskFiles(rootDirectory, taskDirectory);
    const id = nextTaskId(files, archived);
    const fileName = buildTaskFileName(id, input.title);
    const taskPath = join(rootDirectory, taskDirectory, fileName);

    if (await fileExists(taskPath)) {
      const err = new Error(`Task file already exists: ${fileName}`) as TaskCreateError;
      err.name = "TaskCreateError";
      throw err;
    }

    const newSlug = slugify(input.title);
    const existingSlug = files.find((file) => {
      const existingFile = file.path.split(/[\\/]/).pop()?.replace(/\.md$/, "");
      if (!existingFile) return false;
      const dashIndex = existingFile.indexOf("-");
      if (dashIndex === -1) return false;
      return existingFile.slice(dashIndex + 1) === newSlug;
    });
    if (existingSlug) {
      const err = new Error(`Task file already exists: ${existingSlug.path.split("/").pop()}`) as TaskCreateError;
      err.name = "TaskCreateError";
      throw err;
    }

    const verification = input.verification ?? normalizeVerificationCommands(input.verificationCommands ?? []);
    const task: ProjectTask = {
      id,
      title: input.title,
      state: "todo",
      owner: "none",
      mode: input.mode,
      lane: input.lane,
      ...(input.type ? { type: input.type } : {}),
      scope: input.scope,
      risk: input.risk,
      parallel: input.parallel,
      dependsOn: input.dependsOn,
      tags: input.tags,
      goal: input.goal,
      contextFiles: input.contextFiles,
      allowedFiles: input.allowedFiles,
      forbiddenFiles: input.forbiddenFiles,
      steps: input.steps,
      acceptanceCriteria: input.acceptanceCriteria,
      ...(input.correctnessAssumptions && input.correctnessAssumptions.length > 0
        ? { correctnessAssumptions: input.correctnessAssumptions } : {}),
      ...(input.invariants && input.invariants.length > 0
        ? { invariants: input.invariants } : {}),
      ...(input.requiredEvidence && input.requiredEvidence.length > 0
        ? { requiredEvidence: input.requiredEvidence } : {}),
      ...(input.reviewQuestions && input.reviewQuestions.length > 0
        ? { reviewQuestions: input.reviewQuestions } : {}),
      ...(input.counterexampleSearches && input.counterexampleSearches.length > 0
        ? { counterexampleSearches: input.counterexampleSearches } : {}),
      verification,
      verificationCommands: verificationCommandsFromChecks(verification),
      documentationUpdates: input.documentationUpdates,
      notes: input.notes,
    };

    const invalidPathPatterns = [
      ...task.allowedFiles.map((pattern) => ({ kind: "allowed", pattern })),
      ...task.forbiddenFiles.map((pattern) => ({ kind: "forbidden", pattern })),
    ]
      .map(({ kind, pattern }) => ({ kind, pattern, issue: taskPathPatternIssue(pattern) }))
      .filter((entry): entry is { kind: string; pattern: string; issue: string } => entry.issue !== undefined);
    const pathOverlaps = findTaskPathContractOverlaps(task.allowedFiles, task.forbiddenFiles);
    if (invalidPathPatterns.length > 0 || pathOverlaps.length > 0) {
      const messages = [
        ...invalidPathPatterns.map((entry) => `${entry.kind} pattern ${JSON.stringify(entry.pattern)}: ${entry.issue}.`),
        ...pathOverlaps.map(renderTaskPathContractOverlap),
      ];
      const err = new Error(`Path contract validation failed before writing task:
- ${messages.join("\n- ")}`) as TaskCreateError;
      err.name = "TaskCreateError";
      throw err;
    }

    try {
      renderTaskMarkdown(task);
    } catch (error: unknown) {
      const err = new Error(`Failed to render task: ${error instanceof Error ? error.message : String(error)}`) as TaskCreateError;
      err.name = "TaskCreateError";
      throw err;
    }

    try {
      parseTaskMarkdown(renderTaskMarkdown(task));
    } catch (error: unknown) {
      if (error instanceof TaskFormatError) {
        const err = new Error(`Rendered task validation failed:\n- ${error.issues.join("\n- ")}`) as TaskCreateError;
        err.name = "TaskCreateError";
        throw err;
      }
      throw error;
    }

    const candidateFiles = [...files, { path: taskPath, task }];
    const depIssues = validateTaskDependencies(candidateFiles, archived).filter(
      (issue) => issue.taskId === id,
    );

    if (depIssues.length > 0) {
      const messages = depIssues.map((issue) => issue.message).join("\n- ");
      const err = new Error(`Dependency validation failed:\n- ${messages}`) as TaskCreateError;
      err.name = "TaskCreateError";
      throw err;
    }

    await writeTaskFile(taskPath, task);

    return {
      id,
      path: relative(rootDirectory, taskPath).replace(/\\/g, "/"),
      task,
    };
  });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw error;
  }
}

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function escapeRegex(text: string): string {
  return text.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function patternToRegex(pattern: string): RegExp {
  const normalized = normalizeRepoPath(pattern);
  let source = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    source += escapeRegex(char);
  }

  return new RegExp(`^${source}$`);
}

function pathMatchesPattern(path: string, pattern: string): boolean {
  const normalizedPath = normalizeRepoPath(path);
  const normalizedPattern = normalizeRepoPath(pattern);

  if (!normalizedPattern.includes("*")) {
    return normalizedPath === normalizedPattern;
  }

  return patternToRegex(normalizedPattern).test(normalizedPath);
}

export interface TaskPathContractOverlap {
  allowed: string;
  forbidden: string;
  forbiddenParent: boolean;
}

export function taskPathPatternIssue(pattern: string): string | undefined {
  const normalized = normalizeRepoPath(pattern);
  if (normalized.length === 0) return "path pattern must not be empty";
  if (normalized.includes("\n") || normalized.includes("\r")) return "path pattern must be single-line";
  if (isAbsolute(pattern) || /^[A-Za-z]:\//.test(normalized) || normalized.startsWith("/")) {
    return "absolute paths are not allowed";
  }
  if (normalized.split("/").includes("..")) return "parent traversal is not allowed";
  if (/[?\[\]{}]/.test(normalized)) return "only * and ** glob operators are supported";
  if (normalized.includes("//")) return "empty path segments are not allowed";
  return undefined;
}

function taskPathPatternsOverlap(left: string, right: string): boolean {
  const leftNormalized = normalizeRepoPath(left);
  const rightNormalized = normalizeRepoPath(right);
  const leftGlob = leftNormalized.includes("*");
  const rightGlob = rightNormalized.includes("*");
  if (!leftGlob && !rightGlob) return leftNormalized === rightNormalized;
  if (!leftGlob) return pathMatchesPattern(leftNormalized, rightNormalized);
  if (!rightGlob) return pathMatchesPattern(rightNormalized, leftNormalized);

  type GlobToken = { kind: "literal"; value: string }
    | { kind: "star" | "globstar" };
  const tokenize = (pattern: string): GlobToken[] => {
    const tokens: GlobToken[] = [];
    for (let index = 0; index < pattern.length; index += 1) {
      if (pattern[index] === "*" && pattern[index + 1] === "*") {
        tokens.push({ kind: "globstar" });
        index += 1;
      } else if (pattern[index] === "*") {
        tokens.push({ kind: "star" });
      } else {
        tokens.push({ kind: "literal", value: pattern[index] });
      }
    }
    return tokens;
  };
  const leftTokens = tokenize(leftNormalized);
  const rightTokens = tokenize(rightNormalized);
  const queue: Array<[number, number]> = [[0, 0]];
  const visited = new Set<string>();
  const enqueue = (leftIndex: number, rightIndex: number): void => {
    const key = `${leftIndex}:${rightIndex}`;
    if (!visited.has(key)) {
      visited.add(key);
      queue.push([leftIndex, rightIndex]);
    }
  };
  const closure = (leftIndex: number, rightIndex: number): void => {
    const leftToken = leftTokens[leftIndex];
    const rightToken = rightTokens[rightIndex];
    if (leftToken && (leftToken.kind === "star" || leftToken.kind === "globstar")) {
      enqueue(leftIndex + 1, rightIndex);
    }
    if (rightToken && (rightToken.kind === "star" || rightToken.kind === "globstar")) {
      enqueue(leftIndex, rightIndex + 1);
    }
  };
  const choices = (tokens: GlobToken[], index: number): Array<{ next: number; kind: "literal" | "non-slash" | "any"; value?: string }> => {
    const token = tokens[index];
    if (!token) return [];
    if (token.kind === "literal") return [{ next: index + 1, kind: "literal", value: token.value }];
    return [{ next: index, kind: token.kind === "star" ? "non-slash" : "any" }];
  };
  const intersects = (
    leftChoice: ReturnType<typeof choices>[number],
    rightChoice: ReturnType<typeof choices>[number],
  ): boolean => {
    if (leftChoice.kind === "literal" && rightChoice.kind === "literal") {
      return leftChoice.value === rightChoice.value;
    }
    if (leftChoice.kind === "literal") return rightChoice.kind === "any" || leftChoice.value !== "/";
    if (rightChoice.kind === "literal") return leftChoice.kind === "any" || rightChoice.value !== "/";
    return true;
  };

  while (queue.length > 0) {
    const [leftIndex, rightIndex] = queue.shift()!;
    if (leftIndex === leftTokens.length && rightIndex === rightTokens.length) return true;
    closure(leftIndex, rightIndex);
    for (const leftChoice of choices(leftTokens, leftIndex)) {
      for (const rightChoice of choices(rightTokens, rightIndex)) {
        if (intersects(leftChoice, rightChoice)) {
          enqueue(leftChoice.next, rightChoice.next);
        }
      }
    }
  }
  return false;
}

function forbiddenPatternIsParent(allowed: string, forbidden: string): boolean {
  const normalizedAllowed = normalizeRepoPath(allowed);
  const normalizedForbidden = normalizeRepoPath(forbidden);
  const parentPrefix = normalizedForbidden.endsWith("/**")
    ? normalizedForbidden.slice(0, -3).replace(/\/$/, "")
    : undefined;
  return parentPrefix !== undefined
    && normalizedAllowed.startsWith(`${parentPrefix}/`)
    && normalizedAllowed !== parentPrefix;
}

export function findTaskPathContractOverlaps(
  allowedFiles: readonly string[],
  forbiddenFiles: readonly string[],
): TaskPathContractOverlap[] {
  const overlaps: TaskPathContractOverlap[] = [];
  for (const allowed of allowedFiles) {
    for (const forbidden of forbiddenFiles) {
      if (
        !taskPathPatternIssue(allowed)
        && !taskPathPatternIssue(forbidden)
        && taskPathPatternsOverlap(allowed, forbidden)
      ) {
        overlaps.push({
          allowed,
          forbidden,
          forbiddenParent: forbiddenPatternIsParent(allowed, forbidden),
        });
      }
    }
  }
  return overlaps;
}

export function renderTaskPathContractOverlap(overlap: TaskPathContractOverlap): string {
  if (overlap.forbiddenParent) {
    return `Allowed child pattern ${JSON.stringify(overlap.allowed)} overlaps broad forbidden parent ${JSON.stringify(overlap.forbidden)}; positive allowedFiles already bounds edits, so remove or narrow the broad forbidden parent.`;
  }
  return `Allowed pattern ${JSON.stringify(overlap.allowed)} overlaps forbidden pattern ${JSON.stringify(overlap.forbidden)}; remove or narrow one of the overlapping patterns.`;
}

export function verifyTaskFileScope(
  task: ProjectTask,
  changedFiles: readonly string[],
): TaskFileScopeResult {
  const normalizedChanged = [...new Set(changedFiles.map(normalizeRepoPath))]
    .filter((file) => file.length > 0)
    .sort();
  const outOfScopeFiles = normalizedChanged.filter((file) => (
    !task.allowedFiles.some((pattern) => pathMatchesPattern(file, pattern))
  ));
  const forbiddenTouchedFiles = normalizedChanged.filter((file) => (
    task.forbiddenFiles.some((pattern) => pathMatchesPattern(file, pattern))
  ));

  return {
    changedFiles: normalizedChanged,
    outOfScopeFiles,
    forbiddenTouchedFiles,
  };
}

async function gitPaths(rootDirectory: string, args: readonly string[]): Promise<string[]> {
  const result = await execFileAsync("git", args, {
    cwd: rootDirectory,
    encoding: "buffer",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  const output = result.stdout as unknown as Buffer;
  const paths: string[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    if (index === start) throw new Error("Git returned an empty path in NUL-delimited output.");
    const bytes = output.subarray(start, index);
    const path = bytes.toString("utf8");
    if (!Buffer.from(path, "utf8").equals(bytes)) {
      throw new Error("Git returned a path that is not valid UTF-8; attribution fails closed.");
    }
    paths.push(path);
    start = index + 1;
  }
  if (start !== output.length) {
    throw new Error("Git path output is not NUL-terminated; attribution fails closed.");
  }
  return paths;
}

/** Read only enough Git path output to establish that the attribution limit is exceeded. */
async function gitPathsBounded(
  rootDirectory: string,
  args: readonly string[],
  maxPaths: number,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: rootDirectory,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const paths: string[] = [];
    let pending = Buffer.alloc(0);
    let stderr = "";
    let pathLimitExceeded = false;
    let outputLimitExceeded = false;
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(paths);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      if (settled || pathLimitExceeded || outputLimitExceeded) return;
      pending = Buffer.concat([pending, chunk]);
      if (pending.length > 8 * 1024 * 1024) {
        outputLimitExceeded = true;
        child.kill("SIGTERM");
        return;
      }
      let separator = pending.indexOf(0);
      while (separator >= 0) {
        if (separator === 0) {
          finish(new Error("Git returned an empty path in NUL-delimited output."));
          child.kill("SIGTERM");
          return;
        }
        const bytes = pending.subarray(0, separator);
        const path = bytes.toString("utf8");
        if (!Buffer.from(path, "utf8").equals(bytes)) {
          finish(new Error("Git returned a path that is not valid UTF-8; attribution fails closed."));
          child.kill("SIGTERM");
          return;
        }
        paths.push(path);
        pending = pending.subarray(separator + 1);
        if (paths.length > maxPaths) {
          pathLimitExceeded = true;
          child.kill("SIGTERM");
          return;
        }
        separator = pending.indexOf(0);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code, signal) => {
      if (settled) return;
      if (pathLimitExceeded) {
        finish(new Error(`Git path output exceeds the ${maxPaths}-file attribution limit.`));
      } else if (outputLimitExceeded) {
        finish(new Error("Git path output exceeds the 8 MiB attribution safety limit."));
      } else if (code !== 0) {
        finish(new Error(`Git path command failed${signal ? ` with ${signal}` : ` with exit code ${code}`}${stderr ? `: ${stderr.trim()}` : ""}.`));
      } else if (pending.length > 0) {
        finish(new Error("Git path output is not NUL-terminated; attribution fails closed."));
      } else {
        finish();
      }
    });
  });
}

function normalizeGitPath(path: string): string {
  if (path.includes("\\")) {
    throw new Error("Git path contains a backslash and cannot be attributed safely.");
  }
  return path.replace(/^\.\//, "");
}

async function gitOutput(
  rootDirectory: string,
  args: readonly string[],
): Promise<string> {
  try {
    const result = await execFileAsync("git", args, { cwd: rootDirectory, maxBuffer: 8 * 1024 * 1024 });
    return result.stdout;
  } catch (error: unknown) {
    throw new TaskGitComparisonError(args, error);
  }
}

export async function listGitChangedFiles(rootDirectory: string): Promise<string[]> {
  const files = await Promise.all([
    gitPaths(rootDirectory, ["diff", "--name-only", "-z"]),
    gitPaths(rootDirectory, ["diff", "--name-only", "--cached", "-z"]),
    gitPaths(rootDirectory, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);

  return [...new Set(files.flat().map(normalizeGitPath))].sort();
}

function hashCandidatePart(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

async function fingerprintChangedFiles(
  rootDirectory: string,
  changedFiles: readonly string[],
): Promise<Array<{ path: string; sha256: string }>> {
  const fingerprints: Array<{ path: string; sha256: string }> = [];
  for (const path of changedFiles) {
    try {
      const content = await readFile(join(rootDirectory, path));
      fingerprints.push({
        path,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
    } catch {
      fingerprints.push({ path, sha256: "missing" });
    }
  }
  return fingerprints;
}

const DEFAULT_BOOKKEEPING_PATHS = [
  ".tasks/.apk.lock",
  ".agentic/task-baselines.jsonl",
  ".agentic/evidence.jsonl",
  ".agentic/evidence.append.lock",
  ".agentic/runs.jsonl",
  ".agentic/runs/",
  ".agentic/agents.jsonl",
  ".agentic/agents/",
  ".agentic/sessions/",
  ".agentic/reviews/",
];

function isBookkeepingPath(path: string, baseline: TaskClaimBaseline): boolean {
  return [baseline.taskFile, ...baseline.bookkeepingPaths, ...DEFAULT_BOOKKEEPING_PATHS]
    .map(normalizeRepoPath)
    .some((entry) => path === entry || (entry.endsWith("/") && path.startsWith(entry)));
}

function isDefaultBookkeepingPath(path: string, taskFile: string): boolean {
  return [taskFile, ...DEFAULT_BOOKKEEPING_PATHS]
    .map(normalizeRepoPath)
    .some((entry) => path === entry || (entry.endsWith("/") && path.startsWith(entry)));
}

function normalizeBaseline(value: unknown, lineNumber: number): TaskClaimBaseline {
  const issues: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TaskBaselineFormatError([`Baseline line ${lineNumber} must be a JSON object.`]);
  }
  const raw = value as Record<string, unknown>;
  const text = (field: string, max = 200): string => {
    const fieldValue = raw[field];
    if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
      issues.push(`Baseline line ${lineNumber}.${field} must be a non-empty string.`);
      return "";
    }
    if (fieldValue.length > max) {
      issues.push(`Baseline line ${lineNumber}.${field} must be at most ${max} characters.`);
    }
    return fieldValue;
  };
  const repository = raw.repository === "git" || raw.repository === "none"
    ? raw.repository
    : (issues.push(`Baseline line ${lineNumber}.repository must be git or none.`), "none");
  const dirtyFiles: Record<string, string> = {};
  if (!raw.dirtyFiles || typeof raw.dirtyFiles !== "object" || Array.isArray(raw.dirtyFiles)) {
    issues.push(`Baseline line ${lineNumber}.dirtyFiles must be an object.`);
  } else {
    for (const [path, fingerprint] of Object.entries(raw.dirtyFiles as Record<string, unknown>)) {
      if (typeof fingerprint !== "string" || fingerprint.length === 0) {
        issues.push(`Baseline line ${lineNumber}.dirtyFiles.${path} must be a non-empty string.`);
      } else {
        dirtyFiles[normalizeRepoPath(path)] = fingerprint;
      }
    }
  }
  const bookkeepingPaths = Array.isArray(raw.bookkeepingPaths)
    ? raw.bookkeepingPaths.filter((path): path is string => typeof path === "string").map(normalizeRepoPath)
    : [];
  const diagnostics = Array.isArray(raw.diagnostics)
    ? raw.diagnostics.filter((item): item is string => typeof item === "string")
    : [];
  let phase: TaskBaselinePhase = "claim";
  if (raw.phase !== undefined) {
    if (raw.phase === "claim" || raw.phase === "release" || raw.phase === "block" || raw.phase === "epoch") {
      phase = raw.phase;
    } else {
      issues.push(`Baseline line ${lineNumber}.phase must be claim, release, block, or epoch.`);
    }
  }
  const optionalBaselineText = (field: string, max = 240): string | undefined => {
    if (raw[field] === undefined) return undefined;
    if (typeof raw[field] !== "string" || raw[field].trim().length === 0) {
      issues.push(`Baseline line ${lineNumber}.${field} must be a non-empty string when provided.`);
      return undefined;
    }
    if (raw[field].length > max) {
      issues.push(`Baseline line ${lineNumber}.${field} must be at most ${max} characters.`);
    }
    if (raw[field].includes("\n") || raw[field].includes("\r")) {
      issues.push(`Baseline line ${lineNumber}.${field} must be single-line.`);
    }
    return raw[field];
  };
  let carriedForwardFiles: Array<{ path: string; sha256: string }> | undefined;
  if (raw.carriedForwardFiles !== undefined) {
    if (!Array.isArray(raw.carriedForwardFiles)) {
      issues.push(`Baseline line ${lineNumber}.carriedForwardFiles must be an array when provided.`);
    } else {
      if (raw.carriedForwardFiles.length > MAX_TASK_ATTRIBUTION_FILES) {
        issues.push(`Baseline line ${lineNumber}.carriedForwardFiles must contain at most ${MAX_TASK_ATTRIBUTION_FILES} files.`);
      }
      carriedForwardFiles = [];
      for (const [index, item] of raw.carriedForwardFiles.entries()) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          issues.push(`Baseline line ${lineNumber}.carriedForwardFiles[${index}] must be an object.`);
          continue;
        }
        const entry = item as Record<string, unknown>;
        if (typeof entry.path !== "string" || entry.path.trim().length === 0) {
          issues.push(`Baseline line ${lineNumber}.carriedForwardFiles[${index}].path must be a non-empty string.`);
          continue;
        }
        if (typeof entry.sha256 !== "string" || entry.sha256.trim().length === 0) {
          issues.push(`Baseline line ${lineNumber}.carriedForwardFiles[${index}].sha256 must be a non-empty string.`);
          continue;
        }
        carriedForwardFiles.push({ path: normalizeRepoPath(entry.path), sha256: entry.sha256 });
      }
      carriedForwardFiles.sort((left, right) => left.path.localeCompare(right.path));
    }
  }
  const epochId = optionalBaselineText("epochId");
  const predecessorBaselineId = optionalBaselineText("predecessorBaselineId");
  const predecessorEpochId = optionalBaselineText("predecessorEpochId");
  const epochReason = optionalBaselineText("epochReason", 2048);
  const carriedForwardCandidateId = optionalBaselineText("carriedForwardCandidateId");
  const taskContractHash = optionalBaselineText("taskContractHash");
  const baseline: TaskClaimBaseline = {
    baselineId: text("baselineId", 240),
    taskId: text("taskId"),
    owner: text("owner"),
    time: text("time", 40),
    repository,
    ...(typeof raw.headSha === "string" && raw.headSha.length > 0 ? { headSha: raw.headSha } : {}),
    taskFile: normalizeRepoPath(text("taskFile")),
    dirtyFiles,
    bookkeepingPaths,
    diagnostics,
    phase,
    ...(epochId ? { epochId } : {}),
    ...(predecessorBaselineId ? { predecessorBaselineId } : {}),
    ...(predecessorEpochId ? { predecessorEpochId } : {}),
    ...(epochReason ? { epochReason } : {}),
    ...(carriedForwardFiles ? { carriedForwardFiles } : {}),
    ...(carriedForwardCandidateId ? { carriedForwardCandidateId } : {}),
    ...(taskContractHash ? { taskContractHash } : {}),
  };
  if (baseline.repository === "git" && !baseline.headSha) {
    issues.push(`Baseline line ${lineNumber}.headSha is required for git baselines.`);
  }
  if (phase === "epoch") {
    if (!epochId) issues.push(`Baseline line ${lineNumber}.epochId is required for epoch records.`);
    if (!predecessorBaselineId) issues.push(`Baseline line ${lineNumber}.predecessorBaselineId is required for epoch records.`);
    if (!epochReason) issues.push(`Baseline line ${lineNumber}.epochReason is required for epoch records.`);
    if (!carriedForwardFiles) issues.push(`Baseline line ${lineNumber}.carriedForwardFiles is required for epoch records.`);
    if (!carriedForwardCandidateId) issues.push(`Baseline line ${lineNumber}.carriedForwardCandidateId is required for epoch records.`);
    if (!taskContractHash) issues.push(`Baseline line ${lineNumber}.taskContractHash is required for epoch records.`);
  }
  if (issues.length > 0) {
    throw new TaskBaselineFormatError(issues);
  }
  return baseline;
}

export async function captureTaskBaseline(
  rootDirectory: string,
  taskId: string,
  owner: string,
  taskFile: string,
  phase: TaskBaselinePhase = "claim",
  epoch?: Pick<TaskClaimBaseline, "epochId" | "predecessorBaselineId" | "predecessorEpochId" | "epochReason" | "carriedForwardFiles" | "carriedForwardCandidateId" | "taskContractHash">,
  validation?: {
    headSha: string;
    changedFiles: readonly string[];
    dirtyFiles: Readonly<Record<string, string>>;
  },
): Promise<TaskClaimBaseline> {
  let changedFiles: string[] = [];
  const diagnostics: string[] = [];
  try {
    changedFiles = await listGitChangedFiles(rootDirectory);
  } catch (error: unknown) {
    diagnostics.push(error instanceof Error ? error.message : String(error));
  }
  const fingerprints = await fingerprintChangedFiles(rootDirectory, changedFiles);
  let headSha: string | undefined;
  try {
    headSha = (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim() || undefined;
  } catch (error: unknown) {
    diagnostics.push(error instanceof Error ? error.message : String(error));
  }
  const repository = headSha ? "git" : "none";
  if (repository !== "git") {
    diagnostics.push("Git HEAD unavailable; dirty-file attribution is limited to explicit current paths.");
  }
  if (validation) {
    const expectedChangedFiles = [...new Set(validation.changedFiles.map(normalizeRepoPath))].sort();
    const observedDirtyFiles = Object.fromEntries(fingerprints.map(({ path, sha256 }) => [path, sha256]));
    if (
      headSha !== validation.headSha
      || JSON.stringify(changedFiles) !== JSON.stringify(expectedChangedFiles)
      || JSON.stringify(observedDirtyFiles) !== JSON.stringify(validation.dirtyFiles)
    ) {
      throw new Error("Git HEAD or working-tree paths changed while the verification epoch snapshot was being validated; retry.");
    }
  }
  const time = new Date().toISOString();
  const bookkeepingPaths = [...DEFAULT_BOOKKEEPING_PATHS];
  const baselineId = `baseline:${hashCandidatePart({ taskId, owner, time, headSha, changedFiles, phase })}`;
  const baseline: TaskClaimBaseline = {
    baselineId,
    taskId,
    owner,
    time,
    repository,
    ...(headSha ? { headSha } : {}),
    taskFile: normalizeRepoPath(taskFile),
    dirtyFiles: Object.fromEntries(fingerprints.map(({ path, sha256 }) => [path, sha256])),
    bookkeepingPaths,
    diagnostics,
    phase,
    ...(epoch?.epochId ? { epochId: epoch.epochId } : {}),
    ...(epoch?.predecessorBaselineId ? { predecessorBaselineId: epoch.predecessorBaselineId } : {}),
    ...(epoch?.predecessorEpochId ? { predecessorEpochId: epoch.predecessorEpochId } : {}),
    ...(epoch?.epochReason ? { epochReason: epoch.epochReason } : {}),
    ...(epoch?.carriedForwardFiles ? { carriedForwardFiles: epoch.carriedForwardFiles } : {}),
    ...(epoch?.carriedForwardCandidateId ? { carriedForwardCandidateId: epoch.carriedForwardCandidateId } : {}),
    ...(epoch?.taskContractHash ? { taskContractHash: epoch.taskContractHash } : {}),
  };
  const path = join(rootDirectory, TASK_BASELINES_PATH);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(baseline)}\n`, "utf8");
  return baseline;
}

/**
 * Claim capture is append-only for lifecycle evidence, but the authoritative
 * scope baseline is always the earliest claim record for the task. A reclaim
 * appends a new claim marker so `readTaskBaseline` can detect the handoff; it
 * never rebases the authoritative baseline.
 */
export async function ensureTaskBaseline(
  rootDirectory: string,
  taskId: string,
  owner: string,
  taskFile: string,
): Promise<TaskClaimBaseline> {
  const records = await readAllTaskBaselineRecords(rootDirectory);
  const epoch = latestTaskEpoch(records.filter((record) => record.taskId === taskId));
  return captureTaskBaseline(rootDirectory, taskId, owner, taskFile, "claim", epoch ?? undefined);
}

/** Record a release/block handoff snapshot used to detect intervening work. */
export async function recordTaskHandoff(
  rootDirectory: string,
  taskId: string,
  owner: string,
  taskFile: string,
  phase: "release" | "block",
): Promise<TaskClaimBaseline> {
  const records = await readAllTaskBaselineRecords(rootDirectory);
  const epoch = latestTaskEpoch(records.filter((record) => record.taskId === taskId));
  return captureTaskBaseline(rootDirectory, taskId, owner, taskFile, phase, epoch ?? undefined);
}

function shortenSha(sha: string | undefined): string {
  return sha ? sha.slice(0, 12) : "none";
}

interface GitCommitNode {
  sha: string;
  parents: string[];
  files: string[];
  mergeResolutionFiles?: string[];
  mergeAmbiguity?: string;
  inheritedFrom?: string[];
}

interface BoundedGitAncestorGraph {
  nodes: Map<string, string[]>;
  diagnostic?: string;
}

async function boundedGitRangeAncestorGraph(
  rootDirectory: string,
  fromSha: string,
  toSha: string,
  maxNodes = MAX_TASK_ATTRIBUTION_COMMITS,
  diagnosticLimit = maxNodes,
): Promise<BoundedGitAncestorGraph> {
  if (fromSha === toSha) return { nodes: new Map([[fromSha, []]]) };
  try {
    const lines = (await gitOutput(rootDirectory, [
      "rev-list",
      "--topo-order",
      "--ancestry-path",
      `--max-count=${maxNodes + 1}`,
      "--parents",
      `${fromSha}..${toSha}`,
    ])).split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length > maxNodes) {
      return { nodes: new Map(), diagnostic: `Git ancestry range from ${shortenSha(fromSha)} to ${shortenSha(toSha)} exceeds the ${diagnosticLimit}-commit attribution limit.` };
    }
    const nodes = new Map<string, string[]>();
    for (const line of lines) {
      const [nodeSha, ...parents] = line.split(" ");
      if (!nodeSha || parents.length > 2) {
        return { nodes: new Map(), diagnostic: `Git ancestry range from ${shortenSha(fromSha)} to ${shortenSha(toSha)} contains an unsupported octopus node.` };
      }
      nodes.set(nodeSha, parents);
    }
    if (!nodes.has(toSha)) {
      return { nodes: new Map(), diagnostic: `Git ancestry range from ${shortenSha(fromSha)} to ${shortenSha(toSha)} is not a proven descendant chain.` };
    }
    // The task baseline is the bounded root. Its own parents are outside the
    // task range and must not be traversed while proving a merge base.
    nodes.set(fromSha, []);
    return { nodes };
  } catch (error: unknown) {
    return { nodes: new Map(), diagnostic: `Git comparison failed while reading ancestry from ${shortenSha(fromSha)} to ${shortenSha(toSha)} (${error instanceof Error ? error.message : String(error)}).` };
  }
}

async function boundedMergeBase(
  rootDirectory: string,
  parents: readonly string[],
  rangeBaseSha: string,
): Promise<{ mergeBase?: string; diagnostic?: string }> {
  const [left, right] = await Promise.all(parents.map((parent) => boundedGitRangeAncestorGraph(rootDirectory, rangeBaseSha, parent)));
  if (left.diagnostic || right.diagnostic) {
    return { diagnostic: left.diagnostic ?? right.diagnostic };
  }
  const common = [...left.nodes.keys()].filter((sha) => right.nodes.has(sha));
  if (common.length === 0) {
    return { diagnostic: `Merge commit parents ${parents.map(shortenSha).join(", ")} have no common ancestor inside the bounded task range rooted at ${shortenSha(rangeBaseSha)}.` };
  }
  const graph = new Map([...left.nodes, ...right.nodes]);
  const isAncestor = (ancestor: string, descendant: string): boolean => {
    const pending = [descendant];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || visited.has(current)) continue;
      if (current === ancestor) return true;
      visited.add(current);
      pending.push(...(graph.get(current) ?? []));
    }
    return false;
  };
  const mergeBases = common.filter((candidate) => !common.some((other) => (
    candidate !== other && isAncestor(candidate, other)
  )));
  if (mergeBases.length !== 1) {
    return { diagnostic: `Merge commit parents ${parents.map(shortenSha).join(", ")} have ${mergeBases.length} bounded merge bases inside the task range; criss-cross ancestry is ambiguous.` };
  }
  return { mergeBase: mergeBases[0] };
}

interface ResolvedTaskCommitProof {
  attribution: TaskCommitAttribution;
  taskFile: string;
  completionAgent: string;
  taskBaselineDirtyFiles: Record<string, string>;
}

function lineageFailure(
  message: string,
  status: TaskBaselineLineageStatus = "intervening",
  provenOtherTaskCommits?: TaskCommitAttribution[],
  mergeCommits?: TaskMergeAttribution[],
): Pick<TaskClaimBaseline, "lineageStatus" | "lineageDiagnostic" | "provenOtherTaskCommits" | "mergeCommits"> {
  return {
    lineageStatus: status,
    lineageDiagnostic: message.slice(0, 480),
    ...(provenOtherTaskCommits ? { provenOtherTaskCommits } : {}),
    ...(mergeCommits && mergeCommits.length > 0 ? { mergeCommits } : {}),
  };
}

function boundCommitAttributions(proofs: readonly TaskCommitAttribution[]): TaskCommitAttribution[] {
  const bounded: TaskCommitAttribution[] = [];
  let remainingFiles = MAX_TASK_ATTRIBUTION_OUTPUT_FILES;
  for (const proof of proofs.slice(0, MAX_TASK_ATTRIBUTION_OUTPUT_COMMITS)) {
    if (remainingFiles <= 0) break;
    const files = proof.files.slice(0, remainingFiles);
    bounded.push({ ...proof, files });
    remainingFiles -= files.length;
  }
  return bounded;
}

async function readAllTaskBaselineRecords(rootDirectory: string): Promise<TaskClaimBaseline[]> {
  let content: string;
  try {
    content = await readFile(join(rootDirectory, TASK_BASELINES_PATH), "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const records: TaskClaimBaseline[] = [];
  for (const [index, line] of content.split("\n").entries()) {
    if (line.trim().length === 0) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error: unknown) {
      throw new TaskBaselineFormatError([
        `Baseline line ${index + 1} must be valid JSON (${error instanceof Error ? error.message : String(error)}).`,
      ]);
    }
    records.push(normalizeBaseline(value, index + 1));
  }
  return records;
}

function latestTaskEpoch(records: readonly TaskClaimBaseline[]): TaskClaimBaseline | undefined {
  return [...records]
    .reverse()
    .find((record) => record.phase === "epoch" && record.epochId);
}

export async function readTaskBaselineHistory(
  rootDirectory: string,
  taskId?: string,
): Promise<TaskClaimBaseline[]> {
  const records = await readAllTaskBaselineRecords(rootDirectory);
  return taskId === undefined ? records : records.filter((record) => record.taskId === taskId);
}

export interface StartTaskVerificationEpochOptions {
  rootDirectory: string;
  task: ProjectTask;
  taskPath: string;
  owner: string;
  reason: string;
}

/**
 * Append a fresh scope anchor without replacing the original claim history.
 *
 * A stale predecessor is recoverable only by carrying every discoverable
 * non-bookkeeping path forward. This is deliberately conservative: an
 * unrelated path may remain a scope violation, but it can never disappear by
 * omission at the epoch boundary.
 */
export async function startTaskVerificationEpoch(
  options: StartTaskVerificationEpochOptions,
): Promise<TaskClaimBaseline> {
  const reason = options.reason.replace(/\s+/g, " ").trim();
  if (reason.length === 0) throw new Error("Epoch start requires an explicit reason.");
  if (reason.length > 2048) throw new Error("Epoch reason must be at most 2048 characters.");
  if (options.task.owner !== options.owner) {
    throw new Error(`Task ${options.task.id} is owned by ${options.task.owner}, not ${options.owner}.`);
  }
  if (options.task.state !== "doing" && options.task.state !== "review") {
    throw new Error(`Task ${options.task.id} is ${options.task.state}; an epoch can only start for doing or review.`);
  }

  const records = await readAllTaskBaselineRecords(options.rootDirectory);
  const taskRecords = records.filter((record) => record.taskId === options.task.id);
  const predecessor = latestTaskEpoch(taskRecords)
    ?? taskRecords.find((record) => (record.phase ?? "claim") === "claim")
    ?? taskRecords[0];
  if (!predecessor) {
    throw new Error(`Task ${options.task.id} has no claim baseline to recover.`);
  }
  if (predecessor.phase === "release" || predecessor.phase === "block") {
    throw new Error(`Task ${options.task.id} has no active baseline; claim it before starting an epoch.`);
  }
  if (predecessor.taskFile !== normalizeRepoPath(relative(options.rootDirectory, options.taskPath))) {
    throw new Error("Task contract path changed; epoch continuity cannot be proven.");
  }

  const contractHash = hashCandidatePart(comparableTaskContract(options.task));
  if (predecessor.taskContractHash && predecessor.taskContractHash !== contractHash) {
    throw new Error("Task contract changed since the predecessor epoch; epoch recovery fails closed.");
  }
  if (!predecessor.taskContractHash && predecessor.repository !== "git") {
    throw new Error("Legacy non-Git baseline has no durable task contract anchor; epoch recovery fails closed.");
  }
  if (!predecessor.taskContractHash && predecessor.headSha) {
    try {
      const historical = parseTaskMarkdown(await gitOutput(
        options.rootDirectory,
        ["show", `${predecessor.headSha}:${predecessor.taskFile}`],
      ));
      if (comparableTaskContract(historical) !== comparableTaskContract(options.task)) {
        throw new Error("Task contract changed since the predecessor baseline; epoch recovery fails closed.");
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("epoch recovery fails closed")) throw error;
      throw new Error(`Task contract at predecessor baseline is unreadable; epoch recovery fails closed.`);
    }
  }

  const current = await readTaskBaseline(options.rootDirectory, options.task.id);
  if (!current || current.baselineId !== predecessor.baselineId) {
    throw new Error("Task baseline changed while epoch eligibility was evaluated; retry from the current epoch.");
  }
  if (current.repository !== "git" || !current.headSha) {
    throw new Error("Epoch recovery requires a Git HEAD so the carried-forward path set can be proven.");
  }
  let currentHeadSha: string;
  try {
    currentHeadSha = (await gitOutput(options.rootDirectory, ["rev-parse", "HEAD"])).trim();
  } catch (error: unknown) {
    throw new Error(`Epoch recovery cannot read the current Git HEAD: ${error instanceof Error ? error.message : String(error)}`);
  }

  let predecessorDelta: { all: string[]; historical: string[]; workingTree: string[] };
  try {
    predecessorDelta = await listTaskEpochChangedFilesSinceBaseline(options.rootDirectory, current);
  } catch (error: unknown) {
    throw new Error(`Epoch recovery cannot enumerate the predecessor delta: ${error instanceof Error ? error.message : String(error)}`);
  }
  const historicalNonBookkeeping = [...new Set([
    ...predecessorDelta.historical.map(normalizeRepoPath),
    ...(current.carriedForwardFiles ?? []).map(({ path }) => normalizeRepoPath(path)),
  ].filter((path) => !isBookkeepingPath(path, current)))].sort();
  const workingTreeNonBookkeeping = predecessorDelta.workingTree
    .map(normalizeRepoPath)
    .filter((path) => !isBookkeepingPath(path, current));

  let carriedForwardFiles = [
    ...historicalNonBookkeeping,
    ...(current.lineageStatus === "clean" || current.lineageStatus === "attributed"
      ? []
      : workingTreeNonBookkeeping),
  ].sort();
  let predecessorCandidateId: string | undefined;
  if (current.lineageStatus === "clean" || current.lineageStatus === "attributed") {
    const scope = await captureTaskScope({
      rootDirectory: options.rootDirectory,
      task: options.task,
      taskPath: options.taskPath,
      baseline: current,
    });
    if (scope.comparisonKnown && scope.attribution) {
      carriedForwardFiles = [...new Set([
        ...carriedForwardFiles,
        ...scope.attribution.attributedFiles,
      ])].sort();
      try {
        predecessorCandidateId = (await captureTaskEvidenceSubject(
          options.rootDirectory,
          options.task,
          scope.changedFiles,
          current,
        )).candidateId;
      } catch {
        // The conservative path-set carry remains valid even if candidate
        // identity cannot be recaptured during this diagnostic pass.
      }
    }
  }
  if (carriedForwardFiles.length > MAX_TASK_ATTRIBUTION_FILES) {
    throw new Error(`Epoch recovery path set exceeds the ${MAX_TASK_ATTRIBUTION_FILES}-file safety bound.`);
  }

  const validationChangedFiles = await listGitChangedFiles(options.rootDirectory);
  const validationDirtyFiles = Object.fromEntries(
    (await fingerprintChangedFiles(options.rootDirectory, validationChangedFiles))
      .map(({ path, sha256 }) => [path, sha256]),
  );
  const validationNonBookkeeping = validationChangedFiles
    .map(normalizeRepoPath)
    .filter((path) => !isBookkeepingPath(path, current));
  carriedForwardFiles = [...new Set([
    ...carriedForwardFiles,
    ...validationNonBookkeeping.filter((path) => (
      current.dirtyFiles[path] === undefined
      || current.dirtyFiles[path] !== validationDirtyFiles[path]
    )),
  ])].sort();
  if (carriedForwardFiles.length > MAX_TASK_ATTRIBUTION_FILES) {
    throw new Error(`Epoch recovery path set exceeds the ${MAX_TASK_ATTRIBUTION_FILES}-file safety bound.`);
  }

  const carriedFingerprints = await fingerprintChangedFiles(options.rootDirectory, carriedForwardFiles);
  const time = new Date().toISOString();
  const carriedForwardCandidateId = predecessorCandidateId
    ?? `candidate:carried:${hashCandidatePart({
      taskId: options.task.id,
      predecessorBaselineId: predecessor.baselineId,
      carriedForwardFiles: carriedFingerprints,
    })}`;
  const epochId = `epoch:${hashCandidatePart({
    taskId: options.task.id,
    predecessorBaselineId: predecessor.baselineId,
    predecessorEpochId: predecessor.epochId,
    owner: options.owner,
    reason,
    time,
    headSha: currentHeadSha,
    carriedForwardFiles: carriedFingerprints,
  })}`;
  const validationHeadSha = (await gitOutput(options.rootDirectory, ["rev-parse", "HEAD"])).trim();
  if (validationHeadSha !== currentHeadSha) {
    throw new Error("Git HEAD changed while the verification epoch snapshot was being prepared; retry.");
  }
  const next = await captureTaskBaseline(
    options.rootDirectory,
    options.task.id,
    options.owner,
    predecessor.taskFile,
    "epoch",
    {
      epochId,
      predecessorBaselineId: predecessor.baselineId,
      ...(predecessor.epochId ? { predecessorEpochId: predecessor.epochId } : {}),
      epochReason: reason,
      carriedForwardFiles: carriedFingerprints,
      carriedForwardCandidateId,
      taskContractHash: contractHash,
    },
    {
      headSha: validationHeadSha,
      changedFiles: validationChangedFiles,
      dirtyFiles: validationDirtyFiles,
    },
  );
  return next;
}

async function readGitCommitNode(
  rootDirectory: string,
  sha: string,
  parents: readonly string[],
  rangeBaseSha: string,
): Promise<GitCommitNode> {
  if (parents.length > 2) {
    throw new Error(`Octopus merge ${shortenSha(sha)} has ${parents.length} parents; bounded DAG attribution supports at most two.`);
  }
  let mergeBase: string | undefined;
  if (parents.length === 2) {
    const boundedBase = await boundedMergeBase(rootDirectory, parents, rangeBaseSha);
    if (!boundedBase.mergeBase) {
      return {
        sha,
        parents: [...parents],
        files: [],
        mergeResolutionFiles: [],
        mergeAmbiguity: `Merge commit ${shortenSha(sha)} (parents ${parents.map(shortenSha).join(", ")}) cannot establish a unique bounded merge base: ${boundedBase.diagnostic ?? "unknown ancestry error"}`,
      };
    }
    mergeBase = boundedBase.mergeBase;
  }
  let files: string[] = [];
  if (parents.length === 0) {
    files = await gitPathsBounded(rootDirectory, ["diff-tree", "--root", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", sha], MAX_TASK_ATTRIBUTION_FILES);
  } else if (parents.length === 1) {
    files = await gitPathsBounded(rootDirectory, ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", sha], MAX_TASK_ATTRIBUTION_FILES);
  } else {
    const parentPaths = await Promise.all(parents.map((parent) => gitPathsBounded(rootDirectory, [
      "diff", "--name-only", "--no-renames", "-z", parent, sha,
    ], MAX_TASK_ATTRIBUTION_FILES)));
    files = [...new Set(parentPaths.flat().map(normalizeGitPath))].sort();
  }
  if (files.length > MAX_TASK_ATTRIBUTION_FILES) {
    throw new Error(`Commit ${shortenSha(sha)} exceeds the ${MAX_TASK_ATTRIBUTION_FILES}-file attribution limit.`);
  }
  const normalizedFiles = [...new Set(files.map(normalizeGitPath))].sort();
  if (parents.length < 2) {
    return { sha, parents: [...parents], files: normalizedFiles };
  }

  const mergeResolutionFiles: string[] = [];
  const inheritedFrom = new Set<string>();
  const mergeBaseSha = mergeBase;
  if (!mergeBaseSha) throw new Error(`Merge commit ${shortenSha(sha)} has no bounded merge base.`);
  const parentChangedPaths = await Promise.all(parents.map((parent) => gitPathsBounded(rootDirectory, [
    "diff", "--name-only", "--no-renames", "-z", mergeBaseSha, parent,
  ], MAX_TASK_ATTRIBUTION_FILES)));
  const mergePaths = [...new Set([
    ...normalizedFiles,
    ...parentChangedPaths.flat().map(normalizeGitPath),
  ])].sort();
  if (mergePaths.length > MAX_TASK_ATTRIBUTION_FILES) {
    throw new Error(`Merge commit ${shortenSha(sha)} exceeds the ${MAX_TASK_ATTRIBUTION_FILES}-file attribution limit.`);
  }
  for (const path of mergePaths) {
    const resultFingerprint = await gitTreeEntryFingerprint(rootDirectory, sha, path);
    const baseFingerprint = await gitTreeEntryFingerprint(rootDirectory, mergeBaseSha, path);
    const parentFingerprints = await Promise.all(parents.map((parent) => gitTreeEntryFingerprint(rootDirectory, parent, path)));
    const attribution = resolveMergePathAttribution(
      resultFingerprint,
      baseFingerprint,
      parentFingerprints,
      parents,
    );
    if (attribution.mergeResolution) {
      mergeResolutionFiles.push(path);
      continue;
    }
    for (const parent of attribution.inheritedFrom) inheritedFrom.add(parent);
  }
  return {
    sha,
    parents: [...parents],
    files: mergePaths,
    ...(mergeResolutionFiles.length > 0 ? { mergeResolutionFiles: mergeResolutionFiles.sort() } : {}),
    ...(inheritedFrom.size > 0 ? { inheritedFrom: [...inheritedFrom].sort() } : {}),
  };
}

async function listGitDagCommits(
  rootDirectory: string,
  fromSha: string,
  toSha: string,
): Promise<{ commits?: GitCommitNode[]; diagnostic?: string }> {
  if (fromSha === toSha) return { commits: [] };
  let ancestryPathLines: string[];
  try {
    ancestryPathLines = (await gitOutput(rootDirectory, [
      "rev-list",
      "--topo-order",
      "--ancestry-path",
      `--max-count=${MAX_TASK_ATTRIBUTION_COMMITS + 1}`,
      "--parents",
      `${fromSha}..${toSha}`,
    ])).split(/\r?\n/).filter((line) => line.length > 0);
  } catch (error: unknown) {
    return { diagnostic: `Git comparison failed while proving history from ${shortenSha(fromSha)} to ${shortenSha(toSha)} (${error instanceof Error ? error.message : String(error)}).` };
  }
  if (ancestryPathLines.length > MAX_TASK_ATTRIBUTION_COMMITS) {
    return { diagnostic: `Git commit range exceeds the ${MAX_TASK_ATTRIBUTION_COMMITS}-commit attribution limit.` };
  }
  if (!ancestryPathLines.some((line) => line.split(" ")[0] === toSha)) {
    return {
      diagnostic: `Git comparison failed: history from ${shortenSha(fromSha)} to ${shortenSha(toSha)} is not a proven descendant chain within the bounded attribution graph.`,
    };
  }

  let lines: string[];
  try {
    lines = (await gitOutput(rootDirectory, ["rev-list", "--reverse", "--topo-order", `--max-count=${MAX_TASK_ATTRIBUTION_COMMITS + 1}`, "--parents", `${fromSha}..${toSha}`]))
      .split(/\r?\n/)
      .filter((line) => line.length > 0);
  } catch (error: unknown) {
    return { diagnostic: `Git commit range is unreadable (${error instanceof Error ? error.message : String(error)}).` };
  }
  if (lines.length > MAX_TASK_ATTRIBUTION_COMMITS) {
    return { diagnostic: `Git commit range exceeds the ${MAX_TASK_ATTRIBUTION_COMMITS}-commit attribution limit.` };
  }

  const commits: GitCommitNode[] = [];
  for (const line of lines) {
    const [sha, ...parents] = line.split(" ");
    if (!sha || parents.length === 0 || parents.length > 2) {
      return {
        diagnostic: `Unsupported Git DAG node ${shortenSha(sha)} between ${shortenSha(fromSha)} and ${shortenSha(toSha)}; octopus/root traversal is outside the bounded attribution contract.`,
      };
    }
    try {
      commits.push(await readGitCommitNode(rootDirectory, sha, parents, fromSha));
    } catch (error: unknown) {
      return {
        diagnostic: `Changed paths for commit ${shortenSha(sha)} are unreadable (${error instanceof Error ? error.message : String(error)}).`,
      };
    }
  }
  const commitIndexBySha = new Map(commits.map((commit, index) => [commit.sha, index]));
  for (const [index, commit] of commits.entries()) {
    for (const parent of commit.parents) {
      const parentIndex = commitIndexBySha.get(parent);
      if (parentIndex !== undefined && parentIndex >= index) {
        return { diagnostic: `Git DAG ordering is not parent-before-child at ${shortenSha(commit.sha)} (${shortenSha(parent)}); scope fails closed.` };
      }
    }
  }
  if (!commits.some((commit) => commit.sha === toSha)) {
    return { diagnostic: `Git did not produce a complete DAG ending at ${shortenSha(toSha)}.` };
  }
  return { commits };
}

function sameEvidenceCandidate(
  left: TaskEvidenceRecord["subject"],
  right: TaskEvidenceRecord["subject"],
): boolean {
  return left.taskId === right.taskId
    && left.repository === right.repository
    && left.headSha === right.headSha
    && left.baselineId === right.baselineId
    && left.candidateId === right.candidateId
    && left.worktreeId === right.worktreeId;
}

function comparableTaskContract(task: ProjectTask): string {
  return renderTaskMarkdown({ ...task, state: "doing", owner: "none" });
}

async function gitFileFingerprint(
  rootDirectory: string,
  revision: string,
  path: string,
): Promise<string> {
  try {
    const result = await execFileAsync("git", ["show", `${revision}:${path}`], {
      cwd: rootDirectory,
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return createHash("sha256").update(result.stdout as unknown as Buffer).digest("hex");
  } catch {
    try {
      const treePaths = await gitPaths(rootDirectory, ["ls-tree", "-r", "--name-only", "-z", revision, "--", path]);
      return treePaths.includes(path) ? "unreadable" : "missing";
    } catch {
      return "unreadable";
    }
  }
}

async function gitTreeEntryFingerprint(
  rootDirectory: string,
  revision: string,
  path: string,
): Promise<string> {
  try {
    const result = await execFileAsync("git", ["ls-tree", "-z", revision, "--", path], {
      cwd: rootDirectory,
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    const output = result.stdout as unknown as Buffer;
    let start = 0;
    for (let index = 0; index < output.length; index += 1) {
      if (output[index] !== 0) continue;
      const record = output.subarray(start, index);
      const separator = record.indexOf(9);
      if (separator < 0) return "unreadable";
      const entryPath = record.subarray(separator + 1).toString("utf8");
      if (!Buffer.from(entryPath, "utf8").equals(record.subarray(separator + 1))) return "unreadable";
      if (entryPath === path) return `entry:${record.subarray(0, separator).toString("utf8")}`;
      start = index + 1;
    }
    if (start !== output.length) return "unreadable";
    return "missing";
  } catch {
    return "unreadable";
  }
}

export function resolveMergePathAttribution(
  resultFingerprint: string,
  baseFingerprint: string,
  parentFingerprints: readonly string[],
  parents: readonly string[],
): { mergeResolution: boolean; inheritedFrom: string[] } {
  const changedParents = parentFingerprints.filter((fingerprint) => (
    resultFingerprint === "unreadable"
    || fingerprint === "unreadable"
    || fingerprint !== baseFingerprint
  ));
  const resultMatchesParent = parentFingerprints
    .map((fingerprint, index) => fingerprint === resultFingerprint ? parents[index] : undefined)
    .filter((parent): parent is string => parent !== undefined);
  if (
    resultFingerprint === "unreadable"
    || baseFingerprint === "unreadable"
    || parentFingerprints.some((fingerprint) => fingerprint === "unreadable")
    || changedParents.length === parents.length
    || resultMatchesParent.length === 0
  ) {
    return { mergeResolution: true, inheritedFrom: [] };
  }
  return { mergeResolution: false, inheritedFrom: resultMatchesParent };
}

async function resolveTaskCandidateCommit(
  rootDirectory: string,
  taskFiles: readonly ProjectTaskFile[],
  baselineRecords: readonly TaskClaimBaseline[],
  evidenceRecords: readonly TaskEvidenceRecord[],
  runEvents: Awaited<ReturnType<typeof readRunLog>>,
  activeTaskId: string,
  commit: GitCommitNode,
): Promise<ResolvedTaskCommitProof | undefined> {
  if (commit.parents.length !== 1) return undefined;
  const parentSha = commit.parents[0];
  const matches: ResolvedTaskCommitProof[] = [];

  for (const taskFile of taskFiles) {
    const task = taskFile.task;
    if (task.id === activeTaskId || task.state !== "done") continue;
    const relativeTaskFile = normalizeRepoPath(relative(rootDirectory, taskFile.path));
    const taskBaselines = baselineRecords.filter((record) => record.taskId === task.id);
    const authoritative = [...taskBaselines]
      .filter((record) => (
        record.repository === "git"
        && record.headSha === parentSha
        && ((record.phase ?? "claim") === "claim" || record.phase === "epoch")
      ))
      .at(-1);
    if (
      !authoritative
      || authoritative.repository !== "git"
      || authoritative.taskFile !== relativeTaskFile
    ) continue;

    const taskEvidence = evidenceRecords.filter((record) => record.taskId === task.id);
    const completions = taskEvidence.filter((record) => (
      record.type === "completion"
      && record.result === "pass"
      && record.gateEligible === true
      && record.subject.repository === "git"
      && record.subject.headSha === commit.sha
      && record.subject.baselineId === authoritative.baselineId
      && record.subject.taskId === task.id
    ));
    if (completions.length !== 1) continue;
    const completion = completions[0];
    if (task.owner !== completion.agent) continue;
    const doneEvents = runEvents.filter((event) => (
      event.event === "done"
      && event.outcome === "ok"
      && event.state === "done"
      && event.task === task.id
      && event.runId === completion.runId
      && event.agent === completion.agent
    ));
    if (doneEvents.length !== 1) continue;

    const evidenceSet = completion.evidenceSet ?? [];
    if (new Set(evidenceSet).size !== evidenceSet.length) continue;
    const evidenceSetValid = evidenceSet.every((id) => {
      const matchesById = taskEvidence.filter((record) => record.id === id);
      return matchesById.length === 1
        && matchesById[0].result === "pass"
        && matchesById[0].type !== "completion"
        && sameEvidenceCandidate(matchesById[0].subject, completion.subject);
    });
    if (!evidenceSetValid) continue;

    try {
      const baselineContract = parseTaskMarkdown(
        await gitOutput(rootDirectory, ["show", `${parentSha}:${relativeTaskFile}`]),
      );
      const historicalContract = parseTaskMarkdown(
        await gitOutput(rootDirectory, ["show", `${commit.sha}:${relativeTaskFile}`]),
      );
      const candidateContract = comparableTaskContract(historicalContract);
      if (
        comparableTaskContract(baselineContract) !== candidateContract
        || candidateContract !== comparableTaskContract(task)
      ) continue;
    } catch {
      continue;
    }

    const scopeFiles: string[] = [];
    for (const path of commit.files) {
      if (isBookkeepingPath(path, authoritative)) continue;
      const originalFingerprint = authoritative.dirtyFiles[path];
      if (originalFingerprint && originalFingerprint === await gitFileFingerprint(rootDirectory, commit.sha, path)) {
        continue;
      }
      scopeFiles.push(path);
    }
    const scope = verifyTaskFileScope(task, scopeFiles);
    if (scope.outOfScopeFiles.length > 0 || scope.forbiddenTouchedFiles.length > 0) continue;

    matches.push({
      attribution: {
        sha: commit.sha,
        taskId: task.id,
        kind: "task-candidate",
        files: commit.files,
      },
      taskFile: relativeTaskFile,
      completionAgent: completion.agent,
      taskBaselineDirtyFiles: authoritative.dirtyFiles,
    });
  }

  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Walk the single-parent commit chain from a task's claim/epoch baseline
 * (exclusive) to its completion-bound final commit (inclusive). Every
 * intermediate commit must be a single-parent node inside the bounded DAG.
 */
function walkSingleParentTaskChain(
  commitBySha: Map<string, GitCommitNode>,
  baseSha: string,
  headSha: string,
): GitCommitNode[] | undefined {
  if (headSha === baseSha) return undefined;
  if (!commitBySha.has(headSha)) return undefined;
  const chain: GitCommitNode[] = [];
  let sha: string | undefined = headSha;
  while (sha !== baseSha) {
    if (!sha) return undefined;
    const node = commitBySha.get(sha);
    if (!node || node.parents.length !== 1) return undefined;
    chain.push(node);
    sha = node.parents[0];
    if (chain.length > MAX_TASK_ATTRIBUTION_COMMITS) return undefined;
  }
  return chain.reverse();
}

/**
 * The chain contract is stable when the task file's normalized contract is
 * identical from its anchor through the chain head and to the current task
 * file. The anchor is the baseline when the file exists there, otherwise the
 * first chain commit that introduces the file (first-commit task files).
 */
async function taskChainContractStable(
  rootDirectory: string,
  taskFile: string,
  baseSha: string,
  chain: readonly GitCommitNode[],
  currentTask: ProjectTask,
): Promise<boolean> {
  const comparableAt = async (revision: string): Promise<string> => {
    try {
      const markdown = await gitOutput(rootDirectory, ["show", `${revision}:${taskFile}`]);
      return comparableTaskContract(parseTaskMarkdown(markdown));
    } catch {
      return "missing";
    }
  };
  let anchor: string;
  const baseContract = await comparableAt(baseSha);
  if (baseContract !== "missing") {
    anchor = baseContract;
  } else {
    let found: string | undefined;
    for (const node of chain) {
      const contract = await comparableAt(node.sha);
      if (contract !== "missing") {
        found = contract;
        break;
      }
    }
    if (!found) return false;
    anchor = found;
  }
  const head = chain[chain.length - 1];
  if (!head) return false;
  const headContract = await comparableAt(head.sha);
  return headContract === anchor && anchor === comparableTaskContract(currentTask);
}

async function resolveCompletionBookkeepingCommit(
  rootDirectory: string,
  commit: GitCommitNode,
  proofForCandidate: (sha: string) => Promise<ResolvedTaskCommitProof | undefined>,
): Promise<ResolvedTaskCommitProof | undefined> {
  if (commit.parents.length !== 1 || commit.files.length !== 1) return undefined;
  const parentSha = commit.parents[0];
  const candidate = await proofForCandidate(parentSha);
  if (!candidate || commit.files[0] !== candidate.taskFile) return undefined;
  try {
    const before = parseTaskMarkdown(await gitOutput(rootDirectory, ["show", `${parentSha}:${candidate.taskFile}`]));
    const after = parseTaskMarkdown(await gitOutput(rootDirectory, ["show", `${commit.sha}:${candidate.taskFile}`]));
    if (
      !["todo", "doing", "review"].includes(before.state)
      || after.state !== "done"
      || after.owner !== candidate.completionAgent
      || comparableTaskContract(before) !== comparableTaskContract(after)
    ) return undefined;
    return {
      attribution: {
        sha: commit.sha,
        taskId: candidate.attribution.taskId,
        kind: "completion-bookkeeping",
        files: [candidate.taskFile],
      },
      taskFile: candidate.taskFile,
      completionAgent: candidate.completionAgent,
      taskBaselineDirtyFiles: candidate.taskBaselineDirtyFiles,
    };
  } catch {
    return undefined;
  }
}

function snapshotDirtyDifference(
  before: TaskClaimBaseline,
  after: TaskClaimBaseline,
): string | undefined {
  const beforeFiles = Object.fromEntries(Object.entries(before.dirtyFiles)
    .filter(([path]) => !isBookkeepingPath(path, before)));
  const afterFiles = Object.fromEntries(Object.entries(after.dirtyFiles)
    .filter(([path]) => !isBookkeepingPath(path, before)));
  for (const path of [...new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)])].sort()) {
    if (beforeFiles[path] !== afterFiles[path]) return path;
  }
  return undefined;
}

async function resolveTaskBaselineLineage(
  rootDirectory: string,
  authoritative: TaskClaimBaseline,
  taskRecords: readonly TaskClaimBaseline[],
): Promise<Pick<TaskClaimBaseline, "lineageStatus" | "lineageDiagnostic" | "lineageHeadSha" | "provenOtherTaskCommits" | "mergeCommits">> {
  if (authoritative.repository !== "git" || !authoritative.headSha) {
    return {
      lineageStatus: "unresolved",
      lineageDiagnostic: "Task baseline has no Git HEAD; commit ownership and scope lineage cannot be re-verified.",
    };
  }
  const authoritativeHeadSha = authoritative.headSha;
  let currentHead: string;
  try {
    currentHead = (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim();
  } catch (error: unknown) {
    return lineageFailure(`Current Git HEAD is unreadable (${error instanceof Error ? error.message : String(error)}).`, "unresolved");
  }
  const range = await listGitDagCommits(rootDirectory, authoritativeHeadSha, currentHead);
  if (!range.commits) return lineageFailure(range.diagnostic ?? "Git lineage cannot be established.");
  const dagCommits = range.commits;

  let baselineRecords: TaskClaimBaseline[];
  let taskFiles: ProjectTaskFile[];
  let evidenceRecords: TaskEvidenceRecord[];
  let runEvents: Awaited<ReturnType<typeof readRunLog>>;
  try {
    baselineRecords = await readAllTaskBaselineRecords(rootDirectory);
    taskFiles = await allTaskFiles(rootDirectory, dirname(authoritative.taskFile));
    evidenceRecords = await readTaskEvidence(rootDirectory);
    runEvents = await readRunLog(rootDirectory);
  } catch (error: unknown) {
    return lineageFailure(`Canonical task attribution evidence is unreadable (${error instanceof Error ? error.message : String(error)}).`, "unresolved");
  }

  const commitBySha = new Map(dagCommits.map((commit) => [commit.sha, commit]));

  // A completed task whose work spans more than one commit is proven as a
  // whole bounded chain from its claim/epoch baseline to the commit its
  // completion record is bound to. Every chain commit must fit the task's
  // current scope, and the chain contract must be stable (a task file may be
  // introduced by the chain itself when it is absent at the baseline).
  const chainProofsByTask = new Map<string, ResolvedTaskCommitProof[]>();
  for (const taskFile of taskFiles) {
    const task = taskFile.task;
    if (task.id === authoritative.taskId || task.state !== "done") continue;
    const relativeTaskFile = normalizeRepoPath(relative(rootDirectory, taskFile.path));
    const taskBaselines = baselineRecords.filter((record) => record.taskId === task.id);
    const taskEvidence = evidenceRecords.filter((record) => record.taskId === task.id);
    const completions = taskEvidence.filter((record) => (
      record.type === "completion"
      && record.result === "pass"
      && record.gateEligible === true
      && record.subject.repository === "git"
      && record.subject.taskId === task.id
    ));
    if (completions.length !== 1) continue;
    const completion = completions[0];
    const taskBaseline = [...taskBaselines]
      .filter((record) => (
        record.repository === "git"
        && record.baselineId === completion.subject.baselineId
        && ((record.phase ?? "claim") === "claim" || record.phase === "epoch")
      ))
      .at(-1);
    if (!taskBaseline || !taskBaseline.headSha || taskBaseline.taskFile !== relativeTaskFile) continue;
    if (task.owner !== completion.agent) continue;
    const doneEvents = runEvents.filter((event) => (
      event.event === "done"
      && event.outcome === "ok"
      && event.state === "done"
      && event.task === task.id
      && event.runId === completion.runId
      && event.agent === completion.agent
    ));
    if (doneEvents.length !== 1) continue;
    const evidenceSet = completion.evidenceSet ?? [];
    if (new Set(evidenceSet).size !== evidenceSet.length) continue;
    if (!evidenceSet.every((id) => {
      const matchesById = taskEvidence.filter((record) => record.id === id);
      return matchesById.length === 1
        && matchesById[0].result === "pass"
        && matchesById[0].type !== "completion"
        && sameEvidenceCandidate(matchesById[0].subject, completion.subject);
    })) continue;

    const chainHead = completion.subject.headSha;
    if (!chainHead) continue;
    const chain = walkSingleParentTaskChain(commitBySha, taskBaseline.headSha, chainHead);
    if (!chain) continue;
    if (!(await taskChainContractStable(rootDirectory, relativeTaskFile, taskBaseline.headSha, chain, task))) continue;

    let chainScopeValid = true;
    for (const node of chain) {
      const scopeFiles: string[] = [];
      for (const path of node.files) {
        if (isBookkeepingPath(path, taskBaseline)) continue;
        const originalFingerprint = taskBaseline.dirtyFiles[path];
        if (originalFingerprint && originalFingerprint === await gitFileFingerprint(rootDirectory, node.sha, path)) {
          continue;
        }
        scopeFiles.push(path);
      }
      const scope = verifyTaskFileScope(task, scopeFiles);
      if (scope.outOfScopeFiles.length > 0 || scope.forbiddenTouchedFiles.length > 0) {
        chainScopeValid = false;
        break;
      }
    }
    if (!chainScopeValid) continue;

    chainProofsByTask.set(task.id, chain.map((node) => ({
      attribution: {
        sha: node.sha,
        taskId: task.id,
        kind: "task-candidate",
        files: node.files,
      },
      taskFile: relativeTaskFile,
      completionAgent: completion.agent,
      taskBaselineDirtyFiles: taskBaseline.dirtyFiles,
    })));
  }

  const proofCache = new Map<string, Promise<ResolvedTaskCommitProof | undefined>>();
  const proofForCandidate = (sha: string): Promise<ResolvedTaskCommitProof | undefined> => {
    const existing = proofCache.get(sha);
    if (existing) return existing;
    const operation = (async () => {
      let commit = dagCommits.find((entry) => entry.sha === sha);
      if (!commit) {
        try {
          const line = (await gitOutput(rootDirectory, ["rev-list", "--parents", "-n", "1", sha])).trim();
          const [commitSha, ...parents] = line.split(" ");
          if (!commitSha) return undefined;
          commit = await readGitCommitNode(rootDirectory, commitSha, parents, authoritativeHeadSha);
        } catch {
          return undefined;
        }
      }
      return resolveTaskCandidateCommit(
        rootDirectory,
        taskFiles,
        baselineRecords,
        evidenceRecords,
        runEvents,
        authoritative.taskId,
        commit,
      );
    })();
    proofCache.set(sha, operation);
    return operation;
  };

  const proofAtCache = new Map<string, Promise<ResolvedTaskCommitProof | undefined>>();
  const proofAt = (sha: string): Promise<ResolvedTaskCommitProof | undefined> => {
    const existing = proofAtCache.get(sha);
    if (existing) return existing;
    const operation = (async () => {
      const candidateProof = await proofForCandidate(sha);
      const coveringChains = [...chainProofsByTask.entries()]
        .filter(([, chain]) => chain.some((entry) => entry.attribution.sha === sha));
      if (coveringChains.length > 1) return undefined;
      const chainProof = coveringChains.length === 1
        ? coveringChains[0][1].find((entry) => entry.attribution.sha === sha)
        : undefined;
      const proofs = [candidateProof, chainProof].filter(
        (proof): proof is ResolvedTaskCommitProof => proof !== undefined,
      );
      if (new Set(proofs.map((proof) => proof.attribution.taskId)).size > 1) return undefined;
      return proofs[0];
    })();
    proofAtCache.set(sha, operation);
    return operation;
  };

  const proofByCommit = new Map<string, ResolvedTaskCommitProof>();
  for (const commit of dagCommits) {
    const candidateProof = await proofAt(commit.sha);
    if (candidateProof) {
      proofByCommit.set(commit.sha, candidateProof);
      continue;
    }
    const bookkeepingProof = await resolveCompletionBookkeepingCommit(rootDirectory, commit, proofAt);
    if (bookkeepingProof) proofByCommit.set(commit.sha, bookkeepingProof);
  }

  const proven = [...proofByCommit.values()].map((proof) => proof.attribution);
  const provenPathCount = proven.reduce((count, proof) => count + proof.files.length, 0);
  if (
    proven.length > MAX_TASK_ATTRIBUTION_OUTPUT_COMMITS
    || provenPathCount > MAX_TASK_ATTRIBUTION_OUTPUT_FILES
  ) {
    return lineageFailure(
      `Proven task attribution exceeds the bounded output limit (${MAX_TASK_ATTRIBUTION_OUTPUT_COMMITS} commits / ${MAX_TASK_ATTRIBUTION_OUTPUT_FILES} files); scope fails closed.`,
      "intervening",
      boundCommitAttributions(proven),
    );
  }

  const acceptedMergeCommits = new Set<string>();
  const mergeAttributions: TaskMergeAttribution[] = [];
  const branchAncestors = (parent: string): Set<string> => {
    const ancestors = new Set<string>();
    const pending = [parent];
    while (pending.length > 0) {
      const sha = pending.pop();
      if (!sha || ancestors.has(sha)) continue;
      ancestors.add(sha);
      const commit = commitBySha.get(sha);
      if (commit) pending.push(...commit.parents);
    }
    return ancestors;
  };
  const ambiguousMerge = dagCommits.find((commit) => commit.parents.length === 2 && commit.mergeAmbiguity);
  if (ambiguousMerge?.mergeAmbiguity) {
    return lineageFailure(
      `${ambiguousMerge.mergeAmbiguity} Changed paths: ${ambiguousMerge.mergeResolutionFiles?.join(", ") || "unknown"}; scope fails closed.`,
      "intervening",
      proven,
      mergeAttributions,
    );
  }
  for (const merge of dagCommits.filter((commit) => commit.parents.length === 2)) {
    if (merge.mergeResolutionFiles && merge.mergeResolutionFiles.length > 0) {
      return lineageFailure(
        `Merge commit ${shortenSha(merge.sha)} (parents ${merge.parents.map(shortenSha).join(", ")}) contains unresolved merge-resolution paths: ${merge.mergeResolutionFiles.join(", ")}; scope fails closed.`,
        "intervening",
        proven,
        mergeAttributions,
      );
    }
    const ancestors = new Set<string>();
    for (const parent of merge.parents.slice(1)) {
      for (const ancestor of branchAncestors(parent)) ancestors.add(ancestor);
    }
    const unproven = dagCommits.find((commit) => (
      ancestors.has(commit.sha)
      && (
        (commit.parents.length === 2 && !acceptedMergeCommits.has(commit.sha))
        || (
          commit.parents.length === 1
          && commit.files.some((path) => !isBookkeepingPath(path, authoritative))
          && !proofByCommit.has(commit.sha)
        )
      )
    ));
    if (unproven) {
      const path = unproven.files.find((entry) => !isBookkeepingPath(entry, authoritative)) ?? "no non-bookkeeping path";
      return lineageFailure(
        `Merge commit ${shortenSha(merge.sha)} (parents ${merge.parents.map(shortenSha).join(", ")}) includes unproven branch commit ${shortenSha(unproven.sha)} (${path}); merge attribution fails closed.`,
        "intervening",
        proven,
        mergeAttributions,
      );
    }
    const mergeFileCount = mergeAttributions.reduce((count, attribution) => count + attribution.files.length, 0) + merge.files.length;
    if (
      mergeAttributions.length + 1 > MAX_TASK_ATTRIBUTION_OUTPUT_COMMITS
      || mergeFileCount > MAX_TASK_ATTRIBUTION_OUTPUT_FILES
    ) {
      return lineageFailure(
        `Merge attribution for ${shortenSha(merge.sha)} (parents ${merge.parents.map(shortenSha).join(", ")}) exceeds the bounded output limit (${MAX_TASK_ATTRIBUTION_OUTPUT_COMMITS} merge commits / ${MAX_TASK_ATTRIBUTION_OUTPUT_FILES} files); scope fails closed.`,
        "intervening",
        proven,
        mergeAttributions,
      );
    }
    acceptedMergeCommits.add(merge.sha);
    mergeAttributions.push({
      sha: merge.sha,
      parents: [...merge.parents],
      files: [...merge.files],
      inheritedFrom: [...(merge.inheritedFrom ?? [])],
    });
  }

  // A merge must not make a forbidden or out-of-scope first-parent change
  // disappear merely because a later commit reverted its tree effect. Proven
  // task commits are excluded by their canonical proof; all other historical
  // first-parent paths remain part of the merge safety decision.
  if (mergeAttributions.length > 0) {
    const activeTask = taskFiles.find(({ task }) => task.id === authoritative.taskId)?.task;
    if (!activeTask) {
      return lineageFailure(
        `Active task ${authoritative.taskId} is missing from canonical task files; first-parent merge scope cannot be proven.`,
        "unresolved",
        proven,
        mergeAttributions,
      );
    }
    let firstParentSha = currentHead;
    while (firstParentSha !== authoritative.headSha) {
      const firstParentCommit = commitBySha.get(firstParentSha);
      if (!firstParentCommit || firstParentCommit.parents.length === 0) {
        return lineageFailure(
          `Merge first-parent history from ${shortenSha(currentHead)} does not reach baseline ${shortenSha(authoritative.headSha)} inside the bounded DAG; scope fails closed.`,
          "intervening",
          proven,
          mergeAttributions,
        );
      }
      if (firstParentCommit.parents.length === 1 && !proofByCommit.has(firstParentCommit.sha)) {
        const historicalFiles = firstParentCommit.files.filter((path) => !isBookkeepingPath(path, authoritative));
        const historicalScope = verifyTaskFileScope(activeTask, historicalFiles);
        const problematicPath = historicalScope.forbiddenTouchedFiles[0] ?? historicalScope.outOfScopeFiles[0];
        if (problematicPath) {
          return lineageFailure(
            `Merge first-parent history includes commit ${shortenSha(firstParentCommit.sha)} with forbidden or out-of-scope path ${problematicPath}; merge scope fails closed.`,
            "intervening",
            proven,
            mergeAttributions,
          );
        }
      }
      firstParentSha = firstParentCommit.parents[0];
    }
  }

  const taskTimeline = taskRecords.filter((record) => record.taskId === authoritative.taskId);
  const claims = taskTimeline.filter((record) => (record.phase ?? "claim") === "claim");
  for (let index = 1; index < claims.length; index += 1) {
    const previousIndex = taskTimeline.indexOf(claims[index - 1]);
    const claimIndex = taskTimeline.indexOf(claims[index]);
    const hasHandoff = taskTimeline.slice(previousIndex + 1, claimIndex)
      .some((record) => record.phase === "release" || record.phase === "block");
    if (
      !hasHandoff
      && claims[index - 1].headSha
      && claims[index].headSha
      && claims[index - 1].headSha !== claims[index].headSha
    ) {
      return lineageFailure(
        `Claim baseline advanced from ${shortenSha(claims[index - 1].headSha)} to ${shortenSha(claims[index].headSha)} without a recorded release/block handoff; legacy lineage fails closed.`,
        "intervening",
        proven,
      );
    }
  }

  for (let index = 0; index < taskTimeline.length; index += 1) {
    const record = taskTimeline[index];
    if (record.phase !== "release" && record.phase !== "block") continue;
    const nextClaim = taskTimeline.slice(index + 1).find((entry) => (entry.phase ?? "claim") === "claim");
    if (!nextClaim) continue;
    if (!record.headSha || !nextClaim.headSha) {
      return lineageFailure("Release/reclaim records do not contain Git HEAD; scope lineage fails closed.", "intervening", proven);
    }
    const interval = await listGitDagCommits(rootDirectory, record.headSha, nextClaim.headSha);
    if (!interval.commits) {
      return lineageFailure(`Release/reclaim range ${shortenSha(record.headSha)}..${shortenSha(nextClaim.headSha)} cannot be traversed as a bounded DAG: ${interval.diagnostic ?? "unknown history error"}`, "intervening", proven, mergeAttributions);
    }
    const dirtyFile = snapshotDirtyDifference(record, nextClaim);
    if (dirtyFile) {
      return lineageFailure(`Working-tree file ${dirtyFile} changed while the task was released; ownership is ambiguous and scope fails closed.`, "intervening", proven);
    }
    for (const commit of interval.commits) {
      if (commit.parents.length === 2 && acceptedMergeCommits.has(commit.sha)) continue;
      if (!proofByCommit.has(commit.sha)) {
        const file = commit.files[0] ?? "no changed path";
        return lineageFailure(`Intervening commit ${shortenSha(commit.sha)} (${file}) has no canonical completed-task provenance in the merge DAG; scope fails closed.`, "intervening", proven, mergeAttributions);
      }
    }
  }

  const taskOwnedCommitFiles = new Set<string>();
  for (const commit of dagCommits) {
    if (proofByCommit.has(commit.sha)) continue;
    if (commit.parents.length === 2 && acceptedMergeCommits.has(commit.sha)) continue;
    for (const path of commit.files) {
      if (!isBookkeepingPath(path, authoritative)) taskOwnedCommitFiles.add(path);
    }
  }
  for (const proof of proofByCommit.values()) {
    for (const path of proof.attribution.files) {
      const otherTaskDirtyFingerprint = proof.taskBaselineDirtyFiles[path];
      if (
        otherTaskDirtyFingerprint !== undefined
        && path !== proof.taskFile
        && !isBookkeepingPath(path, authoritative)
        && authoritative.dirtyFiles[path] !== otherTaskDirtyFingerprint
      ) {
        return {
          lineageStatus: "intervening",
          lineageDiagnostic: `Task ${proof.attribution.taskId} commit ${shortenSha(proof.attribution.sha)} includes ${path}, which was already dirty at that task's baseline but is not the same pre-existing content at this task's baseline; ownership is ambiguous and scope fails closed.`,
          provenOtherTaskCommits: proven,
        };
      }
      if (
        taskOwnedCommitFiles.has(path)
        || (authoritative.dirtyFiles[path] !== undefined && path !== proof.taskFile)
        || taskTimeline.some((record) => (
          (record.phase === "release" || record.phase === "block")
          && record.dirtyFiles[path] !== undefined
          && path !== proof.taskFile
        ))
      ) {
        return {
          lineageStatus: "intervening",
          lineageDiagnostic: `Task ${proof.attribution.taskId} commit ${shortenSha(proof.attribution.sha)} overlaps task-owned or pre-existing file ${path}; same-file attribution is ambiguous and scope fails closed.`,
          provenOtherTaskCommits: proven,
        };
      }
    }
  }

  let currentDirty: string[];
  try {
    currentDirty = (await listGitChangedFiles(rootDirectory))
      .filter((path) => !isBookkeepingPath(path, authoritative));
  } catch (error: unknown) {
    return lineageFailure(`Current working-tree attribution is unreadable (${error instanceof Error ? error.message : String(error)}).`, "unresolved", proven);
  }
  for (const proof of proofByCommit.values()) {
    const overlap = currentDirty.find((path) => proof.attribution.files.includes(path));
    if (overlap) {
      return {
        lineageStatus: "intervening",
        lineageDiagnostic: `Task ${proof.attribution.taskId} commit ${shortenSha(proof.attribution.sha)} overlaps current working-tree file ${overlap}; same-file attribution is ambiguous and scope fails closed.`,
        provenOtherTaskCommits: proven,
      };
    }
  }

  let finalHead: string;
  try {
    finalHead = (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim();
  } catch (error: unknown) {
    return lineageFailure(`Current Git HEAD became unreadable during lineage evaluation (${error instanceof Error ? error.message : String(error)}).`, "unresolved", proven);
  }
  if (finalHead !== currentHead) {
    return lineageFailure(
      `Git HEAD changed from ${shortenSha(currentHead)} to ${shortenSha(finalHead)} while task lineage was evaluated; scope fails closed.`,
      "intervening",
      proven,
    );
  }

  return {
    lineageStatus: proven.length > 0 ? "attributed" : "clean",
    lineageHeadSha: currentHead,
    ...(proven.length > 0 ? { provenOtherTaskCommits: proven } : {}),
    ...(mergeAttributions.length > 0 ? { mergeCommits: mergeAttributions } : {}),
  };
}

export async function readTaskBaseline(
  rootDirectory: string,
  taskId: string,
): Promise<TaskClaimBaseline | undefined> {
  const allRecords = await readAllTaskBaselineRecords(rootDirectory);
  const records = allRecords.filter((record) => record.taskId === taskId);
  if (records.length === 0) {
    return undefined;
  }

  const epoch = latestTaskEpoch(records);
  const epochIndex = epoch ? records.lastIndexOf(epoch) : -1;
  // Once an epoch exists, only its append-only suffix is current. Older
  // evidence remains readable history, but cannot affect current attribution.
  const currentRecords = epoch ? records.slice(epochIndex) : records;
  const claims = currentRecords.filter((record) => (record.phase ?? "claim") === "claim");
  const authoritative = epoch ?? claims[0] ?? currentRecords[0] ?? records[0];
  const lastRecord = currentRecords[currentRecords.length - 1];
  // A task still released has no active candidate to attribute. Its next claim
  // will validate the complete release interval against the recorded handoff.
  if (lastRecord.phase === "release" || lastRecord.phase === "block") {
    return { ...authoritative, lineageStatus: "clean" };
  }
  const lineage = await resolveTaskBaselineLineage(rootDirectory, authoritative, currentRecords);
  return { ...authoritative, ...lineage };
}

export async function listTaskChangedFilesSinceBaseline(
  rootDirectory: string,
  baseline: TaskClaimBaseline,
): Promise<string[]> {
  if (baseline.repository === "git" && baseline.headSha) {
    const committedAndWorking = await gitPaths(rootDirectory, [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      baseline.headSha,
    ]);
    const untracked = await gitPaths(rootDirectory, ["ls-files", "--others", "--exclude-standard", "-z"]);
    return [...new Set([...committedAndWorking, ...untracked].map(normalizeGitPath))].sort();
  }

  throw new TaskGitComparisonError(
    ["baseline"],
    new Error("task baseline has no resolvable Git HEAD; current paths must be supplied explicitly"),
  );
}

/**
 * Epoch recovery must inspect history, not only the endpoint tree. A path that
 * was created and deleted (or modified and restored) still belongs to the
 * predecessor interval and must remain visible at the new anchor.
 */
async function listTaskEpochChangedFilesSinceBaseline(
  rootDirectory: string,
  baseline: TaskClaimBaseline,
): Promise<{ all: string[]; historical: string[]; workingTree: string[] }> {
  if (baseline.repository !== "git" || !baseline.headSha) {
    throw new TaskGitComparisonError(
      ["baseline"],
      new Error("epoch recovery requires a resolvable Git HEAD"),
    );
  }

  const currentHead = (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim();
  const historicalPaths = new Set<string>();
  if (currentHead !== baseline.headSha) {
    try {
      await gitOutput(rootDirectory, ["merge-base", "--is-ancestor", baseline.headSha, currentHead]);
    } catch (error: unknown) {
      throw new Error(`Epoch recovery requires the predecessor HEAD to be an ancestor of current HEAD; unsupported history fails closed (${error instanceof Error ? error.message : String(error)}).`);
    }

    const lines = (await gitOutput(rootDirectory, [
      "rev-list", "--reverse", "--topo-order", "--parents", `${baseline.headSha}..${currentHead}`,
    ])).split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length > MAX_TASK_EPOCH_COMMITS) {
      throw new Error(`Epoch recovery history exceeds the ${MAX_TASK_EPOCH_COMMITS}-commit safety bound.`);
    }

    let previous = baseline.headSha;
    for (const line of lines) {
      const [sha, ...parents] = line.split(" ");
      if (!sha || parents.length !== 1 || parents[0] !== previous) {
        throw new Error(`Epoch recovery found merge or rewritten ancestry at ${shortenSha(sha)}; unsupported history fails closed.`);
      }
      const commitFiles = await gitPaths(rootDirectory, [
        "diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", sha,
      ]);
      if (commitFiles.length > MAX_TASK_ATTRIBUTION_FILES) {
        throw new Error(`Epoch recovery commit ${shortenSha(sha)} exceeds the ${MAX_TASK_ATTRIBUTION_FILES}-file safety bound.`);
      }
      for (const path of commitFiles) historicalPaths.add(normalizeGitPath(path));
      previous = sha;
    }
    if (previous !== currentHead) {
      throw new Error("Epoch recovery could not prove a complete linear predecessor history; scope fails closed.");
    }
  }

  const workingTreePaths = await gitPaths(rootDirectory, [
    "diff", "--name-only", "--no-renames", "-z", baseline.headSha,
  ]);
  const untracked = await gitPaths(rootDirectory, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const workingTree = [...new Set([...workingTreePaths, ...untracked].map(normalizeGitPath))].sort();
  return {
    all: [...new Set([...historicalPaths, ...workingTree])].sort(),
    historical: [...historicalPaths].sort(),
    workingTree,
  };
}

async function taskBaselineSnapshotDiagnostic(
  rootDirectory: string,
  baseline: TaskClaimBaseline | undefined,
): Promise<string | undefined> {
  if (
    !baseline
    || baseline.repository !== "git"
    || !baseline.lineageHeadSha
    || (baseline.lineageStatus !== "clean" && baseline.lineageStatus !== "attributed")
  ) return undefined;

  let currentHead: string;
  try {
    currentHead = (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim();
  } catch (error: unknown) {
    return `Current Git HEAD is unreadable after lineage evaluation (${error instanceof Error ? error.message : String(error)}); scope fails closed.`;
  }
  if (currentHead !== baseline.lineageHeadSha) {
    return `Git HEAD changed from ${shortenSha(baseline.lineageHeadSha)} to ${shortenSha(currentHead)} after lineage evaluation; scope fails closed.`;
  }

  const excludedPaths = new Set((baseline.provenOtherTaskCommits ?? []).flatMap((commit) => commit.files));
  if (excludedPaths.size > 0) {
    let dirtyFiles: string[];
    try {
      dirtyFiles = await listGitChangedFiles(rootDirectory);
    } catch (error: unknown) {
      return `Current working-tree attribution is unreadable after lineage evaluation (${error instanceof Error ? error.message : String(error)}); scope fails closed.`;
    }
    const overlap = dirtyFiles.find((path) => excludedPaths.has(path));
    if (overlap) {
      return `Task-attributed working-tree file ${overlap} overlaps an excluded task commit after lineage evaluation; scope fails closed.`;
    }
  }

  try {
    currentHead = (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim();
  } catch (error: unknown) {
    return `Current Git HEAD became unreadable during candidate capture (${error instanceof Error ? error.message : String(error)}); scope fails closed.`;
  }
  if (currentHead !== baseline.lineageHeadSha) {
    return `Git HEAD changed to ${shortenSha(currentHead)} during candidate capture; scope fails closed.`;
  }
  return undefined;
}

export async function captureTaskScope(options: {
  rootDirectory: string;
  task: ProjectTask;
  taskPath?: string;
  baseline?: TaskClaimBaseline;
  changedFiles?: readonly string[];
}): Promise<TaskScopeSnapshot> {
  const diagnostics: string[] = [];
  let comparisonKnown = true;
  let rawChangedFiles: readonly string[] = options.changedFiles ?? [];

  const beforeLineageCheck = await taskBaselineSnapshotDiagnostic(options.rootDirectory, options.baseline);
  if (beforeLineageCheck) {
    comparisonKnown = false;
    diagnostics.push(beforeLineageCheck);
  }

  if (options.changedFiles === undefined) {
    try {
      rawChangedFiles = options.baseline
        ? await listTaskChangedFilesSinceBaseline(options.rootDirectory, options.baseline)
        : await listGitChangedFiles(options.rootDirectory);
    } catch (error: unknown) {
      comparisonKnown = false;
      diagnostics.push(error instanceof Error ? error.message : String(error));
      rawChangedFiles = [];
      if (options.baseline?.repository === "none") {
        diagnostics.push("Non-Git task baseline has no explicit candidate paths; repository-wide change discovery is unavailable.");
      }
    }
  }

  const afterLineageCheck = await taskBaselineSnapshotDiagnostic(options.rootDirectory, options.baseline);
  if (afterLineageCheck) {
    comparisonKnown = false;
    diagnostics.push(afterLineageCheck);
  }

  const normalizedTaskPath = options.taskPath
    ? normalizeRepoPath(options.taskPath)
    : undefined;
  const scope = options.baseline
    ? await verifyTaskFileScopeSinceBaseline(
      options.rootDirectory,
      options.task,
      rawChangedFiles,
      options.baseline,
    )
    : verifyTaskFileScope(
      options.task,
      normalizedTaskPath
        ? rawChangedFiles.filter((path) => !isDefaultBookkeepingPath(normalizeRepoPath(path), normalizedTaskPath))
        : rawChangedFiles,
  );
  if (scope.attribution?.diagnostics.some((diagnostic) => diagnostic.startsWith("Carried-forward path "))) {
    comparisonKnown = false;
    diagnostics.push("A carried-forward path overlaps another task's excluded commit; ownership is ambiguous and scope fails closed.");
  }

  const lineage = options.baseline?.lineageStatus;
  if (
    options.baseline?.repository === "git"
    && lineage !== undefined
    && lineage !== "clean"
    && lineage !== "attributed"
  ) {
    comparisonKnown = false;
    diagnostics.push(
      options.baseline.lineageDiagnostic
        ?? `Task baseline lineage is ${lineage}; scope comparison fails closed.`,
    );
  }

  return {
    ...scope,
    comparisonKnown,
    diagnostics: [...new Set([
      ...(scope.attribution?.diagnostics ?? []),
      ...diagnostics,
    ])],
  };
}

export async function verifyTaskFileScopeSinceBaseline(
  rootDirectory: string,
  task: ProjectTask,
  changedFiles: readonly string[],
  baseline: TaskClaimBaseline,
): Promise<TaskFileScopeResult> {
  const carriedForwardPaths = (baseline.carriedForwardFiles ?? []).map(({ path }) => normalizeRepoPath(path));
  const allNormalizedChanged = [...new Set([
    ...changedFiles.map(normalizeRepoPath),
    ...carriedForwardPaths,
  ])]
    .filter((file) => file.length > 0)
    .sort();
  const excludedCommits = baseline.provenOtherTaskCommits ?? [];
  const carriedForwardSet = new Set(carriedForwardPaths);
  const allExcludedFileSet = new Set(excludedCommits.flatMap((commit) => commit.files.map(normalizeRepoPath)));
  const ambiguousCarriedFiles = allNormalizedChanged.filter((file) => (
    carriedForwardSet.has(file) && allExcludedFileSet.has(file)
  ));
  const excludedFileSet = new Set([...allExcludedFileSet].filter((file) => !carriedForwardSet.has(file)));
  const excludedFiles = allNormalizedChanged.filter((file) => excludedFileSet.has(file));
  const normalizedChanged = allNormalizedChanged.filter((file) => !excludedFileSet.has(file));
  const fingerprints = Object.fromEntries(
    (await fingerprintChangedFiles(rootDirectory, normalizedChanged))
      .map(({ path, sha256 }) => [path, sha256]),
  );
  const attributedFiles: string[] = [];
  const preExistingFiles: string[] = [];
  const bookkeepingFiles: string[] = [];
  for (const file of normalizedChanged) {
    if (isBookkeepingPath(file, baseline)) {
      bookkeepingFiles.push(file);
    } else if (carriedForwardSet.has(file)) {
      // A carried path is deliberately never reclassified as pre-existing at
      // the new anchor. Its current content remains part of task scope.
      attributedFiles.push(file);
    } else if (baseline.dirtyFiles[file] !== undefined && baseline.dirtyFiles[file] === fingerprints[file]) {
      preExistingFiles.push(file);
    } else {
      attributedFiles.push(file);
    }
  }
  const scope = verifyTaskFileScope(task, attributedFiles);
  return {
    ...scope,
    attribution: {
      baselineId: baseline.baselineId,
      attributedFiles,
      carriedForwardFiles: carriedForwardPaths.filter((file) => !excludedFileSet.has(file)).sort(),
      preExistingFiles,
      bookkeepingFiles,
      excludedFiles,
      excludedCommits,
      lineageStatus: baseline.lineageStatus ?? "clean",
      ...(baseline.mergeCommits && baseline.mergeCommits.length > 0 ? { mergeCommits: baseline.mergeCommits } : {}),
      diagnostics: [
        ...baseline.diagnostics,
        ...(baseline.lineageDiagnostic ? [baseline.lineageDiagnostic] : []),
        ...ambiguousCarriedFiles.map((file) => (
          `Carried-forward path ${file} overlaps another task's excluded commit; ownership is ambiguous and scope fails closed.`
        )),
      ],
    },
  };
}

export async function captureTaskEvidenceSubject(
  rootDirectory: string,
  task: ProjectTask,
  changedFiles: readonly string[],
  baseline?: TaskClaimBaseline,
): Promise<TaskEvidenceCandidateSubject> {
  const beforeLineageCheck = await taskBaselineSnapshotDiagnostic(rootDirectory, baseline);
  if (beforeLineageCheck) {
    throw new TaskGitComparisonError(["baseline lineage"], new Error(beforeLineageCheck));
  }
  const normalizedChangedFiles = [...new Set(changedFiles.map(normalizeRepoPath))]
    .filter((path) => path.length > 0)
    .sort();
  const fingerprints = await fingerprintChangedFiles(rootDirectory, normalizedChangedFiles);
  let isGit = false;
  try {
    isGit = (await gitOutput(rootDirectory, ["rev-parse", "--is-inside-work-tree"])).trim() === "true";
  } catch {
    isGit = false;
  }
  const headSha = isGit
    ? (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim() || undefined
    : undefined;
  if (baseline?.lineageHeadSha && headSha !== baseline.lineageHeadSha) {
    throw new TaskGitComparisonError(
      ["rev-parse", "HEAD"],
      new Error(`Git HEAD changed from ${shortenSha(baseline.lineageHeadSha)} to ${shortenSha(headSha)} during candidate capture.`),
    );
  }
  const repository = headSha ? "git" : "none";
  const diff = isGit && normalizedChangedFiles.length > 0
    ? [
      // Lifecycle writes to the task file are bookkeeping; only implementation
      // paths may change the evidence subject revision.
      await gitOutput(rootDirectory, ["diff", "--no-ext-diff", "--binary", "HEAD", "--", ...normalizedChangedFiles]),
      await gitOutput(rootDirectory, ["diff", "--cached", "--no-ext-diff", "--binary", "HEAD", "--", ...normalizedChangedFiles]),
    ]
    : [];
  const candidateId = `candidate:${hashCandidatePart({
    // Lifecycle state/owner changes (doing -> review -> done) are not implementation changes.
    task: renderTaskMarkdown({ ...task, state: "doing", owner: "none" }),
    headSha,
    changedFiles: normalizedChangedFiles,
    fingerprints,
    diff,
  })}`;
  const worktreeId = `worktree:${hashCandidatePart({
    changedFiles: normalizedChangedFiles,
    fingerprints,
    diff,
  })}`;

  const afterLineageCheck = await taskBaselineSnapshotDiagnostic(rootDirectory, baseline);
  if (afterLineageCheck) {
    throw new TaskGitComparisonError(["baseline lineage"], new Error(afterLineageCheck));
  }

  return {
    taskId: task.id,
    repository,
    ...(headSha ? { headSha } : {}),
    baselineId: `unclaimed:${headSha ?? "none"}`,
    candidateId,
    worktreeId,
  };
}

async function defaultRunCommand(
  rootDirectory: string,
  command: string,
  timeoutMs = DEFAULT_TASK_COMMAND_TIMEOUT_MS,
): Promise<number> {
  try {
    await execAsync(command, {
      cwd: rootDirectory,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
    });
    return 0;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error) {
      return typeof error.code === "number" ? error.code : 1;
    }

    return 1;
  }
}

function verifyNextStep(result: {
  passed: boolean;
  owner?: string;
  taskId: string;
}): string {
  if (!result.passed) {
    return "fix failures and rerun verify";
  }

  if (result.owner) {
    return `pnpm exec apk review ${result.taskId} --owner ${result.owner}`;
  }

  return "move task to review or done with a registered owner";
}

function verificationEvidenceType(check: TaskVerificationCheck, externallyObserved = false): TaskEvidenceType {
  if (check.evidenceType === "benchmark") {
    return "benchmark";
  }
  if (check.environment === "ci") {
    // CI is an observation boundary regardless of manual type or report profile.
    // Local runs remain diagnostic; only external recording emits hosted proof.
    return externallyObserved ? "ci" : "automated-test";
  }
  if (check.profile === "report") {
    return "report";
  }
  if (check.environment === "live") {
    return "live";
  }
  if (check.type === "manual") {
    return "manual";
  }
  return "automated-test";
}

/** Every CI declaration requires an externally observed result. */
function isHostedCiCheck(check: TaskVerificationCheck): boolean {
  return check.environment === "ci";
}

function verificationRunId(): string {
  return `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSelectedVerificationProfile(
  check: TaskVerificationCheck,
  profile: TaskVerificationProfile | "all" | undefined,
): boolean {
  return profile === undefined || profile === "all" || check.profile === profile;
}

function sameTaskEvidenceSubject(
  left: TaskEvidenceCandidateSubject,
  right: TaskEvidenceCandidateSubject,
): boolean {
  return left.taskId === right.taskId
    && left.repository === right.repository
    && left.headSha === right.headSha
    && left.baselineId === right.baselineId
    && left.candidateId === right.candidateId
    && left.worktreeId === right.worktreeId;
}

function unknownTaskEvidenceSubject(
  task: ProjectTask,
  baseline: TaskClaimBaseline | undefined,
): TaskEvidenceCandidateSubject {
  return {
    taskId: task.id,
    repository: "none",
    baselineId: baseline?.baselineId ?? "unknown",
    candidateId: "candidate:unknown",
    worktreeId: "worktree:unknown",
  };
}

export async function verifyTask(options: TaskVerifyOptions): Promise<TaskVerifyResult> {
  const taskPath = await findTaskFile(
    options.rootDirectory,
    options.taskId,
    options.taskDirectory,
  );
  const { task } = await loadTaskFile(taskPath);
  const baseline = await readTaskBaseline(options.rootDirectory, task.id);
  const ownerAgent = options.owner
    ? await requireAgent(options.rootDirectory, options.owner)
    : undefined;
  const beforeSnapshot = await captureTaskScope({
    rootDirectory: options.rootDirectory,
    task,
    taskPath,
    baseline,
    changedFiles: options.changedFiles,
  });
  const scope = beforeSnapshot;
  const runId = verificationRunId();
  let capturedSubject: TaskEvidenceCandidateSubject;
  const diagnostics = [...beforeSnapshot.diagnostics];
  try {
    capturedSubject = await captureTaskEvidenceSubject(
      options.rootDirectory,
      task,
      scope.changedFiles,
      baseline,
    );
  } catch (error: unknown) {
    diagnostics.push(error instanceof Error ? error.message : String(error));
    beforeSnapshot.comparisonKnown = false;
    capturedSubject = unknownTaskEvidenceSubject(task, baseline);
  }
  const subject: TaskEvidenceCandidateSubject = baseline
    ? { ...capturedSubject, baselineId: baseline.baselineId }
    : capturedSubject;
  const checks = getTaskVerification(task);
  const commandsRun: TaskVerifyCommandResult[] = [];
  const checkResults: TaskVerifyCheckResult[] = [];
  let passed = beforeSnapshot.comparisonKnown
    && scope.outOfScopeFiles.length === 0
    && scope.forbiddenTouchedFiles.length === 0;

  for (const check of checks) {
    let status: TaskVerifyCheckStatus = "not-run";
    let reason: string | undefined;
    let exitCode: number | undefined;
    let resolvedApkIdentity: string | undefined;

    if (!passed) {
      reason = "file scope failed";
    } else if (options.checkFilesOnly) {
      reason = "file-only verification requested";
    } else if (!isSelectedVerificationProfile(check, options.profile)) {
      reason = `profile ${check.profile} not selected`;
    } else if (check.type === "manual") {
      status = "unavailable";
      reason = "manual check requires an external reviewer or operator";
    } else if (check.environment === "live") {
      status = "unavailable";
      reason = "live environment check is not executed by local verifier";
    } else if (!check.command && !check.apkOperation) {
      status = "unavailable";
      reason = "automated check has no command or apkOperation";
    } else {
      try {
        if (check.apkOperation) {
          const operationResult = await (options.runApkOperation ?? runTaskApkOperation)(
            options.rootDirectory,
            check.apkOperation,
          );
          exitCode = operationResult.exitCode;
          resolvedApkIdentity = operationResult.resolvedApkIdentity;
        } else {
          exitCode = await (options.runCommand ?? ((cmd) => defaultRunCommand(
            options.rootDirectory,
            cmd,
            options.commandTimeoutMs,
          )))(check.command!);
        }
      } catch (error: unknown) {
        exitCode = 1;
        reason = `command execution failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      status = exitCode === 0 ? "pass" : "fail";
      commandsRun.push({
        command: check.apkOperation ? `builtin:apk/${check.apkOperation}` : check.command!,
        exitCode,
        ...(check.apkOperation ? { apkOperation: check.apkOperation } : {}),
        ...(resolvedApkIdentity ? { resolvedApkIdentity } : {}),
      });
      if (status === "fail" && !reason) {
        reason = `command exited with code ${exitCode}`;
      }
    }

    checkResults.push({
      id: check.id,
      type: check.type,
      ...(check.evidenceType ? { evidenceType: check.evidenceType } : {}),
      ...(check.artifact ? { artifact: check.artifact } : {}),
      ...(check.apkOperation ? { apkOperation: check.apkOperation } : {}),
      required: check.required,
      status,
      ...(check.command ? { command: check.command } : {}),
      ...(resolvedApkIdentity ? { resolvedApkIdentity } : {}),
      ...(reason ? { reason } : {}),
    });
  }

  let afterSnapshot = await captureTaskScope({
    rootDirectory: options.rootDirectory,
    task,
    taskPath,
    baseline,
    changedFiles: baseline?.repository === "none" ? options.changedFiles : undefined,
  });
  if (!afterSnapshot.comparisonKnown && options.changedFiles !== undefined && baseline === undefined) {
    afterSnapshot = beforeSnapshot;
  }
  diagnostics.push(...afterSnapshot.diagnostics);

  let afterSubject: TaskEvidenceCandidateSubject;
  try {
    afterSubject = await captureTaskEvidenceSubject(
      options.rootDirectory,
      task,
      afterSnapshot.changedFiles,
      baseline,
    );
  } catch (error: unknown) {
    diagnostics.push(error instanceof Error ? error.message : String(error));
    afterSnapshot.comparisonKnown = false;
    afterSubject = unknownTaskEvidenceSubject(task, baseline);
  }

  if (!afterSnapshot.comparisonKnown) {
    for (const check of checkResults) {
      if (check.status === "pass") {
        check.status = "fail";
        check.reason = "baseline-aware candidate comparison unavailable; result is mixed-revision";
      }
    }
    passed = false;
  }
  const normalizedAfterSubject = baseline
    ? { ...afterSubject, baselineId: baseline.baselineId }
    : afterSubject;
  if (!sameTaskEvidenceSubject(subject, normalizedAfterSubject)) {
    for (const check of checkResults) {
      if (check.status === "pass") {
        check.status = "fail";
        check.reason = "candidate changed during verification; result is mixed-revision";
      }
    }
    passed = false;
  }

  if (afterSnapshot.outOfScopeFiles.length > 0 || afterSnapshot.forbiddenTouchedFiles.length > 0) {
    passed = false;
  }

  if (!options.checkFilesOnly && checkResults.some((check) => check.required && check.status !== "pass")) {
    passed = false;
  }

  const candidateStable = beforeSnapshot.comparisonKnown
    && afterSnapshot.comparisonKnown
    && sameTaskEvidenceSubject(subject, normalizedAfterSubject)
    && afterSnapshot.outOfScopeFiles.length === 0
    && afterSnapshot.forbiddenTouchedFiles.length === 0;

  let evidenceWritten = 0;
  for (const [index, check] of checks.entries()) {
    const result = checkResults[index];
    const hostedCheck = isHostedCiCheck(check);
    const localSummary = hostedCheck
      ? `${result.reason ? `${result.reason}; ` : ""}local diagnostic only; hosted ci evidence must be recorded externally`
      : result.reason;
    await appendTaskEvidence(options.rootDirectory, {
      taskId: task.id,
      runId,
      agent: options.owner ?? "unknown",
      // A local run can never manufacture gate-eligible hosted CI proof.
      gateEligible: Boolean(ownerAgent) && candidateStable && !hostedCheck,
      type: verificationEvidenceType(check),
      result: result.status,
      subject,
      checkId: check.id,
      profile: check.profile,
      ...(check.command ? { command: check.command } : {}),
      ...(check.apkOperation ? { apkOperation: check.apkOperation } : {}),
      ...(result.resolvedApkIdentity ? { resolvedApkIdentity: result.resolvedApkIdentity } : {}),
      ...(check.artifact ? { artifact: check.artifact } : {}),
      ...((check.evidenceRef ?? check.evidence) ? { evidence: check.evidenceRef ?? check.evidence } : {}),
      ...((check.summary ?? localSummary) ? { summary: check.summary ?? localSummary } : {}),
    });
    evidenceWritten += 1;
  }

  if (options.owner) {
    await appendRunLog(options.rootDirectory, {
      event: "verify",
      agent: ownerAgent!,
      task: task.id,
      runId,
      state: task.state,
      outcome: passed ? "ok" : "error",
      reason: `${passed ? "verify passed" : "verify failed"} (${runId})`,
    });
  }

  return {
    taskId: task.id,
    attribution: afterSnapshot.attribution,
    runId,
    subject,
    checkResults,
    evidenceWritten,
    changedFiles: afterSnapshot.changedFiles,
    outOfScopeFiles: afterSnapshot.outOfScopeFiles,
    forbiddenTouchedFiles: afterSnapshot.forbiddenTouchedFiles,
    commandsRun,
    commandsSkipped: options.checkFilesOnly ?? false,
    passed,
    diagnostics: [...new Set(diagnostics)],
    nextStep: verifyNextStep({
      passed,
      owner: options.owner,
      taskId: task.id,
    }),
  };
}

export function renderTaskVerifyResult(result: TaskVerifyResult): string {
  const lines: string[] = [
    `Task: ${result.taskId}`,
    `Run: ${result.runId}`,
    `Changed files: ${result.changedFiles.length}`,
    `File scope: ${result.outOfScopeFiles.length === 0 && result.forbiddenTouchedFiles.length === 0 ? "pass" : "fail"}`,
  ];

  if (result.attribution) {
    lines.push(`Scope attribution: baseline=${result.attribution.baselineId} lineage=${result.attribution.lineageStatus}`);
    for (const commit of result.attribution.excludedCommits) {
      lines.push(`  - excluded commit ${shortenSha(commit.sha)} task=${commit.taskId} kind=${commit.kind} files=${commit.files.join(",") || "none"}`);
    }
    for (const merge of result.attribution.mergeCommits ?? []) {
      lines.push(`  - merge ${shortenSha(merge.sha)} parents=${merge.parents.map(shortenSha).join(",")} inherited-from=${merge.inheritedFrom.map(shortenSha).join(",") || "none"} files=${merge.files.join(",") || "none"}`);
    }
  }

  if (result.outOfScopeFiles.length > 0) {
    lines.push("Out of allowed files:");
    for (const file of result.outOfScopeFiles) {
      lines.push(`  - ${file}`);
    }
  }

  if (result.forbiddenTouchedFiles.length > 0) {
    lines.push("Forbidden files touched:");
    for (const file of result.forbiddenTouchedFiles) {
      lines.push(`  - ${file}`);
    }
  }

  if (result.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...result.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
  }

  if (result.commandsSkipped) {
    lines.push("Commands: skipped");
  } else if (result.commandsRun.length === 0) {
    lines.push("Commands: none");
  } else {
    lines.push("Commands:");
    for (const command of result.commandsRun) {
      lines.push(`  - ${command.exitCode === 0 ? "pass" : "fail"} ${command.command}${command.resolvedApkIdentity ? ` (${command.resolvedApkIdentity})` : ""}`);
    }
  }

  lines.push("Checks:");
  for (const check of result.checkResults) {
    lines.push(`  - ${check.status} ${check.id}${check.required ? " (required)" : " (optional)"}${check.evidenceType ? ` evidence=${check.evidenceType}` : ""}${check.apkOperation ? ` apkOperation=${check.apkOperation}` : ""}${check.resolvedApkIdentity ? ` resolved=${check.resolvedApkIdentity}` : ""}${check.artifact ? ` artifact=${check.artifact}` : ""}${check.reason ? `: ${check.reason}` : ""}`);
  }
  lines.push(`Evidence: ${result.evidenceWritten} record(s)`);

  lines.push(`Result: ${result.passed ? "pass" : "fail"}`);
  lines.push(`Next: ${result.nextStep}`);
  lines.push("");

  return lines.join("\n");
}

export interface RecordManualVerificationOptions {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  owner: string;
  checkId: string;
  result: "pass" | "fail";
  evidence: string;
  summary?: string;
}

export interface RecordManualVerificationResult {
  taskId: string;
  checkId: string;
  type: TaskEvidenceType;
  profile: TaskVerificationProfile;
  result: "pass" | "fail";
  runId: string;
  gateEligible: boolean;
  subject: TaskEvidenceCandidateSubject;
  record: TaskEvidenceRecord;
}

const MANUAL_EVIDENCE_REFERENCE_MAX_LENGTH = TASK_VERIFICATION_REFERENCE_MAX_LENGTH;

export async function recordManualVerification(
  options: RecordManualVerificationOptions,
): Promise<RecordManualVerificationResult> {
  const taskPath = await findTaskFile(
    options.rootDirectory,
    options.taskId,
    options.taskDirectory,
  );
  const { task } = await loadTaskFile(taskPath);
  const ownerAgent = await requireAgent(options.rootDirectory, options.owner);
  if (task.state !== "doing" && task.state !== "review") {
    throw new Error(`Task ${task.id} is ${task.state}; external verification evidence can only be recorded while doing or review.`);
  }
  if (task.owner !== ownerAgent.id) {
    throw new Error(
      `Task ${task.id} is owned by ${task.owner}, not ${ownerAgent.id}; only the task owner can record verification evidence.`,
    );
  }

  const checkId = options.checkId.trim();
  if (checkId.length === 0) {
    throw new Error("A verification check id is required.");
  }
  const check = getTaskVerification(task).find((candidate) => candidate.id === checkId);
  if (!check) {
    throw new Error(`Task ${task.id} has no verification check ${checkId}.`);
  }
  const externallyObservable = check.type === "manual"
    || check.environment === "live"
    || check.environment === "ci"
    || check.evidenceType === "benchmark";
  if (!externallyObservable) {
    throw new Error(
      `Verification check ${checkId} is a local automated check and cannot be recorded externally; run apk task verify.`,
    );
  }
  if (options.result !== "pass" && options.result !== "fail") {
    throw new Error("External verification result must be pass or fail.");
  }
  const evidence = options.evidence.trim();
  if (evidence.length === 0) {
    throw new Error("A non-empty externally-observed evidence reference is required.");
  }
  if (/[\r\n]/.test(evidence)) {
    throw new Error(
      "Evidence reference must be a single-line short locator/reference; put narrative context in --summary or Notes.",
    );
  }
  if (evidence.length > MANUAL_EVIDENCE_REFERENCE_MAX_LENGTH) {
    throw new Error(
      `Evidence reference is a short locator/reference and must be at most ${MANUAL_EVIDENCE_REFERENCE_MAX_LENGTH} characters; put narrative context in --summary or Notes.`,
    );
  }
  if (options.summary !== undefined) {
    if (/[\r\n]/.test(options.summary)) {
      throw new Error("--summary must be single-line; put longer guidance in Notes.");
    }
    if (options.summary.length > TASK_EVIDENCE_SUMMARY_MAX_LENGTH) {
      throw new Error(
        `--summary must be at most ${TASK_EVIDENCE_SUMMARY_MAX_LENGTH} characters; put longer guidance in Notes.`,
      );
    }
  }

  const baseline = await readTaskBaseline(options.rootDirectory, task.id);
  const snapshot = await captureTaskScope({
    rootDirectory: options.rootDirectory,
    task,
    taskPath,
    baseline,
  });
  const captured = await captureTaskEvidenceSubject(
    options.rootDirectory,
    task,
    snapshot.changedFiles,
    baseline,
  );
  const subject: TaskEvidenceCandidateSubject = baseline
    ? { ...captured, baselineId: baseline.baselineId }
    : captured;
  let gateEligible = snapshot.comparisonKnown
    && snapshot.outOfScopeFiles.length === 0
    && snapshot.forbiddenTouchedFiles.length === 0;
  if (check.evidenceType === "benchmark" || check.artifact) {
    const finalSnapshot = await captureTaskScope({
      rootDirectory: options.rootDirectory,
      task,
      taskPath,
      baseline,
    });
    const finalCaptured = await captureTaskEvidenceSubject(
      options.rootDirectory,
      task,
      finalSnapshot.changedFiles,
      baseline,
    );
    const finalSubject = baseline
      ? { ...finalCaptured, baselineId: baseline.baselineId }
      : finalCaptured;
    gateEligible = gateEligible
      && finalSnapshot.comparisonKnown
      && finalSnapshot.outOfScopeFiles.length === 0
      && finalSnapshot.forbiddenTouchedFiles.length === 0
      && sameTaskEvidenceSubject(subject, finalSubject);
  }
  const runId = `record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = await appendTaskEvidence(options.rootDirectory, {
    taskId: task.id,
    runId,
    agent: ownerAgent.id,
    gateEligible,
    type: verificationEvidenceType(check, true),
    result: options.result,
    subject,
    checkId: check.id,
    profile: check.profile,
    ...(check.artifact ? { artifact: check.artifact } : {}),
    evidence,
    ...((options.summary ?? check.summary) ? { summary: options.summary ?? check.summary } : {}),
  });
  await appendRunLog(options.rootDirectory, {
    event: "verify",
    agent: ownerAgent,
    task: task.id,
    runId,
    state: task.state,
    outcome: options.result === "pass" ? "ok" : "error",
    reason: `external verification ${options.result} for ${check.id} (${runId})`,
  });

  return {
    taskId: task.id,
    checkId: check.id,
    type: verificationEvidenceType(check, true),
    profile: check.profile,
    result: options.result,
    runId,
    gateEligible,
    subject,
    record,
  };
}

export function renderRecordManualVerificationResult(
  result: RecordManualVerificationResult,
): string {
  return [
    `Task: ${result.taskId}`,
    `Check: ${result.checkId}`,
    `Result: ${result.result}`,
    `Type: ${result.type}; profile: ${result.profile}`,
    ...(result.record.artifact ? [`Artifact reference: ${result.record.artifact}`] : []),
    ...(result.record.evidence ? [`Evidence reference: ${result.record.evidence}`] : []),
    `Gate-eligible: ${result.gateEligible ? "yes" : "no"}`,
    `Candidate: ${result.subject.candidateId}`,
    `Evidence: ${result.record.id}`,
    "",
  ].join("\n");
}

export function renderTaskDeps(result: TaskDepsResult): string {
  const lines: string[] = [];

  lines.push(`Task: ${result.id}`);
  lines.push(`Title: ${result.title}`);
  lines.push(`State: ${result.state}`);
  lines.push(`Path: ${result.path}`);
  lines.push("");

  if (result.prerequisites.length === 0) {
    lines.push("Prerequisites: none");
  } else {
    lines.push("Prerequisites:");
    for (const prereq of result.prerequisites) {
      const archiveTag = prereq.archived ? " (archived)" : "";
      const status = prereq.state === "done" ? "[done]"
        : prereq.state === "canceled" || prereq.state === "blocked" ? `[${prereq.state}]`
        : `[${prereq.state}]`;
      lines.push(`  - ${prereq.id} ${status}${archiveTag} ${prereq.title}`);
    }
  }
  lines.push("");

  if (result.dependents.length === 0) {
    lines.push("Dependents: none");
  } else {
    lines.push("Dependents:");
    for (const dep of result.dependents) {
      const archiveTag = dep.archived ? " (archived)" : "";
      lines.push(`  - ${dep.id} [${dep.state}]${archiveTag} ${dep.title}`);
    }
  }
  lines.push("");

  if (result.missingDeps.length > 0) {
    lines.push("Missing dependencies:");
    for (const m of result.missingDeps) {
      lines.push(`  - ${m}`);
    }
    lines.push("");
  }

  if (result.cycleIssues.length > 0) {
    lines.push("Cycle issues:");
    for (const c of result.cycleIssues) {
      lines.push(`  - ${c}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export * from "./evidence.js";
export * from "./lock.js";
export * from "./package-contract.js";
export * from "./policy.js";
export * from "./review.js";
export * from "./gate.js";
export * from "./dogfood.js";
export * from "./provenance.js";
export * from "./workflow.js";
