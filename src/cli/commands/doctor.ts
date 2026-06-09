import { resolve } from "node:path";

import { renderDoctor, runDoctor } from "../../core/doctor/index.js";

const DOCTOR_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk doctor",
  "",
  "Run a read-only local workflow health check.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export async function runDoctorCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(DOCTOR_HELP_TEXT);
    return 0;
  }

  if (argv.length > 0) {
    console.error("Usage: apk doctor");
    return 1;
  }

  try {
    const result = await runDoctor(resolve(process.cwd()));
    console.log(renderDoctor(result));
    return result.ok ? 0 : 1;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
