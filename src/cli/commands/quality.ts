import { resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import { detectQualityCapabilities, renderQualityDetection } from "../../core/quality/index.js";

const QUALITY_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk quality detect [directory] [--json]",
  "",
  "Detect repository quality capabilities without running or changing toolchains.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runQualityCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(QUALITY_HELP_TEXT);
    return 0;
  }

  const json = argv.includes("--json");
  const args = argv.filter((arg) => arg !== "--json");
  if (args[0] !== "detect" || args.length > 2 || args.some((arg) => arg.startsWith("-"))) {
    console.error("Usage: apk quality detect [directory] [--json]");
    return 1;
  }

  try {
    const rootDirectory = resolve(process.cwd(), args[1] ?? ".");
    const config = await readAgenticConfigFile(rootDirectory);
    const result = await detectQualityCapabilities(rootDirectory, config.quality);
    console.log(renderQualityDetection(result, json));
    return result.policy.status === "pass" ? 0 : 1;
  } catch (error: unknown) {
    if (json) {
      console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    return 1;
  }
}
