import { readAgenticConfigFile } from "../config/index.js";
import { allTaskFiles, type ProjectTask } from "../tasks/index.js";
import { resolveTaskPolicy } from "../tasks/policy.js";
import {
  summarizeStatus,
  type ActiveTaskStatus,
  type StatusSummary,
} from "./index.js";

export const ATTENTION_PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type AttentionPriority = (typeof ATTENTION_PRIORITIES)[number];

export interface WorkerAttentionEntry {
  id: string;
  modelId: string;
  harnessId: string;
  location: string;
  availability: string;
  costClass: string;
  capacity: number;
  occupied: number;
  /** Semantic capacity state; never a live process observation. */
  state: "ready" | "busy" | "unknown";
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
  reviewBudget: string;
}

export interface AttentionView {
  workers: WorkerAttentionEntry[];
  items: AttentionItem[];
  diagnostics: string[];
}

const PRIORITY_RANK: Record<AttentionPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

function buildWorkers(summary: StatusSummary, registry: Awaited<ReturnType<typeof readAgenticConfigFile>>["resources"]): WorkerAttentionEntry[] {
  if (!registry || registry.workers.length === 0) {
    return [];
  }
  void summary;
  return registry.workers
    .map((worker) => {
      const free = worker.capacity - worker.occupied;
      const state: WorkerAttentionEntry["state"] = worker.availability === "unknown"
        ? "unknown"
        : free <= 0
          ? "busy"
          : "ready";
      return {
        id: worker.id,
        modelId: worker.modelId,
        harnessId: worker.harnessId,
        location: worker.location,
        availability: worker.availability,
        costClass: worker.costClass,
        capacity: worker.capacity,
        occupied: worker.occupied,
        state,
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
 * Bounded, deterministic attention projection over existing status, gate,
 * review, policy, and resource state. It reports semantic facts only; it does
 * not poll processes or claim live worker state APK cannot prove.
 */
export async function buildAttentionView(
  rootDirectory: string,
  taskDirectory: string,
): Promise<AttentionView> {
  const config = await readAgenticConfigFile(rootDirectory);
  const summary = await summarizeStatus(rootDirectory);
  const taskFiles = await allTaskFiles(rootDirectory, taskDirectory);
  const activeTasks = taskFiles
    .map((file) => file.task)
    .filter((task) => ["doing", "review", "blocked"].includes(task.state));

  const workers = buildWorkers(summary, config.resources);

  const items: AttentionItem[] = summary.activeTasks
    .filter((status) => ["doing", "review", "blocked"].includes(status.state))
    .map((status) => {
      const task = taskById(activeTasks, status.id);
      const policy = task ? resolveTaskPolicy(task) : undefined;
      const budget = policy?.requirements.reviewBudget;
      return {
        taskId: status.id,
        title: status.title,
        state: status.state,
        owner: status.owner,
        priority: priorityFor(status),
        reason: reasonFor(status),
        nextAction: status.nextAction,
        blockers: [...status.gate.blockers],
        assurance: policy?.requirements.assurance ?? "legacy-compatible",
        reviewBudget: budget ? `${budget.maxReviewPasses} passes/${budget.maxFrontierReviewPasses} frontier` : "legacy-compatible",
      };
    })
    .sort((left, right) => (
      PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
      || left.taskId.localeCompare(right.taskId)
    ));

  const diagnostics = workers.length === 0
    ? ["No declared resource registry; worker occupancy is unavailable."]
    : [];

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
    lines.push(`- [${item.priority}] ${item.taskId} (${item.state}/${item.owner}) ${item.reason} -> ${item.nextAction}`);
  }
  for (const worker of view.workers) {
    lines.push(`- worker ${worker.id} ${worker.state} ${worker.occupied}/${worker.capacity} cost=${worker.costClass}`);
  }
  if (view.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...view.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
  }
  lines.push("");
  return lines.join("\n");
}

export function renderWorkersView(view: AttentionView, json = false): string {
  if (json) {
    return `${JSON.stringify({ workers: view.workers, diagnostics: view.diagnostics }, null, 2)}\n`;
  }
  const lines = [`Workers: ${view.workers.length}`];
  for (const worker of view.workers) {
    lines.push(`- ${worker.id} ${worker.state} ${worker.occupied}/${worker.capacity} ${worker.location} ${worker.availability} cost=${worker.costClass}`);
  }
  if (view.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...view.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
  }
  lines.push("");
  return lines.join("\n");
}
