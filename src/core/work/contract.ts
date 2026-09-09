import type { TaskContextSelection } from "../docs/context.js";
import type { ProjectTask } from "../tasks/index.js";

export const WORKER_PROTOCOL = "apk-worker-v1" as const;

export const WORKER_ROLES = ["implement", "review", "fix", "verify"] as const;
export type WorkerRole = (typeof WORKER_ROLES)[number];

export const WORKER_STATUSES = ["completed", "failed", "changes_requested"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const SAFE_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

export function isSafeRunId(value: string): boolean {
  return SAFE_RUN_ID_PATTERN.test(value);
}

/**
 * Worker package provenance identifies the candidate supplied to the worker.
 * Worker result provenance identifies the candidate produced by that run.
 */
export interface WorkerProvenance {
  repository?: "git" | "none";
  headSha?: string;
  baselineId?: string;
  candidateId?: string;
  worktreeId?: string;
}

export interface WorkerPackage {
  protocol: typeof WORKER_PROTOCOL;
  task: {
    id: string;
    title: string;
    goal: string;
  };
  role: WorkerRole;
  context: {
    level: TaskContextSelection["level"];
    files: string[];
    budget?: number;
    estimatedUnits?: number;
    diagnostics?: string[];
  };
  constraints: {
    allowedFiles: string[];
    forbiddenFiles: string[];
    acceptanceCriteria: string[];
    verification: string[];
  };
  outputExpectations: {
    requiredFields: string[];
    evidence: string[];
    reviewFindings: boolean;
    reason: boolean;
  };
  review?: WorkerReviewBinding;
  handoff?: WorkerHandoff;
  provenance: WorkerProvenance & {
    runId: string;
  };
}

export interface WorkerReviewBinding {
  reviewRunId: string;
  taskId: string;
  reviewer: string;
  baselineId: string;
  repository: "git" | "none";
  headSha?: string;
  candidateId: string;
  worktreeId: string;
  changedFiles: string[];
}

export interface WorkerEvidenceReference {
  id: string;
  type: string;
  result: string;
  reference?: string;
}

export interface WorkerHandoff {
  fromRunId: string;
  fromRole: WorkerRole;
  status: WorkerStatus;
  findings: string[];
  reason?: string;
}

export interface WorkerResult {
  protocol: typeof WORKER_PROTOCOL;
  taskId: string;
  role: WorkerRole;
  runId: string;
  status: WorkerStatus;
  commitIds?: string[];
  diffId?: string;
  evidence?: WorkerEvidenceReference[];
  reviewFindings?: string[];
  reason?: string;
  /** Output candidate produced by this worker run; it is not the issued input candidate. */
  provenance?: WorkerProvenance;
}

export class WorkerContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerContractError";
  }
}

export function validateWorkerRunId(value: string): string {
  if (!isSafeRunId(value)) {
    throw new WorkerContractError("worker run id must be a compact identifier.");
  }
  return value;
}

function text(value: unknown, label: string, maxLength = 320): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkerContractError(`${label} must be a non-empty string.`);
  }
  if (value.includes("\n") || value.includes("\r")) {
    throw new WorkerContractError(`${label} must be single-line.`);
  }
  if (value.length > maxLength) {
    throw new WorkerContractError(`${label} must be at most ${maxLength} characters.`);
  }
  return value;
}

function optionalText(value: unknown, label: string, maxLength = 320): string | undefined {
  return value === undefined ? undefined : text(value, label, maxLength);
}

function boundedList(value: unknown, label: string, maxItems = 64, maxItemLength = 320): string[] {
  if (!Array.isArray(value)) {
    throw new WorkerContractError(`${label} must be an array.`);
  }
  if (value.length > maxItems) {
    throw new WorkerContractError(`${label} must contain at most ${maxItems} items.`);
  }
  return value.map((item, index) => text(item, `${label}[${index}]`, maxItemLength));
}

