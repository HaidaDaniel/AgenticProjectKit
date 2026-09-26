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

type CliHandler = (args: string[], command: string) => Promise<number>;
type SimpleHandler = (args: string[]) => Promise<number>;
type TaskStateCommand = "claim" | "release" | "block" | "review" | "done" | "cancel";

interface PublicCommandVariant {
  usage: string;
  description: string;
}

interface PublicCommand {
  command: string;
  summary: string;
  handler: CliHandler;
  variants: readonly PublicCommandVariant[];
}

function simple(handler: SimpleHandler): CliHandler {
  return (args) => handler(args);
}

function taskState(command: TaskStateCommand): CliHandler {
  return (args) => runTaskStateCommand(command, args);
}

/**
 * Canonical public command families, dispatch routes, and reference syntax.
 * Keep the docs synopsis block below in sync via the focused CLI reference test.
 */
export const PUBLIC_COMMANDS: readonly PublicCommand[] = [
  {
    command: "agent",
    summary: "Register and manage task agents.",
    handler: simple(runAgentCommand),
    variants: [
      { usage: "agent register --id <id> --platform <platform> --model <model> [--label <label>] [--developer <id>]", description: "register an agent in the repository-local registry." },
      { usage: "agent list", description: "list registered agents." },
      { usage: "agent migrate-logs [--remove-legacy]", description: "convert legacy analytics logs to sharded files." },
      { usage: "agent prompt --platform <platform>", description: "print compact setup instructions for a platform." },
    ],
  },
  {
    command: "adopt",
    summary: "Add APK files to an existing repository.",
    handler: simple(runAdoptCommand),
    variants: [{ usage: "adopt [directory] [--preview|--dry-run|--apply]", description: "add kit files and optionally preview/apply the explicit compatibility migration." }],
  },
  {
    command: "analytics",
    summary: "Summarize team agent analytics.",
    handler: simple(runAnalyticsCommand),
    variants: [{ usage: "analytics summary [--month YYYY-MM] [--write]", description: "summarize a month of agent activity, optionally writing the report." }],
  },
  {
    command: "attention",
    summary: "Show the bounded semantic attention queue.",
    handler: simple(runAttentionCommand),
    variants: [{ usage: "attention [--json]", description: "project task, gate, review, policy, and resource state without claiming live process facts." }],
  },
  {
    command: "audit",
    summary: "Write repository audit reports.",
    handler: simple(runAuditCommand),
    variants: [{ usage: "audit [directory]", description: "write lightweight kit/workflow and repository-readiness reports using static inspection." }],
  },
  {
    command: "block",
    summary: "Mark a task blocked.",
    handler: taskState("block"),
    variants: [{ usage: "block <task-id> --owner <agent-id> [--reason <text>]", description: "block a task with an optional reason." }],
  },
  {
    command: "cancel",
    summary: "Cancel a task.",
    handler: taskState("cancel"),
    variants: [{ usage: "cancel <task-id> --owner <agent-id> [--reason <text>]", description: "cancel a task with an optional reason." }],
  },
  {
    command: "claim",
    summary: "Claim a todo task for an agent.",
    handler: taskState("claim"),
    variants: [{ usage: "claim <task-id> --owner <agent-id>", description: "claim a todo task and capture its task baseline." }],
  },
  {
    command: "context",
    summary: "Print task context files.",
    handler: simple(runContextCommand),
    variants: [{ usage: "context <task-id> [--level 1|2|3] [--budget <units>]", description: "select task context; budget units approximate tokens and required files are never dropped." }],
  },
  {
    command: "done",
    summary: "Mark a task done when its gate passes.",
    handler: taskState("done"),
    variants: [{ usage: "done <task-id> --owner <agent-id>", description: "evaluate the completion gate and record completion evidence; there is no force bypass." }],
  },
  {
    command: "doctor",
    summary: "Run read-only workflow health checks.",
    handler: simple(runDoctorCommand),
    variants: [{ usage: "doctor", description: "inspect local APK workflow health without running adopted-repository commands." }],
  },
  {
    command: "execution",
    summary: "Explain resource-aware execution routing.",
    handler: simple(runExecutionCommand),
    variants: [
      { usage: "execution explain <task-id> --role <planning|implementation|review|fix|documentation|triage|verification> [--profile <local|constrained|balanced|abundant>] [--resource <worker-id>] [--complexity <simple|medium|complex>] [--json]", description: "explain the effective route without starting a worker." },
      { usage: "execution calibrate [--json]", description: "emit a bounded calibration package." },
      { usage: "execution calibrate --recommendation <json> [--apply]", description: "validate an external recommendation and apply it only when requested." },
    ],
  },
  {
    command: "export",
    summary: "Write generated agent instruction files.",
    handler: simple(runExportCommand),
    variants: [
      { usage: "export [agent] [--force]", description: "export generated instructions; existing files are skipped unless forced." },
      { usage: "export --report-legacy", description: "report obsolete generated files without writing." },
      { usage: "export --cleanup-legacy", description: "remove only obsolete files whose content exactly matches a known APK rendering." },
    ],
  },
  {
    command: "init",
    summary: "Create starter kit files in a repository.",
    handler: simple(runInitCommand),
    variants: [{ usage: "init [directory]", description: "create starter docs, config, task, ignore rules, and generated instructions." }],
  },
  {
    command: "language",
    summary: "Inspect or update the developer-local communication language.",
    handler: simple(runLanguageCommand),
    variants: [
      { usage: "language [show]", description: "show the resolved local language and its source." },
      { usage: "language set <tag>", description: "persist a short developer-local language tag." },
      { usage: "language reset", description: "remove the local preference and use the English fallback." },
    ],
  },
  {
    command: "lint",
    summary: "Validate task, path, policy, and generated-file contracts.",
    handler: simple(runLintCommand),
    variants: [{ usage: "lint [--json]", description: "run read-only contract lint; JSON output is stable for automation." }],
  },
  {
    command: "mode",
    summary: "Print or update the active operating mode.",
    handler: simple(runModeCommand),
    variants: [{ usage: "mode [mode]", description: "inspect or set the repository's current workflow mode." }],
  },
  {
    command: "next-task",
    summary: "Print the next actionable task.",
    handler: simple(runNextTaskCommand),
    variants: [{ usage: "next-task", description: "select a todo task whose dependencies are complete." }],
  },
  {
    command: "prompt",
    summary: "Generate an agent-specific task prompt.",
    handler: simple(runPromptCommand),
    variants: [{ usage: "prompt <agent> --task <task-id> [--level 1|2|3] [--budget <units>] [--language <tag>]", description: "render bounded task context and an optional invocation-only language override." }],
  },
  {
    command: "quality",
    summary: "Detect repository quality capabilities without running them.",
    handler: simple(runQualityCommand),
    variants: [{ usage: "quality detect [directory] [--json]", description: "read declared quality signals and evaluate explicit policy without executing project commands." }],
  },
  {
    command: "resources",
    summary: "Inspect the vendor-neutral worker/resource registry.",
    handler: simple(runResourcesCommand),
    variants: [
      { usage: "resources [--json]", description: "render configured model, harness, and worker records without probing providers." },
      { usage: "resources detect [--json]", description: "inventory local markers and declared capabilities without mutation." },
    ],
  },
  {
    command: "release",
    summary: "Release a task back to todo.",
    handler: taskState("release"),
    variants: [{ usage: "release <task-id> --owner <agent-id>", description: "release a task owned by the registered agent." }],
  },
  {
    command: "review",
    summary: "Move a task to review or record independent review evidence.",
    handler: taskState("review"),
    variants: [
      { usage: "review <task-id> --owner <agent-id>", description: "move the implementation task to review." },
      { usage: "review <task-id> --reviewer <reviewer-id> --prompt", description: "prepare a revision-bound review session and print its review run ID." },
      { usage: "review <task-id> --reviewer <reviewer-id> --review-run <review-run-id> --result <pass|changes_requested|fail> [--finding <text>] [--implementation-run <run-id>]", description: "record the prepared review outcome; reviewer must be registered and separate from the owner." },
    ],
  },
  {
    command: "status",
    summary: "Print compact workflow status.",
    handler: simple(runStatusCommand),
    variants: [{ usage: "status [--detail]", description: "show task and gate state; detail adds bounded evidence/provenance diagnostics without writing files." }],
  },
  {
    command: "suggest-context",
    summary: "Suggest context files using local deterministic heuristics.",
    handler: simple(runSuggestContextCommand),
    variants: [{ usage: "suggest-context \"<task description>\" [--limit <n>]", description: "rank context candidates from repository paths and task signals; suggestions are not guaranteed impact analysis." }],
  },
  {
    command: "sync",
    summary: "Check or update generated agent instruction files.",
    handler: simple(runSyncCommand),
    variants: [{ usage: "sync [agent] [--write]", description: "check generated files by default; write missing or stale files only with `--write`." }],
  },
  {
    command: "task",
    summary: "Inspect, create, and verify task contracts.",
    handler: simple(runTaskCommand),
    variants: [
      { usage: "task archive <task-id>", description: "archive a done task." },
      { usage: "task archive --all", description: "archive all done top-level tasks." },
      { usage: "task deps <task-id>", description: "inspect prerequisites, dependents, and graph problems." },
      { usage: "task evidence <task-id>", description: "list bounded evidence references and subject identities." },
      { usage: "task lock status [--kind <task|evidence>] [--json]", description: "inspect task/evidence lock ownership and liveness." },
      { usage: "task lock recover --kind <task|evidence> [--force]", description: "recover a confirmed-dead lock; uncertain metadata requires `--force` and independent operator inspection." },
      { usage: "task policy <task-id>", description: "resolve requirements and show blockers without changing task state." },
      { usage: "task gate <task-id>", description: "preview completion blockers for the current candidate." },
      { usage: "task decision <task-id> --actor <human-id> --result <accept-current|grant-review-passes|changes-required|cancel> --reason <text> [--passes <1-2>] [--owner <agent-id>]", description: "record an operator-asserted, candidate-bound decision; there is no generic force bypass." },
      { usage: "task provenance <task-id> [--json]", description: "reconstruct bounded runs, commits, scope, evidence freshness, and completion provenance." },
      { usage: "task dogfood start <task-id> --owner <agent-id> --tool <tool> --scenario <text> [--session <id>] [--started-at <ISO timestamp>]", description: "create a bounded dogfooding prompt/session." },
      { usage: "task dogfood result <task-id> --owner <agent-id> --session <session-id> --outcome <pass|fail> [--ended-at <ISO timestamp>] [--failures <csv>] [--retries <n>] [--observations <csv>] [--issues <csv>] [--metrics-json <json>]", description: "record an immutable bounded observation for that session." },
      { usage: "task verify <task-id> [--check-files-only] [--profile <profile|all>] [--owner <agent-id>]", description: "check task file scope, run eligible checks, and append candidate-bound evidence." },
      { usage: "task verify <task-id> --record --owner <agent-id> --check <check-id> --result <pass|fail> --evidence <reference> [--summary <text>]", description: "record an externally observed manual/live result for a declared check." },
      { usage: "task create --title <title> --scope <csv> --allowed <csv> [--type <name>|--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--forbidden <csv>] [--depends <csv>] [--parallel] [--tags <csv>] [--verification <csv>] [--verification-json <json>] [--goal <text>] [--steps <csv>] [--acceptance <csv>] [--docs <csv>] [--notes <csv>] [--assumptions <csv>] [--invariants <csv>] [--required-evidence <csv>] [--review-questions <csv>] [--counterexample-searches <csv>]", description: "generate a validated task file; explicit values override typed template defaults." },
    ],
  },
  {
    command: "tasks",
    summary: "List tasks in compact form.",
    handler: simple(runTasksCommand),
    variants: [{ usage: "tasks [--all] [--state <state>] [--owner <agent-id>]", description: "list active tasks or filter the complete lifecycle set." }],
  },
  {
    command: "work",
    summary: "Issue a worker handoff or record its result.",
    handler: simple(runWorkCommand),
    variants: [
      { usage: "work <task-id> --owner <agent-id> --target <agent> [--resource <worker-id>] [--role implement|review|fix|verify] [--level 1|2|3|auto] [--write-session] [--json]", description: "claim or continue a task and persist an `apk-worker-v1` package; this does not launch an agent." },
      { usage: "work result <task-id> --owner <agent-id> --run-id <run-id> --role <implement|review|fix|verify> --status <completed|failed|changes_requested> [--result-json <json>] [--commit-id <sha>] [--diff-id <id>] [--evidence-json <json>] [--finding <text>] [--reason <text>] [--json]", description: "submit a result for the exact activated worker run; results do not replace canonical verification or review evidence." },
      { usage: "work result <task-id> --owner <agent-id> --result-json <json> [--json]", description: "submit the complete JSON-compatible result instead of individual result fields." },
    ],
  },
  {
    command: "workers",
    summary: "Show declared workers and semantic capacity state.",
    handler: simple(runWorkersCommand),
    variants: [{ usage: "workers [--json]", description: "project declared availability/capacity and canonical issued sessions; does not claim live process state." }],
  },
  {
    command: "workspaces",
    summary: "Manage optional isolated Git worktrees.",
    handler: simple(runWorkspacesCommand),
    variants: [
      { usage: "workspaces create --task <task-id> --owner <agent-id> [--resource <worker-id>] [--run <run-id>] [--branch <name>] [--name <dir>] [--baseline <ref>] [--base <dir>] [--json]", description: "create a worktree after validating task/run/resource binding and path ownership." },
      { usage: "workspaces list [--json]", description: "list bounded APK-managed workspace state." },
      { usage: "workspaces status [--json]", description: "inspect one or all managed workspace states." },
      { usage: "workspaces cleanup <workspace-id> [--apply] [--json]", description: "preview cleanup by default; apply removes only a proven clean, inactive APK-owned worktree." },
    ],
  },
];

