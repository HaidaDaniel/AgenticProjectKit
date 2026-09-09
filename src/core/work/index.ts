import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { appendRunLog, requireAgent } from "../agents/index.js";
import { readAgenticConfigFile } from "../config/index.js";
import { buildTaskPromptInput, renderTaskPrompt } from "../docs/prompt.js";
import type { ContextLevel } from "../docs/context.js";
import { appendTaskEvidence, readTaskEvidence, type TaskEvidenceRecord } from "../tasks/evidence.js";
import { captureTaskCompletionCandidate, evaluateTaskCompletionGate } from "../tasks/gate.js";
import { resolveTaskPolicy } from "../tasks/policy.js";
import { prepareTaskReview, recordTaskReview, type TaskReviewOutcome } from "../tasks/review.js";
import { claimTask, reviewTask } from "../tasks/workflow.js";
import { findTaskFile, loadTaskFile, type ProjectTask } from "../tasks/index.js";
import type { TaskEvidenceCandidateSubject } from "../tasks/evidence.js";
import {
  createWorkerPackage,
  parseWorkerPackage,
  parseWorkerResult,
  serializeWorkerPackage,
  validateWorkerRunId,
  WORKER_PROTOCOL,
  type WorkerPackage,
  type WorkerProvenance,
  type WorkerResult,
  type WorkerRole,
  type WorkerStatus,
  type WorkerHandoff,
  type WorkerReviewBinding,
} from "./contract.js";
import { readActiveWorkerSession } from "./session.js";

export * from "./contract.js";

export type WorkLevel = ContextLevel | "auto";

export interface WorkOptions {
  rootDirectory: string;
  taskId: string;
  owner: string;
  target: string;
  level: WorkLevel;
  role?: WorkerRole;
  writeSession?: boolean;
  /** Test-only seam for exercising the review issuance transaction boundary. */
  beforeReviewActivation?: () => Promise<void>;
}

export interface WorkResult {
  task: ProjectTask;
  runId: string;
  workerPackage: WorkerPackage;
  prompt: string;
  claimed: boolean;
  sessionPath?: string;
  packagePath: string;
  metadataPath: string;
  activationPath: string;
  nextRole?: WorkerRole;
  next: string[];
  warnings: string[];
}

export interface WorkerRunResult {
  task: ProjectTask;
  result: WorkerResult;
  evidence: TaskEvidenceRecord;
  nextRole?: WorkerRole;
  nextAction: string;
}

export interface IssuedWorkerRunMetadata {
  protocol: typeof WORKER_PROTOCOL;
  taskId: string;
  runId: string;
  owner: string;
  target: string;
  role: WorkerRole;
  issuedAt: string;
  baselineId?: string;
  candidateId?: string;
  worktreeId?: string;
  comparisonKnown: boolean;
  worktreeLocationId: string;
  packageHash: string;
  issuedSubject: WorkerProvenance;
}

export interface WorkerRunActivation {
  protocol: typeof WORKER_PROTOCOL;
  taskId: string;
  runId: string;
  packageHash: string;
  activatedAt: string;
}

const WORK_SESSION_DIRECTORY = ".agentic/sessions/work";

function resolveLevel(task: ProjectTask, level: WorkLevel): ContextLevel {
  if (level !== "auto") {
    return level;
  }

  return task.risk === "high" ? 3 : 2;
}

