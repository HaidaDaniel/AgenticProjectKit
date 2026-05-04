import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  renderTaskContext,
  selectTaskContext,
  type ContextLevel,
} from "../../core/docs/context.js";
import { findTaskFile, parseTaskMarkdown } from "../../core/tasks/index.js";

const CONTEXT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk context <task-id> [--level 1|2|3]",
  "",
  "Prints the exact files an agent should read for a task.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function readLevel(argv: string[]): ContextLevel {
  const levelIndex = argv.indexOf("--level");

  if (levelIndex === -1) {
    return 1;
  }

  const rawLevel = argv[levelIndex + 1];

  if (rawLevel === "1" || rawLevel === "2" || rawLevel === "3") {
    return Number(rawLevel) as ContextLevel;
  }

  throw new Error("Context level must be 1, 2, or 3.");
}

interface ContextArgs {
  taskId: string;
  level: ContextLevel;
}

function parseContextArgs(argv: string[]): ContextArgs {
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--level") {
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (positional.length !== 1) {
    throw new Error("Usage: apk context <task-id> [--level 1|2|3]");
  }

  return {
    taskId: positional[0],
    level: readLevel(argv),
  };
}

export async function runContextCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(CONTEXT_HELP_TEXT);
    return 0;
  }

  try {
    const args = parseContextArgs(argv);
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const taskFile = await findTaskFile(rootDirectory, args.taskId, config.taskDirectory);
    const task = parseTaskMarkdown(await readFile(taskFile, "utf8"));

    console.log(renderTaskContext(selectTaskContext(task, args.level, {
      docsDirectory: config.docsDirectory,
      taskFile: relative(rootDirectory, taskFile),
      taskDirectory: config.taskDirectory,
    })));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
