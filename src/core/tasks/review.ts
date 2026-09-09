import { appendRunLog, requireAgent } from "../agents/index.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  captureTaskEvidenceSubject,
  findTaskFile,
  loadTaskFile,
  readTaskBaseline,
  captureTaskScope,
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
import { isSafeRunId } from "../work/contract.js";

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
  reviewRunId: string;
  task: ProjectTask;
  reviewer: string;
  subject: TaskEvidenceCandidateSubject;
  changedFiles: string[];
  baselineHeadSha?: string;
  prompt: string;
  preparedAt: string;
}

export interface TaskReviewOptions {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  reviewer: string;
  reviewRunId?: string;
  outcome: TaskReviewOutcome;
  findings?: readonly string[];
  implementationRunId?: string;
  changedFiles?: readonly string[];
  workerProtocol?: string;
  workerRole?: string;
  workerStatus?: string;
  expectedSubject?: TaskEvidenceCandidateSubject;
  expectedChangedFiles?: readonly string[];
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

export const TASK_REVIEW_SESSIONS_PATH = ".agentic/reviews";

interface StoredTaskReviewPreparation {
  protocol: "review-v1";
  reviewRunId: string;
  taskId: string;
  reviewer: string;
  subject: TaskEvidenceCandidateSubject;
  changedFiles: string[];
  baselineHeadSha?: string;
  preparedAt: string;
}

function reviewSessionPath(rootDirectory: string, taskId: string, id: string): string {
  return join(rootDirectory, TASK_REVIEW_SESSIONS_PATH, taskId, `${id}.json`);
}

function validateReviewRunId(value: string): string {
  if (!isSafeRunId(value)) {
    throw new Error("Review run id must be a compact identifier.");
  }
  return value;
}

async function writePreparedReview(
  rootDirectory: string,
  preparation: StoredTaskReviewPreparation,
): Promise<void> {
  const path = reviewSessionPath(rootDirectory, preparation.taskId, preparation.reviewRunId);
  await mkdir(join(rootDirectory, TASK_REVIEW_SESSIONS_PATH, preparation.taskId), { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(preparation)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new Error(`Review run already exists: ${preparation.reviewRunId}.`);
    }
    throw error;
  }
}

async function readPreparedReview(
  rootDirectory: string,
  taskId: string,
  id: string,
): Promise<StoredTaskReviewPreparation> {
  const reviewRunIdValue = validateReviewRunId(id);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(reviewSessionPath(rootDirectory, taskId, reviewRunIdValue), "utf8"));
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Prepared review run not found: ${reviewRunIdValue}. Run --prompt first.`);
    }
    throw error;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Prepared review run is malformed: ${reviewRunIdValue}.`);
  }
  const raw = value as Record<string, unknown>;
  if (raw.protocol !== "review-v1" || raw.reviewRunId !== reviewRunIdValue || raw.taskId !== taskId) {
    throw new Error(`Prepared review run identity mismatch: ${reviewRunIdValue}.`);
  }
  if (typeof raw.reviewer !== "string" || !raw.subject || typeof raw.subject !== "object" || Array.isArray(raw.subject)) {
    throw new Error(`Prepared review run is malformed: ${reviewRunIdValue}.`);
  }
  if (!Array.isArray(raw.changedFiles) || typeof raw.preparedAt !== "string") {
    throw new Error(`Prepared review run is malformed: ${reviewRunIdValue}.`);
  }
  return {
    protocol: "review-v1",
    reviewRunId: reviewRunIdValue,
    taskId,
    reviewer: raw.reviewer,
    subject: raw.subject as TaskEvidenceCandidateSubject,
    changedFiles: raw.changedFiles.filter((path): path is string => typeof path === "string"),
    ...(typeof raw.baselineHeadSha === "string" ? { baselineHeadSha: raw.baselineHeadSha } : {}),
    preparedAt: raw.preparedAt,
  };
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

