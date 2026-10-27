import { withDiagnosticSnapshot, type TaskDiagnosticSnapshot } from "../tasks/diagnostics.js";
import { type ProjectTask } from "../tasks/index.js";
import { resolveTaskPolicy } from "../tasks/policy.js";
import { projectWorkers, renderWorkerLine, type WorkerAttentionEntry } from "./workers.js";
export { WORKER_SEMANTIC_STATES, renderWorkersView, type WorkerSemanticState, type WorkerAttentionEntry } from "./workers.js";
import {
  summarizeStatus,
  readStatusTaskInventory,
  type ActiveTaskStatus,
  type StatusSummary,
} from "./index.js";

export const ATTENTION_PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type AttentionPriority = (typeof ATTENTION_PRIORITIES)[number];

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

function attentionAction(status: ActiveTaskStatus, independentReview: boolean): Pick<AttentionItem, "needsHuman" | "nextAction"> {
  const ordinary = { needsHuman: false, nextAction: status.nextAction };
  if (status.gate.status === "pass") return ordinary;
  const inspect = { needsHuman: false, nextAction: `inspect task ${status.id} evidence and worker-session diagnostics; retry attention` };
  // Error text is not a policy decision, even if it contains operator keywords.
  if (status.gate.status === "unavailable") return inspect;

  const review = status.review;
  const budget = independentReview ? review.budget : undefined;
  const passing = review.status === "current" && review.outcome === "pass";
  const accepted = review.decision?.freshness === "current"
    && review.decision.decision === "accept-current"
    && review.decision.resolvedBlocker === "review-budget-exhausted";
  // The status blocker list is bounded. Structured counts retain operator-only
  // conditions even when earlier verification/scope blockers fill that list.
  // MAX_SAFE_INTEGER is the gate's unavailable-session sentinel, not spend.
  const frontierUnknown = budget?.frontierPassesUsed === Number.MAX_SAFE_INTEGER
    || budget?.frontierRunsUsed === Number.MAX_SAFE_INTEGER;
  const frontierBlocked = budget && [
    [budget.frontierPassesUsed, budget.maxFrontierReviewPasses],
    [budget.frontierRunsUsed, budget.maxFrontierRuns],
  ].some(([used, maximum]) => used !== Number.MAX_SAFE_INTEGER
    && (used > maximum || (used >= maximum && !passing)));
  if (budget && (budget.passesUsed > budget.effectiveMaxReviewPasses || frontierBlocked)) {
    return { needsHuman: true, nextAction: `request explicit operator policy change for task ${status.id}; inspect apk task gate ${status.id}` };
  }
  if (budget?.exhausted && !passing && !accepted) {
    return { needsHuman: true, nextAction: `request explicit operator decision with apk task decision ${status.id}` };
  }
  const explicitApproval = status.gate.blockers.some((blocker) => (
    /^(?:Explicit )?(?:operator|human) (?:approval|decision) (?:is )?required(?:[.:;]|$)/i.test(blocker)
    || /^needs-human(?:[.:;]|$)/i.test(blocker)
  ));
  if (explicitApproval) {
    return { needsHuman: true, nextAction: `request the explicit operator approval identified by apk task gate ${status.id}` };
  }
  if (frontierUnknown || (independentReview && review.status === "unknown")) return inspect;
  if (!independentReview) return ordinary;
  if (review.decision?.freshness === "current" && review.decision.decision === "changes-required") {
    return { needsHuman: false, nextAction: `run fixer for ${status.id}; then request independent review` };
  }
  if (review.status === "current" && review.outcome === "changes_requested") {
    return { needsHuman: false, nextAction: `run fixer for ${status.id}; then request independent review` };
  }
  if (!accepted && ["missing", "stale"].includes(review.status)) {
    return { needsHuman: false, nextAction: `request independent review for ${status.id}` };
  }
  return ordinary;
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
  return withDiagnosticSnapshot(rootDirectory, taskDirectory, (snapshot) => buildCapturedAttention(rootDirectory, taskDirectory, snapshot));
}

async function buildCapturedAttention(rootDirectory: string, taskDirectory: string, diagnosticSnapshot: TaskDiagnosticSnapshot): Promise<AttentionView> {
  const config = diagnosticSnapshot.config;
  diagnosticSnapshot.assertLocation(rootDirectory, config.taskDirectory);
  const summary: StatusSummary = await summarizeStatus(rootDirectory, diagnosticSnapshot);
  const inventory = await readStatusTaskInventory(rootDirectory, taskDirectory, diagnosticSnapshot);
  const taskFiles = [...inventory.active, ...inventory.archived];
  const activeTasks = taskFiles
    .map((file) => file.task)
    .filter((task) => ["doing", "review", "blocked"].includes(task.state));
  const workerDiagnostics = inventory.diagnostics.filter((diagnostic) => !summary.warnings.includes(diagnostic));
  const workers = await projectWorkers(rootDirectory, config.resources, taskFiles.map((file) => file.task), workerDiagnostics, inventory.complete, diagnosticSnapshot);

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
        ...attentionAction(status, independentReview),
        blockers,
        assurance: policy?.requirements.assurance ?? "legacy-compatible",
        review: {
          status: status.review.status,
          ...(status.review.reviewer ? { reviewer: status.review.reviewer } : {}),
          ...(status.review.outcome ? { outcome: status.review.outcome } : {}),
        },
        assuranceStatus: assurance,
        reviewEscalation: independentReview && ["missing", "stale", "unknown"].includes(status.review.status),
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
