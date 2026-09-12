import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
  appendRunLog,
  durationSinceLastClaim,
  requireAgent,
  type RegisteredAgent,
  type RunEventType,
} from "../agents/index.js";
import { appendTaskEvidence } from "./evidence.js";
import {
  captureTaskCompletionCandidate,
  evaluateTaskCompletionGate,
  TaskCompletionGateError,
} from "./gate.js";
import {
  findTaskFile,
  ensureTaskBaseline,
  loadTaskFile,
  recordTaskHandoff,
  writeTaskFile,
  type ProjectTask,
  type TaskState,
} from "./index.js";
import { withLocalMutationLock } from "./lock.js";

export interface TaskTransitionOptions {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  owner: string;
  reason?: string;
}

async function withTaskLock<T>(
  rootDirectory: string,
  taskDirectory: string,
  command: string,
  taskId: string,
  run: () => Promise<T>,
): Promise<T> {
  const lockPath = join(rootDirectory, taskDirectory, ".apk.lock");
  return withLocalMutationLock({
    path: lockPath,
    kind: "task-mutation",
    command,
    taskId,
  }, run);
}

function requireOwner(task: ProjectTask, owner: string): void {
  if (task.owner !== owner) {
    throw new Error(`Task ${task.id} is owned by ${task.owner}, not ${owner}.`);
  }
}

function requireState(task: ProjectTask, allowed: readonly TaskState[]): void {
  if (!allowed.includes(task.state)) {
    throw new Error(`Task ${task.id} is ${task.state}; expected one of: ${allowed.join(", ")}.`);
  }
}

function appendReason(task: ProjectTask, event: RunEventType, reason: string | undefined): ProjectTask {
  if (!reason) {
    return task;
  }

  return {
    ...task,
    notes: [...task.notes, `${event}: ${reason.replace(/\s+/g, " ").trim().slice(0, 160)}`],
  };
}

async function transition(
  options: TaskTransitionOptions,
  event: RunEventType,
  update: (task: ProjectTask, agent: RegisteredAgent) => Promise<ProjectTask> | ProjectTask,
): Promise<ProjectTask> {
  return withTaskLock(options.rootDirectory, options.taskDirectory, event, options.taskId, async () => {
    const agent = await requireAgent(options.rootDirectory, options.owner);
    const taskPath = await findTaskFile(
      options.rootDirectory,
      options.taskId,
      options.taskDirectory,
    );
    const { task } = await loadTaskFile(taskPath);
    const nextTask = await update(task, agent);
    const taskRelativePath = relative(options.rootDirectory, taskPath).replace(/\\/g, "/");
    if (event === "claim") {
      await ensureTaskBaseline(
        options.rootDirectory,
        task.id,
        agent.id,
        taskRelativePath,
      );
    }
    if (event === "release" || event === "block") {
      await recordTaskHandoff(
        options.rootDirectory,
        task.id,
        agent.id,
        taskRelativePath,
        event,
      );
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

export async function claimTask(options: TaskTransitionOptions): Promise<ProjectTask> {
  return transition(options, "claim", (task) => {
    requireState(task, ["todo"]);
    return {
      ...task,
      state: "doing",
      owner: options.owner,
    };
  });
}

export async function releaseTask(options: TaskTransitionOptions): Promise<ProjectTask> {
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

export async function blockTask(options: TaskTransitionOptions): Promise<ProjectTask> {
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

export async function reviewTask(options: TaskTransitionOptions): Promise<ProjectTask> {
  return transition(options, "review", (task) => {
    requireState(task, ["doing"]);
    requireOwner(task, options.owner);
    return {
      ...task,
      state: "review",
    };
  });
}

export async function doneTask(options: TaskTransitionOptions): Promise<ProjectTask> {
  return withTaskLock(options.rootDirectory, options.taskDirectory, "done", options.taskId, async () => {
    const agent = await requireAgent(options.rootDirectory, options.owner);
    const taskPath = await findTaskFile(
      options.rootDirectory,
      options.taskId,
      options.taskDirectory,
    );
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
    if (
      candidateAfterEvaluation.subject.candidateId !== gate.subject.candidateId ||
      candidateAfterEvaluation.subject.worktreeId !== gate.subject.worktreeId
    ) {
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
      state: "done" as const,
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

export async function cancelTask(options: TaskTransitionOptions): Promise<ProjectTask> {
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

export async function createStaleTaskLock(
  rootDirectory: string,
  taskDirectory: string,
): Promise<string> {
  const lockPath = join(rootDirectory, taskDirectory, ".apk.lock");
  await mkdir(dirname(lockPath), { recursive: true });
  await writeFile(lockPath, "stale\n", {
    encoding: "utf8",
    flag: "wx",
  });
  return lockPath;
}
