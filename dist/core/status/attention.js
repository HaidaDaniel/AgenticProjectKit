import { readAgenticConfigFile } from "../config/index.js";
import { resolveTaskPolicy } from "../tasks/policy.js";
import { projectWorkers, renderWorkerLine } from "./workers.js";
export { WORKER_SEMANTIC_STATES, renderWorkersView } from "./workers.js";
import { summarizeStatus, readStatusTaskInventory, } from "./index.js";
export const ATTENTION_PRIORITIES = ["P1", "P2", "P3", "P4"];
const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2, P4: 3 };
function priorityFor(status) {
    const blockers = status.gate.blockers.join(" ").toLowerCase();
    if (status.scope.status === "fail"
        || /scope violation|forbidden file|required verification check .* is fail|verification evidence is fail/.test(blockers)) {
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
function reasonFor(status) {
    if (status.gate.status === "pass") {
        return "ready to complete";
    }
    return status.gate.blockers[0] ?? status.review.reason;
}
function taskById(tasks, id) {
    return tasks.find((task) => task.id === id);
}
/**
 * Attention never surfaces OS liveness facts. Lock warnings carry PID/host
 * details, so they are reduced to a neutral state pointer; any other warning
 * that mentions process liveness is dropped.
 */
function sanitizeDiagnostic(warning) {
    const lockMatch = /^(task|evidence) lock:/.exec(warning);
    if (lockMatch) {
        return `${lockMatch[1]} lock is present; inspect with apk task lock status.`;
    }
    if (/\bpid\b|process-start|liveness|hostname=|is running|cannot prove death/i.test(warning)) {
        return undefined;
    }
    return warning;
}
function assuranceStatus(independentReview, review) {
    if (!independentReview)
        return "not-required";
    return review.status === "current" && review.outcome === "pass" ? "satisfied" : "unavailable";
}
/**
 * Bounded, deterministic attention projection over existing status, gate,
 * review, policy, provenance, and resource state. It reports semantic facts
 * only; it does not poll processes or claim live worker state APK cannot prove.
 */
export async function buildAttentionView(rootDirectory, taskDirectory) {
    const config = await readAgenticConfigFile(rootDirectory);
    const summary = await summarizeStatus(rootDirectory);
    const inventory = await readStatusTaskInventory(rootDirectory, taskDirectory);
    const taskFiles = [...inventory.active, ...inventory.archived];
    const activeTasks = taskFiles
        .map((file) => file.task)
        .filter((task) => ["doing", "review", "blocked"].includes(task.state));
    const workerDiagnostics = inventory.diagnostics.filter((diagnostic) => !summary.warnings.includes(diagnostic));
    const workers = await projectWorkers(rootDirectory, config.resources, taskFiles.map((file) => file.task), workerDiagnostics, inventory.complete);
    const items = summary.activeTasks
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
        .sort((left, right) => (PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
        || left.taskId.localeCompare(right.taskId)));
    const diagnostics = [
        ...summary.warnings.map(sanitizeDiagnostic).filter((warning) => warning !== undefined),
        ...workerDiagnostics,
        ...(workers.length === 0 ? ["No declared resource registry; worker occupancy is unavailable."] : []),
    ];
    return { workers, items, diagnostics };
}
export function renderAttentionView(view, json = false) {
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
