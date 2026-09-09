import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { appendRunLog, readRunLog, requireAgent } from "../agents/index.js";
import { readAgenticConfigFile } from "../config/index.js";
import { buildTaskPromptInput, renderTaskPrompt } from "../docs/prompt.js";
import type { ContextLevel } from "../docs/context.js";
import { appendTaskEvidence, readTaskEvidence, type TaskEvidenceRecord } from "../tasks/evidence.js";
import { captureTaskCompletionCandidate, evaluateTaskCompletionGate } from "../tasks/gate.js";
import { resolveTaskPolicy } from "../tasks/policy.js";
import { prepareTaskReview, recordTaskReview, type TaskReviewOutcome } from "../tasks/review.js";
import { claimTask } from "../tasks/workflow.js";
import { findTaskFile, loadTaskFile, type ProjectTask } from "../tasks/index.js";
import {
  createWorkerPackage,
  parseWorkerPackage,
  parseWorkerResult,
  serializeWorkerPackage,
  WORKER_PROTOCOL,
  type WorkerPackage,
  type WorkerResult,
  type WorkerRole,
  type WorkerStatus,
  type WorkerHandoff,
  type WorkerReviewBinding,
} from "./contract.js";

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

function packageHash(workerPackage: WorkerPackage): string {
  return hashText(serializeWorkerPackage(workerPackage));
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
  const directory = issuedSessionDirectory(options.rootDirectory, options.taskId, options.runId);
  await mkdir(join(options.rootDirectory, WORK_SESSION_DIRECTORY, options.taskId), { recursive: true });
  try {
    await mkdir(directory);
    const packagePath = join(directory, "package.json");
    const metadataPath = join(directory, "metadata.json");
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
    };
    await writeFile(packagePath, packageContent, { encoding: "utf8", flag: "wx" });
    await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`, { encoding: "utf8", flag: "wx" });
    let promptPath: string | undefined;
    if (options.writePrompt !== undefined) {
      promptPath = join(directory, "prompt.md");
      await writeFile(promptPath, options.writePrompt, { encoding: "utf8", flag: "wx" });
    }
    return {
      packagePath: relative(options.rootDirectory, packagePath).replace(/\\/g, "/"),
      metadataPath: relative(options.rootDirectory, metadataPath).replace(/\\/g, "/"),
      ...(promptPath ? { promptPath: relative(options.rootDirectory, promptPath).replace(/\\/g, "/") } : {}),
    };
  } catch (error: unknown) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function readIssuedWorkerRun(
  rootDirectory: string,
  taskId: string,
  runId: string,
): Promise<{ workerPackage: WorkerPackage; metadata: IssuedWorkerRunMetadata }> {
  const directory = issuedSessionDirectory(rootDirectory, taskId, runId);
  let packageValue: string;
  let metadataValue: string;
  try {
    [packageValue, metadataValue] = await Promise.all([
      readFile(join(directory, "package.json"), "utf8"),
      readFile(join(directory, "metadata.json"), "utf8"),
    ]);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Issued worker run not found: ${runId} for task ${taskId}.`);
    }
    throw error;
  }
  const workerPackage = parseWorkerPackage(packageValue);
  const raw = JSON.parse(metadataValue) as Partial<IssuedWorkerRunMetadata>;
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
    typeof raw.worktreeLocationId !== "string"
  ) {
    throw new Error(`Issued worker run metadata is malformed: ${runId}.`);
  }
  if (raw.packageHash !== packageHash(workerPackage)) {
    throw new Error(`Issued worker package hash mismatch: ${runId}.`);
  }
  return { workerPackage, metadata: raw as IssuedWorkerRunMetadata };
}

function evidenceResult(status: WorkerStatus): TaskEvidenceRecord["result"] {
  if (status === "completed") return "pass";
  if (status === "failed") return "fail";
  return "changes_requested";
}

function nextWorkerRole(task: ProjectTask, result: WorkerResult): WorkerRole | undefined {
  if (result.status !== "completed") {
    return result.role === "review" ? "fix" : result.role;
  }

  if (result.role === "implement" || result.role === "fix") {
    return "verify";
  }
  if (result.role === "verify") {
    return resolveTaskPolicy(task).requirements.independentReview ? "review" : undefined;
  }
  return undefined;
}

async function nextWorkerRoleAfterResult(
  rootDirectory: string,
  taskDirectory: string,
  task: ProjectTask,
  result: WorkerResult,
): Promise<WorkerRole | undefined> {
  const role = nextWorkerRole(task, result);
  if (role !== "review") {
    return role;
  }
  const gate = await evaluateTaskCompletionGate({
    rootDirectory,
    taskDirectory,
    taskId: task.id,
  });
  const verificationCurrent = gate.verification.every((check) => (
    check.result === "pass" && check.freshness === "current"
  ));
  return verificationCurrent
    ? "review"
    : result.role === "verify"
      ? "verify"
      : undefined;
}

