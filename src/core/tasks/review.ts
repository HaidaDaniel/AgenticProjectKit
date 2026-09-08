import { appendRunLog, requireAgent } from "../agents/index.js";
import { relative } from "node:path";
import {
  captureTaskEvidenceSubject,
  findTaskFile,
  listGitChangedFiles,
  listTaskChangedFilesSinceBaseline,
  loadTaskFile,
  readTaskBaseline,
  verifyTaskFileScope,
  verifyTaskFileScopeSinceBaseline,
  type ProjectTask,
} from "./index.js";
import {
  appendTaskEvidence,
  compareTaskEvidenceFreshness,
  readTaskEvidence,
  type TaskEvidenceCandidateSubject,
  type TaskEvidenceRecord,
  type TaskEvidenceFreshness,
} from "./evidence.js";

export const TASK_REVIEW_OUTCOMES = ["pass", "changes_requested", "fail"] as const;
export type TaskReviewOutcome = (typeof TASK_REVIEW_OUTCOMES)[number];

export interface TaskReviewPromptInput {
  task: ProjectTask;
  reviewer: string;
  subject: TaskEvidenceCandidateSubject;
  baselineHeadSha?: string;
  changedFiles: readonly string[];
  reviewRunId?: string;
}

export interface TaskReviewPreparation {
  task: ProjectTask;
  reviewer: string;
  subject: TaskEvidenceCandidateSubject;
  changedFiles: string[];
  baselineHeadSha?: string;
  prompt: string;
}

export interface TaskReviewOptions {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  reviewer: string;
  outcome: TaskReviewOutcome;
  findings?: readonly string[];
  implementationRunId?: string;
  changedFiles?: readonly string[];
}

export interface TaskReviewRecord extends TaskEvidenceRecord {
  type: "review";
  result: TaskReviewOutcome;
  reviewer: string;
  findings: string[];
  implementationRunId?: string;
}

export interface TaskReviewResult {
  taskId: string;
  runId: string;
  reviewer: string;
  outcome: TaskReviewOutcome;
  findings: string[];
  subject: TaskEvidenceCandidateSubject;
  changedFiles: string[];
  evidence: TaskReviewRecord;
  prompt: string;
}

export interface TaskReviewAssessment {
  record: TaskReviewRecord;
  freshness: TaskEvidenceFreshness;
  reason: string;
}

