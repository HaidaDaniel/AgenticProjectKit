import { resolve } from "node:path";

import {
  parseWorkerRole,
  parseWorkerResult,
  parseWorkerStatus,
  recordWorkerResult,
  renderWorkResult,
  renderWorkerRunResult,
  startWork,
  WORKER_PROTOCOL,
  WORKER_ROLES,
  type WorkLevel,
} from "../../core/work/index.js";
import { readAgenticConfigFile } from "../../core/config/index.js";

const WORK_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  `  apk work <task-id> --owner <agent-id> --target <agent> [--role ${WORKER_ROLES.join("|")}] [--level 1|2|3|auto] [--write-session]`,
  "  apk work result <task-id> --owner <agent-id> --run-id <run-id> --role <role> --status <status> [--result-json <json>] [--json]",
  "",
  "Claim or continue a task, render its prompt, or record a result from an external worker.",
  "Does not launch external AI agents.",
].join("\n");

const WORK_VALUE_FLAGS = new Set(["--owner", "--target", "--role", "--level"]);
const RESULT_VALUE_FLAGS = new Set([
  "--owner", "--run-id", "--role", "--status", "--result-json", "--diff-id", "--evidence-json",
  "--commit-id", "--finding", "--reason",
]);

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  if (index === argv.length - 1 || argv[index + 1].startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }

  return argv[index + 1];
}

function readFlagValues(argv: readonly string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    if (index === argv.length - 1 || argv[index + 1].startsWith("-")) {
      throw new Error(`${flag} requires a value.`);
    }
    values.push(argv[index + 1]);
    index += 1;
  }
  return values;
}

function positionalArgs(argv: readonly string[], valueFlags: ReadonlySet<string>): string[] {
  return argv.filter((arg, index) => (
    !arg.startsWith("-") && !valueFlags.has(argv[index - 1] ?? "")
  ));
}

function parseJsonFlag(value: string | undefined, label: string): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch (error: unknown) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseLevel(value: string | undefined): WorkLevel {
  if (value === undefined || value === "auto") {
    return "auto";
  }
  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as WorkLevel;
  }
  throw new Error("--level must be 1, 2, 3, or auto.");
}

export async function runWorkCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(WORK_HELP_TEXT);
    return 0;
  }

  try {
    if (argv[0] === "result") {
      return runWorkResultCommand(argv.slice(1));
    }
    const knownFlags = new Set(["--owner", "--target", "--role", "--level", "--write-session"]);
    for (const arg of argv) {
      if (arg.startsWith("-") && !knownFlags.has(arg)) {
        throw new Error(`Unknown option: ${arg}`);
      }
    }

    const positional = positionalArgs(argv, WORK_VALUE_FLAGS);
    if (positional.length !== 1) {
      throw new Error(WORK_HELP_TEXT);
    }

    const owner = readFlagValue(argv, "--owner");
    const target = readFlagValue(argv, "--target");
    if (!owner) {
      throw new Error("--owner is required.");
    }
    if (!target) {
      throw new Error("--target is required.");
    }

    const result = await startWork({
      rootDirectory: resolve(process.cwd()),
      taskId: positional[0],
      owner,
      target,
      role: parseWorkerRole(readFlagValue(argv, "--role") ?? "implement"),
      level: parseLevel(readFlagValue(argv, "--level")),
      writeSession: argv.includes("--write-session"),
    });

    console.log(renderWorkResult(result));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runWorkResultCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(WORK_HELP_TEXT);
    return 0;
  }

  for (const arg of argv) {
    if (arg.startsWith("-") && arg !== "--json" && !RESULT_VALUE_FLAGS.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  const positional = positionalArgs(argv, RESULT_VALUE_FLAGS);
  if (positional.length !== 1) {
    throw new Error(WORK_HELP_TEXT);
  }

  const owner = readFlagValue(argv, "--owner");
  if (!owner) {
    throw new Error("--owner is required.");
  }
  const resultJson = readFlagValue(argv, "--result-json");
  let result;
  if (resultJson !== undefined) {
    result = parseWorkerResult(resultJson);
  } else {
    const runId = readFlagValue(argv, "--run-id");
    const role = readFlagValue(argv, "--role");
    const status = readFlagValue(argv, "--status");
    if (!runId || !role || !status) {
      throw new Error("--run-id, --role, and --status are required unless --result-json is provided.");
    }
    const evidence = parseJsonFlag(readFlagValue(argv, "--evidence-json"), "--evidence-json");
    result = parseWorkerResult({
      protocol: WORKER_PROTOCOL,
      taskId: positional[0],
      role: parseWorkerRole(role),
      runId,
      status: parseWorkerStatus(status),
      ...(readFlagValues(argv, "--commit-id").length > 0 ? { commitIds: readFlagValues(argv, "--commit-id") } : {}),
      ...(readFlagValue(argv, "--diff-id") ? { diffId: readFlagValue(argv, "--diff-id") } : {}),
      ...(evidence === undefined ? {} : { evidence }),
      ...(readFlagValues(argv, "--finding").length > 0 ? { reviewFindings: readFlagValues(argv, "--finding") } : {}),
      ...(readFlagValue(argv, "--reason") ? { reason: readFlagValue(argv, "--reason") } : {}),
    });
  }

  if (result.taskId !== positional[0]) {
    throw new Error(`Worker result taskId ${result.taskId} does not match task ${positional[0]}.`);
  }
  const coordination = await recordWorkerResult({
    rootDirectory: resolve(process.cwd()),
    taskDirectory: (await readAgenticConfigFile(resolve(process.cwd()))).taskDirectory,
    owner,
    result,
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify({
      result: coordination.result,
      evidence: coordination.evidence,
      nextRole: coordination.nextRole ?? null,
      nextPackage: coordination.nextPackage ?? null,
      nextAction: coordination.nextAction,
    }, null, 2));
  } else {
    console.log(renderWorkerRunResult(coordination));
  }
  return result.status === "completed" ? 0 : 1;
}
