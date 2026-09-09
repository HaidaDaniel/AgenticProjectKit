import { resolve } from "node:path";

import {
  lintRepositoryContracts,
  renderTaskLintResult,
} from "../../core/audit/lint.js";

const LINT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk lint [--json]",
  "",
  "Validate task graph, paths, policy/state contracts, and generated exports.",
  "Read-only: does not write audit reports or generated files.",
].join("\n");

export async function runLintCommand(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(LINT_HELP_TEXT);
    return 0;
  }

  const json = argv.includes("--json");
  if (argv.some((arg) => arg !== "--json" && !["--help", "-h"].includes(arg))) {
    console.error("Usage: apk lint [--json]");
    return 1;
  }

  try {
    const result = await lintRepositoryContracts(resolve(process.cwd()));
    console.log(renderTaskLintResult(result, json));
    return result.hasErrors ? 1 : 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

