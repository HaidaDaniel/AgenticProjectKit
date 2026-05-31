import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  allTaskFiles,
  archiveAllTasks,
  archiveTask,
  buildTaskDeps,
  createTask,
  findTaskFile,
  listArchivedTaskFiles,
  listTaskFiles,
  renderTaskDeps,
  TASK_MODES,
  TASK_RISKS,
  type TaskCreateInput,
} from "../../core/tasks/index.js";

const TASK_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk task archive [<task-id>] [--all]",
  "  apk task deps <task-id>",
  "  apk task create --title <title> --mode <mode> --lane <lane> --scope <csv> --risk <risk> --context <csv> --allowed <csv> --verification <csv>",
  "",
  "Subcommands:",
  "  archive Archive a done task or all done tasks.",
  "  deps    Inspect task prerequisites, dependents, and graph problems.",
  "  create  Generate a new task file with validated metadata.",
].join("\n");

const TASK_DEPS_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk task deps <task-id>",
  "",
  "Print task prerequisites, dependents, missing deps, and cycle issues.",
].join("\n");

const TASK_CREATE_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk task create --title <title> --mode <mode> --lane <lane> --scope <csv> --risk <risk> --context <csv> --allowed <csv> --verification <csv>",
  "",
  "Required flags:",
  "  --title <title>         Task title.",
  "  --mode <mode>           Task mode: discovery, mvp, product, production, maintenance, audit, adopt.",
  "  --lane <lane>           Work lane (e.g. implementation, planning, adoption).",
  "  --scope <csv>           Comma-separated scope areas (e.g. cli,tasks,docs).",
  "  --risk <risk>           Risk level: low, medium, high.",
  "  --context <csv>         Comma-separated context file paths.",
  "  --allowed <csv>         Comma-separated allowed file paths.",
  "  --verification <csv>    Comma-separated verification commands.",
  "",
  "Optional flags:",
  "  --depends <csv>         Comma-separated dependency task ids.",
  "  --tags <csv>            Comma-separated tags.",
  "  --parallel              Mark task as parallel (default: false).",
  "  --forbidden <csv>       Comma-separated forbidden file paths.",
  "  --steps <csv>           Comma-separated numbered steps.",
  "  --acceptance <csv>      Comma-separated acceptance criteria.",
  "  --docs <csv>            Comma-separated documentation updates.",
  "  --notes <csv>           Comma-separated notes.",
  "",
  "Example:",
  '  apk task create --title "Add Feature" --mode mvp --lane implementation --scope api,docs --risk low --context "AGENTS.md,docs/task-system.md" --allowed "src/api/index.ts" --verification "pnpm test"',
].join("\n");

const TASK_ARCHIVE_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk task archive <task-id>",
  "  apk task archive --all",
  "",
  "Archive a done task by moving it to .tasks/archive/.",
  "Use --all to archive all done top-level tasks.",
  "",
  "Only tasks in state 'done' can be archived.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function rejectUnknownOptions(argv: readonly string[]): void {
  for (const arg of argv) {
    if (arg.startsWith("-") && arg !== "--help" && arg !== "-h") {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
}

function parseFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1 || index === argv.length - 1) {
    return undefined;
  }
  return argv[index + 1];
}

