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
  renderTaskVerifyResult,
  TASK_MODES,
  TASK_RISKS,
  verifyTask,
  type TaskCreateInput,
} from "../../core/tasks/index.js";

const TASK_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk task archive [<task-id>] [--all]",
  "  apk task deps <task-id>",
  "  apk task verify <task-id> [--check-files-only] [--owner <agent-id>]",
  "  apk task create --title <title> --scope <csv> --allowed <csv> [--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--verification <csv>] [--goal <text>]",
  "",
  "Subcommands:",
  "  archive Archive a done task or all done tasks.",
  "  deps    Inspect task prerequisites, dependents, and graph problems.",
  "  verify  Check changed files and task verification commands.",
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
  "  apk task create --title <title> --scope <csv> --allowed <csv> [--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--verification <csv>] [--goal <text>]",
  "",
  "Required flags:",
  "  --title <title>         Task title.",
  "  --scope <csv>           Comma-separated scope areas (e.g. cli,tasks,docs).",
  "  --allowed <csv>         Comma-separated allowed file paths.",
  "",
  "Optional flags:",
  "  --template <name>       Defaults: bugfix, feature, refactor, docs, audit, test.",
  "  --mode <mode>           Task mode: discovery, mvp, product, production, maintenance, audit, adopt.",
  "  --lane <lane>           Work lane (e.g. implementation, planning, adoption).",
  "  --risk <risk>           Risk level: low, medium, high.",
  "  --context <csv>         Comma-separated context file paths.",
  "  --verification <csv>    Comma-separated verification commands.",
  "  --goal <text>          Task goal text (default: title).",
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

