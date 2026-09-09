import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { appendRunLog, readRunLog, requireAgent } from "../agents/index.js";
import { readAgenticConfigFile } from "../config/index.js";
import { buildTaskPromptInput, renderTaskPrompt } from "../docs/prompt.js";
import type { ContextLevel } from "../docs/context.js";
import { appendTaskEvidence, readTaskEvidence, type TaskEvidenceRecord } from "../tasks/evidence.js";
import { captureTaskCompletionCandidate } from "../tasks/gate.js";
import { resolveTaskPolicy } from "../tasks/policy.js";
import { claimTask } from "../tasks/workflow.js";
import { findTaskFile, loadTaskFile, readTaskBaseline, type ProjectTask } from "../tasks/index.js";
import {
  createWorkerPackage,
  parseWorkerResult,
  WORKER_PROTOCOL,
  type WorkerPackage,
  type WorkerResult,
  type WorkerRole,
  type WorkerStatus,
  type WorkerHandoff,
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
  nextRole?: WorkerRole;
  next: string[];
}

export interface WorkerRunResult {
  task: ProjectTask;
  result: WorkerResult;
  evidence: TaskEvidenceRecord;
  nextRole?: WorkerRole;
  nextPackage?: WorkerPackage;
  nextAction: string;
}

function resolveLevel(task: ProjectTask, level: WorkLevel): ContextLevel {
  if (level !== "auto") {
    return level;
  }

  return task.risk === "high" ? 3 : 2;
}

