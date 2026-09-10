#!/usr/bin/env node

import { runAgentCommand } from "./commands/agent.js";
import { runAdoptCommand } from "./commands/adopt.js";
import { runAnalyticsCommand } from "./commands/analytics.js";
import { runAuditCommand } from "./commands/audit.js";
import { runContextCommand } from "./commands/context.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runExecutionCommand } from "./commands/execution.js";
import { runExportCommand } from "./commands/export.js";
import { runInitCommand } from "./commands/init.js";
import { runLintCommand } from "./commands/lint.js";
import { runModeCommand } from "./commands/mode.js";
import { runNextTaskCommand } from "./commands/next-task.js";
import { runPromptCommand } from "./commands/prompt.js";
import { runQualityCommand } from "./commands/quality.js";
import { runResourcesCommand } from "./commands/resources.js";
import { runSuggestContextCommand } from "./commands/suggest-context.js";
import { runSyncCommand } from "./commands/sync.js";
import { runStatusCommand } from "./commands/status.js";
import { runTasksCommand } from "./commands/tasks.js";
import { runTaskCommand } from "./commands/task.js";
import { runTaskStateCommand } from "./commands/task-state.js";
import { runWorkCommand } from "./commands/work.js";

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
  "  apk doctor",
  "  apk execution explain <task-id> --role <role> [--profile <profile>] [--json]",
  "  apk init [directory]",
  "  apk lint [--json]",
  "  apk context <task-id> [--level 1|2|3] [--budget <units>]",
  "  apk export [agent]",
  "  apk mode [mode]",
  "  apk next-task",
  "  apk prompt <agent> --task <task-id> [--level 1|2|3] [--budget <units>]",
  "  apk quality detect [directory] [--json]",
  "  apk resources [--json]",
  "  apk release <task-id> --owner <agent-id>",
  "  apk review <task-id> --owner <agent-id>",
  "  apk sync [agent] [--write]",
  "  apk status",
  '  apk suggest-context "<task description>" [--limit <n>]',
  "  apk task archive [<task-id>] [--all]",
  "  apk task deps <task-id>",
  "  apk task evidence <task-id>",
  "  apk task verify <task-id> [--profile <profile|all>] [--check-files-only] [--owner <agent-id>]",
  "  apk task gate <task-id>",
  "  apk task create --title <title> --mode <mode> --lane <lane> --scope <csv> --risk <risk> --context <csv> --allowed <csv> --verification <csv>|--verification-json <json>",
  "  apk tasks [--all] [--state <state>] [--owner <agent-id>]",
  "  apk work <task-id> --owner <agent-id> --target <agent> [--resource <worker-id>] [--level 1|2|3|auto] [--write-session]",
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
  "  doctor  Run local workflow health checks.",
  "  execution  Explain deterministic resource-aware execution routing.",
  "  export  Write generated agent instruction files.",
  "  init  Create starter kit files in a repository.",
  "  lint  Validate task and generated-file contracts without writing.",
  "  mode  Print or update the active operating mode.",
  "  next-task  Print the next actionable task.",
  "  prompt  Generate an agent-specific task prompt.",
  "  quality  Detect repository quality capabilities without mutation.",
  "  resources  Inspect the configured vendor-neutral worker/resource registry.",
  "  release  Release a task back to todo.",
  "  review  Move a task to review.",
  "  sync  Check or update generated agent instruction files.",
  "  status  Print compact workflow status.",
  "  suggest-context  Suggest task context files from local heuristics.",
  "  task  Inspect task dependencies and graph.",
  "  tasks  List tasks in compact form.",
  "  work  Claim or continue a task and render its prompt.",
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

  if (command === "lint") {
    return runLintCommand(commandArgs);
  }

  if (command === "context") {
    return runContextCommand(commandArgs);
  }

  if (command === "doctor") {
    return runDoctorCommand(commandArgs);
  }

  if (command === "execution") {
    return runExecutionCommand(commandArgs);
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

  if (command === "quality") {
    return runQualityCommand(commandArgs);
  }

  if (command === "resources") {
    return runResourcesCommand(commandArgs);
  }

  if (command === "sync") {
    return runSyncCommand(commandArgs);
  }

  if (command === "status") {
    return runStatusCommand(commandArgs);
  }

  if (command === "suggest-context") {
    return runSuggestContextCommand(commandArgs);
  }

  if (command === "task") {
    return runTaskCommand(commandArgs);
  }

  if (command === "tasks") {
    return runTasksCommand(commandArgs);
  }

  if (command === "work") {
    return runWorkCommand(commandArgs);
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `apk --help` for available commands.");
  return 1;
}

process.exitCode = await main();