const TASK_VERIFY_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk task verify <task-id> [--check-files-only] [--owner <agent-id>]",
  "",
  "Checks changed files against task allowed/forbidden files.",
  "Runs task verification commands unless --check-files-only is supplied.",
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
  if (index === -1) {
    return undefined;
  }

  if (index === argv.length - 1 || argv[index + 1].startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
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

interface TaskTemplateDefaults {
  mode: TaskCreateInput["mode"];
  lane: string;
  risk: TaskCreateInput["risk"];
  tags: string[];
  contextFiles: string[];
  verificationCommands: string[];
  steps: string[];
  acceptanceCriteria: string[];
  documentationUpdates: string[];
  notes: string[];
}

const TASK_TEMPLATES: Record<string, TaskTemplateDefaults> = {
  bugfix: {
    mode: "product",
    lane: "bugfix",
    risk: "medium",
    tags: ["bugfix"],
    contextFiles: ["AGENTS.md", "docs/task-system.md"],
    verificationCommands: ["pnpm test"],
    steps: ["Reproduce or characterize the bug.", "Implement the smallest safe fix.", "Add or update regression coverage.", "Run verification."],
    acceptanceCriteria: ["Bug is fixed.", "Regression coverage exists."],
    documentationUpdates: ["Update docs/progress.md when task state changes."],
    notes: ["Keep the fix narrow."],
  },
  feature: {
    mode: "product",
    lane: "implementation",
    risk: "medium",
    tags: ["feature"],
    contextFiles: ["AGENTS.md", "docs/project.md", "docs/task-system.md"],
    verificationCommands: ["pnpm test"],
    steps: ["Implement the smallest useful feature slice.", "Add focused tests.", "Run verification."],
    acceptanceCriteria: ["Feature behavior is implemented and tested."],
    documentationUpdates: ["Update docs/progress.md when task state changes."],
    notes: ["Avoid unrelated refactors."],
  },
  refactor: {
    mode: "product",
    lane: "refactor",
    risk: "medium",
    tags: ["refactor"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verificationCommands: ["pnpm test"],
    steps: ["Identify the behavior-preserving change.", "Refactor in small steps.", "Run verification."],
    acceptanceCriteria: ["Behavior is unchanged.", "Code is simpler or clearer."],
    documentationUpdates: ["Update docs/progress.md when task state changes."],
    notes: ["Do not change public behavior unless the task says so."],
  },
  docs: {
    mode: "product",
    lane: "documentation",
    risk: "low",
    tags: ["docs"],
    contextFiles: ["AGENTS.md", "docs/project.md", "docs/scope.md"],
    verificationCommands: ["pnpm lint", "pnpm test"],
    steps: ["Read relevant docs.", "Update documentation.", "Run verification."],
    acceptanceCriteria: ["Docs are accurate and scoped."],
    documentationUpdates: ["Update docs/progress.md when task state changes."],
    notes: ["Do not change source code unless explicitly required."],
  },
  audit: {
    mode: "audit",
    lane: "audit",
    risk: "medium",
    tags: ["audit"],
    contextFiles: ["AGENTS.md", "docs/cli-commands.md", "docs/task-system.md"],
    verificationCommands: ["pnpm test", "node dist/cli/index.js audit"],
    steps: ["Inspect current behavior.", "Add or update audit checks.", "Run verification."],
    acceptanceCriteria: ["Audit findings are deterministic and documented."],
    documentationUpdates: ["Update docs/progress.md when task state changes."],
    notes: ["Keep audit static unless the task says otherwise."],
  },
  test: {
    mode: "product",
    lane: "testing",
    risk: "low",
    tags: ["tests"],
    contextFiles: ["AGENTS.md", "docs/task-system.md"],
    verificationCommands: ["pnpm test"],
    steps: ["Identify missing coverage.", "Add focused tests.", "Run verification."],
    acceptanceCriteria: ["Tests cover the intended behavior."],
    documentationUpdates: ["Update docs/progress.md when task state changes."],
    notes: ["Prefer focused regression tests."],
  },
};

function parseTemplate(name: string | undefined): TaskTemplateDefaults | undefined {
  if (name === undefined) {
    return undefined;
  }

  const template = TASK_TEMPLATES[name];
  if (!template) {
    throw new Error(`--template must be one of: ${Object.keys(TASK_TEMPLATES).join(", ")}.`);
  }
  return template;
}

async function runCreateSubcommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(TASK_CREATE_HELP_TEXT);
    return 0;
  }

  const knownFlags = new Set([
    "--title", "--mode", "--lane", "--scope", "--risk", "--parallel",
    "--goal", "--template",
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

  const template = parseTemplate(parseFlag(argv, "--template"));

  const modeRaw = parseFlag(argv, "--mode");
  const mode = modeRaw ?? template?.mode;
  if (!mode || !TASK_MODES.includes(mode as (typeof TASK_MODES)[number])) {
    throw new Error(`--mode must be one of: ${TASK_MODES.join(", ")}.`);
  }

  const lane = parseFlag(argv, "--lane") ?? template?.lane;
  if (!lane) {
    throw new Error("--lane is required.");
  }

  const riskRaw = parseFlag(argv, "--risk");
  const risk = riskRaw ?? template?.risk;
  if (!risk || !TASK_RISKS.includes(risk as (typeof TASK_RISKS)[number])) {
    throw new Error(`--risk must be one of: ${TASK_RISKS.join(", ")}.`);
  }

  const scope = parseCsvFlag(parseFlag(argv, "--scope"));
  const contextFiles = parseCsvFlag(parseFlag(argv, "--context"));
  const allowedFiles = parseCsvFlag(parseFlag(argv, "--allowed"));
  const verificationCommands = parseCsvFlag(parseFlag(argv, "--verification"));
  const resolvedContextFiles = contextFiles.length > 0 ? contextFiles : template?.contextFiles ?? [];
  const resolvedVerificationCommands = verificationCommands.length > 0
    ? verificationCommands
    : template?.verificationCommands ?? [];

  if (resolvedContextFiles.length === 0) {
    throw new Error("--context must include at least one file.");
  }

  if (scope.length === 0) {
    throw new Error("--scope must include at least one scope area.");
  }

  if (allowedFiles.length === 0) {
    throw new Error("--allowed must include at least one file.");
  }

  if (resolvedVerificationCommands.length === 0) {
    throw new Error("--verification must include at least one command.");
  }

  const input: TaskCreateInput = {
    title,
    mode: mode as (typeof TASK_MODES)[number],
    lane,
    scope,
    risk: risk as (typeof TASK_RISKS)[number],
    parallel: hasFlag(argv, "--parallel"),
    dependsOn: parseCsvFlag(parseFlag(argv, "--depends")),
    tags: parseCsvFlag(parseFlag(argv, "--tags")).length > 0
      ? parseCsvFlag(parseFlag(argv, "--tags"))
      : template?.tags ?? [],
    goal: parseFlag(argv, "--goal") ?? title,
    contextFiles: resolvedContextFiles,
    allowedFiles,
    forbiddenFiles: parseCsvFlag(parseFlag(argv, "--forbidden")),
    steps: parseCsvFlag(parseFlag(argv, "--steps")).length > 0
      ? parseCsvFlag(parseFlag(argv, "--steps"))
      : template?.steps ?? [],
    acceptanceCriteria: parseCsvFlag(parseFlag(argv, "--acceptance")).length > 0
      ? parseCsvFlag(parseFlag(argv, "--acceptance"))
      : template?.acceptanceCriteria ?? [],
    verificationCommands: resolvedVerificationCommands,
    documentationUpdates: parseCsvFlag(parseFlag(argv, "--docs")).length > 0
      ? parseCsvFlag(parseFlag(argv, "--docs"))
      : template?.documentationUpdates ?? [],
    notes: parseCsvFlag(parseFlag(argv, "--notes")).length > 0
      ? parseCsvFlag(parseFlag(argv, "--notes"))
      : template?.notes ?? [],
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

async function runVerifySubcommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(TASK_VERIFY_HELP_TEXT);
    return 0;
  }

  const knownVerifyFlags = new Set(["--check-files-only", "--owner", "--help", "-h"]);
  for (const arg of argv) {
    if (arg.startsWith("-") && !knownVerifyFlags.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const positional = argv.filter((arg, index) => (
    !arg.startsWith("-") &&
    argv[index - 1] !== "--owner"
  ));

  if (positional.length !== 1) {
    throw new Error("Usage: apk task verify <task-id> [--check-files-only] [--owner <agent-id>]");
  }

  const rootDirectory = resolve(process.cwd());
  const config = await readAgenticConfigFile(rootDirectory);
  const result = await verifyTask({
    rootDirectory,
    taskDirectory: config.taskDirectory,
    taskId: positional[0],
    owner: parseFlag(argv, "--owner"),
    checkFilesOnly: hasFlag(argv, "--check-files-only"),
  });

  console.log(renderTaskVerifyResult(result));
  return result.passed ? 0 : 1;
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

    if (subcommand === "verify") {
      return await runVerifySubcommand(subArgs);
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