function workRunId(): string {
  return `work-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function worktreeLocationId(rootDirectory: string): Promise<string> {
  const location = await realpath(rootDirectory).catch(() => rootDirectory);
  return `worktree-location:${hashText(location.replace(/\\/g, "/"))}`;
}

function issuedSessionDirectory(rootDirectory: string, taskId: string, runId: string): string {
  return join(rootDirectory, WORK_SESSION_DIRECTORY, taskId, runId);
}

function issuedActivationPath(rootDirectory: string, taskId: string, runId: string): string {
  return join(issuedSessionDirectory(rootDirectory, taskId, runId), "activation.json");
}

function packageHash(workerPackage: WorkerPackage): string {
  return hashText(serializeWorkerPackage(workerPackage));
}

function provenanceForSubject(subject: TaskEvidenceCandidateSubject): WorkerProvenance {
  return {
    repository: subject.repository,
    ...(subject.headSha ? { headSha: subject.headSha } : {}),
    baselineId: subject.baselineId,
    candidateId: subject.candidateId,
    worktreeId: subject.worktreeId,
  };
}

function sameCandidateSubject(
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

function suppliedProvenanceMatches(
  supplied: WorkerProvenance | undefined,
  expected: WorkerProvenance,
): boolean {
  if (!supplied) return true;
  return (["repository", "headSha", "baselineId", "candidateId", "worktreeId"] as const)
    .every((field) => supplied[field] === undefined || supplied[field] === expected[field]);
}

function pathExists(path: string): Promise<boolean> {
  return stat(path).then(() => true).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  });
}

async function persistIssuedWorkerRun(options: {
  rootDirectory: string;
  taskId: string;
  runId: string;
  owner: string;
  target: string;
  workerPackage: WorkerPackage;
  comparisonKnown: boolean;
  issuedAt: string;
  worktreeLocationId: string;
  writePrompt?: string;
}): Promise<{ packagePath: string; metadataPath: string; promptPath?: string }> {
  validateWorkerRunId(options.runId);
  const directory = issuedSessionDirectory(options.rootDirectory, options.taskId, options.runId);
  const parent = join(options.rootDirectory, WORK_SESSION_DIRECTORY, options.taskId);
  await mkdir(parent, { recursive: true });
  if (await pathExists(directory)) {
    throw new Error(`Worker run collision: issued run ${options.runId} already exists; existing session is immutable.`);
  }
  const temporaryDirectory = join(parent, `.${options.runId}.tmp-${Math.random().toString(36).slice(2, 8)}`);
  let temporaryCreated = false;
  try {
    await mkdir(temporaryDirectory);
    temporaryCreated = true;
    const packagePath = join(temporaryDirectory, "package.json");
    const metadataPath = join(temporaryDirectory, "metadata.json");
    const packageContent = `${serializeWorkerPackage(options.workerPackage)}\n`;
    const metadata: IssuedWorkerRunMetadata = {
      protocol: WORKER_PROTOCOL,
      taskId: options.taskId,
      runId: options.runId,
      owner: options.owner,
      target: options.target,
      role: options.workerPackage.role,
      issuedAt: options.issuedAt,
      ...(options.workerPackage.provenance.baselineId ? { baselineId: options.workerPackage.provenance.baselineId } : {}),
      ...(options.workerPackage.provenance.candidateId ? { candidateId: options.workerPackage.provenance.candidateId } : {}),
      ...(options.workerPackage.provenance.worktreeId ? { worktreeId: options.workerPackage.provenance.worktreeId } : {}),
      comparisonKnown: options.comparisonKnown,
      worktreeLocationId: options.worktreeLocationId,
      packageHash: packageHash(options.workerPackage),
      issuedSubject: provenanceForSubject({
        taskId: options.taskId,
        repository: options.workerPackage.provenance.repository ?? "none",
        ...(options.workerPackage.provenance.headSha ? { headSha: options.workerPackage.provenance.headSha } : {}),
        baselineId: options.workerPackage.provenance.baselineId ?? "unknown",
        candidateId: options.workerPackage.provenance.candidateId ?? "unknown",
        worktreeId: options.workerPackage.provenance.worktreeId ?? "unknown",
      }),
    };
    await writeFile(packagePath, packageContent, { encoding: "utf8", flag: "wx" });
    await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`, { encoding: "utf8", flag: "wx" });
    let promptPath: string | undefined;
    if (options.writePrompt !== undefined) {
      promptPath = join(temporaryDirectory, "prompt.md");
      await writeFile(promptPath, options.writePrompt, { encoding: "utf8", flag: "wx" });
    }
    try {
      await rename(temporaryDirectory, directory);
      temporaryCreated = false;
    } catch (error: unknown) {
      if (await pathExists(directory)) {
        throw new Error(`Worker run collision: issued run ${options.runId} already exists; existing session is immutable.`);
      }
      throw error;
    }
    const finalPackagePath = join(directory, "package.json");
    const finalMetadataPath = join(directory, "metadata.json");
    const finalPromptPath = options.writePrompt === undefined ? undefined : join(directory, "prompt.md");
    return {
      packagePath: relative(options.rootDirectory, finalPackagePath).replace(/\\/g, "/"),
      metadataPath: relative(options.rootDirectory, finalMetadataPath).replace(/\\/g, "/"),
      ...(finalPromptPath ? { promptPath: relative(options.rootDirectory, finalPromptPath).replace(/\\/g, "/") } : {}),
    };
  } catch (error: unknown) {
    if (temporaryCreated) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
    throw error;
  }
}

