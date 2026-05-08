import { resolve } from "node:path";

import {
  auditRepository,
  renderAuditSummary,
} from "../../core/audit/index.js";

const AUDIT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk audit [directory]",
  "",
  "Writes:",
  "  docs/audit-report.md",
  "  docs/project-map.md",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runAuditCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(AUDIT_HELP_TEXT);
    return 0;
  }

  if (argv.length > 1 || argv.some((arg) => arg.startsWith("-"))) {
    console.error("Usage: apk audit [directory]");
    return 1;
  }

  try {
    const result = await auditRepository(resolve(process.cwd(), argv[0] ?? "."));
    console.log(renderAuditSummary(result));
    return result.hasErrors ? 1 : 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
