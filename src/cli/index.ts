#!/usr/bin/env node

import { runAdoptCommand } from "./commands/adopt.js";
import { runContextCommand } from "./commands/context.js";
import { runExportCommand } from "./commands/export.js";
import { runInitCommand } from "./commands/init.js";
import { runModeCommand } from "./commands/mode.js";
import { runNextTaskCommand } from "./commands/next-task.js";
import { runPromptCommand } from "./commands/prompt.js";

const HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk --help",
  "  apk adopt [directory]",
  "  apk init [directory]",
  "  apk context <task-id> [--level 1|2|3]",
  "  apk export [agent]",
  "  apk mode [mode]",
  "  apk next-task",
  "  apk prompt <agent> --task <task-id> [--level 1|2|3]",
  "",
  "Commands:",
  "  adopt  Add kit files to an existing repository.",
  "  context  Print task context files.",
  "  export  Write generated agent instruction files.",
  "  init  Create starter kit files in a repository.",
  "  mode  Print or update the active operating mode.",
  "  next-task  Print the next actionable task.",
  "  prompt  Generate an agent-specific task prompt.",
].join("\n");

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

const argv = process.argv.slice(2);

async function main(): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP_TEXT);
    return 0;
  }

  const [command, ...commandArgs] = argv;

  if (command === "adopt") {
    return runAdoptCommand(commandArgs);
  }

  if (command === "init") {
    return runInitCommand(commandArgs);
  }

  if (command === "context") {
    return runContextCommand(commandArgs);
  }

  if (command === "export") {
    return runExportCommand(commandArgs);
  }

  if (command === "mode") {
    return runModeCommand(commandArgs);
  }

  if (command === "next-task") {
    return runNextTaskCommand(commandArgs);
  }

  if (command === "prompt") {
    return runPromptCommand(commandArgs);
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `apk --help` for available commands.");
  return 1;
}

process.exitCode = await main();
