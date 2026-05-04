import { resolve } from "node:path";

import { getProjectMode, setProjectMode } from "../../core/modes/index.js";

const MODE_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk mode",
  "  apk mode <mode>",
  "",
  "Prints or updates the active operating mode.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runModeCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(MODE_HELP_TEXT);
    return 0;
  }

  if (argv.length > 1) {
    console.error("Usage: apk mode [mode]");
    return 1;
  }

  try {
    const rootDirectory = resolve(process.cwd());

    if (argv.length === 0) {
      console.log(await getProjectMode(rootDirectory));
      return 0;
    }

    console.log(await setProjectMode(rootDirectory, argv[0]));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