function reviewRunId(): string {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizedFindings(findings: readonly string[] | undefined): string[] {
  return [...new Set((findings ?? [])
    .map((finding) => finding.replace(/\s+/g, " ").trim())
    .filter((finding) => finding.length > 0))];
}

function requireReviewableTask(task: ProjectTask, reviewer: string): void {
  if (task.state !== "doing" && task.state !== "review") {
    throw new Error(`Task ${task.id} is ${task.state}; expected doing or review for independent review.`);
  }
  if (task.owner === "none") {
    throw new Error(`Task ${task.id} has no implementation owner for independent review.`);
  }
  if (task.owner === reviewer) {
    throw new Error("Implementation owner cannot certify the same task as independent reviewer.");
  }
}

function reviewSubject(
  subject: TaskEvidenceCandidateSubject,
  baselineId: string | undefined,
): TaskEvidenceCandidateSubject {
  return baselineId ? { ...subject, baselineId } : subject;
}

const DEFAULT_BOOKKEEPING_PATHS = [
  ".tasks/.apk.lock",
  ".agentic/task-baselines.jsonl",
  ".agentic/evidence.jsonl",
  ".agentic/runs.jsonl",
  ".agentic/runs/",
  ".agentic/agents.jsonl",
  ".agentic/agents/",
];

function isBookkeepingPath(path: string, taskFile: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return [taskFile, ...DEFAULT_BOOKKEEPING_PATHS].some((entry) => (
    normalized === entry || (entry.endsWith("/") && normalized.startsWith(entry))
  ));
}

export function renderTaskReviewPrompt(input: TaskReviewPromptInput): string {
  const baseline = input.baselineHeadSha ?? "unavailable";
  const current = input.subject.headSha ?? "unavailable";
  const changed = input.changedFiles.length > 0
    ? input.changedFiles.map((path) => `- ${path}`)
    : ["- none detected"];
  const findingsRule = "Record concrete findings for the fixer; an empty finding list is valid only when the review passes.";

  return [
    `Reviewer: ${input.reviewer}`,
    `Review run: ${input.reviewRunId ?? "pending"}`,
    `Task: ${input.task.id} - ${input.task.title}`,
    `Evaluated HEAD: ${current}`,
    `Baseline: ${input.subject.baselineId}`,
    `Candidate: ${input.subject.candidateId}`,
    `Worktree: ${input.subject.worktreeId}`,
    "",
    "Baseline-to-current diff:",
    `- baseline HEAD: ${baseline}`,
    `- current HEAD: ${current}`,
    ...changed,
    "",
    "Review instructions:",
    "- Inspect the implementation and task diff; do not continue implementation work.",
    "- Check every acceptance criterion and the declared scope.",
    "- Challenge hidden assumptions, failure paths, and counterexamples.",
    "- Green tests alone are not correctness proof; inspect behavior and risk explicitly.",
    `- ${findingsRule}`,
    "",
    "Acceptance criteria:",
    ...input.task.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Allowed files:",
    ...input.task.allowedFiles.map((path) => `- ${path}`),
    "",
    "Forbidden files:",
    ...input.task.forbiddenFiles.map((path) => `- ${path}`),
    "",
    "Submit one outcome: pass, changes_requested, or fail.",
    "",
  ].join("\n");
}

export async function prepareTaskReview(
  options: {
    rootDirectory: string;
    taskDirectory: string;
    taskId: string;
    reviewer: string;
    changedFiles?: readonly string[];
    reviewRunId?: string;
  },
): Promise<TaskReviewPreparation> {
  const reviewer = await requireAgent(options.rootDirectory, options.reviewer);
  const taskPath = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
  const { task } = await loadTaskFile(taskPath);
  requireReviewableTask(task, reviewer.id);
  const baseline = await readTaskBaseline(options.rootDirectory, task.id);
  const rawChangedFiles = [...(options.changedFiles ?? (
    baseline
      ? await listTaskChangedFilesSinceBaseline(options.rootDirectory, baseline)
      : await listGitChangedFiles(options.rootDirectory).catch(() => [])
  ))].sort();
  const taskRelativePath = relative(options.rootDirectory, taskPath).replace(/\\/g, "/");
  const scope = baseline
    ? await verifyTaskFileScopeSinceBaseline(options.rootDirectory, task, rawChangedFiles, baseline)
    : verifyTaskFileScope(
      task,
      rawChangedFiles.filter((path) => !isBookkeepingPath(path, taskRelativePath)),
    );
  const changedFiles = scope.changedFiles;
  const capturedSubject = await captureTaskEvidenceSubject(
    options.rootDirectory,
    task,
    changedFiles,
  );
  const subject = reviewSubject(capturedSubject, baseline?.baselineId);
  return {
    task,
    reviewer: reviewer.id,
    subject,
    changedFiles,
    ...(baseline?.headSha ? { baselineHeadSha: baseline.headSha } : {}),
    prompt: renderTaskReviewPrompt({
      task,
      reviewer: reviewer.id,
      subject,
      baselineHeadSha: baseline?.headSha,
      changedFiles,
      reviewRunId: options.reviewRunId,
    }),
  };
}

function asTaskReviewRecord(record: TaskEvidenceRecord): TaskReviewRecord | undefined {
  if (
    record.type !== "review" ||
    !TASK_REVIEW_OUTCOMES.includes(record.result as TaskReviewOutcome) ||
    !record.reviewer
  ) {
    return undefined;
  }
  return {
    ...record,
    type: "review",
    result: record.result as TaskReviewOutcome,
    reviewer: record.reviewer,
    findings: record.findings ?? [],
  };
}

export async function recordTaskReview(options: TaskReviewOptions): Promise<TaskReviewResult> {
  const runId = reviewRunId();
  const prepared = await prepareTaskReview({
    ...options,
    reviewRunId: runId,
  });
  const findings = normalizedFindings(options.findings);
  const evidence = await appendTaskEvidence(options.rootDirectory, {
    taskId: prepared.task.id,
    runId,
    agent: prepared.reviewer,
    type: "review",
    result: options.outcome,
    subject: prepared.subject,
    reviewer: prepared.reviewer,
    implementationRunId: options.implementationRunId,
    findings,
    summary: options.outcome === "pass" ? "Independent review passed." : findings.join("; ") || `Independent review ${options.outcome}.`,
  });
  const reviewRecord = asTaskReviewRecord(evidence);
  if (!reviewRecord) {
    throw new Error("Review evidence did not produce a valid review record.");
  }
  const reviewerAgent = await requireAgent(options.rootDirectory, prepared.reviewer);
  await appendRunLog(options.rootDirectory, {
    event: "review",
    agent: reviewerAgent,
    task: prepared.task.id,
    state: prepared.task.state,
    outcome: "ok",
    reason: `independent review ${options.outcome} (${runId})`,
  });
  return {
    taskId: prepared.task.id,
    runId,
    reviewer: prepared.reviewer,
    outcome: options.outcome,
    findings,
    subject: prepared.subject,
    changedFiles: prepared.changedFiles,
    evidence: reviewRecord,
    prompt: renderTaskReviewPrompt({
      task: prepared.task,
      reviewer: prepared.reviewer,
      subject: prepared.subject,
      baselineHeadSha: prepared.baselineHeadSha,
      changedFiles: prepared.changedFiles,
      reviewRunId: runId,
    }),
  };
}

export async function listTaskReviews(
  rootDirectory: string,
  taskId: string,
): Promise<TaskReviewRecord[]> {
  const records = await readTaskEvidence(rootDirectory, taskId);
  return records
    .map(asTaskReviewRecord)
    .filter((record): record is TaskReviewRecord => record !== undefined);
}

export function assessTaskReview(
  record: TaskReviewRecord,
  currentSubject: TaskEvidenceCandidateSubject,
): TaskReviewAssessment {
  const freshness = compareTaskEvidenceFreshness(record, currentSubject);
  return {
    record,
    freshness: freshness.freshness,
    reason: freshness.reason,
  };
}

export function assessTaskReviews(
  records: readonly TaskReviewRecord[],
  currentSubject: TaskEvidenceCandidateSubject,
): TaskReviewAssessment[] {
  return records.map((record) => assessTaskReview(record, currentSubject));
}

export function renderTaskReviewResult(result: TaskReviewResult): string {
  return [
    `Task: ${result.taskId}`,
    `Review run: ${result.runId}`,
    `Reviewer: ${result.reviewer}`,
    `Outcome: ${result.outcome}`,
    `Changed files: ${result.changedFiles.length}`,
    `Subject: baseline=${result.subject.baselineId} candidate=${result.subject.candidateId} worktree=${result.subject.worktreeId}`,
    `Evidence: ${result.evidence.id}`,
    "Findings:",
    ...(result.findings.length > 0 ? result.findings.map((finding) => `  - ${finding}`) : ["  - none"]),
    "",
  ].join("\n");
}
