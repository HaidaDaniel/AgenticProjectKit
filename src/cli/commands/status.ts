import { resolve } from "node:path";

import { renderStatus, summarizeStatus } from "../../core/status/index.js";

const STATUS_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk status",
  "",
  "Print compact workflow status without modifying files.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runStatusCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(STATUS_HELP_TEXT);
    return 0;
  }

  if (argv.length > 0) {
    console.error("Usage: apk status");
    return 1;
  }

  try {
    console.log(renderStatus(await summarizeStatus(resolve(process.cwd()))));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
