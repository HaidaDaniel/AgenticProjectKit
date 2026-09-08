import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const TASK_EVIDENCE_PATH = ".agentic/evidence.jsonl";

export const TASK_EVIDENCE_TYPES = [
  "automated-test",
  "ci",
  "live",
  "manual",
  "benchmark",
  "report",
  "review",
] as const;
export type TaskEvidenceType = (typeof TASK_EVIDENCE_TYPES)[number];

export const TASK_EVIDENCE_RESULTS = [
  "pass",
  "changes_requested",
  "fail",
  "pending",
  "unavailable",
  "not-run",
] as const;
export type TaskEvidenceResult = (typeof TASK_EVIDENCE_RESULTS)[number];

export const TASK_EVIDENCE_REPOSITORIES = ["git", "none"] as const;
export type TaskEvidenceRepository = (typeof TASK_EVIDENCE_REPOSITORIES)[number];

export interface TaskEvidenceCandidateSubject {
  taskId: string;
  repository: TaskEvidenceRepository;
  headSha?: string;
  baselineId: string;
  candidateId: string;
  worktreeId: string;
}

export interface TaskEvidenceSubject extends TaskEvidenceCandidateSubject {
  runId: string;
}

export interface TaskEvidenceRecord {
  id: string;
  taskId: string;
  runId: string;
  agent: string;
  type: TaskEvidenceType;
  result: TaskEvidenceResult;
  time: string;
  subject: TaskEvidenceSubject;
  checkId?: string;
  profile?: string;
  command?: string;
  artifact?: string;
  evidence?: string;
  summary?: string;
  reviewer?: string;
  implementationRunId?: string;
  findings?: string[];
}

export interface AddTaskEvidenceInput {
  id?: string;
  taskId: string;
  runId: string;
  agent: string;
  type: TaskEvidenceType;
  result: TaskEvidenceResult;
  time?: string;
  subject: TaskEvidenceCandidateSubject;
  checkId?: string;
  profile?: string;
  command?: string;
  artifact?: string;
  evidence?: string;
  summary?: string;
  reviewer?: string;
  implementationRunId?: string;
  findings?: string[];
}

export type TaskEvidenceFreshness = "current" | "stale" | "unknown";

export interface TaskEvidenceFreshnessResult {
  freshness: TaskEvidenceFreshness;
  reason: string;
}

export class TaskEvidenceFormatError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid task evidence:\n- ${issues.join("\n- ")}`);
    this.name = "TaskEvidenceFormatError";
    this.issues = issues;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(
  value: unknown,
  label: string,
  issues: string[],
  maxLength = 160,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${label} must be a non-empty string.`);
    return "";
  }
  if (value.includes("\n") || value.includes("\r")) {
    issues.push(`${label} must be single-line.`);
  }
  if (value.length > maxLength) {
    issues.push(`${label} must be at most ${maxLength} characters.`);
  }
  return value;
}

function optionalText(
  value: unknown,
  label: string,
  issues: string[],
  maxLength = 240,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return textValue(value, label, issues, maxLength);
}

