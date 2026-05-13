import { resolve } from "node:path";

import { parseAgentExportTarget } from "../../core/exporters/index.js";
import {
  renderSyncSummary,
  syncAgentExports,
} from "../../core/sync/index.js";

const SYNC_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk sync [--write]",
  "  apk sync <agent> [--write]",
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

export async function runSyncCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(SYNC_HELP_TEXT);
    return 0;
  }

  const write = argv.includes("--write");
  const targets = argv.filter((arg) => arg !== "--write");

  if (targets.length > 1 || targets.some((arg) => arg.startsWith("-"))) {
    console.error("Usage: apk sync [agent] [--write]");
    return 1;
  }

  try {
    const result = await syncAgentExports(resolve(process.cwd()), {
      target: targets.length === 0 ? undefined : parseAgentExportTarget(targets[0]),
      write,
    });

    console.log(renderSyncSummary(result));
    return !write && result.hasDrift ? 1 : 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
