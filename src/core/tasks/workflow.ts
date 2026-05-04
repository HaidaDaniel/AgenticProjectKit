import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  appendRunLog,
  durationSinceLastClaim,
  requireAgent,
  type RegisteredAgent,
  type RunEventType,
} from "../agents/index.js";
import {
  findTaskFile,
  loadTaskFile,
  writeTaskFile,
  type ProjectTask,
  type TaskState,
} from "./index.js";

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
  run: () => Promise<T>,
): Promise<T> {
  const lockPath = join(rootDirectory, taskDirectory, ".apk.lock");
  await mkdir(dirname(lockPath), { recursive: true });

  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(lockPath, "wx");
    await handle.writeFile(JSON.stringify({
      pid: process.pid,
      created: new Date().toISOString(),
    }));
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(`Task lock exists: ${lockPath}. If no task command is running, remove it manually.`);
    }

    throw error;
  }

  try {
    return await run();
  } finally {
    await handle?.close();
    await rm(lockPath, { force: true });
  }
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
  return withTaskLock(options.rootDirectory, options.taskDirectory, async () => {
    const agent = await requireAgent(options.rootDirectory, options.owner);
    const taskPath = await findTaskFile(
      options.rootDirectory,
      options.taskId,
      options.taskDirectory,
    );
    const { task } = await loadTaskFile(taskPath);
    const nextTask = await update(task, agent);
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
  return transition(options, "done", (task) => {
    requireState(task, ["doing", "review"]);
    requireOwner(task, options.owner);
    return {
      ...task,
      state: "done",
    };
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
