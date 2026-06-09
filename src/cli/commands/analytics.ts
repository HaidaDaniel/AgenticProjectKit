import { resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  renderAnalyticsSummary,
  summarizeAnalytics,
  writeAnalyticsSummary,
} from "../../core/analytics/index.js";

const ANALYTICS_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk analytics summary [--month YYYY-MM] [--write]",
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

function rejectUnknownOptions(argv: readonly string[]): void {
  for (const arg of argv) {
    if (arg.startsWith("-") && arg !== "--month" && arg !== "--write") {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
}

export async function runAnalyticsCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(ANALYTICS_HELP_TEXT);
    return 0;
  }

  const [subcommand, ...args] = argv;

  try {
    if (subcommand !== "summary") {
      throw new Error(ANALYTICS_HELP_TEXT);
    }

    rejectUnknownOptions(args);
    if (args.some((arg, index) => (
      !arg.startsWith("-") &&
      args[index - 1] !== "--month"
    ))) {
      throw new Error("Usage: apk analytics summary [--month YYYY-MM] [--write]");
    }

    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const summary = await summarizeAnalytics(rootDirectory, {
      month: readFlagValue(args, "--month"),
      taskDirectory: config.taskDirectory,
      docsDirectory: config.docsDirectory,
    });

    if (args.includes("--write")) {
      const outputPath = await writeAnalyticsSummary(rootDirectory, summary);
      console.log(`Wrote ${outputPath}`);
    } else {
      console.log(renderAnalyticsSummary(summary));
    }

    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
