import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { CONFIG_PATH, readAgenticConfigFile } from "../config/index.js";
import { readRunLog, type RunLogEvent } from "../agents/index.js";
import { syncAgentExports } from "../sync/index.js";
import {
  buildTaskProvenance,
  evaluateTaskCompletionGate,
  listArchivedTaskFiles,
  listTaskFiles,
  selectNextTask,
  type ProjectTask,
  type ProjectTaskFile,
  type TaskCompletionGateResult,
  type TaskProvenance,
  TASK_STATES,
  type TaskState,
} from "../tasks/index.js";
import { TASK_EVIDENCE_LOCK_PATH } from "../tasks/evidence.js";
import { inspectLocalMutationLock, renderLocalLockInspection } from "../tasks/lock.js";

const MAX_ACTIVE_TASKS = 32;
const MAX_STATUS_BLOCKERS = 8;

export interface ActiveTaskStatus {
  id: string;
  title: string;
  state: TaskState;
  owner: string;
  risk: ProjectTask["risk"];
  policy: {
    classifications: string[];
    verification: "required" | "optional";
    scope: "required" | "not-required";
    review: "none" | "lightweight" | "independent";
    evidence: "required" | "not-required";
    evidenceCategories: string[];
  };
  dependencies: {
    ready: string[];
    blocked: string[];
  };
  verification: {
    required: number;
    passed: number;
    failed: number;
    pending: number;
    missing: number;
    stale: number;
    unknown: number;
  };
  scope: {
    status: "pass" | "fail" | "not-started" | "unavailable";
    changed: number;
    outOfScope: number;
    forbidden: number;
  };
  review: {
    status: "current" | "stale" | "unknown" | "missing" | "not-required";
    reviewer?: string;
    outcome?: string;
    reason: string;
  };
  evidence: {
    total: number;
    current: number;
    stale: number;
    unknown: number;
  };
  gate: {
    status: "pass" | "blocked" | "unavailable";
    blockers: string[];
  };
  provenance: {
    baselineId?: string;
    candidateId: string;
    worktreeId: string;
    runs: number;
    changedFiles: number;
    completion: "pass" | "stale" | "none";
  };
  nextAction: string;
  diagnostics: string[];
}

export interface StatusSummary {
  mode: string;
  config: "ok" | "missing";
  taskCounts: Record<TaskState, number>;
  archived: number;
  nextTask?: {
    id: string;
    title: string;
  };
  generated: {
    current: number;
    missing: number;
    stale: number;
  };
  latestRun?: RunLogEvent;
  activeTasks: ActiveTaskStatus[];
  warnings: string[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function emptyTaskCounts(): Record<TaskState, number> {
  return Object.fromEntries(TASK_STATES.map((state) => [state, 0])) as Record<TaskState, number>;
}

function duplicateTaskIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }

  return [...duplicates].sort();
}

async function localLockWarnings(rootDirectory: string, taskDirectory: string): Promise<string[]> {
  const [taskLock, evidenceLock] = await Promise.all([
    inspectLocalMutationLock(join(rootDirectory, taskDirectory, ".apk.lock")),
    inspectLocalMutationLock(join(rootDirectory, TASK_EVIDENCE_LOCK_PATH)),
  ]);
  const locks = [["task", taskLock], ["evidence", evidenceLock]] as const;
  return locks
    .filter(([, inspection]) => inspection.state !== "absent")
    .map(([label, inspection]) => `${label} lock: ${renderLocalLockInspection(inspection)}`);
}

function capStatusText(value: string, maxLength = 180): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function taskDependencies(
  task: ProjectTask,
  ready: readonly string[],
): ActiveTaskStatus["dependencies"] {
  const readySet = new Set(ready);
  return {
    ready: [...ready].sort(),
    blocked: task.dependsOn.filter((dependency) => !readySet.has(dependency)).sort(),
  };
}

function verificationStatus(gate: TaskCompletionGateResult): ActiveTaskStatus["verification"] {
  return {
    required: gate.verification.length,
    passed: gate.verification.filter((check) => check.result === "pass" && check.freshness === "current").length,
    failed: gate.verification.filter((check) => check.result === "fail" || check.result === "changes_requested").length,
    pending: gate.verification.filter((check) => check.result === "pending" || check.result === "unavailable" || check.result === "not-run").length,
    missing: gate.verification.filter((check) => check.result === "missing" && check.freshness === "missing").length,
    stale: gate.verification.filter((check) => check.freshness === "stale").length,
    unknown: gate.verification.filter((check) => check.freshness === "unknown").length,
  };
}

