#!/usr/bin/env node

import { readCliVersion } from "./version.js";

const argv = process.argv.slice(2);

async function main(): Promise<number> {
  if (argv[0] === "--version") {
    if (argv.length !== 1) {
      console.error("Use --version as a standalone argument.");
      return 1;
    }
    try {
      console.log(await readCliVersion());
      return 0;
    } catch (error: unknown) {
      console.error(`Cannot determine APK version: ${String(error instanceof Error ? error.message : error).slice(0, 512)}`);
      return 1;
    }
  }
  // Version lookup must not load project commands or performance diagnostics.
  const { dispatchPublicCommand, renderCliHelp } = await import("./command-registry.js");
  const { runWithPerfInvocation, withPerfSpan } = await import("../core/perf/index.js");
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(renderCliHelp());
    return 0;
  }

  const [command, ...commandArgs] = argv;
  if (!command) {
    console.log(renderCliHelp());
    return 0;
  }
  const result = await runWithPerfInvocation(process.cwd(), command, () => withPerfSpan(
    "apk-bootstrap",
    "cli.dispatch",
    () => dispatchPublicCommand(command, commandArgs),
  ));
  if (result !== undefined) {
    return result;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `apkit --help` for available commands.");
  return 1;
}

process.exitCode = await main();
