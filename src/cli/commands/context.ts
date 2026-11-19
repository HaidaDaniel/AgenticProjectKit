import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  buildTaskContextPack,
  renderTaskContext,
  type ContextLevel,
} from "../../core/docs/context.js";
import { findTaskFile, parseTaskMarkdown } from "../../core/tasks/index.js";

const CONTEXT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk context <task-id> [--level 1|2|3] [--budget <units>] [--section <heading>]",
  "",
  "Prints the exact files an agent should read for a task.",
  "--section emits only the matching '## <heading>' excerpt from selected files.",
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

function readBudget(argv: string[]): number | undefined {
  const budgetIndex = argv.indexOf("--budget");
  if (budgetIndex === -1) return undefined;
  const rawBudget = argv[budgetIndex + 1];
  if (rawBudget === undefined || !/^\d+$/.test(rawBudget) || Number(rawBudget) <= 0) {
    throw new Error("Context budget must be a positive integer.");
  }
  return Number(rawBudget);
}

function readSection(argv: string[]): string | undefined {
  const sectionIndex = argv.indexOf("--section");
  if (sectionIndex === -1) return undefined;
  const raw = argv[sectionIndex + 1];
  if (raw === undefined || raw.length === 0 || raw.length > 80 || /[\0\r\n]/.test(raw) || raw.startsWith("-")) {
    throw new Error("Context section must be a single non-empty heading name of at most 80 characters.");
  }
  return raw;
}

interface ContextArgs {
  taskId: string;
  level: ContextLevel;
  budget?: number;
  section?: string;
}

function parseContextArgs(argv: string[]): ContextArgs {
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--level") {
      index += 1;
      continue;
    }

    if (arg === "--budget" || arg === "--section") {
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

    const budget = readBudget(argv);
    const section = readSection(argv);
    if (budget !== undefined && section !== undefined) {
      throw new Error("Use either --budget or --section, not both.");
    }
    return {
      taskId: positional[0],
      level: readLevel(argv),
      ...(budget === undefined ? {} : { budget }),
      ...(section === undefined ? {} : { section }),
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

    const selection = await buildTaskContextPack(rootDirectory, task, args.level, {
      docsDirectory: config.docsDirectory,
      taskFile: relative(rootDirectory, taskFile),
      taskDirectory: config.taskDirectory,
      ...(args.budget === undefined ? {} : { budget: args.budget }),
      ...(args.section === undefined ? {} : { section: args.section }),
    });
    console.log(renderTaskContext(selection));
    return selection.diagnostics && selection.diagnostics.length > 0 ? 1 : 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
