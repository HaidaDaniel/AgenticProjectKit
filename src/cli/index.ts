#!/usr/bin/env node

import { runAgentCommand } from "./commands/agent.js";
import { runAdoptCommand } from "./commands/adopt.js";
import { runAnalyticsCommand } from "./commands/analytics.js";
import { runAttentionCommand } from "./commands/attention.js";
import { runAuditCommand } from "./commands/audit.js";
import { runContextCommand } from "./commands/context.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runExecutionCommand } from "./commands/execution.js";
import { runExportCommand } from "./commands/export.js";
import { runInitCommand } from "./commands/init.js";
import { runLanguageCommand } from "./commands/language.js";
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
import { runWorkersCommand } from "./commands/workers.js";
import { runWorkspacesCommand } from "./commands/workspaces.js";

const HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Command: apkit",
  "Aliases: apk, agentic-project-kit",
  "",
  "Usage:",
  "  apkit --help",
  "  apkit agent <register|list|prompt>",
  "  apkit adopt [directory]",
  "  apkit analytics summary [--month YYYY-MM] [--write]",
  "  apkit attention [--json]",
  "  apkit audit [directory]",
  "  apkit block <task-id> --owner <agent-id> [--reason <text>]",
  "  apkit cancel <task-id> --owner <agent-id> [--reason <text>]",
  "  apkit claim <task-id> --owner <agent-id>",
  "  apkit done <task-id> --owner <agent-id>",
  "  apkit doctor",
  "  apkit execution explain <task-id> --role <role> [--profile <profile>] [--json]",
  "  apkit init [directory]",
  "  apkit language [show|set <tag>|reset]",
  "  apkit lint [--json]",
  "  apkit context <task-id> [--level 1|2|3] [--budget <units>]",
  "  apkit export [agent]",
  "  apkit mode [mode]",
  "  apkit next-task",
  "  apkit prompt <agent> --task <task-id> [--level 1|2|3] [--budget <units>]",
  "  apkit quality detect [directory] [--json]",
  "  apkit resources [--json]",
  "  apkit release <task-id> --owner <agent-id>",
  "  apkit review <task-id> --owner <agent-id>",
  "  apkit sync [agent] [--write]",
  "  apkit status",
  '  apkit suggest-context "<task description>" [--limit <n>]',
  "  apkit task archive [<task-id>] [--all]",
  "  apkit task deps <task-id>",
  "  apkit task evidence <task-id>",
  "  apkit task verify <task-id> [--profile <profile|all>] [--check-files-only] [--owner <agent-id>]",
  "  apkit task gate <task-id>",
  "  apkit task decision <task-id> --actor <human-id> --result <accept-current|grant-review-passes|changes-required|cancel> --reason <text> [--passes <n>] [--owner <agent-id>]",
  "  apkit task create --title <title> --mode <mode> --lane <lane> --scope <csv> --risk <risk> --context <csv> --allowed <csv> --verification <csv>|--verification-json <json>",
  "  apkit tasks [--all] [--state <state>] [--owner <agent-id>]",
  "  apkit work <task-id> --owner <agent-id> --target <agent> [--resource <worker-id>] [--level 1|2|3|auto] [--write-session]",
  "  apkit workers [--json]",
  "  apkit workspaces <create|list|status|cleanup> [--json] [--apply]",
  "",
  "Commands:",
  "  agent  Register and list task agents.",
  "  adopt  Add kit files to an existing repository.",
  "  analytics  Summarize team agent analytics.",
  "  attention  Show the bounded semantic attention queue.",
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
  "  language  Inspect, set, or reset the local communication language.",
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
  "  workers  Show declared worker/resources and semantic capacity state.",
  "  workspaces  Manage optional isolated Git worktrees for parallel workers.",
].join("\n");

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

  if (command === "attention") {
    return runAttentionCommand(commandArgs);
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

  if (command === "language") {
    return runLanguageCommand(commandArgs);
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

  if (command === "workers") {
    return runWorkersCommand(commandArgs);
  }

  if (command === "workspaces") {
    return runWorkspacesCommand(commandArgs);
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `apkit --help` for available commands.");
  return 1;
}

process.exitCode = await main();
