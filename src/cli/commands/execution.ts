import { resolve } from "node:path";

import {
  DEFAULT_EXECUTION_PROFILE,
  emptyResourceRegistry,
  parseExecutionOverride,
  parseExecutionProfile,
  renderExecutionRoute,
  resolveExecutionRoute,
  EXECUTION_COMPLEXITIES,
  EXECUTION_ROLES,
  type ExecutionComplexity,
  type ExecutionOverride,
  type ExecutionRole,
} from "../../core/config/index.js";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { findTaskFile, loadTaskFile } from "../../core/tasks/index.js";
import { resolveTaskPolicy } from "../../core/tasks/policy.js";

const HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  `  apk execution explain <task-id> --role ${EXECUTION_ROLES.join("|")} [--profile ${DEFAULT_EXECUTION_PROFILE}|local|balanced|abundant] [--resource <worker-id>] [--complexity simple|medium|complex] [--json]`,
  "",
  "Explain a deterministic execution route without starting a worker or probing a provider.",
].join("\n");

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  if (index === argv.length - 1 || argv[index + 1].startsWith("-")) throw new Error(`${flag} requires a value.`);
  return argv[index + 1];
}

function positionalArgs(argv: readonly string[]): string[] {
  const valueFlags = new Set(["--role", "--profile", "--resource", "--complexity"]);
  return argv.filter((arg, index) => !arg.startsWith("-") && !valueFlags.has(argv[index - 1] ?? ""));
}

function hasHelpFlag(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runExecutionCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(HELP_TEXT);
    return 0;
  }
  try {
    if (argv[0] !== "explain") throw new Error(HELP_TEXT);
    const positional = positionalArgs(argv.slice(1));
    if (positional.length !== 1) throw new Error(HELP_TEXT);
    const roleValue = readFlagValue(argv, "--role");
    if (!roleValue || !(EXECUTION_ROLES as readonly string[]).includes(roleValue)) {
      throw new Error(`--role must be one of: ${EXECUTION_ROLES.join(", ")}.`);
    }
    const profileValue = readFlagValue(argv, "--profile");
    const complexityValue = readFlagValue(argv, "--complexity");
    if (complexityValue && !(EXECUTION_COMPLEXITIES as readonly string[]).includes(complexityValue)) {
      throw new Error(`--complexity must be one of: ${EXECUTION_COMPLEXITIES.join(", ")}.`);
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const taskFile = await findTaskFile(rootDirectory, positional[0], config.taskDirectory);
    const { task } = await loadTaskFile(taskFile);
    const profile = profileValue === undefined
      ? config.executionProfile
      : parseExecutionProfile(profileValue);
    const cliResource = readFlagValue(argv, "--resource");
    const override: ExecutionOverride | undefined = cliResource === undefined
      ? config.executionOverrides
      : parseExecutionOverride({
        ...(config.executionOverrides ?? {}),
        resourceId: cliResource,
        allowProfileBypass: true,
      });
    const route = resolveExecutionRoute({
      profile,
      role: roleValue as ExecutionRole,
      policy: resolveTaskPolicy(task).requirements,
      registry: config.resources ?? emptyResourceRegistry(),
      ...(complexityValue === undefined ? {} : { complexity: complexityValue as ExecutionComplexity }),
      ...(override === undefined ? {} : { override }),
    });
    console.log(renderExecutionRoute(route, argv.includes("--json")));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
