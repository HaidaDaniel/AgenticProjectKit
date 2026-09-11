import { readAgenticConfigFile } from "../config/index.js";
import { allTaskFiles, type ProjectTask, type TaskState } from "../tasks/index.js";
import { resolveTaskPolicy } from "../tasks/policy.js";
import {
  listWorkerSessions,
  type DiscoveredWorkerSession,
} from "../work/session.js";
import {
  summarizeStatus,
  type ActiveTaskStatus,
  type StatusSummary,
} from "./index.js";

export const ATTENTION_PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type AttentionPriority = (typeof ATTENTION_PRIORITIES)[number];

export const WORKER_SEMANTIC_STATES = ["ready", "busy", "unknown", "unavailable"] as const;
export type WorkerSemanticState = (typeof WORKER_SEMANTIC_STATES)[number];

export interface WorkerAttentionEntry {
  id: string;
  modelId: string;
  harnessId: string;
  location: string;
  availability: string;
  costClass: string;
  capabilities: string[];
  capacity: number;
  /** Effective occupancy: max(declared occupied, active APK-recorded runs). */
  occupied: number;
  declaredOccupied: number;
  remainingSlots: number;
  /** Semantic capacity state; never a live process observation. */
  state: WorkerSemanticState;
  stateReason: string;
  /** Proven from canonical session records only; omitted when not provable. */
  currentTaskId?: string;
  currentRunId?: string;
}

export interface AttentionItem {
  taskId: string;
  title: string;
  state: string;
  owner: string;
  priority: AttentionPriority;
  reason: string;
  nextAction: string;
  blockers: string[];
  assurance: string;
  review: {
    status: string;
    reviewer?: string;
    outcome?: string;
  };
  assuranceStatus: "satisfied" | "unavailable" | "not-required";
  reviewEscalation: boolean;
  needsHuman: boolean;
  runs: number;
  reviewBudget: string;
}

export interface AttentionView {
  workers: WorkerAttentionEntry[];
  items: AttentionItem[];
  diagnostics: string[];
}

const PRIORITY_RANK: Record<AttentionPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
const TERMINAL_TASK_STATES: readonly TaskState[] = ["done", "canceled"];

interface BoundWorkerSessions {
  /** Activated runs whose task is still open; these consume a slot. */
  active: DiscoveredWorkerSession[];
  /** Unactivated or task-missing sessions; cannot prove readiness. */
  stale: DiscoveredWorkerSession[];
  /** Malformed identity; ownership is ambiguous. */
  ambiguous: DiscoveredWorkerSession[];
}

function bindWorkerSessions(
  sessions: readonly DiscoveredWorkerSession[],
  taskStates: ReadonlyMap<string, TaskState>,
): BoundWorkerSessions {
  const active: DiscoveredWorkerSession[] = [];
  const stale: DiscoveredWorkerSession[] = [];
  const ambiguous: DiscoveredWorkerSession[] = [];
  for (const session of sessions) {
    if (session.state === "malformed") {
      ambiguous.push(session);
      continue;
    }
    if (session.state === "unactivated") {
      stale.push(session);
      continue;
    }
    const taskState = taskStates.get(session.taskId);
    if (taskState === undefined) {
      // An orphaned session (missing task) must be visible and prevent
      // confident readiness.
      stale.push(session);
      continue;
    }
    if (TERMINAL_TASK_STATES.includes(taskState)) {
      // A completed/canceled run does not hold a slot or block readiness.
      continue;
    }
    active.push(session);
  }
  return { active, stale, ambiguous };
}

