import { resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  blockTask,
  cancelTask,
  claimTask,
  doneTask,
  releaseTask,
  reviewTask,
} from "../../core/tasks/workflow.js";
import type { ProjectTask } from "../../core/tasks/index.js";

type TaskCommand = "claim" | "release" | "block" | "review" | "done" | "cancel";

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function readTaskId(argv: readonly string[]): string | undefined {
  return argv.find((arg) => !arg.startsWith("-") && arg !== readFlagValue(argv, "--owner") && arg !== readFlagValue(argv, "--reason"));
}

function rejectUnknownOptions(argv: readonly string[]): void {
  for (const arg of argv) {
    if (arg.startsWith("-") && arg !== "--owner" && arg !== "--reason") {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
}

function helpText(command: TaskCommand): string {
  const reason = command === "block" || command === "cancel" ? " [--reason <text>]" : "";
  return `Usage: apk ${command} <task-id> --owner <agent-id>${reason}`;
}

function renderTransition(task: ProjectTask): string {
  return [
    `Task: ${task.id}`,
    `State: ${task.state}`,
    `Owner: ${task.owner}`,
  ].join("\n");
}

export async function runTaskStateCommand(
  command: TaskCommand,
  argv: string[],
): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(helpText(command));
    return 0;
  }

  try {
    rejectUnknownOptions(argv);
    const taskId = readTaskId(argv);
    const owner = readFlagValue(argv, "--owner");

    if (!taskId || !owner) {
      throw new Error(helpText(command));
    }

    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const options = {
      rootDirectory,
      taskDirectory: config.taskDirectory,
      taskId,
      owner,
      reason: readFlagValue(argv, "--reason"),
    };
    const task = command === "claim"
      ? await claimTask(options)
      : command === "release"
        ? await releaseTask(options)
        : command === "block"
          ? await blockTask(options)
          : command === "review"
            ? await reviewTask(options)
            : command === "done"
              ? await doneTask(options)
              : await cancelTask(options);

    console.log(renderTransition(task));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