function workRunId(): string {
  return `work-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    return nextWorkerRole(task, {
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

async function createNextWorkerPackage(
  rootDirectory: string,
  taskDirectory: string,
  task: ProjectTask,
  result: WorkerResult,
  nextRole: WorkerRole,
): Promise<WorkerPackage> {
  const config = await readAgenticConfigFile(rootDirectory);
  const taskFile = await findTaskFile(rootDirectory, task.id, taskDirectory);
  const candidate = await captureTaskCompletionCandidate({
    rootDirectory,
    taskDirectory,
    taskId: task.id,
  });
  const promptInput = buildTaskPromptInput(
    "agents",
    task,
    task.risk === "high" ? 3 : 2,
    {
      docsDirectory: config.docsDirectory,
      taskDirectory: config.taskDirectory,
      taskFile: relative(rootDirectory, taskFile).replace(/\\/g, "/"),
    },
  );
  const findings = workerFindings(result);
  return createWorkerPackage(task, promptInput.context, {
    role: nextRole,
    runId: workRunId(),
    baselineId: candidate.subject.baselineId,
    candidateId: candidate.subject.candidateId,
    worktreeId: candidate.subject.worktreeId,
    ...(nextRole === "fix"
      ? {
        handoff: {
          fromRunId: result.runId,
          fromRole: result.role,
          status: result.status,
          findings,
          ...(result.reason ? { reason: result.reason } : {}),
        },
      }
      : {}),
  });
}

function requireWorkRole(task: ProjectTask, owner: string, role: WorkerRole): void {
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
      throw new Error("Implementation owner cannot start an independent review worker run.");
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

function workNextCommands(taskId: string, owner: string, runId: string, role: WorkerRole): string[] {
  const commands = [
    `pnpm exec apk work result ${taskId} --owner ${owner} --run-id ${runId} --role ${role} --status completed`,
  ];
  if (role === "implement" || role === "fix") {
    commands.push(`pnpm exec apk task verify ${taskId} --owner ${owner}`);
  } else if (role === "verify") {
    commands.push(`pnpm exec apk review ${taskId} --owner ${owner}`);
  } else {
    commands.push(`pnpm exec apk task gate ${taskId}`);
  }
  commands.push(`pnpm exec apk done ${taskId} --owner ${owner}`);
  return commands;
}

async function writeSessionPrompt(
  rootDirectory: string,
  taskId: string,
  runId: string,
  prompt: string,
): Promise<string> {
  const sessionPath = join(".agentic", "sessions", taskId, runId, "prompt.md");
  const absolute = join(rootDirectory, sessionPath);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, prompt, "utf8");
  return sessionPath.replace(/\\/g, "/");
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
  requireWorkRole(task, options.owner, role);
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
  const prompt = renderTaskPrompt(promptInput);
  const runId = workRunId();
  const baseline = await readTaskBaseline(options.rootDirectory, task.id);
  const handoff = role === "fix"
    ? await resolveLatestHandoff(options.rootDirectory, task.id)
    : undefined;
  const workerPackage = createWorkerPackage(task, promptInput.context, {
    role,
    runId,
    ...(baseline ? { baselineId: baseline.baselineId } : {}),
    ...(handoff ? { handoff } : {}),
  });
  const sessionPath = options.writeSession
    ? await writeSessionPrompt(options.rootDirectory, task.id, runId, prompt)
    : undefined;

  await appendRunLog(options.rootDirectory, {
    event: "work",
    agent,
    task: task.id,
    runId,
    state: task.state,
    outcome: "ok",
    ...(sessionPath ? { reason: `session ${sessionPath}` } : {}),
  });

  return {
    task,
    runId,
    workerPackage,
    prompt,
    claimed,
    sessionPath,
    nextRole: nextWorkerRole(task, {
      protocol: WORKER_PROTOCOL,
      taskId: task.id,
      role,
      runId,
      status: "completed",
    }),
    next: workNextCommands(task.id, options.owner, runId, role),
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
  if (result.role === "review" && task.owner === options.owner) {
    throw new Error("Implementation owner cannot record its own independent review result.");
  }

  const run = (await readRunLog(options.rootDirectory)).find((event) => (
    event.event === "work" &&
    event.task === task.id &&
    event.runId === result.runId &&
    event.agent === options.owner
  ));
  if (!run) {
    throw new Error(`No matching work package run ${result.runId} exists for task ${task.id} and owner ${options.owner}.`);
  }

  const existing = await readTaskEvidence(options.rootDirectory, task.id);
  if (existing.some((record) => record.workerProtocol === WORKER_PROTOCOL && record.runId === result.runId)) {
    throw new Error(`Worker result already recorded for run ${result.runId}.`);
  }

  const candidate = await captureTaskCompletionCandidate({
    rootDirectory: options.rootDirectory,
    taskDirectory: options.taskDirectory,
    taskId: task.id,
  });
  const findings = workerFindings(result);
  const type = result.role === "review" ? "review" : "report";
  const evidence = await appendTaskEvidence(options.rootDirectory, {
    taskId: task.id,
    runId: result.runId,
    agent: agent.id,
    gateEligible: candidate.comparisonKnown,
    type,
    result: evidenceResult(result.status),
    subject: candidate.subject,
    ...(type === "review" ? { reviewer: agent.id } : {}),
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

  const nextRole = nextWorkerRole(task, result);
  const nextPackage = nextRole
    ? await createNextWorkerPackage(options.rootDirectory, options.taskDirectory, task, result, nextRole)
    : undefined;
  return {
    task,
    result,
    evidence,
    ...(nextRole ? { nextRole } : {}),
    ...(nextPackage ? { nextPackage } : {}),
    nextAction: nextRole
      ? `Start the ${nextRole} worker role with run ${nextPackage?.provenance.runId}.`
      : `Run apk task gate ${task.id}, then apk done ${task.id} --owner ${options.owner}.`,
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
    ...(result.nextPackage ? [
      `Next run: ${result.nextPackage.provenance.runId}`,
      `Next package: ${result.nextPackage.protocol}`,
      ...(result.nextPackage.handoff?.findings.length
        ? ["Handoff findings:", ...result.nextPackage.handoff.findings.map((finding) => `  - ${finding}`)]
        : []),
    ] : []),
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
    `Next role: ${result.nextRole ?? "gate/done"}`,
    `Claimed: ${result.claimed ? "yes" : "no"}`,
    ...(result.sessionPath ? [`Session: ${result.sessionPath}`] : []),
    "",
    result.prompt,
    "Next commands:",
    ...result.next.map((command) => `- ${command}`),
    "",
  ].join("\n");
}
