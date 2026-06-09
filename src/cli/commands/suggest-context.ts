import { resolve } from "node:path";

import { renderContextSuggestion, suggestContext } from "../../core/context-suggestions/index.js";

const SUGGEST_CONTEXT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  '  apk suggest-context "<task description>" [--limit <n>]',
  "",
  "Suggest task context and allowed files using local deterministic heuristics.",
].join("\n");

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

export async function runSuggestContextCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(SUGGEST_CONTEXT_HELP_TEXT);
    return 0;
  }

  try {
    for (const arg of argv) {
      if (arg.startsWith("-") && arg !== "--limit") {
        throw new Error(`Unknown option: ${arg}`);
      }
    }

    const description = argv.filter((arg, index) => (
      !arg.startsWith("-") &&
      argv[index - 1] !== "--limit"
    )).join(" ").trim();
    if (!description) {
      throw new Error(SUGGEST_CONTEXT_HELP_TEXT);
    }

    const limitValue = readFlagValue(argv, "--limit");
    const limit = limitValue === undefined ? undefined : Number.parseInt(limitValue, 10);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw new Error("--limit must be a positive integer.");
    }

    console.log(renderContextSuggestion(await suggestContext(resolve(process.cwd()), description, { limit })));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