function buildWorkers(
  registry: Awaited<ReturnType<typeof readAgenticConfigFile>>["resources"],
  sessions: readonly DiscoveredWorkerSession[],
  taskStates: ReadonlyMap<string, TaskState>,
  diagnostics: string[],
): WorkerAttentionEntry[] {
  if (!registry || registry.workers.length === 0) {
    return [];
  }
  const bound = new Map<string, DiscoveredWorkerSession[]>();
  for (const session of sessions) {
    if (!session.resourceId) continue;
    const list = bound.get(session.resourceId) ?? [];
    list.push(session);
    bound.set(session.resourceId, list);
  }
  const configured = new Set(registry.workers.map((worker) => worker.id));
  for (const resourceId of [...bound.keys()].sort()) {
    if (!configured.has(resourceId)) {
      diagnostics.push(`Worker session references unconfigured resource ${resourceId}; its occupancy cannot be attributed.`);
    }
  }

  return registry.workers
    .map((worker) => {
      const workerSessions = bound.get(worker.id) ?? [];
      const { active, stale, ambiguous } = bindWorkerSessions(workerSessions, taskStates);
      const effectiveOccupied = Math.max(worker.occupied, active.length);
      const remainingSlots = Math.max(0, worker.capacity - effectiveOccupied);
      let state: WorkerSemanticState;
      let stateReason: string;
      if (worker.availability === "unknown") {
        state = "unknown";
        stateReason = "declared availability is unknown";
      } else if (worker.availability === "unavailable") {
        state = "unavailable";
        stateReason = "declared unavailable";
      } else if (ambiguous.length > 0) {
        state = "unknown";
        stateReason = `${ambiguous.length} malformed session(s) prevent confident readiness`;
        diagnostics.push(`Worker ${worker.id} has malformed session state; reporting unknown rather than ready.`);
      } else if (worker.occupied >= worker.capacity) {
        state = "busy";
        stateReason = `declared occupancy ${worker.occupied}/${worker.capacity}`;
      } else if (active.length > 0) {
        state = "busy";
        stateReason = `${active.length} active APK-recorded run(s)`;
      } else if (stale.length > 0) {
        state = "unknown";
        stateReason = `${stale.length} stale/orphaned session(s) present without active work`;
        diagnostics.push(`Worker ${worker.id} has ${stale.length} stale/orphaned session(s); not confidently ready.`);
      } else {
        state = "ready";
        stateReason = "no conflicting canonical run or session";
      }

      const sortedActive = [...active].sort((left, right) => (
        left.taskId.localeCompare(right.taskId) || left.runId.localeCompare(right.runId)
      ));
      if (sortedActive.length > 1) {
        diagnostics.push(`Worker ${worker.id} has multiple active runs; the current task/run is ambiguous and omitted.`);
      }
      const current = sortedActive.length === 1 ? sortedActive[0] : undefined;
      return {
        id: worker.id,
        modelId: worker.modelId,
        harnessId: worker.harnessId,
        location: worker.location,
        availability: worker.availability,
        costClass: worker.costClass,
        capabilities: [...worker.capabilities.roles].sort(),
        capacity: worker.capacity,
        occupied: effectiveOccupied,
        declaredOccupied: worker.occupied,
        remainingSlots,
        state,
        stateReason,
        ...(current ? { currentTaskId: current.taskId, currentRunId: current.runId } : {}),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function priorityFor(status: ActiveTaskStatus): AttentionPriority {
  const blockers = status.gate.blockers.join(" ").toLowerCase();
  if (
    status.scope.status === "fail"
    || /scope violation|forbidden file|required verification check .* is fail|verification evidence is fail/.test(blockers)
  ) {
    return "P1";
  }
  if (/independent review|live evidence|manual evidence|report evidence|benchmark evidence|review budget|assurance/.test(blockers)) {
    return "P2";
  }
  if (/stale|dependency|missing verification evidence|not done/.test(blockers)) {
    return "P3";
  }
  return "P4";
}

function reasonFor(status: ActiveTaskStatus): string {
  if (status.gate.status === "pass") {
    return "ready to complete";
  }
  return status.gate.blockers[0] ?? status.review.reason;
}

function taskById(tasks: readonly ProjectTask[], id: string): ProjectTask | undefined {
  return tasks.find((task) => task.id === id);
}

/**
 * Attention never surfaces OS liveness facts. Lock warnings carry PID/host
 * details, so they are reduced to a neutral state pointer; any other warning
 * that mentions process liveness is dropped.
 */
function sanitizeDiagnostic(warning: string): string | undefined {
  const lockMatch = /^(task|evidence) lock:/.exec(warning);
  if (lockMatch) {
    return `${lockMatch[1]} lock is present; inspect with apk task lock status.`;
  }
  if (/\bpid\b|process-start|liveness|hostname=|is running|cannot prove death/i.test(warning)) {
    return undefined;
  }
  return warning;
}

function assuranceStatus(
  independentReview: boolean,
  review: ActiveTaskStatus["review"],
): AttentionItem["assuranceStatus"] {
  if (!independentReview) return "not-required";
  return review.status === "current" && review.outcome === "pass" ? "satisfied" : "unavailable";
}

/**
 * Bounded, deterministic attention projection over existing status, gate,
 * review, policy, provenance, and resource state. It reports semantic facts
 * only; it does not poll processes or claim live worker state APK cannot prove.
 */
export async function buildAttentionView(
  rootDirectory: string,
  taskDirectory: string,
): Promise<AttentionView> {
  const config = await readAgenticConfigFile(rootDirectory);
  const summary: StatusSummary = await summarizeStatus(rootDirectory);
  const taskFiles = await allTaskFiles(rootDirectory, taskDirectory);
  const activeTasks = taskFiles
    .map((file) => file.task)
    .filter((task) => ["doing", "review", "blocked"].includes(task.state));
  const taskStates = new Map(taskFiles.map((file) => [file.task.id, file.task.state] as const));

  const workerDiagnostics: string[] = [];
  let sessions: DiscoveredWorkerSession[] = [];
  if (config.resources && config.resources.workers.length > 0) {
    try {
      sessions = await listWorkerSessions(rootDirectory);
    } catch (error: unknown) {
      workerDiagnostics.push(`Worker session scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const workers = buildWorkers(config.resources, sessions, taskStates, workerDiagnostics);

  const items: AttentionItem[] = summary.activeTasks
    .filter((status) => ["doing", "review", "blocked"].includes(status.state))
    .map((status) => {
      const task = taskById(activeTasks, status.id);
      const policy = task ? resolveTaskPolicy(task) : undefined;
      const budget = policy?.requirements.reviewBudget;
      const independentReview = Boolean(policy?.requirements.independentReview);
      const assurance = assuranceStatus(independentReview, status.review);
      const blockers = [...status.gate.blockers];
      return {
        taskId: status.id,
        title: status.title,
        state: status.state,
        owner: status.owner,
        priority: priorityFor(status),
        reason: reasonFor(status),
        nextAction: status.nextAction,
        blockers,
        assurance: policy?.requirements.assurance ?? "legacy-compatible",
        review: {
          status: status.review.status,
          ...(status.review.reviewer ? { reviewer: status.review.reviewer } : {}),
          ...(status.review.outcome ? { outcome: status.review.outcome } : {}),
        },
        assuranceStatus: assurance,
        reviewEscalation: independentReview && ["missing", "stale", "unknown"].includes(status.review.status),
        needsHuman: blockers.some((blocker) => /needs-human|review budget exhausted/i.test(blocker))
          || (assurance === "unavailable" && status.gate.status !== "pass"),
        runs: status.provenance.runs,
        reviewBudget: budget ? `${budget.maxReviewPasses} passes/${budget.maxFrontierReviewPasses} frontier` : "legacy-compatible",
      };
    })
    .sort((left, right) => (
      PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
      || left.taskId.localeCompare(right.taskId)
    ));

  const diagnostics = [
    ...summary.warnings.map(sanitizeDiagnostic).filter((warning): warning is string => warning !== undefined),
    ...workerDiagnostics,
    ...(workers.length === 0 ? ["No declared resource registry; worker occupancy is unavailable."] : []),
  ];

  return { workers, items, diagnostics };
}

export function renderAttentionView(view: AttentionView, json = false): string {
  if (json) {
    return `${JSON.stringify(view, null, 2)}\n`;
  }
  const lines = [
    `Attention: ${view.items.length} item(s); workers: ${view.workers.length}`,
  ];
  for (const item of view.items) {
    lines.push(`- [${item.priority}] ${item.taskId} "${item.title}" (${item.state}/${item.owner}) ${item.reason}`);
    lines.push(`    next=${item.nextAction} assurance=${item.assurance} (${item.assuranceStatus}) review=${item.review.status}${item.review.outcome ? `/${item.review.outcome}` : ""}${item.review.reviewer ? ` by ${item.review.reviewer}` : ""} escalation=${item.reviewEscalation} needs-human=${item.needsHuman} budget=${item.reviewBudget} runs=${item.runs}`);
    lines.push(`    blockers=${item.blockers.length > 0 ? item.blockers.join(" | ") : "none"}`);
  }
  for (const worker of view.workers) {
    lines.push(renderWorkerLine("worker", worker));
  }
  if (view.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...view.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
  }
  lines.push("");
  return lines.join("\n");
}

function renderWorkerLine(label: string, worker: WorkerAttentionEntry): string {
  const current = worker.currentTaskId
    ? ` current=${worker.currentTaskId}/${worker.currentRunId ?? "unknown"}`
    : "";
  return `- ${label} ${worker.id} ${worker.state} ${worker.occupied}/${worker.capacity} remaining=${worker.remainingSlots}${current} ${worker.location} ${worker.availability} cost=${worker.costClass} capabilities=${worker.capabilities.join(",") || "none"} model=${worker.modelId} harness=${worker.harnessId} reason=${worker.stateReason}`;
}

export function renderWorkersView(view: AttentionView, json = false): string {
  if (json) {
    return `${JSON.stringify({ workers: view.workers, diagnostics: view.diagnostics }, null, 2)}\n`;
  }
  const lines = [`Workers: ${view.workers.length}`];
  for (const worker of view.workers) {
    lines.push(renderWorkerLine("", worker).replace(/^- /, "- "));
  }
  if (view.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...view.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
  }
  lines.push("");
  return lines.join("\n");
}
