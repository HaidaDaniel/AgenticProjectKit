#!/usr/bin/env node

import { dispatchPublicCommand, renderCliHelp } from "./command-registry.js";

const argv = process.argv.slice(2);

async function main(): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(renderCliHelp());
    return 0;
  }

  const [command, ...commandArgs] = argv;
  if (!command) {
    console.log(renderCliHelp());
    return 0;
  }
  const result = await dispatchPublicCommand(command, commandArgs);
  if (result !== undefined) {
    return result;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `apkit --help` for available commands.");
  return 1;
}

process.exitCode = await main();
