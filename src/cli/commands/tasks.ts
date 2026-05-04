import { relative, resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  listTaskFiles,
  renderTasksTable,
  TASK_STATES,
  type ProjectTaskFile,
  type TaskState,
} from "../../core/tasks/index.js";

const TASKS_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk tasks [--state <state>] [--owner <agent-id>]",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function parseState(value: string | undefined): TaskState | undefined {
  if (value === undefined) {
    return undefined;
  }

  if ((TASK_STATES as readonly string[]).includes(value)) {
    return value as TaskState;
  }

  throw new Error(`State must be one of: ${TASK_STATES.join(", ")}.`);
}

function rejectUnknownOptions(argv: readonly string[]): void {
  for (const arg of argv) {
    if (arg.startsWith("-") && arg !== "--state" && arg !== "--owner") {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
}

function withRelativePaths(
  rootDirectory: string,
  files: readonly ProjectTaskFile[],
): ProjectTaskFile[] {
  return files.map((file) => ({
    ...file,
    path: relative(rootDirectory, file.path).replace(/\\/g, "/"),
  }));
}

export async function runTasksCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(TASKS_HELP_TEXT);
    return 0;
  }

  try {
    rejectUnknownOptions(argv);
    const state = parseState(readFlagValue(argv, "--state"));
    const owner = readFlagValue(argv, "--owner");
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const files = withRelativePaths(
      rootDirectory,
      await listTaskFiles(rootDirectory, config.taskDirectory),
    ).filter((file) => (
      (state === undefined || file.task.state === state) &&
      (owner === undefined || file.task.owner === owner)
    ));

    console.log(renderTasksTable(files));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