function provenanceStatus(provenance: TaskProvenance | undefined, gate: TaskCompletionGateResult): ActiveTaskStatus["provenance"] {
  if (!provenance) {
    return {
      baselineId: gate.attribution?.baselineId,
      candidateId: gate.subject.candidateId,
      worktreeId: gate.subject.worktreeId,
      runs: 0,
      changedFiles: gate.changedFiles.length,
      completion: "none",
    };
  }
  return {
    baselineId: provenance.baseline?.baselineId,
    candidateId: provenance.currentSubject.candidateId,
    worktreeId: provenance.currentSubject.worktreeId,
    runs: provenance.runs.length,
    changedFiles: provenance.taskAttributedFiles.length,
    completion: provenance.completion
      ? provenance.completion.currentFreshness === "current" ? "pass" : "stale"
      : "none",
  };
}

function evidenceStatus(provenance: TaskProvenance | undefined): ActiveTaskStatus["evidence"] {
  if (!provenance) return { total: 0, current: 0, stale: 0, unknown: 0 };
  return {
    total: provenance.evidence.length,
    current: provenance.evidence.filter((record) => record.freshness === "current").length,
    stale: provenance.evidence.filter((record) => record.freshness === "stale").length,
    unknown: provenance.evidence.filter((record) => record.freshness === "unknown").length,
  };
}

function nextTaskAction(
  task: ProjectTask,
  gate: TaskCompletionGateResult,
  dependencies: ActiveTaskStatus["dependencies"],
): string {
  if (task.state === "todo") {
    return dependencies.blocked.length > 0
      ? `wait for dependencies: ${dependencies.blocked.join(",")}`
      : "claim with --owner <agent-id>";
  }
  if (task.state === "blocked") {
    return gate.blockers.length > 0
      ? `resolve: ${capStatusText(gate.blockers[0])}`
      : "review blockers and reopen task";
  }
  if (gate.passed) {
    return `mark done with --owner ${task.owner}`;
  }
  if (gate.review.freshness === "current" && gate.review.outcome !== undefined && gate.review.outcome !== "pass") {
    return `run fixer for ${task.id}`;
  }
  if (gate.verification.some((check) => check.result !== "pass" || check.freshness !== "current")) {
    return `run verification for ${task.id}`;
  }
  if (gate.review.freshness !== "current" && gate.review.reason !== "independent review is not required") {
    return `request independent review for ${task.id}`;
  }
  if (gate.outOfScopeFiles.length > 0 || gate.forbiddenTouchedFiles.length > 0) {
    return `fix file scope for ${task.id}`;
  }
  return gate.blockers.length > 0
    ? `resolve: ${capStatusText(gate.blockers[0])}`
    : `inspect gate for ${task.id}`;
}