function optionalBoundedList(value: unknown, label: string, maxItems = 64, maxItemLength = 320): string[] | undefined {
  return value === undefined ? undefined : boundedList(value, label, maxItems, maxItemLength);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkerContractError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function workerRole(value: unknown, label: string): WorkerRole {
  if ((WORKER_ROLES as readonly unknown[]).includes(value)) {
    return value as WorkerRole;
  }
  throw new WorkerContractError(`${label} must be one of: ${WORKER_ROLES.join(", ")}.`);
}

function workerStatus(value: unknown, label: string): WorkerStatus {
  if ((WORKER_STATUSES as readonly unknown[]).includes(value)) {
    return value as WorkerStatus;
  }
  throw new WorkerContractError(`${label} must be one of: ${WORKER_STATUSES.join(", ")}.`);
}

function requiredNumber(value: unknown, label: string, max = 1_000_000): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > max) {
    throw new WorkerContractError(`${label} must be a positive integer at most ${max}.`);
  }
  return value;
}

function optionalNumber(value: unknown, label: string, max = 1_000_000): number | undefined {
  return value === undefined ? undefined : requiredNumber(value, label, max);
}

function parsePackage(value: unknown): WorkerPackage {
  const raw = objectValue(value, "worker package");
  if (raw.protocol !== WORKER_PROTOCOL) {
    throw new WorkerContractError(`worker package.protocol must be ${WORKER_PROTOCOL}.`);
  }
  const task = objectValue(raw.task, "worker package.task");
  const context = objectValue(raw.context, "worker package.context");
  const constraints = objectValue(raw.constraints, "worker package.constraints");
  const expectations = objectValue(raw.outputExpectations, "worker package.outputExpectations");
  const provenance = objectValue(raw.provenance, "worker package.provenance");
  const diagnostics = optionalBoundedList(context.diagnostics, "worker package.context.diagnostics", 16);
  const packageValue: WorkerPackage = {
    protocol: WORKER_PROTOCOL,
    task: {
      id: text(task.id, "worker package.task.id", 120),
      title: text(task.title, "worker package.task.title"),
      goal: text(task.goal, "worker package.task.goal"),
    },
    role: workerRole(raw.role, "worker package.role"),
    context: {
      level: context.level === 1 || context.level === 2 || context.level === 3
        ? context.level
        : (() => { throw new WorkerContractError("worker package.context.level must be 1, 2, or 3."); })(),
      files: boundedList(context.files, "worker package.context.files"),
      ...(optionalNumber(context.budget, "worker package.context.budget") === undefined ? {} : { budget: context.budget as number }),
      ...(optionalNumber(context.estimatedUnits, "worker package.context.estimatedUnits") === undefined ? {} : { estimatedUnits: context.estimatedUnits as number }),
      ...(diagnostics === undefined ? {} : { diagnostics }),
    },
    constraints: {
      allowedFiles: boundedList(constraints.allowedFiles, "worker package.constraints.allowedFiles"),
      forbiddenFiles: boundedList(constraints.forbiddenFiles, "worker package.constraints.forbiddenFiles"),
      acceptanceCriteria: boundedList(constraints.acceptanceCriteria, "worker package.constraints.acceptanceCriteria"),
      verification: boundedList(constraints.verification, "worker package.constraints.verification"),
    },
    outputExpectations: {
      requiredFields: boundedList(expectations.requiredFields, "worker package.outputExpectations.requiredFields", 16, 120),
      evidence: boundedList(expectations.evidence, "worker package.outputExpectations.evidence", 16),
      reviewFindings: expectations.reviewFindings === true,
      reason: expectations.reason === true,
    },
    ...(raw.review === undefined ? {} : { review: parseReviewBinding(raw.review) }),
    ...(raw.handoff === undefined ? {} : { handoff: parseHandoff(raw.handoff) }),
    provenance: {
      runId: validateWorkerRunId(text(provenance.runId, "worker package.provenance.runId", 120)),
      ...(provenance.repository === "git" || provenance.repository === "none" ? { repository: provenance.repository } : {}),
      ...(optionalText(provenance.headSha, "worker package.provenance.headSha", 160) ? { headSha: provenance.headSha as string } : {}),
      ...(optionalText(provenance.baselineId, "worker package.provenance.baselineId", 240) ? { baselineId: provenance.baselineId as string } : {}),
      ...(optionalText(provenance.candidateId, "worker package.provenance.candidateId", 240) ? { candidateId: provenance.candidateId as string } : {}),
      ...(optionalText(provenance.worktreeId, "worker package.provenance.worktreeId", 240) ? { worktreeId: provenance.worktreeId as string } : {}),
    },
  };
  return packageValue;
}

