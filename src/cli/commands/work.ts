import { resolve } from "node:path";

import { renderWorkResult, startWork, type WorkLevel } from "../../core/work/index.js";

const WORK_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk work <task-id> --owner <agent-id> --target <agent> [--level 1|2|3|auto] [--write-session]",
  "",
  "Claim or continue a task, render its prompt, and print verify/review guidance.",
  "Does not launch external AI agents.",
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

function parseLevel(value: string | undefined): WorkLevel {
  if (value === undefined || value === "auto") {
    return "auto";
  }
  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as WorkLevel;
  }
  throw new Error("--level must be 1, 2, 3, or auto.");
}

export async function runWorkCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(WORK_HELP_TEXT);
    return 0;
  }

  try {
    const knownFlags = new Set(["--owner", "--target", "--level", "--write-session"]);
    for (const arg of argv) {
      if (arg.startsWith("-") && !knownFlags.has(arg)) {
        throw new Error(`Unknown option: ${arg}`);
      }
    }

    const positional = argv.filter((arg, index) => (
      !arg.startsWith("-") &&
      argv[index - 1] !== "--owner" &&
      argv[index - 1] !== "--target" &&
      argv[index - 1] !== "--level"
    ));
    if (positional.length !== 1) {
      throw new Error(WORK_HELP_TEXT);
    }

    const owner = readFlagValue(argv, "--owner");
    const target = readFlagValue(argv, "--target");
    if (!owner) {
      throw new Error("--owner is required.");
    }
    if (!target) {
      throw new Error("--target is required.");
    }

    const result = await startWork({
      rootDirectory: resolve(process.cwd()),
      taskId: positional[0],
      owner,
      target,
      level: parseLevel(readFlagValue(argv, "--level")),
      writeSession: argv.includes("--write-session"),
    });

    console.log(renderWorkResult(result));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