async function summarizeActiveTask(
  rootDirectory: string,
  taskDirectory: string,
  file: ProjectTaskFile,
  warnings: string[],
): Promise<ActiveTaskStatus> {
  const changedFiles = file.task.state === "todo" ? [] : undefined;
  let gate: TaskCompletionGateResult;
  try {
    gate = await evaluateTaskCompletionGate({
      rootDirectory,
      taskDirectory,
      taskId: file.task.id,
      changedFiles,
    });
  } catch (error: unknown) {
    const message = capStatusText(error instanceof Error ? error.message.split("\n")[0] : String(error));
    warnings.push(`task status warning: ${file.task.id}: ${message}`);
    return {
      id: file.task.id,
      title: file.task.title,
      state: file.task.state,
      owner: file.task.owner,
      risk: file.task.risk,
      policy: {
        classifications: [],
        verification: "required",
        scope: "not-required",
        review: "none",
        evidence: "not-required",
        evidenceCategories: [],
      },
      dependencies: { ready: [], blocked: [...file.task.dependsOn] },
      verification: { required: 0, passed: 0, failed: 0, pending: 0, missing: 0, stale: 0, unknown: 0 },
      scope: { status: "unavailable", changed: 0, outOfScope: 0, forbidden: 0 },
      review: { status: "unknown", reason: message },
      evidence: { total: 0, current: 0, stale: 0, unknown: 0 },
      gate: { status: "unavailable", blockers: [message] },
      provenance: {
        candidateId: "unavailable",
        worktreeId: "unavailable",
        runs: 0,
        changedFiles: 0,
        completion: "none",
      },
      nextAction: `inspect task ${file.task.id} status error`,
      diagnostics: [message],
    };
  }

  let provenance: TaskProvenance | undefined;
  if (file.task.state !== "todo") {
    try {
      provenance = await buildTaskProvenance(rootDirectory, taskDirectory, file.task.id);
    } catch (error: unknown) {
      const message = capStatusText(error instanceof Error ? error.message.split("\n")[0] : String(error));
      warnings.push(`task provenance warning: ${file.task.id}: ${message}`);
    }
  }
  const dependencies = taskDependencies(file.task, gate.dependencies);
  const verification = verificationStatus(gate);
  const scopeStatus = file.task.state === "todo"
    ? "not-started"
    : !gate.comparisonKnown
      ? "unavailable"
    : gate.outOfScopeFiles.length > 0 || gate.forbiddenTouchedFiles.length > 0 ? "fail" : "pass";
  return {
    id: file.task.id,
    title: file.task.title,
    state: file.task.state,
    owner: file.task.owner,
    risk: file.task.risk,
    policy: {
      classifications: [...gate.policy.classifications],
      verification: gate.policy.requirements.automatedVerification ? "required" : "optional",
      scope: gate.policy.requirements.scope ? "required" : "not-required",
      review: gate.policy.requirements.independentReview ? gate.policy.requirements.reviewLevel : "none",
      evidence: gate.policy.requirements.evidenceRequired ? "required" : "not-required",
      evidenceCategories: [...gate.policy.requirements.evidenceCategories],
    },
    dependencies,
    verification,
    scope: {
      status: scopeStatus,
      changed: gate.changedFiles.length,
      outOfScope: gate.outOfScopeFiles.length,
      forbidden: gate.forbiddenTouchedFiles.length,
    },
    review: {
      status: !gate.policy.requirements.independentReview ? "not-required" : gate.review.freshness,
      ...(gate.review.reviewer ? { reviewer: gate.review.reviewer } : {}),
      ...(gate.review.outcome ? { outcome: gate.review.outcome } : {}),
      reason: gate.review.reason,
    },
    evidence: evidenceStatus(provenance),
    gate: {
      status: gate.passed ? "pass" : "blocked",
      blockers: gate.blockers.slice(0, MAX_STATUS_BLOCKERS).map((blocker) => capStatusText(blocker)),
    },
    provenance: provenanceStatus(provenance, gate),
    nextAction: nextTaskAction(file.task, gate, dependencies),
    diagnostics: [
      ...gate.diagnostics.slice(0, MAX_STATUS_BLOCKERS).map((diagnostic) => capStatusText(diagnostic)),
      ...(provenance?.diagnostics ?? []).slice(0, MAX_STATUS_BLOCKERS).map((diagnostic) => capStatusText(diagnostic)),
    ],
  };
}