const commandMap = new Map<string, CliHandler>(PUBLIC_COMMANDS.map((entry) => [entry.command, entry.handler] as const));

if (commandMap.size !== PUBLIC_COMMANDS.length) {
  throw new Error("CLI command registry contains duplicate dispatch routes.");
}

export async function dispatchPublicCommand(command: string, args: string[]): Promise<number | undefined> {
  const handler = commandMap.get(command);
  return handler ? handler(args, command) : undefined;
}

export function renderCliHelp(): string {
  const usage = PUBLIC_COMMANDS.flatMap((entry) => entry.variants.map((variant) => `  apkit ${variant.usage}`));
  const commands = PUBLIC_COMMANDS.map((entry) => `  ${entry.command}  ${entry.summary}`);

  return [
    "Agentic Project Kit",
    "",
    "Command: apkit",
    "Aliases: apk, agentic-project-kit",
    "",
    "Usage:",
    ...usage,
    "",
    "Commands:",
    ...commands,
  ].join("\n");
}

export const CLI_REFERENCE_START = "<!-- BEGIN GENERATED CLI COMMAND REFERENCE -->";
export const CLI_REFERENCE_END = "<!-- END GENERATED CLI COMMAND REFERENCE -->";

export function renderCliReferenceSection(): string {
  const entries = PUBLIC_COMMANDS.flatMap((command) => command.variants.map(
    (variant) => `- \`apkit ${variant.usage}\` - ${variant.description}`,
  ));

  return [CLI_REFERENCE_START, ...entries, CLI_REFERENCE_END].join("\n");
}

export function validateCliReference(markdown: string): string[] {
  const start = markdown.indexOf(CLI_REFERENCE_START);
  const end = markdown.indexOf(CLI_REFERENCE_END);
  if (start === -1 || end === -1 || end < start || markdown.indexOf(CLI_REFERENCE_START, start + 1) !== -1 || markdown.indexOf(CLI_REFERENCE_END, end + 1) !== -1) {
    return ["CLI command reference markers are missing, duplicated, or out of order."];
  }

  const actual = markdown.slice(start, end + CLI_REFERENCE_END.length);
  return actual === renderCliReferenceSection() ? [] : ["CLI command reference is missing or stale; update the generated command reference block from the CLI registry."];
}