function parseEvidence(value: unknown, index: number): WorkerEvidenceReference {
  const raw = objectValue(value, `worker result.evidence[${index}]`);
  return {
    id: text(raw.id, `worker result.evidence[${index}].id`, 120),
    type: text(raw.type, `worker result.evidence[${index}].type`, 120),
    result: text(raw.result, `worker result.evidence[${index}].result`, 80),
    ...(optionalText(raw.reference, `worker result.evidence[${index}].reference`) ? { reference: raw.reference as string } : {}),
  };
}

function parseEvidenceList(value: unknown): WorkerEvidenceReference[] {
  if (!Array.isArray(value)) {
    throw new WorkerContractError("worker result.evidence must be an array.");
  }
  if (value.length > 64) {
    throw new WorkerContractError("worker result.evidence must contain at most 64 items.");
  }
  return value.map(parseEvidence);
}

function parseHandoff(value: unknown): WorkerHandoff {
  const raw = objectValue(value, "worker package.handoff");
  return {
    fromRunId: validateWorkerRunId(text(raw.fromRunId, "worker package.handoff.fromRunId", 120)),
    fromRole: workerRole(raw.fromRole, "worker package.handoff.fromRole"),
    status: workerStatus(raw.status, "worker package.handoff.status"),
    findings: boundedList(raw.findings, "worker package.handoff.findings", 32),
    ...(optionalText(raw.reason, "worker package.handoff.reason") ? { reason: raw.reason as string } : {}),
  };
}

function parseReviewBinding(value: unknown): WorkerReviewBinding {
  const raw = objectValue(value, "worker package.review");
  return {
    reviewRunId: validateWorkerRunId(text(raw.reviewRunId, "worker package.review.reviewRunId", 120)),
    taskId: text(raw.taskId, "worker package.review.taskId", 120),
    reviewer: text(raw.reviewer, "worker package.review.reviewer", 120),
    baselineId: text(raw.baselineId, "worker package.review.baselineId", 240),
    repository: raw.repository === "git" || raw.repository === "none"
      ? raw.repository
      : (() => { throw new WorkerContractError("worker package.review.repository must be git or none."); })(),
    ...(optionalText(raw.headSha, "worker package.review.headSha", 160) ? { headSha: raw.headSha as string } : {}),
    candidateId: text(raw.candidateId, "worker package.review.candidateId", 240),
    worktreeId: text(raw.worktreeId, "worker package.review.worktreeId", 240),
    changedFiles: boundedList(raw.changedFiles, "worker package.review.changedFiles"),
  };
}

