import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { appendRunLog, durationSinceLastClaim, requireAgent, } from "../agents/index.js";
import { appendTaskEvidence } from "./evidence.js";
import { captureTaskCompletionCandidate, evaluateTaskCompletionGate, TaskCompletionGateError, } from "./gate.js";
import { findTaskFile, captureTaskBaseline, loadTaskFile, writeTaskFile, } from "./index.js";
import { withLocalMutationLock } from "./lock.js";
async function withTaskLock(rootDirectory, taskDirectory, command, taskId, run) {
    const lockPath = join(rootDirectory, taskDirectory, ".apk.lock");
    return withLocalMutationLock({
        path: lockPath,
        kind: "task-mutation",
        command,
        taskId,
    }, run);
}
function requireOwner(task, owner) {
    if (task.owner !== owner) {
        throw new Error(`Task ${task.id} is owned by ${task.owner}, not ${owner}.`);
    }
}
function requireState(task, allowed) {
    if (!allowed.includes(task.state)) {
        throw new Error(`Task ${task.id} is ${task.state}; expected one of: ${allowed.join(", ")}.`);
    }
}
function appendReason(task, event, reason) {
    if (!reason) {
        return task;
    }
    return {
        ...task,
        notes: [...task.notes, `${event}: ${reason.replace(/\s+/g, " ").trim().slice(0, 160)}`],
    };
}
async function transition(options, event, update) {
    return withTaskLock(options.rootDirectory, options.taskDirectory, event, options.taskId, async () => {
        const agent = await requireAgent(options.rootDirectory, options.owner);
        const taskPath = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
        const { task } = await loadTaskFile(taskPath);
        const nextTask = await update(task, agent);
        if (event === "claim") {
            await captureTaskBaseline(options.rootDirectory, task.id, agent.id, relative(options.rootDirectory, taskPath).replace(/\\/g, "/"));
        }
        const durationSec = event === "done"
            ? await durationSinceLastClaim(options.rootDirectory, task.id, agent.id)
            : undefined;
        await writeTaskFile(taskPath, nextTask);
        await appendRunLog(options.rootDirectory, {
            event,
            agent,
            task: task.id,
            state: nextTask.state,
            outcome: "ok",
            reason: options.reason,
            durationSec,
        });
        return nextTask;
    });
}
export async function claimTask(options) {
    return transition(options, "claim", (task) => {
        requireState(task, ["todo"]);
        return {
            ...task,
            state: "doing",
            owner: options.owner,
        };
    });
}
export async function releaseTask(options) {
    return transition(options, "release", (task) => {
        requireState(task, ["doing", "review", "blocked"]);
        if (task.owner !== "none") {
            requireOwner(task, options.owner);
        }
        return {
            ...task,
            state: "todo",
            owner: "none",
        };
    });
}
export async function blockTask(options) {
    return transition(options, "block", (task) => {
        requireState(task, ["todo", "doing", "review"]);
        if (task.owner !== "none") {
            requireOwner(task, options.owner);
        }
        return appendReason({
            ...task,
            state: "blocked",
            owner: "none",
        }, "block", options.reason);
    });
}
export async function reviewTask(options) {
    return transition(options, "review", (task) => {
        requireState(task, ["doing"]);
        requireOwner(task, options.owner);
        return {
            ...task,
            state: "review",
        };
    });
}
export async function doneTask(options) {
    return withTaskLock(options.rootDirectory, options.taskDirectory, "done", options.taskId, async () => {
        const agent = await requireAgent(options.rootDirectory, options.owner);
        const taskPath = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
        const { task } = await loadTaskFile(taskPath);
        requireState(task, ["doing", "review"]);
        requireOwner(task, options.owner);
        const gate = await evaluateTaskCompletionGate({
            rootDirectory: options.rootDirectory,
            taskDirectory: options.taskDirectory,
            taskId: task.id,
        });
        if (!gate.passed) {
            throw new TaskCompletionGateError(gate);
        }
        const candidateAfterEvaluation = await captureTaskCompletionCandidate({
            rootDirectory: options.rootDirectory,
            taskDirectory: options.taskDirectory,
            taskId: task.id,
        });
        if (candidateAfterEvaluation.subject.candidateId !== gate.subject.candidateId ||
            candidateAfterEvaluation.subject.worktreeId !== gate.subject.worktreeId) {
            throw new TaskCompletionGateError({
                ...gate,
                passed: false,
                blockers: [
                    ...gate.blockers,
                    "Candidate changed between gate evaluation and completion persistence.",
                ],
            });
        }
        const completionRunId = `completion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await appendTaskEvidence(options.rootDirectory, {
            taskId: task.id,
            runId: completionRunId,
            agent: agent.id,
            type: "completion",
            result: "pass",
            gateEligible: true,
            subject: gate.subject,
            evidenceSet: gate.evidenceIds,
            summary: "Completion gate passed for the evaluated candidate.",
        });
        const durationSec = await durationSinceLastClaim(options.rootDirectory, task.id, agent.id);
        const nextTask = {
            ...task,
            state: "done",
        };
        await writeTaskFile(taskPath, nextTask);
        await appendRunLog(options.rootDirectory, {
            event: "done",
            agent,
            task: task.id,
            runId: completionRunId,
            state: nextTask.state,
            outcome: "ok",
            reason: options.reason,
            durationSec,
        });
        return nextTask;
    });
}
export async function cancelTask(options) {
    return transition(options, "cancel", (task) => {
        requireState(task, ["todo", "doing", "review", "blocked"]);
        if (task.owner !== "none") {
            requireOwner(task, options.owner);
        }
        return appendReason({
            ...task,
            state: "canceled",
            owner: "none",
        }, "cancel", options.reason);
    });
}
export async function createStaleTaskLock(rootDirectory, taskDirectory) {
    const lockPath = join(rootDirectory, taskDirectory, ".apk.lock");
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(lockPath, "stale\n", {
        encoding: "utf8",
        flag: "wx",
    });
    return lockPath;
}
