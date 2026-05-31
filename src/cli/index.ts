#!/usr/bin/env node

import { runAgentCommand } from "./commands/agent.js";
import { runAdoptCommand } from "./commands/adopt.js";
import { runAnalyticsCommand } from "./commands/analytics.js";
import { runAuditCommand } from "./commands/audit.js";
import { runContextCommand } from "./commands/context.js";
import { runExportCommand } from "./commands/export.js";
import { runInitCommand } from "./commands/init.js";
import { runModeCommand } from "./commands/mode.js";
import { runNextTaskCommand } from "./commands/next-task.js";
import { runPromptCommand } from "./commands/prompt.js";
import { runSyncCommand } from "./commands/sync.js";
import { runTasksCommand } from "./commands/tasks.js";
import { runTaskCommand } from "./commands/task.js";
import { runTaskStateCommand } from "./commands/task-state.js";

const HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Command: apkit (apk alias supported)",
  "",
  "Usage:",
  "  apkit --help",
  "  apk agent <register|list|prompt>",
  "  apk adopt [directory]",
  "  apk analytics summary [--month YYYY-MM] [--write]",
  "  apk audit [directory]",
  "  apk block <task-id> --owner <agent-id> [--reason <text>]",
  "  apk cancel <task-id> --owner <agent-id> [--reason <text>]",
  "  apk claim <task-id> --owner <agent-id>",
  "  apk done <task-id> --owner <agent-id>",
  "  apk init [directory]",
  "  apk context <task-id> [--level 1|2|3]",
  "  apk export [agent]",
  "  apk mode [mode]",
  "  apk next-task",
  "  apk prompt <agent> --task <task-id> [--level 1|2|3]",
  "  apk release <task-id> --owner <agent-id>",
  "  apk review <task-id> --owner <agent-id>",
  "  apk sync [agent] [--write]",
  "  apk task archive [<task-id>] [--all]",
  "  apk task deps <task-id>",
  "  apk task create --title <title> --mode <mode> --lane <lane> --scope <csv> --risk <risk> --context <csv> --allowed <csv> --verification <csv>",
  "  apk tasks [--all] [--state <state>] [--owner <agent-id>]",
  "",
  "Commands:",
  "  agent  Register and list task agents.",
  "  adopt  Add kit files to an existing repository.",
  "  analytics  Summarize team agent analytics.",
  "  audit  Write repository audit reports.",
  "  block  Mark a task blocked.",
  "  cancel  Cancel a task.",
  "  claim  Claim a todo task for an agent.",
  "  context  Print task context files.",
  "  done  Mark a task done.",
  "  export  Write generated agent instruction files.",
  "  init  Create starter kit files in a repository.",
  "  mode  Print or update the active operating mode.",
  "  next-task  Print the next actionable task.",
  "  prompt  Generate an agent-specific task prompt.",
  "  release  Release a task back to todo.",
  "  review  Move a task to review.",
  "  sync  Check or update generated agent instruction files.",
  "  task  Inspect task dependencies and graph.",
  "  tasks  List tasks in compact form.",
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

  if (command === "agent") {
    return runAgentCommand(commandArgs);
  }

  if (command === "adopt") {
    return runAdoptCommand(commandArgs);
  }

  if (command === "analytics") {
    return runAnalyticsCommand(commandArgs);
  }

  if (command === "audit") {
    return runAuditCommand(commandArgs);
  }

  if (command === "block" || command === "cancel" || command === "claim" || command === "done" || command === "release" || command === "review") {
    return runTaskStateCommand(command, commandArgs);
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

  if (command === "sync") {
    return runSyncCommand(commandArgs);
  }

  if (command === "task") {
    return runTaskCommand(commandArgs);
  }

  if (command === "tasks") {
    return runTasksCommand(commandArgs);
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `apk --help` for available commands.");
  return 1;
}

process.exitCode = await main();