async function activateIssuedWorkerRun(options: {
  rootDirectory: string;
  taskId: string;
  runId: string;
  workerPackage: WorkerPackage;
}): Promise<string> {
  validateWorkerRunId(options.runId);
  const path = issuedActivationPath(options.rootDirectory, options.taskId, options.runId);
  const activation: WorkerRunActivation = {
    protocol: WORKER_PROTOCOL,
    taskId: options.taskId,
    runId: options.runId,
    packageHash: packageHash(options.workerPackage),
    activatedAt: new Date().toISOString(),
  };
  try {
    await writeFile(path, `${JSON.stringify(activation)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new Error(`Worker run ${options.runId} is already activated; issued sessions are immutable.`);
    }
    throw error;
  }
  return relative(options.rootDirectory, path).replace(/\\/g, "/");
}

async function readIssuedWorkerRun(
  rootDirectory: string,
  taskId: string,
  runId: string,
): Promise<{ workerPackage: WorkerPackage; metadata: IssuedWorkerRunMetadata }> {
  validateWorkerRunId(runId);
  const directory = issuedSessionDirectory(rootDirectory, taskId, runId);
  let packageValue: string;
  let metadataValue: string;
  let activationValue: string;
  try {
    [packageValue, metadataValue, activationValue] = await Promise.all([
      readFile(join(directory, "package.json"), "utf8"),
      readFile(join(directory, "metadata.json"), "utf8"),
      readFile(join(directory, "activation.json"), "utf8"),
    ]);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (await pathExists(directory)) {
        throw new Error(`Issued worker run ${runId} is not activated; startWork did not finish successfully.`);
      }
      throw new Error(`Issued worker run not found: ${runId} for task ${taskId}.`);
    }
    throw error;
  }
  const workerPackage = parseWorkerPackage(packageValue);
  const raw = JSON.parse(metadataValue) as Partial<IssuedWorkerRunMetadata>;
  const activation = JSON.parse(activationValue) as Partial<WorkerRunActivation>;
  if (
    activation.protocol !== WORKER_PROTOCOL ||
    activation.taskId !== taskId ||
    activation.runId !== runId ||
    typeof activation.packageHash !== "string" ||
    typeof activation.activatedAt !== "string"
  ) {
    throw new Error(`Issued worker run activation is malformed: ${runId}.`);
  }
  const issuedSubject = raw.issuedSubject;
  if (
    raw.protocol !== WORKER_PROTOCOL ||
    raw.taskId !== taskId ||
    raw.runId !== runId ||
    typeof raw.owner !== "string" ||
    typeof raw.target !== "string" ||
    raw.role !== workerPackage.role ||
    typeof raw.issuedAt !== "string" ||
    typeof raw.packageHash !== "string" ||
    typeof raw.comparisonKnown !== "boolean" ||
    typeof raw.worktreeLocationId !== "string" ||
    !issuedSubject ||
    typeof issuedSubject !== "object" ||
    typeof issuedSubject.repository !== "string" ||
    typeof issuedSubject.baselineId !== "string" ||
    typeof issuedSubject.candidateId !== "string" ||
    typeof issuedSubject.worktreeId !== "string"
  ) {
    throw new Error(`Issued worker run metadata is malformed: ${runId}.`);
  }
  if (
    issuedSubject.repository !== (workerPackage.provenance.repository ?? "none") ||
    issuedSubject.headSha !== workerPackage.provenance.headSha ||
    issuedSubject.baselineId !== (workerPackage.provenance.baselineId ?? "unknown") ||
    issuedSubject.candidateId !== (workerPackage.provenance.candidateId ?? "unknown") ||
    issuedSubject.worktreeId !== (workerPackage.provenance.worktreeId ?? "unknown")
  ) {
    throw new Error(`Issued worker run metadata subject mismatch: ${runId}.`);
  }
  if (raw.packageHash !== packageHash(workerPackage)) {
    throw new Error(`Issued worker package hash mismatch: ${runId}.`);
  }
  if (activation.packageHash !== raw.packageHash) {
    throw new Error(`Issued worker run activation hash mismatch: ${runId}.`);
  }
  return { workerPackage, metadata: raw as IssuedWorkerRunMetadata };
}

function evidenceResult(status: WorkerStatus): TaskEvidenceRecord["result"] {
  if (status === "completed") return "pass";
  if (status === "failed") return "fail";
  return "changes_requested";
}

async function resolveCanonicalWorkerRole(
  rootDirectory: string,
  taskDirectory: string,
  task: ProjectTask,
): Promise<WorkerRole | undefined> {
  if (task.state === "todo") return "implement";
  if (task.state !== "doing" && task.state !== "review") return undefined;

  const gate = await evaluateTaskCompletionGate({
    rootDirectory,
    taskDirectory,
    taskId: task.id,
  });
  if (gate.review.freshness === "current" && gate.review.outcome !== undefined && gate.review.outcome !== "pass") {
    return "fix";
  }
  if (gate.verification.some((check) => check.result !== "pass" || check.freshness !== "current")) {
    return "verify";
  }
  if (gate.policy.requirements.independentReview) {
    const currentIndependentPass = gate.review.freshness === "current"
      && gate.review.outcome === "pass"
      && gate.review.reviewer !== task.owner;
    if (!currentIndependentPass) return "review";
  }
  return undefined;
}

async function nextWorkerRoleAfterResult(
  rootDirectory: string,
  taskDirectory: string,
  task: ProjectTask,
  result: WorkerResult,
): Promise<WorkerRole | undefined> {
  if (result.status !== "completed") {
    return result.role === "review" ? "fix" : result.role;
  }
  return resolveCanonicalWorkerRole(rootDirectory, taskDirectory, task);
}

async function resolveWorkRole(
  rootDirectory: string,
  task: ProjectTask,
): Promise<WorkerRole | undefined> {
  const config = await readAgenticConfigFile(rootDirectory);
  return resolveCanonicalWorkerRole(rootDirectory, config.taskDirectory, task);
}

function workerFindings(result: WorkerResult): string[] {
  const findings = [...(result.reviewFindings ?? [])]
    .map((finding) => finding.replace(/\s+/g, " ").trim())
    .filter((finding) => finding.length > 0);
  if (findings.length === 0 && result.reason) {
    findings.push(result.reason);
  }
  return [...new Set(findings)].slice(0, 32);
}

function handoffFromRecord(record: TaskEvidenceRecord): WorkerHandoff | undefined {
  if (!record.workerRole || !record.workerStatus) return undefined;
  const role = record.workerRole as WorkerRole;
  const status = record.workerStatus as WorkerStatus;
  const findings = [...(record.findings ?? [])];
  if (findings.length === 0 && record.summary) findings.push(record.summary);
  return {
    fromRunId: record.runId,
    fromRole: role,
    status,
    findings: findings.slice(0, 32),
    ...(record.summary ? { reason: record.summary } : {}),
  };
}

async function resolveLatestHandoff(
  rootDirectory: string,
  taskId: string,
): Promise<WorkerHandoff | undefined> {
  const records = await readTaskEvidence(rootDirectory, taskId);
  const workerFailure = [...records]
    .filter((record) => record.workerRole && record.workerStatus && record.workerStatus !== "completed")
    .sort((left, right) => left.time.localeCompare(right.time))
    .at(-1);
  if (workerFailure) return handoffFromRecord(workerFailure);

  const reviewFailure = [...records]
    .filter((record) => record.type === "review" && record.result !== "pass")
    .sort((left, right) => left.time.localeCompare(right.time))
    .at(-1);
  if (!reviewFailure) return undefined;
  return {
    fromRunId: reviewFailure.runId,
    fromRole: "review",
    status: reviewFailure.result === "changes_requested" ? "changes_requested" : "failed",
    findings: (reviewFailure.findings ?? [reviewFailure.summary ?? "Review requires fixes."]).slice(0, 32),
    ...(reviewFailure.summary ? { reason: reviewFailure.summary } : {}),
  };
}

function summarizeWorkerEvidence(result: WorkerResult): string | undefined {
  if (!result.evidence || result.evidence.length === 0) {
    return undefined;
  }
  const summary = result.evidence.map((reference) => (
    `${reference.id}:${reference.type}=${reference.result}${reference.reference ? ` (${reference.reference})` : ""}`
  )).join("; ");
  return summary.slice(0, 240);
}

function requireWorkRole(task: ProjectTask, owner: string, target: string, role: WorkerRole): void {
  if (task.state === "todo") {
    if (role !== "implement") {
      throw new Error(`Task ${task.id} is todo; the first worker role must be implement.`);
    }
    return;
  }
  if (task.state !== "doing" && task.state !== "review") {
    throw new Error(`Task ${task.id} is ${task.state}; expected doing or review for a worker run.`);
  }
  if (role === "review") {
    if (task.owner === owner) {
      throw new Error(
        `Independent review requires a reviewer different from ${task.owner}. Run: pnpm exec apk work ${task.id} --owner <reviewer> --target ${target} --role review`,
      );
    }
    return;
  }
  if (role === "fix" && task.state !== "review") {
    throw new Error(`Task ${task.id} must be in review before a fixer worker run.`);
  }
  if (role !== "fix" && task.owner !== owner) {
    throw new Error(`Task ${task.id} is owned by ${task.owner}, not ${owner}.`);
  }
}

function workNextCommands(task: ProjectTask, target: string, owner: string, runId: string, role: WorkerRole): string[] {
  const commands = [
    `pnpm exec apk work result ${task.id} --owner ${owner} --run-id ${runId} --role ${role} --status completed`,
  ];
  if (role === "implement" || role === "fix") {
    commands.push(`pnpm exec apk task verify ${task.id} --owner ${task.owner}`);
  } else if (role === "verify") {
    commands.push(`pnpm exec apk task verify ${task.id} --owner ${task.owner}`);
    if (resolveTaskPolicy(task).requirements.independentReview) {
      commands.push(`pnpm exec apk work ${task.id} --owner <reviewer> --target ${target} --role review`);
    } else {
      commands.push(`pnpm exec apk task gate ${task.id}`);
    }
  } else {
    commands.push(`After PASS: pnpm exec apk task gate ${task.id}`);
    commands.push(`After changes_requested/fail: pnpm exec apk work ${task.id} --owner <fixer> --target ${target} --role fix`);
  }
  return commands;
}

function workerNextAction(
  task: ProjectTask,
  target: string,
  owner: string,
  result: WorkerResult,
  nextRole: WorkerRole | undefined,
): string {
  if (result.status !== "completed") {
    if (result.role === "review") {
      return `Issue a fixer package with findings: pnpm exec apk work ${task.id} --owner <fixer> --target ${target} --role fix`;
    }
    return `Resolve the ${result.role} result and issue a fresh ${result.role} package for task ${task.id}.`;
  }
  if (result.role === "implement" || result.role === "fix") {
    if (nextRole === "review") {
      return `Request an independent reviewer: pnpm exec apk work ${task.id} --owner <reviewer> --target ${target} --role review`;
    }
    if (nextRole === "verify") {
      return `Run canonical verification: pnpm exec apk task verify ${task.id} --owner ${task.owner}`;
    }
    return `Run pnpm exec apk task gate ${task.id}, then inspect the remaining blocker.`;
  }
  if (result.role === "verify") {
    return nextRole === "review"
      ? `Request an independent reviewer: pnpm exec apk work ${task.id} --owner <reviewer> --target ${target} --role review`
      : `Run canonical verification and inspect the gate: pnpm exec apk task verify ${task.id} --owner ${task.owner}`;
  }
  return `Run pnpm exec apk task gate ${task.id}, then pnpm exec apk done ${task.id} --owner ${task.owner}.`;
}

async function sameWorktreeWarnings(
  rootDirectory: string,
  taskId: string,
  locationId: string,
): Promise<string[]> {
  const warnings: string[] = [];
  const tasksDirectory = join(rootDirectory, WORK_SESSION_DIRECTORY);
  let taskDirectories: string[] = [];
  try {
    taskDirectories = await readdir(tasksDirectory);
  } catch {
    return warnings;
  }
  for (const otherTaskId of taskDirectories) {
    if (otherTaskId === taskId) continue;
    let runDirectories: string[] = [];
    try {
      runDirectories = await readdir(join(tasksDirectory, otherTaskId));
    } catch {
      continue;
    }
    for (const otherRunId of runDirectories) {
      try {
        const metadata = JSON.parse(await readFile(
          join(tasksDirectory, otherTaskId, otherRunId, "metadata.json"),
          "utf8",
        )) as Partial<IssuedWorkerRunMetadata>;
        if (metadata.worktreeLocationId !== locationId) continue;
        if (metadata.role !== "implement" && metadata.role !== "fix" && metadata.role !== "verify") continue;
        try {
          await readActiveWorkerSession(rootDirectory, otherTaskId, otherRunId);
        } catch {
          continue;
        }
        const evidence = await readTaskEvidence(rootDirectory, otherTaskId);
        const settled = evidence.some((record) => record.runId === otherRunId && (
          record.workerProtocol === WORKER_PROTOCOL || record.type === "review"
        ));
        if (!settled) {
          warnings.push(
            `Concurrent mutable task ${otherTaskId} has issued run ${otherRunId} in the same Git worktree; use separate worktrees to preserve scope attribution.`,
          );
        }
      } catch {
        // A malformed/partial session is diagnosed by result submission; it cannot prove an active run.
      }
    }
  }
  return [...new Set(warnings)];
}

export async function startWork(options: WorkOptions): Promise<WorkResult> {
  const config = await readAgenticConfigFile(options.rootDirectory);
  const agent = await requireAgent(options.rootDirectory, options.owner);
  let taskFile = await findTaskFile(options.rootDirectory, options.taskId, config.taskDirectory);
  let { task } = await loadTaskFile(taskFile);
  const role = options.role ?? await resolveWorkRole(options.rootDirectory, task);
  if (!role) {
    throw new Error(`Task ${task.id} has no pending worker role; run apk task gate ${task.id} or apk done ${task.id} --owner ${options.owner}.`);
  }
  requireWorkRole(task, options.owner, options.target, role);
  let claimed = false;

  if (task.state === "todo") {
    task = await claimTask({
      rootDirectory: options.rootDirectory,
      taskDirectory: config.taskDirectory,
      taskId: options.taskId,
      owner: options.owner,
    });
    taskFile = await findTaskFile(options.rootDirectory, options.taskId, config.taskDirectory);
    claimed = true;
  }

  const promptInput = buildTaskPromptInput(
    options.target,
    task,
    resolveLevel(task, options.level),
    {
      docsDirectory: config.docsDirectory,
      taskDirectory: config.taskDirectory,
      taskFile: relative(options.rootDirectory, taskFile).replace(/\\/g, "/"),
    },
  );
  const runId = workRunId();
  const candidate = await captureTaskCompletionCandidate({
    rootDirectory: options.rootDirectory,
    taskDirectory: config.taskDirectory,
    taskId: task.id,
  });
  const handoff = role === "fix"
    ? await resolveLatestHandoff(options.rootDirectory, task.id)
    : undefined;
  if (role === "review") {
    const gate = await evaluateTaskCompletionGate({
      rootDirectory: options.rootDirectory,
      taskDirectory: config.taskDirectory,
      taskId: task.id,
    });
    if (gate.verification.some((check) => check.result !== "pass" || check.freshness !== "current")) {
      throw new Error(`Canonical verification is not current for task ${task.id}; run pnpm exec apk task verify ${task.id} --owner ${task.owner} before issuing a review worker package.`);
    }
  }
  const reviewPreparation = role === "review"
    ? await prepareTaskReview({
      rootDirectory: options.rootDirectory,
      taskDirectory: config.taskDirectory,
      taskId: task.id,
      reviewer: options.owner,
      reviewRunId: runId,
      origin: "worker",
      workerRunId: runId,
    })
    : undefined;
  const prompt = reviewPreparation?.prompt ?? renderTaskPrompt(promptInput);
  const subject = reviewPreparation?.subject ?? candidate.subject;
  const workerPackage = createWorkerPackage(task, promptInput.context, {
    role,
    runId,
    repository: subject.repository,
    ...(subject.headSha ? { headSha: subject.headSha } : {}),
    baselineId: subject.baselineId,
    candidateId: subject.candidateId,
    worktreeId: subject.worktreeId,
    ...(reviewPreparation ? {
      review: {
        reviewRunId: reviewPreparation.reviewRunId,
        taskId: task.id,
        reviewer: reviewPreparation.reviewer,
        baselineId: reviewPreparation.subject.baselineId,
        repository: reviewPreparation.subject.repository,
        ...(reviewPreparation.subject.headSha ? { headSha: reviewPreparation.subject.headSha } : {}),
        candidateId: reviewPreparation.subject.candidateId,
        worktreeId: reviewPreparation.subject.worktreeId,
        changedFiles: reviewPreparation.changedFiles,
      } satisfies WorkerReviewBinding,
    } : {}),
    ...(handoff ? { handoff } : {}),
  });
  const worktreeId = await worktreeLocationId(options.rootDirectory);
  const issuedAt = new Date().toISOString();
  const persisted = await persistIssuedWorkerRun({
    rootDirectory: options.rootDirectory,
    taskId: task.id,
    runId,
    owner: options.owner,
    target: options.target,
    workerPackage,
    comparisonKnown: reviewPreparation ? true : candidate.comparisonKnown,
    issuedAt,
    worktreeLocationId: worktreeId,
    ...(options.writeSession ? { writePrompt: prompt } : {}),
  });
  if (role === "review" && options.beforeReviewActivation) {
    await options.beforeReviewActivation();
  }
  if (role === "review" && task.state === "doing") {
    task = await reviewTask({
      rootDirectory: options.rootDirectory,
      taskDirectory: config.taskDirectory,
      taskId: task.id,
      owner: task.owner,
    });
  }
  if (role === "review" && reviewPreparation) {
    const confirmedCandidate = await captureTaskCompletionCandidate({
      rootDirectory: options.rootDirectory,
      taskDirectory: config.taskDirectory,
      taskId: task.id,
    });
    if (
      !sameCandidateSubject(confirmedCandidate.subject, reviewPreparation.subject)
      || JSON.stringify([...confirmedCandidate.changedFiles].sort()) !== JSON.stringify([...reviewPreparation.changedFiles].sort())
    ) {
      throw new Error(`Review candidate changed during issuance for task ${task.id}; the issued review run remains inactive. Prepare a fresh review package.`);
    }
  }
  const warnings = await sameWorktreeWarnings(options.rootDirectory, task.id, worktreeId);

  await appendRunLog(options.rootDirectory, {
    event: "work",
    agent,
    task: task.id,
    runId,
    state: task.state,
    outcome: "ok",
    reason: `worker package ${persisted.packagePath}`,
  });
  const nextRole = role === "review"
    ? undefined
    : await nextWorkerRoleAfterResult(options.rootDirectory, config.taskDirectory, task, {
      protocol: WORKER_PROTOCOL,
      taskId: task.id,
      role,
      runId,
      status: "completed",
    });
  const next = workNextCommands(task, options.target, options.owner, runId, role);
  const activationPath = await activateIssuedWorkerRun({
    rootDirectory: options.rootDirectory,
    taskId: task.id,
    runId,
    workerPackage,
  });

  return {
    task,
    runId,
    workerPackage,
    prompt,
    claimed,
    ...(persisted.promptPath ? { sessionPath: persisted.promptPath } : {}),
    packagePath: persisted.packagePath,
    metadataPath: persisted.metadataPath,
    activationPath,
    ...(nextRole === undefined ? {} : { nextRole }),
    next,
    warnings,
  };
}

export async function recordWorkerResult(options: {
  rootDirectory: string;
  taskDirectory: string;
  owner: string;
  result: string | WorkerResult;
}): Promise<WorkerRunResult> {
  const result = parseWorkerResult(options.result);
  const agent = await requireAgent(options.rootDirectory, options.owner);
  const taskFile = await findTaskFile(options.rootDirectory, result.taskId, options.taskDirectory);
  const { task } = await loadTaskFile(taskFile);
  if (task.state !== "doing" && task.state !== "review") {
    throw new Error(`Task ${task.id} is ${task.state}; expected doing or review for a worker result.`);
  }
  const issued = await readIssuedWorkerRun(options.rootDirectory, task.id, result.runId);
  if (issued.metadata.owner !== options.owner) {
    throw new Error(`Issued worker run ${result.runId} belongs to ${issued.metadata.owner}, not ${options.owner}.`);
  }
  if (issued.metadata.taskId !== result.taskId || issued.workerPackage.task.id !== result.taskId) {
    throw new Error(`Worker result taskId ${result.taskId} does not match issued run ${result.runId}.`);
  }
  if (issued.workerPackage.provenance.runId !== result.runId) {
    throw new Error(`Worker result runId ${result.runId} does not match the issued package.`);
  }
  if (issued.workerPackage.role !== result.role || issued.metadata.role !== result.role) {
    throw new Error(`Worker result role ${result.role} does not match issued role ${issued.workerPackage.role}.`);
  }
  const existing = await readTaskEvidence(options.rootDirectory, task.id);
  if (existing.some((record) => record.runId === result.runId && (
    record.workerProtocol === WORKER_PROTOCOL || record.type === "review"
  ))) {
    throw new Error(`Worker result already recorded for run ${result.runId}.`);
  }

  const findings = workerFindings(result);
  const resultCandidate = result.role === "review"
    ? undefined
    : await captureTaskCompletionCandidate({
      rootDirectory: options.rootDirectory,
      taskDirectory: options.taskDirectory,
      taskId: task.id,
    });
  let evidence: TaskEvidenceRecord;
  if (result.role === "review") {
    const binding = issued.workerPackage.review;
    if (!binding) {
      throw new Error(`Issued review run ${result.runId} has no canonical prepared review binding.`);
    }
    if (binding.reviewRunId !== result.runId || binding.taskId !== task.id || binding.reviewer !== options.owner) {
      throw new Error(`Issued review run ${result.runId} has a mismatched canonical review binding.`);
    }
    if (!suppliedProvenanceMatches(result.provenance, {
      repository: binding.repository,
      ...(binding.headSha ? { headSha: binding.headSha } : {}),
      baselineId: binding.baselineId,
      candidateId: binding.candidateId,
      worktreeId: binding.worktreeId,
    })) {
      throw new Error(`Worker review result provenance does not match the issued review subject.`);
    }
    const review = await recordTaskReview({
      rootDirectory: options.rootDirectory,
      taskDirectory: options.taskDirectory,
      taskId: task.id,
      reviewer: options.owner,
      reviewRunId: binding.reviewRunId,
      outcome: (result.status === "completed" ? "pass" : result.status === "changes_requested" ? "changes_requested" : "fail") as TaskReviewOutcome,
      findings,
      expectedSubject: {
        taskId: binding.taskId,
        repository: binding.repository,
        ...(binding.headSha ? { headSha: binding.headSha } : {}),
        baselineId: binding.baselineId,
        candidateId: binding.candidateId,
        worktreeId: binding.worktreeId,
      },
      expectedChangedFiles: binding.changedFiles,
      workerProtocol: result.protocol,
      workerRole: result.role,
      workerStatus: result.status,
    });
    evidence = review.evidence;
  } else {
    if (!resultCandidate) {
      throw new Error(`Worker result ${result.runId} has no captured output candidate.`);
    }
    const outputProvenance = provenanceForSubject(resultCandidate.subject);
    if (!suppliedProvenanceMatches(result.provenance, outputProvenance)) {
      throw new Error(`Worker result provenance does not match the captured output candidate.`);
    }
    evidence = await appendTaskEvidence(options.rootDirectory, {
      taskId: task.id,
      runId: result.runId,
      agent: agent.id,
      gateEligible: false,
      type: "report",
      result: evidenceResult(result.status),
      subject: {
        taskId: task.id,
        repository: resultCandidate.subject.repository,
        ...(resultCandidate.subject.headSha ? { headSha: resultCandidate.subject.headSha } : {}),
        baselineId: resultCandidate.subject.baselineId,
        candidateId: resultCandidate.subject.candidateId,
        worktreeId: resultCandidate.subject.worktreeId,
      },
      ...(findings.length > 0 ? { findings } : {}),
      ...(summarizeWorkerEvidence(result) ? { evidence: summarizeWorkerEvidence(result) } : {}),
      ...(result.commitIds ? { workerCommitIds: result.commitIds } : {}),
      ...(result.diffId ? { workerDiffId: result.diffId } : {}),
      ...(result.evidence ? { workerEvidence: result.evidence.map((reference) => reference.id) } : {}),
      workerProtocol: result.protocol,
      workerRole: result.role,
      workerStatus: result.status,
      summary: result.reason ?? `Worker ${result.role} ${result.status}.`,
    });
    await appendRunLog(options.rootDirectory, {
      event: "work",
      agent,
      task: task.id,
      runId: result.runId,
      state: task.state,
      outcome: result.status === "completed" ? "ok" : "error",
      reason: `worker ${result.role} ${result.status}${result.reason ? `: ${result.reason}` : ""}`,
    });
  }

  const nextRole = await nextWorkerRoleAfterResult(options.rootDirectory, options.taskDirectory, task, result);
  const nextAction = workerNextAction(task, issued.metadata.target, options.owner, result, nextRole);
  return {
    task,
    result,
    evidence,
    ...(nextRole ? { nextRole } : {}),
    nextAction,
  };
}

export function renderWorkerRunResult(result: WorkerRunResult): string {
  return [
    `Task: ${result.task.id}`,
    `Run: ${result.result.runId}`,
    `Worker role: ${result.result.role}`,
    `Outcome: ${result.result.status}`,
    `Evidence: ${result.evidence.id}`,
    ...(result.result.reason ? [`Reason: ${result.result.reason}`] : []),
    ...(result.result.reviewFindings && result.result.reviewFindings.length > 0
      ? ["Review findings:", ...result.result.reviewFindings.map((finding) => `  - ${finding}`)]
      : []),
    `Next role: ${result.nextRole ?? "gate/done"}`,
    `Next action: ${result.nextAction}`,
    "",
  ].join("\n");
}

export function renderWorkResult(result: WorkResult): string {
  const nextRole = result.nextRole
    ?? (result.workerPackage.role === "review" ? "pending review result" : "gate/done");
  return [
    `Task: ${result.task.id}`,
    `State: ${result.task.state}`,
    `Owner: ${result.task.owner}`,
    `Run: ${result.runId}`,
    `Worker role: ${result.workerPackage.role}`,
    `Package: ${result.packagePath}`,
    `Metadata: ${result.metadataPath}`,
    `Activation: ${result.activationPath}`,
    `Next role: ${nextRole}`,
    `Claimed: ${result.claimed ? "yes" : "no"}`,
    ...(result.sessionPath ? [`Session: ${result.sessionPath}`] : []),
    "",
    result.prompt,
    ...(result.warnings.length > 0 ? ["Warnings:", ...result.warnings.map((warning) => `- ${warning}`), ""] : []),
    "Next commands:",
    ...result.next.map((command) => `- ${command}`),
    "",
  ].join("\n");
}
