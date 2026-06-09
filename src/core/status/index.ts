import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { CONFIG_PATH, readAgenticConfigFile } from "../config/index.js";
import { readRunLog, type RunLogEvent } from "../agents/index.js";
import { syncAgentExports } from "../sync/index.js";
import {
  listArchivedTaskFiles,
  listTaskFiles,
  selectNextTask,
  TASK_STATES,
  type TaskState,
} from "../tasks/index.js";

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

async function hasStaleLock(rootDirectory: string, taskDirectory: string): Promise<boolean> {
  try {
    const lock = await stat(join(rootDirectory, taskDirectory, ".apk.lock"));
    return Date.now() - lock.mtimeMs > 5 * 60 * 1000;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function summarizeStatus(rootDirectory: string): Promise<StatusSummary> {
  const configExists = await fileExists(join(rootDirectory, CONFIG_PATH));
  const config = await readAgenticConfigFile(rootDirectory);
  const warnings: string[] = [];
  const taskCounts = emptyTaskCounts();
  let archivedCount = 0;
  let nextTask: StatusSummary["nextTask"];

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
  } catch (error: unknown) {
    warnings.push(`task parse warning: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }

  if (await hasStaleLock(rootDirectory, config.taskDirectory)) {
    warnings.push("stale task lock detected");
  }

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

export function renderStatus(summary: StatusSummary): string {
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
    `Warnings: ${summary.warnings.length === 0 ? "none" : summary.warnings.join("; ")}`,
    "",
  ].join("\n");
}
