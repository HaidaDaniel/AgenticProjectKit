import { resolve } from "node:path";

import { initProject } from "../../core/init/index.js";

const INIT_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk init [directory]",
  "",
  "Creates starter project docs, task files, and .agentic config.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runInitCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(INIT_HELP_TEXT);
    return 0;
  }

  if (argv.length > 1) {
    console.error("Usage: apk init [directory]");
    return 1;
  }

  const rootDirectory = resolve(argv[0] ?? process.cwd());
  const result = await initProject(rootDirectory);

  console.log(`Initialized Agentic Project Kit in ${rootDirectory}`);
  console.log(`Created ${result.created.length} file(s).`);

  if (result.skipped.length > 0) {
    console.log(`Skipped ${result.skipped.length} existing file(s).`);
  }

  return 0;
}
