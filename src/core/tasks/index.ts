import { exec, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";

import { appendRunLog, requireAgent } from "../agents/index.js";
import {
  appendTaskEvidence,
  type TaskEvidenceCandidateSubject,
  type TaskEvidenceRecord,
  type TaskEvidenceResult,
  type TaskEvidenceType,
} from "./evidence.js";
import { withLocalMutationLock } from "./lock.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const DEFAULT_TASK_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

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
  command?: string;
  instruction?: string;
  artifact?: string;
  evidence?: string;
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

function parseList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => (
      /^\d+\.\s+/.test(line)
        ? line.replace(/^\d+\.\s+/, "")
        : line.replace(/^-\s+/, "")
    ).trim())
    .map((line) => line.replace(/^`(.+)`$/, "$1"))
    .filter((line) => line.length > 0);
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

function renderList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
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

  if (type === "automated" && !command) {
    addVerificationIssue(issues, checkNumber, "automated checks require command.");
  }
  if (type === "manual" && !instruction) {
    addVerificationIssue(issues, checkNumber, "manual checks require instruction.");
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
    ...(command ? { command } : {}),
    ...(instruction ? { instruction } : {}),
    ...(artifact ? { artifact } : {}),
    ...(evidence ? { evidence } : {}),
  };
}

