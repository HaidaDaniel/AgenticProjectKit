import { resolve } from "node:path";

import {
  listAgents,
  migrateAgentLogs,
  registerAgent,
  renderAgentSetupPrompt,
  renderAgentsTable,
  renderMigrationSummary,
} from "../../core/agents/index.js";

const AGENT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk agent register --id <agent-id> --platform <platform> --model <model> [--label <label>] [--developer <id>]",
  "  apk agent list",
  "  apk agent migrate-logs [--remove-legacy]",
  "  apk agent prompt --platform <platform>",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function rejectUnknownOptions(argv: readonly string[], allowed: readonly string[]): void {
  for (const arg of argv) {
    if (arg.startsWith("-") && !allowed.includes(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
}

export async function runAgentCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(AGENT_HELP_TEXT);
    return 0;
  }

  const [subcommand, ...args] = argv;
  const rootDirectory = resolve(process.cwd());

  try {
    if (subcommand === "register") {
      rejectUnknownOptions(args, ["--id", "--platform", "--model", "--label", "--developer"]);
      const id = readFlagValue(args, "--id");
      const platform = readFlagValue(args, "--platform");
      const model = readFlagValue(args, "--model");

      if (!id || !platform || !model) {
        throw new Error("Usage: apk agent register --id <agent-id> --platform <platform> --model <model> [--label <label>] [--developer <id>]");
      }

      const agent = await registerAgent(rootDirectory, {
        id,
        developer: readFlagValue(args, "--developer"),
        platform,
        model,
        label: readFlagValue(args, "--label"),
      });
      console.log(`Registered agent: ${agent.id}`);
      return 0;
    }

    if (subcommand === "migrate-logs") {
      rejectUnknownOptions(args, ["--remove-legacy"]);
      if (args.some((arg) => !arg.startsWith("-"))) {
        throw new Error("Usage: apk agent migrate-logs [--remove-legacy]");
      }

      console.log(renderMigrationSummary(await migrateAgentLogs(rootDirectory, {
        removeLegacy: args.includes("--remove-legacy"),
      })));
      return 0;
    }

    if (subcommand === "list") {
      if (args.length > 0) {
        throw new Error("Usage: apk agent list");
      }

      console.log(renderAgentsTable(await listAgents(rootDirectory)));
      return 0;
    }

    if (subcommand === "prompt") {
      rejectUnknownOptions(args, ["--platform"]);
      const platform = readFlagValue(args, "--platform");

      if (!platform) {
        throw new Error("Usage: apk agent prompt --platform <platform>");
      }

      console.log(renderAgentSetupPrompt(platform));
      return 0;
    }

    throw new Error(AGENT_HELP_TEXT);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
