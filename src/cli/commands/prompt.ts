import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  buildTaskPromptInput,
  PROMPT_AGENTS,
  renderTaskPrompt,
} from "../../core/docs/prompt.js";
import type { ContextLevel } from "../../core/docs/context.js";
import { findTaskFile, parseTaskMarkdown } from "../../core/tasks/index.js";

const PROMPT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk prompt <agent> --task <task-id> [--level 1|2|3]",
  "",
  "Agents:",
  ...PROMPT_AGENTS.map((agent) => `  ${agent}`),
  "",
  "Generates a concise task prompt with exact context files.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function readLevel(argv: readonly string[]): ContextLevel {
  const rawLevel = readFlagValue(argv, "--level");

  if (rawLevel === undefined) {
    return 1;
  }

  if (rawLevel === "1" || rawLevel === "2" || rawLevel === "3") {
    return Number(rawLevel) as ContextLevel;
  }

  throw new Error("Context level must be 1, 2, or 3.");
}

interface PromptArgs {
  agent: string;
  taskId: string;
  level: ContextLevel;
}

function parsePromptArgs(argv: readonly string[]): PromptArgs {
  const positional: string[] = [];
  let taskId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--task") {
      taskId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--level") {
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (positional.length !== 1 || !taskId || taskId.startsWith("-")) {
    throw new Error("Usage: apk prompt <agent> --task <task-id> [--level 1|2|3]");
  }

  return {
    agent: positional[0],
    taskId,
    level: readLevel(argv),
  };
}

export async function runPromptCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(PROMPT_HELP_TEXT);
    return 0;
  }

  try {
    const args = parsePromptArgs(argv);
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const taskFile = await findTaskFile(rootDirectory, args.taskId, config.taskDirectory);
    const task = parseTaskMarkdown(await readFile(taskFile, "utf8"));

    console.log(renderTaskPrompt(buildTaskPromptInput(args.agent, task, args.level, {
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
