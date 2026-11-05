import { resolve } from "node:path";

import {
  BACKLOG_STATUSES,
  BacklogFormatError,
  createBacklogItem,
  listBacklogItems,
  readBacklogItem,
  renderBacklogMarkdown,
  validateBacklogItems,
  type BacklogStatus,
} from "../../core/backlog/index.js";
import {
  BacklogPromotionError,
  previewBacklogPromotion,
  promoteBacklogItem,
  type BacklogPromotionRequest,
} from "../../core/backlog/promote.js";
import {
  TASK_MODES,
  TASK_RISKS,
  normalizeVerificationCommands,
  type TaskCreateInput,
  type TaskVerificationCheck,
} from "../../core/tasks/index.js";
import { readAgenticConfigFile } from "../../core/config/index.js";

const HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk backlog add --title <title> [--slug <slug>] [--status <status>] [--priority <text>] [--motivation <text>] [--why-not-now <text>] [--criteria <csv>] [--outcome <text>] [--references <csv>] [--json]",
  "  apk backlog list [--status <status>] [--json]",
  "  apk backlog show <slug> [--json]",
  "  apk backlog validate [--json]",
  "  apk backlog promote <slug> --preview [task fields] [--confirm <criterion-id>] [--reason <text>] [--json]",
  "  apk backlog promote <slug> --apply [task fields] --confirm <criterion-id> --expect-criteria <fingerprint> [--reason <text>] [--json]",
  "",
  "Backlog items are lightweight Git-tracked Markdown cards, not executable tasks.",
  `Statuses: ${BACKLOG_STATUSES.join(", ")}.`,
].join("\n");

function hasHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function value(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  if (index === argv.length - 1 || argv[index + 1]!.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return argv[index + 1];
}

function csv(argv: readonly string[], flag: string): string[] {
  const raw = value(argv, flag);
  return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function allValues(argv: readonly string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("-")) throw new Error(`${flag} requires a value.`);
    values.push(next);
    index += 1;
  }
  return values;
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function taskInputFromFlags(argv: string[], defaultMode: string): TaskCreateInput {
  const mode = value(argv, "--mode") ?? defaultMode;
  if (!(TASK_MODES as readonly string[]).includes(mode)) throw new Error(`--mode must be one of: ${TASK_MODES.join(", ")}.`);
  const risk = value(argv, "--risk") ?? "medium";
  if (!(TASK_RISKS as readonly string[]).includes(risk)) throw new Error(`--risk must be one of: ${TASK_RISKS.join(", ")}.`);
  const verificationJson = value(argv, "--verification-json");
  let verification: TaskVerificationCheck[] | undefined;
  if (verificationJson !== undefined) {
    try {
      const parsed: unknown = JSON.parse(verificationJson);
      if (!Array.isArray(parsed)) throw new Error("must be a JSON array");
      verification = parsed as TaskVerificationCheck[];
    } catch (error: unknown) {
      throw new Error(`--verification-json must be a valid JSON array: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const verificationCommands = csv(argv, "--verification");
  return {
    title: "Backlog promotion",
    mode: mode as TaskCreateInput["mode"],
    lane: value(argv, "--lane") ?? "implementation",
    ...(value(argv, "--type") ? { type: value(argv, "--type") } : {}),
    scope: csv(argv, "--scope"),
    risk: risk as TaskCreateInput["risk"],
    parallel: argv.includes("--parallel"),
    dependsOn: csv(argv, "--depends"),
    tags: csv(argv, "--tags").length > 0 ? csv(argv, "--tags") : ["backlog"],
    goal: singleLine(value(argv, "--goal") ?? ""),
    contextFiles: csv(argv, "--context"),
    allowedFiles: csv(argv, "--allowed"),
    forbiddenFiles: csv(argv, "--forbidden"),
    steps: csv(argv, "--steps"),
    acceptanceCriteria: csv(argv, "--acceptance"),
    verification: verification ?? (verificationCommands.length > 0 ? normalizeVerificationCommands(verificationCommands) : []),
    documentationUpdates: csv(argv, "--docs"),
    notes: csv(argv, "--notes"),
  };
}

function promotionRequest(argv: string[], defaultMode: string): BacklogPromotionRequest {
  return {
    task: taskInputFromFlags(argv, defaultMode),
    confirmations: allValues(argv, "--confirm").flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean),
    reason: value(argv, "--reason"),
    expectedCriteriaFingerprint: value(argv, "--expect-criteria"),
  };
}

function renderPromotionPreview(preview: Awaited<ReturnType<typeof previewBacklogPromotion>>): string {
  return [
    `Card: ${preview.item.slug} (${preview.item.id})`,
    `Status: ${preview.item.status}`,
    `Card revision: ${preview.cardRevision}`,
    `Criteria fingerprint: ${preview.criteriaFingerprint}`,
    `Missing fields: ${preview.missingFields.length > 0 ? preview.missingFields.join(", ") : "none"}`,
    `Confirmed criteria: ${preview.confirmedCriteria.length > 0 ? preview.confirmedCriteria.join(", ") : "none"}`,
    `Missing criteria: ${preview.missingCriteria.length > 0 ? preview.missingCriteria.join(", ") : "none"}`,
    `Unknown criteria: ${preview.unknownCriteria.length > 0 ? preview.unknownCriteria.join(", ") : "none"}`,
    `Existing task: ${preview.existingTask ? `${preview.existingTask.id} (${preview.existingTask.path})` : "none"}`,
    `Valid: ${preview.valid ? "yes" : "no"}`,
    ...preview.diagnostics.map((diagnostic) => `- ${diagnostic}`),
  ].join("\n");
}

function parseStatus(raw: string | undefined): BacklogStatus | undefined {
  if (raw === undefined) return undefined;
  if ((BACKLOG_STATUSES as readonly string[]).includes(raw)) return raw as BacklogStatus;
  throw new Error(`--status must be one of: ${BACKLOG_STATUSES.join(", ")}.`);
}

function rejectUnknown(argv: readonly string[], allowed: readonly string[]): void {
  const flags = new Set(allowed);
  for (const arg of argv) {
    if (arg.startsWith("-") && !flags.has(arg)) throw new Error(`Unknown option: ${arg}`);
  }
}

function renderItem(item: Awaited<ReturnType<typeof readBacklogItem>>, json: boolean): void {
  console.log(json ? JSON.stringify(item, null, 2) : renderBacklogMarkdown(item));
}

export async function runBacklogCommand(argv: string[]): Promise<number> {
  if (hasHelp(argv) || argv.length === 0) {
    console.log(HELP_TEXT);
    return 0;
  }

  const [command, ...args] = argv;
  try {
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const taskDirectory = config.taskDirectory;
    const json = args.includes("--json");

    if (command === "add") {
      rejectUnknown(args, ["--title", "--slug", "--status", "--priority", "--motivation", "--why-not-now", "--criteria", "--outcome", "--references", "--json", "--help", "-h"]);
      const title = value(args, "--title");
      if (!title) throw new Error("--title is required.");
      const item = await createBacklogItem(rootDirectory, taskDirectory, {
        title,
        slug: value(args, "--slug"),
        status: parseStatus(value(args, "--status")),
        priority: value(args, "--priority"),
        motivation: value(args, "--motivation"),
        whyNotNow: value(args, "--why-not-now"),
        criteria: csv(args, "--criteria"),
        proposedOutcome: value(args, "--outcome"),
        references: csv(args, "--references"),
      });
      console.log(json ? JSON.stringify(item, null, 2) : `Created: ${item.path}`);
      return 0;
    }

    if (command === "list") {
      rejectUnknown(args, ["--status", "--json", "--help", "-h"]);
      const status = parseStatus(value(args, "--status"));
      const result = await listBacklogItems(rootDirectory, taskDirectory);
      const items = status ? result.items.filter((item) => item.status === status) : result.items;
      if (json) {
        console.log(JSON.stringify({ items, diagnostics: result.diagnostics }, null, 2));
      } else {
        if (items.length === 0) console.log("No backlog items.");
        for (const item of items) console.log(`${item.slug}\t${item.status}\t${item.title}`);
        for (const diagnostic of result.diagnostics) console.error(`Warning: ${diagnostic}`);
      }
      return result.diagnostics.length > 0 ? 1 : 0;
    }

    if (command === "show") {
      rejectUnknown(args, ["--json", "--help", "-h"]);
      const positional = args.filter((arg) => !arg.startsWith("-"));
      if (positional.length !== 1) throw new Error("Usage: apk backlog show <slug> [--json]");
      const item = await readBacklogItem(rootDirectory, taskDirectory, positional[0]!);
      renderItem(item, json);
      return 0;
    }

    if (command === "validate") {
      rejectUnknown(args, ["--json", "--help", "-h"]);
      if (args.filter((arg) => !arg.startsWith("-")).length > 0) throw new Error("Usage: apk backlog validate [--json]");
      const result = await validateBacklogItems(rootDirectory, taskDirectory);
      if (json) {
        console.log(JSON.stringify({ items: result.items, diagnostics: result.diagnostics }, null, 2));
      } else {
        console.log(`Validated ${result.items.length} backlog item(s).`);
        for (const diagnostic of result.diagnostics) console.error(`Error: ${diagnostic}`);
      }
      return result.diagnostics.length > 0 ? 1 : 0;
    }

    if (command === "promote") {
      const valueFlags = new Set([
        "--mode", "--lane", "--type", "--scope", "--risk", "--depends", "--tags", "--goal",
        "--context", "--allowed", "--forbidden", "--steps", "--acceptance", "--verification",
        "--verification-json", "--docs", "--notes", "--confirm", "--reason", "--expect-criteria",
      ]);
      rejectUnknown(args, [...valueFlags, "--preview", "--apply", "--parallel", "--json", "--help", "-h"]);
      const positional: string[] = [];
      for (let index = 0; index < args.length; index += 1) {
        const arg = args[index]!;
        if (arg.startsWith("-")) continue;
        if (valueFlags.has(args[index - 1] ?? "")) continue;
        positional.push(arg);
      }
      if (positional.length !== 1) throw new Error("Usage: apk backlog promote <slug> --preview|--apply [task fields]");
      const previewRequested = args.includes("--preview");
      const applyRequested = args.includes("--apply");
      if (previewRequested === applyRequested) throw new Error("Use exactly one of --preview or --apply.");
      const slug = positional[0]!;
      const request = promotionRequest(args, config.defaultMode);
      if (previewRequested) {
        const preview = await previewBacklogPromotion(rootDirectory, taskDirectory, slug, request);
        console.log(json ? JSON.stringify(preview, null, 2) : renderPromotionPreview(preview));
        return preview.valid ? 0 : 1;
      }
      const result = await promoteBacklogItem(rootDirectory, taskDirectory, slug, request);
      console.log(json
        ? JSON.stringify(result, null, 2)
        : `${result.outcome === "promoted" ? "Promoted" : result.outcome === "recovered" ? "Recovered" : "Already promoted"}: ${result.item.slug} -> ${result.task.path} (Task ${result.task.id}).`);
      return 0;
    }

    throw new Error(`Unknown backlog subcommand: ${command}`);
  } catch (error: unknown) {
    console.error(
      error instanceof BacklogFormatError || error instanceof BacklogPromotionError
        ? error.message
        : error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
