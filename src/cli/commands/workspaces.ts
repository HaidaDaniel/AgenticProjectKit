import { resolve } from "node:path";

import {
  createWorkspace,
  listWorkspaceStatuses,
  removeWorkspace,
  renderCreateWorkspaceResult,
  renderRemoveWorkspaceResult,
  renderWorkspaceStatuses,
} from "../../core/workspaces/index.js";

const WORKSPACES_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk workspaces create --task <task-id> --owner <agent-id> [--resource <worker-id>] [--run <run-id>] [--branch <name>] [--name <dir>] [--baseline <ref>] [--json]",
  "  apk workspaces list [--json]",
  "  apk workspaces status [--json]",
  "  apk workspaces cleanup <workspace-id> [--apply] [--json]",
  "",
  "Safe Git worktree lifecycle for parallel top-level workers.",
  "Creation validates repository root, path containment, ownership, and collisions before mutation.",
  "Cleanup is dry-run by default; --apply removes only an exact APK-owned, clean, registered worktree.",
  "APK never deletes a repository root, foreign/user worktree, dirty worktree, or unmarked path.",
].join("\n");

function hasHelpFlag(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function parseFlag(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  if (index === argv.length - 1 || argv[index + 1].startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return argv[index + 1];
}

function positionalArgs(argv: readonly string[], valueFlags: readonly string[]): string[] {
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("-")) continue;
    if (valueFlags.includes(argv[index - 1] ?? "")) continue;
    positional.push(arg);
  }
  return positional;
}

function rejectUnknown(argv: readonly string[], known: readonly string[]): void {
  const allowed = new Set([...known, "--help", "-h"]);
  for (const arg of argv) {
    if (arg.startsWith("-") && !allowed.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
}

async function runCreate(argv: string[]): Promise<number> {
  const known = ["--task", "--owner", "--resource", "--run", "--branch", "--name", "--baseline", "--json"];
  rejectUnknown(argv, known);
  const taskId = parseFlag(argv, "--task");
  const owner = parseFlag(argv, "--owner");
  if (!taskId || !owner) {
    throw new Error("--task and --owner are required for workspace create.");
  }
  const result = await createWorkspace({
    rootDirectory: resolve(process.cwd()),
    taskId,
    owner,
    resourceId: parseFlag(argv, "--resource"),
    runId: parseFlag(argv, "--run"),
    branch: parseFlag(argv, "--branch"),
    name: parseFlag(argv, "--name"),
    baseline: parseFlag(argv, "--baseline"),
  });
  console.log(renderCreateWorkspaceResult(result, argv.includes("--json")));
  return 0;
}

async function runListOrStatus(argv: string[]): Promise<number> {
  rejectUnknown(argv, ["--json"]);
  const entries = await listWorkspaceStatuses(resolve(process.cwd()));
  console.log(renderWorkspaceStatuses(entries, argv.includes("--json")));
  return 0;
}

async function runCleanup(argv: string[]): Promise<number> {
  rejectUnknown(argv, ["--apply", "--json"]);
  const positional = positionalArgs(argv, []);
  if (positional.length !== 1) {
    throw new Error("Usage: apk workspaces cleanup <workspace-id> [--apply] [--json]");
  }
  const result = await removeWorkspace({
    rootDirectory: resolve(process.cwd()),
    id: positional[0],
    apply: argv.includes("--apply"),
  });
  console.log(renderRemoveWorkspaceResult(result, argv.includes("--json")));
  return 0;
}

export async function runWorkspacesCommand(argv: string[]): Promise<number> {
  try {
    if (argv.length === 0 || hasHelpFlag(argv)) {
      console.log(WORKSPACES_HELP_TEXT);
      return argv.length === 0 && argv[0] !== "--help" && argv[0] !== "-h" ? 1 : 0;
    }
    const [subcommand, ...subArgs] = argv;
    if (subcommand === "create") return await runCreate(subArgs);
    if (subcommand === "list" || subcommand === "status") return await runListOrStatus(subArgs);
    if (subcommand === "cleanup") return await runCleanup(subArgs);
    console.error(`Unknown workspaces subcommand: ${subcommand}`);
    return 1;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