function parseResult(value: unknown): WorkerResult {
  const raw = objectValue(value, "worker result");
  if (raw.protocol !== WORKER_PROTOCOL) {
    throw new WorkerContractError(`worker result.protocol must be ${WORKER_PROTOCOL}.`);
  }
  const status = workerStatus(raw.status, "worker result.status");
  const result: WorkerResult = {
    protocol: WORKER_PROTOCOL,
    taskId: text(raw.taskId, "worker result.taskId", 120),
    role: workerRole(raw.role, "worker result.role"),
    runId: validateWorkerRunId(text(raw.runId, "worker result.runId", 120)),
    status,
    ...(optionalBoundedList(raw.commitIds, "worker result.commitIds") ? { commitIds: raw.commitIds as string[] } : {}),
    ...(optionalText(raw.diffId, "worker result.diffId", 160) ? { diffId: raw.diffId as string } : {}),
    ...(raw.evidence === undefined ? {} : { evidence: parseEvidenceList(raw.evidence) }),
    ...(optionalBoundedList(raw.reviewFindings, "worker result.reviewFindings", 32) ? { reviewFindings: raw.reviewFindings as string[] } : {}),
    ...(optionalText(raw.reason, "worker result.reason") ? { reason: raw.reason as string } : {}),
  };
  if (status !== "completed" && !result.reason) {
    throw new WorkerContractError(`worker result.reason is required when status is ${status}.`);
  }
  if (raw.provenance !== undefined) {
    const provenance = objectValue(raw.provenance, "worker result.provenance");
    result.provenance = {
      ...(provenance.repository === "git" || provenance.repository === "none" ? { repository: provenance.repository } : {}),
      ...(optionalText(provenance.headSha, "worker result.provenance.headSha", 160) ? { headSha: provenance.headSha as string } : {}),
      ...(optionalText(provenance.baselineId, "worker result.provenance.baselineId", 240) ? { baselineId: provenance.baselineId as string } : {}),
      ...(optionalText(provenance.candidateId, "worker result.provenance.candidateId", 240) ? { candidateId: provenance.candidateId as string } : {}),
      ...(optionalText(provenance.worktreeId, "worker result.provenance.worktreeId", 240) ? { worktreeId: provenance.worktreeId as string } : {}),
    };
  }
  return result;
}

export function parseWorkerRole(value: string): WorkerRole {
  return workerRole(value, "worker role");
}

export function parseWorkerStatus(value: string): WorkerStatus {
  return workerStatus(value, "worker status");
}

export function createWorkerPackage(
  task: ProjectTask,
  context: TaskContextSelection,
  options: {
    role: WorkerRole;
    runId: string;
    repository?: "git" | "none";
    headSha?: string;
    baselineId?: string;
    candidateId?: string;
    worktreeId?: string;
    review?: WorkerReviewBinding;
    handoff?: WorkerHandoff;
  },
): WorkerPackage {
  const verification = task.verification
    ? task.verification.map((check) => check.command ?? check.instruction ?? check.id)
    : task.verificationCommands;
  return parsePackage({
    protocol: WORKER_PROTOCOL,
    task: {
      id: task.id,
      title: task.title,
      goal: task.goal,
    },
    role: options.role,
    context: {
      level: context.level,
      files: context.files,
      ...(context.budget === undefined ? {} : { budget: context.budget }),
      ...(context.estimatedUnits === undefined ? {} : { estimatedUnits: context.estimatedUnits }),
      ...(context.diagnostics && context.diagnostics.length > 0
        ? { diagnostics: context.diagnostics.map((diagnostic) => diagnostic.message) }
        : {}),
    },
    constraints: {
      allowedFiles: task.allowedFiles,
      forbiddenFiles: task.forbiddenFiles,
      acceptanceCriteria: task.acceptanceCriteria,
      verification,
    },
    outputExpectations: {
      requiredFields: ["taskId", "role", "runId", "status"],
      evidence: ["evidence references", "subject/provenance identity when available"],
      reviewFindings: options.role === "review",
      reason: true,
    },
    ...(options.review === undefined ? {} : { review: options.review }),
    ...(options.handoff === undefined ? {} : { handoff: options.handoff }),
    provenance: {
      runId: options.runId,
      ...(options.repository ? { repository: options.repository } : {}),
      ...(options.headSha ? { headSha: options.headSha } : {}),
      ...(options.baselineId ? { baselineId: options.baselineId } : {}),
      ...(options.candidateId ? { candidateId: options.candidateId } : {}),
      ...(options.worktreeId ? { worktreeId: options.worktreeId } : {}),
    },
  });
}

export function parseWorkerPackage(value: string | unknown): WorkerPackage {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (error: unknown) {
      throw new WorkerContractError(`worker package must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return parsePackage(parsed);
}

export function serializeWorkerPackage(value: WorkerPackage): string {
  return JSON.stringify(parsePackage(value));
}

export function parseWorkerResult(value: string | unknown): WorkerResult {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (error: unknown) {
      throw new WorkerContractError(`worker result must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return parseResult(parsed);
}

export function serializeWorkerResult(value: WorkerResult): string {
  return JSON.stringify(parseResult(value));
}
