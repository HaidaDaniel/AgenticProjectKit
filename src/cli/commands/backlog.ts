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
import { readAgenticConfigFile } from "../../core/config/index.js";

const HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk backlog add --title <title> [--slug <slug>] [--status <status>] [--priority <text>] [--motivation <text>] [--why-not-now <text>] [--criteria <csv>] [--outcome <text>] [--references <csv>] [--json]",
  "  apk backlog list [--status <status>] [--json]",
  "  apk backlog show <slug> [--json]",
  "  apk backlog validate [--json]",
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

    throw new Error(`Unknown backlog subcommand: ${command}`);
  } catch (error: unknown) {
    console.error(error instanceof BacklogFormatError ? error.message : error instanceof Error ? error.message : String(error));
    return 1;
  }
}
