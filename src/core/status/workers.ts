import type { TaskDiagnosticSnapshot } from "../tasks/diagnostics.js";
import { readAgenticConfigFile } from "../config/index.js";
import { inspectTaskContracts } from "../config/compatibility.js";
import { type ProjectTask, type TaskState } from "../tasks/index.js";
import { listWorkerSessions, type DiscoveredWorkerSession } from "../work/session.js";

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

export interface WorkerView {
  workers: WorkerAttentionEntry[];
  diagnostics: string[];
}

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
  taskStates: ReadonlyMap<string, TaskState | null>,
): BoundWorkerSessions {
  const active: DiscoveredWorkerSession[] = [];
  const stale: DiscoveredWorkerSession[] = [];
  const ambiguous: DiscoveredWorkerSession[] = [];
  for (const session of sessions) {
    if (session.state === "malformed" || taskStates.get(session.taskId) === null) {
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
    if (taskState !== null && TERMINAL_TASK_STATES.includes(taskState)) {
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
  taskStates: ReadonlyMap<string, TaskState | null>,
  diagnostics: string[],
  sessionsUnavailable = false,
): WorkerAttentionEntry[] {
  if (!registry || registry.workers.length === 0) {
    return [];
  }
  const bound = new Map<string, DiscoveredWorkerSession[]>();
  for (const session of sessions) {
    if (!session.resourceId) {
      if (session.state === "malformed") {
        sessionsUnavailable = true;
        diagnostics.push("Malformed canonical session has no attributable resource; worker readiness is unknown.");
      }
      continue;
    }
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
      if (worker.availability === "unavailable") {
        state = "unavailable";
        stateReason = "declared unavailable";
      } else if (sessionsUnavailable) {
        // Canonical session state could not be read: readiness cannot be proven.
        state = "unknown";
        stateReason = "canonical worker-session state unavailable";
      } else if (worker.availability === "unknown") {
        state = "unknown";
        stateReason = "declared availability is unknown";
      } else if (workerSessions.some((session) => taskStates.get(session.taskId) === null)) {
        state = "unknown";
        stateReason = "duplicate task IDs make canonical session ownership ambiguous";
        diagnostics.push(`Worker ${worker.id} has a session bound to a duplicate task ID; reporting unknown.`);
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
      const current = !sessionsUnavailable && ambiguous.length === 0 && sortedActive.length === 1 ? sortedActive[0] : undefined;
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

/** A canonical session binds an ID, not a path: every duplicate is ambiguous,
 * including equal states and active/archive collisions. No ordering preference
 * can establish which contract owns that session. */
export async function projectWorkers(
  rootDirectory: string,
  registry: Awaited<ReturnType<typeof readAgenticConfigFile>>["resources"],
  tasks: readonly ProjectTask[],
  diagnostics: string[],
  inventoryComplete: boolean,
  diagnosticSnapshot?: TaskDiagnosticSnapshot,
): Promise<WorkerAttentionEntry[]> {
  if (!registry?.workers.length) return [];
  const taskStates = new Map<string, TaskState | null>();
  for (const task of tasks) {
    taskStates.set(task.id, taskStates.has(task.id) ? null : task.state);
  }
  let sessions: DiscoveredWorkerSession[] = [];
  let unavailable = !inventoryComplete;
  if (unavailable) diagnostics.push("Task inventory is incomplete or invalid; worker readiness is unknown.");
  try {
    sessions = await (diagnosticSnapshot?.memo(rootDirectory, "worker-sessions", () => listWorkerSessions(rootDirectory)) ?? listWorkerSessions(rootDirectory));
  } catch (error: unknown) {
    unavailable = true;
    diagnostics.push(`Canonical worker-session state unavailable (${String(error instanceof Error ? error.message : error).slice(0, 512)}); worker readiness is unknown.`);
  }
  return buildWorkers(registry, sessions, taskStates, diagnostics, unavailable);
}

/** Invocation-local worker projection: no status, gate, provenance or journals. */
export async function buildWorkersView(rootDirectory: string): Promise<WorkerView> {
  const config = await readAgenticConfigFile(rootDirectory);
  if (!config.resources?.workers.length) {
    return { workers: [], diagnostics: ["No declared resource registry; worker occupancy is unavailable."] };
  }
  const { inspection, parsed } = await inspectTaskContracts(rootDirectory, config.taskDirectory);
  const diagnostics = [...inspection.diagnostics];
  const invalid = inspection.entries.filter((entry) => entry.status !== "parseable");
  for (const entry of invalid.slice(0, 8)) {
    diagnostics.push(`Worker task inventory: ${entry.path.slice(0, 256)}: ${entry.status}: ${entry.issues[0] ?? "unavailable"}`);
  }
  if (invalid.length > 8) diagnostics.push(`${invalid.length - 8} additional task inventory issues omitted.`);
  const workers = await projectWorkers(rootDirectory, config.resources, parsed.map((file) => file.task),
    diagnostics, inspection.coverage.complete && inspection.coverage.incompatible === 0);
  return { workers, diagnostics };
}

export function renderWorkerLine(label: string, worker: WorkerAttentionEntry): string {
  const current = worker.currentTaskId
    ? ` current=${worker.currentTaskId}/${worker.currentRunId ?? "unknown"}`
    : "";
  return `- ${label} ${worker.id} ${worker.state} ${worker.occupied}/${worker.capacity} remaining=${worker.remainingSlots}${current} ${worker.location} ${worker.availability} cost=${worker.costClass} capabilities=${worker.capabilities.join(",") || "none"} model=${worker.modelId} harness=${worker.harnessId} reason=${worker.stateReason}`;
}

export function renderWorkersView(view: WorkerView, json = false): string {
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
