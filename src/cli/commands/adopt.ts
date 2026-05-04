import { resolve } from "node:path";

import { adoptRepository } from "../../core/docs/adopt.js";

const ADOPT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk adopt [directory]",
  "",
  "Scans an existing repository and adds kit docs without rewriting source code.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runAdoptCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(ADOPT_HELP_TEXT);
    return 0;
  }

  if (argv.length > 1) {
    console.error("Usage: apk adopt [directory]");
    return 1;
  }

  try {
    const rootDirectory = resolve(argv[0] ?? process.cwd());
    const result = await adoptRepository(rootDirectory);

    console.log(`Adopted Agentic Project Kit in ${rootDirectory}`);
    console.log(`Detected stack: ${result.scan.detectedStack.join(", ") || "unknown"}`);
    console.log(`Created ${result.created.length} file(s).`);

    if (result.skipped.length > 0) {
      console.log(`Skipped ${result.skipped.length} existing file(s).`);
    }

    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