function optionalTextList(
  value: unknown,
  label: string,
  issues: string[],
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array when provided.`);
    return undefined;
  }
  if (value.length > 32) {
    issues.push(`${label} must contain at most 32 items.`);
  }
  return value.map((item, index) => textValue(item, `${label}[${index}]`, issues, 320));
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  issues: string[],
): T {
  if ((allowed as readonly unknown[]).includes(value)) {
    return value as T;
  }
  issues.push(`${label} must be one of: ${allowed.join(", ")}.`);
  return allowed[0];
}

function validateSubject(
  value: unknown,
  label: string,
  issues: string[],
): TaskEvidenceCandidateSubject {
  if (!isRecord(value)) {
    issues.push(`${label} must be an object.`);
    return {
      taskId: "",
      repository: "none",
      baselineId: "",
      candidateId: "",
      worktreeId: "",
    };
  }

  const repository = oneOf(
    value.repository,
    TASK_EVIDENCE_REPOSITORIES,
    `${label}.repository`,
    issues,
  );
  const subject: TaskEvidenceCandidateSubject = {
    taskId: textValue(value.taskId, `${label}.taskId`, issues),
    repository,
    baselineId: textValue(value.baselineId, `${label}.baselineId`, issues),
    candidateId: textValue(value.candidateId, `${label}.candidateId`, issues),
    worktreeId: textValue(value.worktreeId, `${label}.worktreeId`, issues),
  };

  subject.headSha = optionalText(value.headSha, `${label}.headSha`, issues, 160);
  if (repository === "git" && !subject.headSha) {
    issues.push(`${label}.headSha is required for git evidence.`);
  }

  return subject;
}

function normalizeEvidenceRecord(
  value: unknown,
  lineNumber?: number,
): TaskEvidenceRecord {
  const prefix = lineNumber === undefined ? "Evidence" : `Evidence line ${lineNumber}`;
  const issues: string[] = [];
  if (!isRecord(value)) {
    throw new TaskEvidenceFormatError([`${prefix} must be a JSON object.`]);
  }

  const subject = validateSubject(value.subject, `${prefix}.subject`, issues);
  const subjectRunId = textValue(
    value.subject && isRecord(value.subject) ? value.subject.runId : undefined,
    `${prefix}.subject.runId`,
    issues,
    120,
  );
  const record: TaskEvidenceRecord = {
    id: textValue(value.id, `${prefix}.id`, issues, 120),
    taskId: textValue(value.taskId, `${prefix}.taskId`, issues),
    runId: textValue(value.runId, `${prefix}.runId`, issues, 120),
    agent: textValue(value.agent, `${prefix}.agent`, issues, 120),
    type: oneOf(value.type, TASK_EVIDENCE_TYPES, `${prefix}.type`, issues),
    result: oneOf(value.result, TASK_EVIDENCE_RESULTS, `${prefix}.result`, issues),
    time: textValue(value.time, `${prefix}.time`, issues, 40),
    subject: {
      ...subject,
      runId: subjectRunId,
    },
    checkId: optionalText(value.checkId, `${prefix}.checkId`, issues, 120),
    profile: optionalText(value.profile, `${prefix}.profile`, issues, 120),
    command: optionalText(value.command, `${prefix}.command`, issues),
    artifact: optionalText(value.artifact, `${prefix}.artifact`, issues),
    evidence: optionalText(value.evidence, `${prefix}.evidence`, issues),
    summary: optionalText(value.summary, `${prefix}.summary`, issues, 320),
    reviewer: optionalText(value.reviewer, `${prefix}.reviewer`, issues, 120),
    implementationRunId: optionalText(value.implementationRunId, `${prefix}.implementationRunId`, issues, 120),
    findings: optionalTextList(value.findings, `${prefix}.findings`, issues),
  };

  if (Number.isNaN(Date.parse(record.time))) {
    issues.push(`${prefix}.time must be an ISO timestamp.`);
  }
  if (record.subject.taskId !== record.taskId) {
    issues.push(`${prefix}.subject.taskId must match taskId.`);
  }
  if (record.subject.runId !== record.runId) {
    issues.push(`${prefix}.subject.runId must match runId.`);
  }

  if (issues.length > 0) {
    throw new TaskEvidenceFormatError(issues);
  }

  return record;
}

function generatedEvidenceId(): string {
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendTaskEvidence(
  rootDirectory: string,
  input: AddTaskEvidenceInput,
): Promise<TaskEvidenceRecord> {
  const time = input.time ?? new Date().toISOString();
  const record = normalizeEvidenceRecord({
    ...input,
    id: input.id ?? generatedEvidenceId(),
    time,
    subject: {
      ...input.subject,
      runId: input.runId,
    },
  });
  const path = join(rootDirectory, TASK_EVIDENCE_PATH);

  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readTaskEvidence(
  rootDirectory: string,
  taskId?: string,
): Promise<TaskEvidenceRecord[]> {
  const path = join(rootDirectory, TASK_EVIDENCE_PATH);
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }

  const records: TaskEvidenceRecord[] = [];
  for (const [index, line] of content.split("\n").entries()) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch (error: unknown) {
      throw new TaskEvidenceFormatError([
        `Evidence line ${index + 1} must be valid JSON (${error instanceof Error ? error.message : String(error)}).`,
      ]);
    }
    records.push(normalizeEvidenceRecord(value, index + 1));
  }

  return taskId === undefined
    ? records
    : filterTaskEvidence(records, taskId);
}

export function filterTaskEvidence(
  records: readonly TaskEvidenceRecord[],
  taskId: string,
  result?: TaskEvidenceResult,
): TaskEvidenceRecord[] {
  return records.filter((record) => (
    record.taskId === taskId && (result === undefined || record.result === result)
  ));
}

export function compareTaskEvidenceFreshness(
  record: TaskEvidenceRecord,
  current: TaskEvidenceCandidateSubject,
): TaskEvidenceFreshnessResult {
  const issues: string[] = [];
  const normalizedCurrent = validateSubject(current, "current subject", issues);
  if (issues.length > 0) {
    return {
      freshness: "unknown",
      reason: issues.join(" "),
    };
  }

  if (record.taskId !== normalizedCurrent.taskId) {
    return { freshness: "stale", reason: "evidence belongs to another task." };
  }

  const fields: (keyof TaskEvidenceCandidateSubject)[] = [
    "repository",
    "headSha",
    "baselineId",
    "candidateId",
    "worktreeId",
  ];
  for (const field of fields) {
    if (record.subject[field] !== normalizedCurrent[field]) {
      return {
        freshness: "stale",
        reason: `evidence subject differs at ${field}.`,
      };
    }
  }

  return { freshness: "current", reason: "evidence subject matches current task candidate." };
}

export function renderTaskEvidence(
  records: readonly TaskEvidenceRecord[],
  taskId: string,
): string {
  const taskRecords = filterTaskEvidence(records, taskId);
  const lines = [`Task: ${taskId}`, `Evidence: ${taskRecords.length}`];

  if (taskRecords.length === 0) {
    lines.push("Records: none", "");
    return lines.join("\n");
  }

  lines.push("Records:");
  for (const record of taskRecords) {
    const check = record.checkId ? ` check=${record.checkId}` : "";
    const profile = record.profile ? ` profile=${record.profile}` : "";
    lines.push(`  - ${record.time} ${record.result} ${record.type} agent=${record.agent}${check}${profile}`);
    lines.push(`    Subject: baseline=${record.subject.baselineId} candidate=${record.subject.candidateId} worktree=${record.subject.worktreeId}`);
    if (record.summary) {
      lines.push(`    Summary: ${record.summary}`);
    }
    if (record.findings && record.findings.length > 0) {
      lines.push(`    Findings: ${record.findings.join("; ")}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
