import { resolve } from "node:path";

import {
  emptyResourceRegistry,
  renderResourceRegistry,
} from "../../core/resources/index.js";
import { readAgenticConfigFile } from "../../core/config/index.js";

const RESOURCES_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk resources [--json]",
  "",
  "Print the configured vendor-neutral resource registry without probing providers or starting workers.",
].join("\n");

export async function runResourcesCommand(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(RESOURCES_HELP_TEXT);
    return 0;
  }

  if (argv.some((arg) => arg !== "--json")) {
    console.error(RESOURCES_HELP_TEXT);
    return 1;
  }

  try {
    const config = await readAgenticConfigFile(resolve(process.cwd()));
    console.log(renderResourceRegistry(config.resources ?? emptyResourceRegistry(), argv.includes("--json")));
    return 0;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
