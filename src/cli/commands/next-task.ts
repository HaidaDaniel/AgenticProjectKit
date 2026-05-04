import { relative, resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  listTaskFiles,
  renderNextTask,
  selectNextTask,
  type NextTaskSelection,
} from "../../core/tasks/index.js";

const NEXT_TASK_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk next-task",
  "",
  "Prints the lowest-numbered todo task and its context command.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function withRelativePath(
  rootDirectory: string,
  selection: NextTaskSelection | undefined,
): NextTaskSelection | undefined {
  if (!selection) {
    return undefined;
  }

  return {
    ...selection,
    path: relative(rootDirectory, selection.path).replace(/\\/g, "/"),
  };
}

export async function runNextTaskCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(NEXT_TASK_HELP_TEXT);
    return 0;
  }

  if (argv.length > 0) {
    console.error("Usage: apk next-task");
    return 1;
  }

  try {
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const selection = selectNextTask(await listTaskFiles(rootDirectory, config.taskDirectory));
    console.log(renderNextTask(withRelativePath(rootDirectory, selection)));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