function sameReviewSubject(
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

function renderCorrectnessRequirements(task: ProjectTask): string[] {
  const groups: Array<[string, string[] | undefined]> = [
    ["Assumptions", task.correctnessAssumptions],
    ["Invariants", task.invariants],
    ["Required evidence", task.requiredEvidence],
    ["Review questions", task.reviewQuestions],
    ["Counterexample searches", task.counterexampleSearches],
  ];
  const populated = groups.filter(([, items]) => items && items.length > 0);
  if (populated.length === 0) return [];
  return [
    "Correctness requirements:",
    ...populated.flatMap(([label, items]) => [label + ":", ...(items ?? []).map((item) => `- ${item}`)]),
    "",
  ];
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
    ...renderCorrectnessRequirements(input.task),
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
  const taskRelativePath = relative(options.rootDirectory, taskPath).replace(/\\/g, "/");
  const snapshot = await captureTaskScope({
    rootDirectory: options.rootDirectory,
    task,
    taskPath: taskRelativePath,
    baseline,
    changedFiles: options.changedFiles,
  });
  if (!snapshot.comparisonKnown) {
    throw new Error(`Cannot prepare review for an ambiguous candidate: ${snapshot.diagnostics.join(" ")}`);
  }
  const changedFiles = snapshot.changedFiles;
  const capturedSubject = await captureTaskEvidenceSubject(
    options.rootDirectory,
    task,
    changedFiles,
  );
  const subject = reviewSubject(capturedSubject, baseline?.baselineId);
  const preparedAt = new Date().toISOString();
  const preparedRunId = validateReviewRunId(options.reviewRunId ?? reviewRunId());
  await writePreparedReview(options.rootDirectory, {
    protocol: "review-v1",
    reviewRunId: preparedRunId,
    taskId: task.id,
    reviewer: reviewer.id,
    subject,
    changedFiles,
    ...(baseline?.headSha ? { baselineHeadSha: baseline.headSha } : {}),
    preparedAt,
  });
  return {
    reviewRunId: preparedRunId,
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
      reviewRunId: preparedRunId,
    }),
    preparedAt,
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
  let prepared: TaskReviewPreparation;
  if (options.reviewRunId) {
    const stored = await readPreparedReview(
      options.rootDirectory,
      options.taskId,
      options.reviewRunId,
    );
    const reviewer = await requireAgent(options.rootDirectory, options.reviewer);
    const taskPath = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
    const { task } = await loadTaskFile(taskPath);
    requireReviewableTask(task, reviewer.id);
    if (stored.reviewer !== reviewer.id) {
      throw new Error(`Prepared review run ${stored.reviewRunId} belongs to reviewer ${stored.reviewer}, not ${reviewer.id}.`);
    }
    const baseline = await readTaskBaseline(options.rootDirectory, task.id);
    const snapshot = await captureTaskScope({
      rootDirectory: options.rootDirectory,
      task,
      taskPath: relative(options.rootDirectory, taskPath).replace(/\\/g, "/"),
      baseline,
    });
    if (!snapshot.comparisonKnown) {
      throw new Error(`Cannot record review for an ambiguous candidate: ${snapshot.diagnostics.join(" ")}`);
    }
    const currentCaptured = await captureTaskEvidenceSubject(
      options.rootDirectory,
      task,
      snapshot.changedFiles,
    );
    const currentSubject = reviewSubject(currentCaptured, baseline?.baselineId);
    if (!sameReviewSubject(stored.subject, currentSubject)) {
      throw new Error(
        `Review run ${stored.reviewRunId} is stale/mixed-revision: prepared candidate ${stored.subject.candidateId} differs from current candidate ${currentSubject.candidateId}. Prepare a new review prompt.`,
      );
    }
    prepared = {
      task,
      reviewer: reviewer.id,
      reviewRunId: stored.reviewRunId,
      subject: stored.subject,
      changedFiles: snapshot.changedFiles,
      ...(stored.baselineHeadSha ? { baselineHeadSha: stored.baselineHeadSha } : {}),
      prompt: renderTaskReviewPrompt({
        task,
        reviewer: reviewer.id,
        subject: stored.subject,
        baselineHeadSha: stored.baselineHeadSha,
        changedFiles: snapshot.changedFiles,
        reviewRunId: stored.reviewRunId,
      }),
      preparedAt: stored.preparedAt,
    };
  } else {
    prepared = await prepareTaskReview({
      ...options,
      reviewRunId: reviewRunId(),
    });
  }
  if (options.expectedSubject && !sameReviewSubject(options.expectedSubject, prepared.subject)) {
    throw new Error(`Review run ${prepared.reviewRunId} does not match the issued worker review subject.`);
  }
  if (options.expectedChangedFiles && JSON.stringify([...options.expectedChangedFiles].sort()) !== JSON.stringify([...prepared.changedFiles].sort())) {
    throw new Error(`Review run ${prepared.reviewRunId} changed files do not match the issued worker review package.`);
  }
  const runId = prepared.reviewRunId;
  if ((await readTaskEvidence(options.rootDirectory, prepared.task.id)).some((record) => record.type === "review" && record.runId === runId)) {
    throw new Error(`Review run already has a result: ${runId}.`);
  }
  const findings = normalizedFindings(options.findings);
  const evidence = await appendTaskEvidence(options.rootDirectory, {
    taskId: prepared.task.id,
    runId,
    agent: prepared.reviewer,
    type: "review",
    result: options.outcome,
    gateEligible: true,
    subject: prepared.subject,
    reviewer: prepared.reviewer,
    implementationRunId: options.implementationRunId,
    workerProtocol: options.workerProtocol,
    workerRole: options.workerRole,
    workerStatus: options.workerStatus,
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
    runId,
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