function parseStructuredVerification(
  text: string,
  issues: string[],
): TaskVerificationCheck[] {
  const entries = parseList(text);
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

function parseSections(lines: readonly string[]): Partial<Record<SectionKey, string>> {
  const sections: Partial<Record<SectionKey, string>> = {};
  let current: SectionKey | undefined;
  let buffer: string[] = [];

  function flush(): void {
    if (current) {
      sections[current] = buffer.join("\n").trim();
    }
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      current = SECTION_TITLES[line.slice(3).trim()];
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
  const sections = parseSections(lines);
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
    : normalizeVerificationCommands(parseList(sections.verificationCommands ?? ""));
  const verificationCommands = verificationCommandsFromChecks(verification);
  const optionalLists = {
    correctnessAssumptions: sections.correctnessAssumptions === undefined
      ? undefined
      : parseList(sections.correctnessAssumptions),
    invariants: sections.invariants === undefined ? undefined : parseList(sections.invariants),
    requiredEvidence: sections.requiredEvidence === undefined ? undefined : parseList(sections.requiredEvidence),
    reviewQuestions: sections.reviewQuestions === undefined ? undefined : parseList(sections.reviewQuestions),
    counterexampleSearches: sections.counterexampleSearches === undefined
      ? undefined
      : parseList(sections.counterexampleSearches),
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
    ),
    allowedFiles: parseList(
      requireSection(sections, "allowedFiles", "Files allowed to edit", issues),
    ),
    forbiddenFiles: parseList(
      requireSection(
        sections,
        "forbiddenFiles",
        "Files forbidden to edit",
        issues,
      ),
    ),
    steps: parseSteps(requireSection(sections, "steps", "Steps", issues)),
    acceptanceCriteria: parseList(
      requireSection(sections, "acceptanceCriteria", "Acceptance criteria", issues),
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
    ),
    notes: parseList(requireSection(sections, "notes", "Notes", issues)),
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
        : renderList(value as string[]);

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
): Promise<ProjectTaskFile[]> {
  const archiveDirectory = join(rootDirectory, taskDirectory, "archive");
  const entries = await readdir(archiveDirectory).catch(() => []);
  const files: ProjectTaskFile[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    files.push(await loadTaskFile(join(archiveDirectory, entry)));
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

export async function archiveTask(
  rootDirectory: string,
  taskDirectory: string,
  taskId: string,
): Promise<TaskArchiveResult> {
  return withTaskMutationLock(rootDirectory, taskDirectory, `task archive ${taskId}`, taskId, async () => {
    const activeFiles = await listTaskFiles(rootDirectory, taskDirectory);
    const file = activeFiles.find((f) => f.task.id === taskId);

    if (!file) {
      throw new Error(`Task file not found for id: ${taskId}`);
    }

    if (file.task.state !== "done") {
      throw new Error(`Task ${taskId} is ${file.task.state}; only done tasks can be archived.`);
    }

    const sourcePath = file.path;
    const archiveDirectory = join(rootDirectory, taskDirectory, "archive");
    const fileName = sourcePath.split(/[\\/]/).pop()!;
    const archivePath = join(archiveDirectory, fileName);

    if (await fileExists(archivePath)) {
      throw new Error(`Archived task already exists: ${archivePath}`);
    }

    await mkdir(archiveDirectory, { recursive: true });
    await rename(sourcePath, archivePath);

    return {
      taskId,
      sourcePath: relative(rootDirectory, sourcePath).replace(/\\/g, "/"),
      archivePath: relative(rootDirectory, archivePath).replace(/\\/g, "/"),
    };
  });
}

export interface TaskArchiveAllResult {
  archived: TaskArchiveResult[];
}

export async function archiveAllTasks(
  rootDirectory: string,
  taskDirectory: string,
): Promise<TaskArchiveAllResult> {
  return withTaskMutationLock(rootDirectory, taskDirectory, "task archive --all", undefined, async () => {
    const activeFiles = await listTaskFiles(rootDirectory, taskDirectory);
    const doneFiles = activeFiles.filter((f) => f.task.state === "done");
    const archived: TaskArchiveResult[] = [];

    for (const file of doneFiles) {
      const sourcePath = file.path;
      const archiveDirectory = join(rootDirectory, taskDirectory, "archive");
      const fileName = sourcePath.split(/[\\/]/).pop()!;
      const archivePath = join(archiveDirectory, fileName);

      if (await fileExists(archivePath)) {
        throw new Error(`Archive path already exists: ${relative(rootDirectory, archivePath).replace(/\\/g, "/")}`);
      }

      await mkdir(archiveDirectory, { recursive: true });
      await rename(sourcePath, archivePath);

      archived.push({
        taskId: file.task.id,
        sourcePath: relative(rootDirectory, sourcePath).replace(/\\/g, "/"),
        archivePath: relative(rootDirectory, archivePath).replace(/\\/g, "/"),
      });
    }

    return { archived };
  });
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
  preExistingFiles: string[];
  bookkeepingFiles: string[];
  diagnostics: string[];
}

export type TaskBaselinePhase = "claim" | "release" | "block";

export type TaskBaselineLineageStatus = "clean" | "intervening" | "unresolved";

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
  /** Authoritative baseline lineage result; only set by `readTaskBaseline`. */
  lineageStatus?: TaskBaselineLineageStatus;
  lineageDiagnostic?: string;
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
}

export type TaskVerifyCheckStatus = TaskEvidenceResult;

export interface TaskVerifyCheckResult {
  id: string;
  type: TaskVerificationType;
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

async function gitLines(rootDirectory: string, args: readonly string[]): Promise<string[]> {
  const result = await execFileAsync("git", args, { cwd: rootDirectory });
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
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
    gitLines(rootDirectory, ["diff", "--name-only"]),
    gitLines(rootDirectory, ["diff", "--name-only", "--cached"]),
    gitLines(rootDirectory, ["ls-files", "--others", "--exclude-standard"]),
  ]);

  return [...new Set(files.flat().map(normalizeRepoPath))].sort();
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
    if (raw.phase === "claim" || raw.phase === "release" || raw.phase === "block") {
      phase = raw.phase;
    } else {
      issues.push(`Baseline line ${lineNumber}.phase must be claim, release, or block.`);
    }
  }
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
  };
  if (baseline.repository === "git" && !baseline.headSha) {
    issues.push(`Baseline line ${lineNumber}.headSha is required for git baselines.`);
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
  return captureTaskBaseline(rootDirectory, taskId, owner, taskFile, "claim");
}

/** Record a release/block handoff snapshot used to detect intervening work. */
export async function recordTaskHandoff(
  rootDirectory: string,
  taskId: string,
  owner: string,
  taskFile: string,
  phase: "release" | "block",
): Promise<TaskClaimBaseline> {
  return captureTaskBaseline(rootDirectory, taskId, owner, taskFile, phase);
}

function shortenSha(sha: string | undefined): string {
  return sha ? sha.slice(0, 12) : "none";
}

async function handoffDirtyDiffers(
  rootDirectory: string,
  handoff: TaskClaimBaseline,
): Promise<{ differs: boolean; file?: string }> {
  let currentDirty: string[];
  try {
    currentDirty = (await listGitChangedFiles(rootDirectory))
      .map(normalizeRepoPath)
      .filter((file) => !isBookkeepingPath(file, handoff));
  } catch (error: unknown) {
    return { differs: true, file: `unreadable working tree (${error instanceof Error ? error.message : String(error)})` };
  }
  const current = new Set(currentDirty);
  for (const file of currentDirty) {
    const [fingerprint] = await fingerprintChangedFiles(rootDirectory, [file]);
    if (handoff.dirtyFiles[file] !== fingerprint?.sha256) {
      return { differs: true, file };
    }
  }
  for (const file of Object.keys(handoff.dirtyFiles)) {
    if (isBookkeepingPath(file, handoff)) continue;
    if (!current.has(file)) {
      return { differs: true, file };
    }
  }
  return { differs: false };
}

async function resolveReclaimLineage(
  rootDirectory: string,
  authoritative: TaskClaimBaseline,
  handoff: TaskClaimBaseline | undefined,
): Promise<Pick<TaskClaimBaseline, "lineageStatus" | "lineageDiagnostic">> {
  if (authoritative.repository !== "git" || !authoritative.headSha) {
    return {
      lineageStatus: "unresolved",
      lineageDiagnostic: "Task was released and reclaimed without a Git baseline HEAD; scope lineage cannot be re-verified.",
    };
  }
  let currentHead: string;
  try {
    currentHead = (await gitOutput(rootDirectory, ["rev-parse", "HEAD"])).trim();
  } catch (error: unknown) {
    return {
      lineageStatus: "intervening",
      lineageDiagnostic: `Task was released and reclaimed but current HEAD is unreadable (${error instanceof Error ? error.message : String(error)}); scope lineage fails closed.`,
    };
  }
  if (currentHead !== authoritative.headSha) {
    if (!handoff?.headSha || handoff.headSha !== currentHead) {
      return {
        lineageStatus: "intervening",
        lineageDiagnostic: `Repository HEAD advanced from authoritative baseline ${shortenSha(authoritative.headSha)} to ${shortenSha(currentHead)} while the task was released; intervening work cannot be distinguished safely and scope fails closed.`,
      };
    }
  }
  if (handoff) {
    const dirtyDiff = await handoffDirtyDiffers(rootDirectory, handoff);
    if (dirtyDiff.differs) {
      return {
        lineageStatus: "intervening",
        lineageDiagnostic: `Working-tree changes appeared while the task was released (${dirtyDiff.file ?? "unknown path"}); scope lineage is ambiguous and fails closed.`,
      };
    }
  }
  return { lineageStatus: "clean" };
}

export async function readTaskBaseline(
  rootDirectory: string,
  taskId: string,
): Promise<TaskClaimBaseline | undefined> {
  let content: string;
  try {
    content = await readFile(join(rootDirectory, TASK_BASELINES_PATH), "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
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
    const baseline = normalizeBaseline(value, index + 1);
    if (baseline.taskId === taskId) {
      records.push(baseline);
    }
  }
  if (records.length === 0) {
    return undefined;
  }

  const claims = records.filter((record) => (record.phase ?? "claim") === "claim");
  const authoritative = claims[0] ?? records[0];
  const latestClaim = claims.length > 0 ? claims[claims.length - 1] : undefined;
  const handoffs = records.filter((record) => record.phase === "release" || record.phase === "block");
  const latestHandoff = handoffs.length > 0 ? handoffs[handoffs.length - 1] : undefined;

  // No reclaim after the authoritative claim: normal same-claim continuation.
  if (!latestClaim || latestClaim.baselineId === authoritative.baselineId) {
    return { ...authoritative, lineageStatus: "clean" };
  }

  const lineage = await resolveReclaimLineage(rootDirectory, authoritative, latestHandoff);
  return { ...authoritative, ...lineage };
}

export async function listTaskChangedFilesSinceBaseline(
  rootDirectory: string,
  baseline: TaskClaimBaseline,
): Promise<string[]> {
  if (baseline.repository === "git" && baseline.headSha) {
    const committedAndWorking = await gitOutput(rootDirectory, [
      "diff",
      "--name-only",
      "--no-renames",
      baseline.headSha,
    ]);
    const untracked = await gitOutput(rootDirectory, ["ls-files", "--others", "--exclude-standard"]);
    return [...new Set([
      ...(committedAndWorking ?? "").split(/\r?\n/),
      ...(untracked ?? "").split(/\r?\n/),
    ].map(normalizeRepoPath).filter((path) => path.length > 0))].sort();
  }

  throw new TaskGitComparisonError(
    ["baseline"],
    new Error("task baseline has no resolvable Git HEAD; current paths must be supplied explicitly"),
  );
}

export async function captureTaskScope(options: {
  rootDirectory: string;
  task: ProjectTask;
  taskPath?: string;
  baseline?: TaskClaimBaseline;
  changedFiles?: readonly string[];
}): Promise<TaskScopeSnapshot> {
  const diagnostics: string[] = [];
  let comparisonKnown = options.changedFiles !== undefined;
  let rawChangedFiles: readonly string[] = options.changedFiles ?? [];

  if (options.changedFiles === undefined) {
    try {
      rawChangedFiles = options.baseline
        ? await listTaskChangedFilesSinceBaseline(options.rootDirectory, options.baseline)
        : await listGitChangedFiles(options.rootDirectory);
      comparisonKnown = true;
    } catch (error: unknown) {
      diagnostics.push(error instanceof Error ? error.message : String(error));
      rawChangedFiles = [];
      if (options.baseline?.repository === "none") {
        diagnostics.push("Non-Git task baseline has no explicit candidate paths; repository-wide change discovery is unavailable.");
      }
    }
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

  const lineage = options.baseline?.lineageStatus;
  if (options.baseline?.repository === "git" && lineage !== undefined && lineage !== "clean") {
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
  const normalizedChanged = [...new Set(changedFiles.map(normalizeRepoPath))]
    .filter((file) => file.length > 0)
    .sort();
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
      preExistingFiles,
      bookkeepingFiles,
      diagnostics: baseline.diagnostics,
    },
  };
}

export async function captureTaskEvidenceSubject(
  rootDirectory: string,
  task: ProjectTask,
  changedFiles: readonly string[],
): Promise<TaskEvidenceCandidateSubject> {
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

function verificationEvidenceType(check: TaskVerificationCheck): TaskEvidenceType {
  if (check.profile === "report") {
    return "report";
  }
  if (check.environment === "live") {
    return "live";
  }
  if (check.type === "manual") {
    return "manual";
  }
  if (check.environment === "ci") {
    return "ci";
  }
  return "automated-test";
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
    } else if (!check.command) {
      status = "unavailable";
      reason = "automated check has no command";
    } else {
      try {
        exitCode = await (options.runCommand ?? ((cmd) => defaultRunCommand(
          options.rootDirectory,
          cmd,
          options.commandTimeoutMs,
        )))(check.command);
      } catch (error: unknown) {
        exitCode = 1;
        reason = `command execution failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      status = exitCode === 0 ? "pass" : "fail";
      commandsRun.push({ command: check.command, exitCode });
      if (status === "fail" && !reason) {
        reason = `command exited with code ${exitCode}`;
      }
    }

    checkResults.push({
      id: check.id,
      type: check.type,
      required: check.required,
      status,
      ...(check.command ? { command: check.command } : {}),
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
    await appendTaskEvidence(options.rootDirectory, {
      taskId: task.id,
      runId,
      agent: options.owner ?? "unknown",
      gateEligible: Boolean(ownerAgent) && candidateStable,
      type: verificationEvidenceType(check),
      result: result.status,
      subject,
      checkId: check.id,
      profile: check.profile,
      ...(check.command ? { command: check.command } : {}),
      ...(check.artifact ? { artifact: check.artifact } : {}),
      ...(check.evidence ? { evidence: check.evidence } : {}),
      ...(result.reason ? { summary: result.reason } : {}),
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
      lines.push(`  - ${command.exitCode === 0 ? "pass" : "fail"} ${command.command}`);
    }
  }

  lines.push("Checks:");
  for (const check of result.checkResults) {
    lines.push(`  - ${check.status} ${check.id}${check.required ? " (required)" : " (optional)"}${check.reason ? `: ${check.reason}` : ""}`);
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

const MANUAL_EVIDENCE_REFERENCE_MAX_LENGTH = 240;

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
    throw new Error(`Task ${task.id} is ${task.state}; manual evidence can only be recorded while doing or review.`);
  }
  if (task.owner !== ownerAgent.id) {
    throw new Error(
      `Task ${task.id} is owned by ${task.owner}, not ${ownerAgent.id}; only the task owner can record manual evidence.`,
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
  if (check.type !== "manual" && check.environment !== "live") {
    throw new Error(
      `Verification check ${checkId} is automated and cannot be recorded externally; run apk task verify.`,
    );
  }
  if (options.result !== "pass" && options.result !== "fail") {
    throw new Error("Manual verification result must be pass or fail.");
  }
  const evidence = options.evidence.trim();
  if (evidence.length === 0) {
    throw new Error("A non-empty externally-observed evidence reference is required.");
  }
  if (evidence.length > MANUAL_EVIDENCE_REFERENCE_MAX_LENGTH) {
    throw new Error(
      `Evidence reference must be at most ${MANUAL_EVIDENCE_REFERENCE_MAX_LENGTH} characters.`,
    );
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
  );
  const subject: TaskEvidenceCandidateSubject = baseline
    ? { ...captured, baselineId: baseline.baselineId }
    : captured;
  const gateEligible = snapshot.comparisonKnown
    && snapshot.outOfScopeFiles.length === 0
    && snapshot.forbiddenTouchedFiles.length === 0;
  const runId = `record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = await appendTaskEvidence(options.rootDirectory, {
    taskId: task.id,
    runId,
    agent: ownerAgent.id,
    gateEligible,
    type: verificationEvidenceType(check),
    result: options.result,
    subject,
    checkId: check.id,
    profile: check.profile,
    evidence,
    ...(options.summary ? { summary: options.summary } : {}),
  });
  await appendRunLog(options.rootDirectory, {
    event: "verify",
    agent: ownerAgent,
    task: task.id,
    runId,
    state: task.state,
    outcome: options.result === "pass" ? "ok" : "error",
    reason: `manual verification ${options.result} for ${check.id} (${runId})`,
  });

  return {
    taskId: task.id,
    checkId: check.id,
    type: verificationEvidenceType(check),
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
export * from "./policy.js";
export * from "./review.js";
export * from "./gate.js";
export * from "./dogfood.js";
export * from "./provenance.js";