function parseCsvFlag(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

async function runCreateSubcommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(TASK_CREATE_HELP_TEXT);
    return 0;
  }

  const knownFlags = new Set([
    "--title", "--mode", "--lane", "--scope", "--risk", "--parallel",
    "--depends", "--tags", "--context", "--allowed", "--forbidden",
    "--steps", "--acceptance", "--verification", "--docs", "--notes",
    "--help", "-h",
  ]);
  for (const arg of argv) {
    if (arg.startsWith("-") && !knownFlags.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const title = parseFlag(argv, "--title");
  if (!title) {
    throw new Error("--title is required.");
  }

  const modeRaw = parseFlag(argv, "--mode");
  if (!modeRaw || !TASK_MODES.includes(modeRaw as (typeof TASK_MODES)[number])) {
    throw new Error(`--mode must be one of: ${TASK_MODES.join(", ")}.`);
  }

  const lane = parseFlag(argv, "--lane");
  if (!lane) {
    throw new Error("--lane is required.");
  }

  const riskRaw = parseFlag(argv, "--risk");
  if (!riskRaw || !TASK_RISKS.includes(riskRaw as (typeof TASK_RISKS)[number])) {
    throw new Error(`--risk must be one of: ${TASK_RISKS.join(", ")}.`);
  }

  const scope = parseCsvFlag(parseFlag(argv, "--scope"));
  const contextFiles = parseCsvFlag(parseFlag(argv, "--context"));
  const allowedFiles = parseCsvFlag(parseFlag(argv, "--allowed"));
  const verificationCommands = parseCsvFlag(parseFlag(argv, "--verification"));

  if (contextFiles.length === 0) {
    throw new Error("--context must include at least one file.");
  }

  if (scope.length === 0) {
    throw new Error("--scope must include at least one scope area.");
  }

  if (allowedFiles.length === 0) {
    throw new Error("--allowed must include at least one file.");
  }

  if (verificationCommands.length === 0) {
    throw new Error("--verification must include at least one command.");
  }

  const input: TaskCreateInput = {
    title,
    mode: modeRaw as (typeof TASK_MODES)[number],
    lane,
    scope,
    risk: riskRaw as (typeof TASK_RISKS)[number],
    parallel: hasFlag(argv, "--parallel"),
    dependsOn: parseCsvFlag(parseFlag(argv, "--depends")),
    tags: parseCsvFlag(parseFlag(argv, "--tags")),
    goal: parseFlag(argv, "--goal") ?? title,
    contextFiles,
    allowedFiles,
    forbiddenFiles: parseCsvFlag(parseFlag(argv, "--forbidden")),
    steps: parseCsvFlag(parseFlag(argv, "--steps")),
    acceptanceCriteria: parseCsvFlag(parseFlag(argv, "--acceptance")),
    verificationCommands,
    documentationUpdates: parseCsvFlag(parseFlag(argv, "--docs")),
    notes: parseCsvFlag(parseFlag(argv, "--notes")),
  };

  const rootDirectory = resolve(process.cwd());
  const config = await readAgenticConfigFile(rootDirectory);

  const result = await createTask(rootDirectory, config.taskDirectory, input);

  console.log(`Created: ${result.path}`);
  return 0;
}

async function runDepsSubcommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(TASK_DEPS_HELP_TEXT);
    return 0;
  }

  rejectUnknownOptions(argv);

  const positional: string[] = [];
  for (const arg of argv) {
    if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw new Error("Usage: apk task deps <task-id>");
  }

  const taskId = positional[0];
  const rootDirectory = resolve(process.cwd());
  const config = await readAgenticConfigFile(rootDirectory);
  const files = await listTaskFiles(rootDirectory, config.taskDirectory);
  const archived = await listArchivedTaskFiles(rootDirectory, config.taskDirectory);

  const taskFile = await findTaskFile(rootDirectory, taskId, config.taskDirectory);
  const relativePath = relative(rootDirectory, taskFile).replace(/\\/g, "/");
  const result = buildTaskDeps(files, taskId, relativePath, archived);

  if (!result) {
    throw new Error(`Task file not found for id: ${taskId}`);
  }

  console.log(renderTaskDeps(result));
  return 0;
}

async function runArchiveSubcommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(TASK_ARCHIVE_HELP_TEXT);
    return 0;
  }

  const knownArchiveFlags = new Set(["--all", "--help", "-h"]);
  for (const arg of argv) {
    if (arg.startsWith("-") && !knownArchiveFlags.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const positional: string[] = [];
  for (const arg of argv) {
    if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (hasFlag(argv, "--all")) {
    if (positional.length !== 0) {
      throw new Error("Usage: apk task archive --all (no positional args with --all)");
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);

    const result = await archiveAllTasks(rootDirectory, config.taskDirectory);
    if (result.archived.length === 0) {
      console.log("No done tasks to archive.");
      return 0;
    }
    for (const a of result.archived) {
      console.log(`Archived: ${a.taskId} -> ${a.archivePath}`);
    }
    return 0;
  }

  if (positional.length !== 1) {
    throw new Error("Usage: apk task archive <task-id>");
  }

  const rootDirectory = resolve(process.cwd());
  const config = await readAgenticConfigFile(rootDirectory);

  const taskId = positional[0];
  const result = await archiveTask(rootDirectory, config.taskDirectory, taskId);
  console.log(`Archived: ${result.taskId} -> ${result.archivePath}`);
  return 0;
}

export async function runTaskCommand(argv: string[]): Promise<number> {
  try {
    if (hasHelpFlag(argv)) {
      console.log(TASK_HELP_TEXT);
      return 0;
    }

    if (argv.length === 0) {
      console.error("Error: Usage: apk task <archive|deps|create>");
      return 1;
    }

    const [subcommand, ...subArgs] = argv;

    if (subcommand === "archive") {
      return await runArchiveSubcommand(subArgs);
    }

    if (subcommand === "deps") {
      return await runDepsSubcommand(subArgs);
    }

    if (subcommand === "create") {
      return await runCreateSubcommand(subArgs);
    }

    console.error(`Error: Unknown task subcommand: ${subcommand}`);
    return 1;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