function latestWorkerRecord(records: readonly TaskEvidenceRecord[]): TaskEvidenceRecord | undefined {
  return [...records]
    .filter((record) => record.workerProtocol === WORKER_PROTOCOL && record.workerRole && record.workerStatus)
    .sort((left, right) => left.time.localeCompare(right.time))
    .at(-1);
}

async function resolveWorkRole(
  rootDirectory: string,
  task: ProjectTask,
): Promise<WorkerRole | undefined> {
  const latest = latestWorkerRecord(await readTaskEvidence(rootDirectory, task.id));
  if (latest?.workerRole && latest.workerStatus) {
    return nextWorkerRoleAfterResult(rootDirectory, (await readAgenticConfigFile(rootDirectory)).taskDirectory, task, {
      protocol: WORKER_PROTOCOL,
      taskId: task.id,
      role: latest.workerRole as WorkerRole,
      runId: latest.runId,
      status: latest.workerStatus as WorkerStatus,
    });
  }

  if (task.state === "review") {
    const reviews = (await readTaskEvidence(rootDirectory, task.id))
      .filter((record) => record.type === "review")
      .sort((left, right) => left.time.localeCompare(right.time));
    const latestReview = reviews.at(-1);
    if (latestReview && latestReview.result !== "pass") {
      return "fix";
    }
  }
  return task.state === "todo" || task.state === "doing" ? "implement" : undefined;
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
    commands.push(`pnpm exec apk task gate ${task.id}`);
    commands.push(`pnpm exec apk done ${task.id} --owner ${task.owner}`);
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
    return `Run canonical verification: pnpm exec apk task verify ${task.id} --owner ${task.owner}`;
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

  return {
    task,
    runId,
    workerPackage,
    prompt,
    claimed,
    ...(persisted.promptPath ? { sessionPath: persisted.promptPath } : {}),
    packagePath: persisted.packagePath,
    metadataPath: persisted.metadataPath,
    nextRole: await nextWorkerRoleAfterResult(options.rootDirectory, config.taskDirectory, task, {
      protocol: WORKER_PROTOCOL,
      taskId: task.id,
      role,
      runId,
      status: "completed",
    }),
    next: workNextCommands(task, options.target, options.owner, runId, role),
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
  for (const field of ["repository", "headSha", "baselineId", "candidateId", "worktreeId"] as const) {
    const supplied = result.provenance?.[field];
    const issuedValue = issued.workerPackage.provenance[field];
    if (supplied !== undefined && supplied !== issuedValue) {
      throw new Error(`Worker result provenance ${field} does not match the issued package.`);
    }
  }

  const existing = await readTaskEvidence(options.rootDirectory, task.id);
  if (existing.some((record) => record.runId === result.runId && (
    record.workerProtocol === WORKER_PROTOCOL || record.type === "review"
  ))) {
    throw new Error(`Worker result already recorded for run ${result.runId}.`);
  }

  const findings = workerFindings(result);
  let evidence: TaskEvidenceRecord;
  if (result.role === "review") {
    const binding = issued.workerPackage.review;
    if (!binding) {
      throw new Error(`Issued review run ${result.runId} has no canonical prepared review binding.`);
    }
    if (binding.reviewRunId !== result.runId || binding.taskId !== task.id || binding.reviewer !== options.owner) {
      throw new Error(`Issued review run ${result.runId} has a mismatched canonical review binding.`);
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
    const provenance = issued.workerPackage.provenance;
    if (!provenance.repository || !provenance.baselineId || !provenance.candidateId || !provenance.worktreeId) {
      throw new Error(`Issued worker run ${result.runId} has incomplete candidate identity.`);
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
        repository: provenance.repository,
        ...(provenance.headSha ? { headSha: provenance.headSha } : {}),
        baselineId: provenance.baselineId,
        candidateId: provenance.candidateId,
        worktreeId: provenance.worktreeId,
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
  return [
    `Task: ${result.task.id}`,
    `State: ${result.task.state}`,
    `Owner: ${result.task.owner}`,
    `Run: ${result.runId}`,
    `Worker role: ${result.workerPackage.role}`,
    `Package: ${result.packagePath}`,
    `Metadata: ${result.metadataPath}`,
    `Next role: ${result.nextRole ?? "gate/done"}`,
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
