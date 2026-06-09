import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { appendRunLog, requireAgent } from "../agents/index.js";
import { readAgenticConfigFile } from "../config/index.js";
import { buildTaskPromptInput, renderTaskPrompt } from "../docs/prompt.js";
import type { ContextLevel } from "../docs/context.js";
import { claimTask } from "../tasks/workflow.js";
import { findTaskFile, loadTaskFile, type ProjectTask } from "../tasks/index.js";

export type WorkLevel = ContextLevel | "auto";

export interface WorkOptions {
  rootDirectory: string;
  taskId: string;
  owner: string;
  target: string;
  level: WorkLevel;
  writeSession?: boolean;
}

export interface WorkResult {
  task: ProjectTask;
  prompt: string;
  claimed: boolean;
  sessionPath?: string;
  next: string[];
}

function resolveLevel(task: ProjectTask, level: WorkLevel): ContextLevel {
  if (level !== "auto") {
    return level;
  }

  return task.risk === "high" ? 3 : 2;
}

function runId(): string {
  return new Date().toISOString().replace(/[^0-9TZ]/g, "");
}

async function writeSessionPrompt(
  rootDirectory: string,
  taskId: string,
  prompt: string,
): Promise<string> {
  const sessionPath = join(".agentic", "sessions", taskId, runId(), "prompt.md");
  const absolute = join(rootDirectory, sessionPath);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, prompt, "utf8");
  return sessionPath.replace(/\\/g, "/");
}

export async function startWork(options: WorkOptions): Promise<WorkResult> {
  const config = await readAgenticConfigFile(options.rootDirectory);
  const agent = await requireAgent(options.rootDirectory, options.owner);
  let taskFile = await findTaskFile(options.rootDirectory, options.taskId, config.taskDirectory);
  let { task } = await loadTaskFile(taskFile);
  let claimed = false;

  if (task.state === "todo") {
    task = await claimTask({
      rootDirectory: options.rootDirectory,
      taskDirectory: config.taskDirectory,
      taskId: options.taskId,
      owner: options.owner,
    });
    taskFile = await findTaskFile(options.rootDirectory, options.taskId, config.taskDirectory);
    claimed = true;
  } else if (task.state !== "doing" || task.owner !== options.owner) {
    throw new Error(`Task ${task.id} is ${task.state} owned by ${task.owner}; expected todo or doing owned by ${options.owner}.`);
  }

  const prompt = renderTaskPrompt(buildTaskPromptInput(
    options.target,
    task,
    resolveLevel(task, options.level),
    {
      docsDirectory: config.docsDirectory,
      taskDirectory: config.taskDirectory,
      taskFile: relative(options.rootDirectory, taskFile).replace(/\\/g, "/"),
    },
  ));
  const sessionPath = options.writeSession
    ? await writeSessionPrompt(options.rootDirectory, task.id, prompt)
    : undefined;

  if (sessionPath) {
    await appendRunLog(options.rootDirectory, {
      event: "work",
      agent,
      task: task.id,
      state: task.state,
      outcome: "ok",
      reason: `session ${sessionPath}`,
    });
  }

  return {
    task,
    prompt,
    claimed,
    sessionPath,
    next: [
      `apk task verify ${task.id} --owner ${options.owner}`,
      `apk review ${task.id} --owner ${options.owner}`,
      `apk done ${task.id} --owner ${options.owner}`,
    ],
  };
}

export function renderWorkResult(result: WorkResult): string {
  return [
    `Task: ${result.task.id}`,
    `State: ${result.task.state}`,
    `Owner: ${result.task.owner}`,
    `Claimed: ${result.claimed ? "yes" : "no"}`,
    ...(result.sessionPath ? [`Session: ${result.sessionPath}`] : []),
    "",
    result.prompt,
    "Next commands:",
    ...result.next.map((command) => `- ${command}`),
    "",
  ].join("\n");
}
