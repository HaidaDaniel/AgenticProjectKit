import { resolve } from "node:path";

import { renderStatus, summarizeStatus } from "../../core/status/index.js";

const STATUS_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk status [--detail|--json]",
  "",
  "Print compact workflow status without modifying files.",
  "Use --detail for bounded gate, evidence and provenance diagnostics, or --json for a machine-readable projection.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runStatusCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(STATUS_HELP_TEXT);
    return 0;
  }

  if (argv.some((arg) => arg !== "--detail" && arg !== "--json")) {
    console.error("Usage: apk status [--detail|--json]");
    return 1;
  }
  if (argv.includes("--detail") && argv.includes("--json")) {
    console.error("Use either --detail or --json, not both.");
    return 1;
  }

  try {
    const summary = await summarizeStatus(resolve(process.cwd()));
    if (argv.includes("--json")) {
      console.log(JSON.stringify(summary, null, 2));
      return 0;
    }
    console.log(renderStatus(summary, {
      detail: argv.includes("--detail"),
    }));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