export async function summarizeStatus(rootDirectory: string): Promise<StatusSummary> {
  const configExists = await fileExists(join(rootDirectory, CONFIG_PATH));
  const config = await readAgenticConfigFile(rootDirectory);
  const warnings: string[] = [];
  const taskCounts = emptyTaskCounts();
  let archivedCount = 0;
  let nextTask: StatusSummary["nextTask"];
  const activeTaskStatuses: ActiveTaskStatus[] = [];

  if (!configExists) {
    warnings.push("config missing; using defaults");
  }

  try {
    const [activeTasks, archivedTasks] = await Promise.all([
      listTaskFiles(rootDirectory, config.taskDirectory),
      listArchivedTaskFiles(rootDirectory, config.taskDirectory),
    ]);

    for (const file of [...activeTasks, ...archivedTasks]) {
      taskCounts[file.task.state] += 1;
    }
    archivedCount = archivedTasks.length;

    const next = selectNextTask(activeTasks, archivedTasks);
    if (next) {
      nextTask = {
        id: next.task.id,
        title: next.task.title,
      };
    }

    const duplicateIds = duplicateTaskIds([...activeTasks, ...archivedTasks].map((file) => file.task.id));
    if (duplicateIds.length > 0) {
      warnings.push(`duplicate task ids: ${duplicateIds.join(",")}`);
    }

    const activeFiles = activeTasks.filter((file) => !["done", "canceled"].includes(file.task.state));
    for (const file of activeFiles.slice(0, MAX_ACTIVE_TASKS)) {
      activeTaskStatuses.push(await summarizeActiveTask(rootDirectory, config.taskDirectory, file, warnings));
    }
    if (activeFiles.length > MAX_ACTIVE_TASKS) {
      warnings.push(`active task status truncated at ${MAX_ACTIVE_TASKS} tasks`);
    }
  } catch (error: unknown) {
    warnings.push(`task parse warning: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }

  warnings.push(...await localLockWarnings(rootDirectory, config.taskDirectory));

  const sync = await syncAgentExports(rootDirectory);
  if (sync.hasDrift) {
    warnings.push("generated instructions out of sync");
  }

  const runs = await readRunLog(rootDirectory);

  return {
    mode: config.defaultMode,
    config: configExists ? "ok" : "missing",
    taskCounts,
    archived: archivedCount,
    nextTask,
    generated: {
      current: sync.current.length,
      missing: sync.missing.length,
      stale: sync.stale.length,
    },
    latestRun: runs.at(-1),
    activeTasks: activeTaskStatuses,
    warnings,
  };
}

function renderLatestRun(event: RunLogEvent | undefined): string {
  if (!event) {
    return "Latest run: none";
  }

  const task = event.task ? ` task ${event.task}` : "";
  return `Latest run: ${event.event}${task} by ${event.agent} at ${event.time}`;
}

function renderActiveTaskCompact(task: ActiveTaskStatus): string {
  const blockers = task.gate.blockers.length > 0
    ? ` blockers=${task.gate.blockers.slice(0, 2).join(" | ")}`
    : "";
  return `- ${task.id} [${task.state}] owner=${task.owner} risk=${task.risk} policy=review:${task.policy.review},scope:${task.policy.scope},evidence:${task.policy.evidence} deps=${task.dependencies.blocked.length > 0 ? `blocked(${task.dependencies.blocked.join(",")})` : "ready"} verify=${task.verification.passed}/${task.verification.required} scope=${task.scope.status} review=${task.review.status} evidence=${task.evidence.current}/${task.evidence.total} gate=${task.gate.status}${blockers} next=${task.nextAction}`;
}

function renderActiveTaskDetail(task: ActiveTaskStatus): string[] {
  return [
    `Task ${task.id}: ${task.title}`,
    `  State: ${task.state}; owner=${task.owner}; risk=${task.risk}`,
    `  Policy: review=${task.policy.review}; verification=${task.policy.verification}; scope=${task.policy.scope}; evidence=${task.policy.evidence}; classifications=${task.policy.classifications.join(",") || "none"}; categories=${task.policy.evidenceCategories.join(",") || "none"}`,
    `  Dependencies: ready=${task.dependencies.ready.join(",") || "none"}; blocked=${task.dependencies.blocked.join(",") || "none"}`,
    `  Verification: required=${task.verification.required}; passed=${task.verification.passed}; failed=${task.verification.failed}; pending=${task.verification.pending}; missing=${task.verification.missing}; stale=${task.verification.stale}; unknown=${task.verification.unknown}`,
    `  Scope: ${task.scope.status}; changed=${task.scope.changed}; out-of-scope=${task.scope.outOfScope}; forbidden=${task.scope.forbidden}`,
    `  Review: ${task.review.status}${task.review.reviewer ? ` reviewer=${task.review.reviewer}` : ""}${task.review.outcome ? ` outcome=${task.review.outcome}` : ""}; ${task.review.reason}`,
    `  Evidence: total=${task.evidence.total}; current=${task.evidence.current}; stale=${task.evidence.stale}; unknown=${task.evidence.unknown}`,
    `  Gate: ${task.gate.status}`,
    ...(task.gate.blockers.length > 0 ? ["  Blockers:", ...task.gate.blockers.map((blocker) => `    - ${blocker}`)] : []),
    `  Provenance: baseline=${task.provenance.baselineId ?? "none"}; candidate=${task.provenance.candidateId}; worktree=${task.provenance.worktreeId}; runs=${task.provenance.runs}; changed-files=${task.provenance.changedFiles}; completion=${task.provenance.completion}`,
    `  Next: ${task.nextAction}`,
    ...(task.diagnostics.length > 0 ? ["  Diagnostics:", ...task.diagnostics.map((diagnostic) => `    - ${diagnostic}`)] : []),
  ];
}

export function renderStatus(summary: StatusSummary, options: { detail?: boolean } = {}): string {
  const tasks = TASK_STATES
    .map((state) => `${state}:${summary.taskCounts[state]}`)
    .join(", ");

  return [
    `Mode: ${summary.mode}`,
    `Config: ${summary.config}`,
    `Tasks: ${tasks}, archived:${summary.archived}`,
    `Next task: ${summary.nextTask ? `${summary.nextTask.id} ${summary.nextTask.title}` : "none"}`,
    `Generated instructions: current:${summary.generated.current}, missing:${summary.generated.missing}, stale:${summary.generated.stale}`,
    renderLatestRun(summary.latestRun),
    "Active tasks:",
    ...(summary.activeTasks.length > 0
      ? (options.detail
        ? summary.activeTasks.flatMap((task) => renderActiveTaskDetail(task))
        : summary.activeTasks.map(renderActiveTaskCompact))
      : ["- none"]),
    `Warnings: ${summary.warnings.length === 0 ? "none" : summary.warnings.join("; ")}`,
    "",
  ].join("\n");
}
