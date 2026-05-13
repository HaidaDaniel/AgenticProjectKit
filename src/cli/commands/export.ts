import { resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  DEFAULT_AGENT_POLICY,
  parseAgentExportTarget,
  writeAgentExportTarget,
  writeAllAgentExports,
} from "../../core/exporters/index.js";

const EXPORT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk export [--force]",
  "  apk export <agent> [--force]",
  "",
  "Agents:",
  "  agents",
  "  claude",
  "  codex",
  "  gemini",
  "  opencode",
  "  cursor",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runExportCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(EXPORT_HELP_TEXT);
    return 0;
  }

  const force = argv.includes("--force");
  const targets = argv.filter((arg) => arg !== "--force");

  if (targets.length > 1 || targets.some((arg) => arg.startsWith("-"))) {
    console.error("Usage: apk export [agent] [--force]");
    return 1;
  }

  try {
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const policy = {
      ...DEFAULT_AGENT_POLICY,
      projectName: config.projectName,
      defaultStyle: config.agentStyle,
    };
    const result = targets.length === 0
      ? await writeAllAgentExports(rootDirectory, policy, { force })
      : await writeAgentExportTarget(
          rootDirectory,
          parseAgentExportTarget(targets[0]),
          policy,
          { force },
        );

    console.log(`Wrote ${result.written.length} file(s).`);
    for (const file of result.written) {
      console.log(`- ${file}`);
    }

    if (result.skipped.length > 0) {
      console.log(`Skipped ${result.skipped.length} existing file(s). Use --force to overwrite.`);
    }

    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
