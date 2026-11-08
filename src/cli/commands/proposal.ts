import { resolve } from "node:path";

import { readAgenticConfigFile } from "../../core/config/index.js";
import {
  createProposal,
  findProposal,
  linkProposal,
  listProposals,
  ProposalFormatError,
  PROPOSAL_KINDS,
  PROPOSAL_STATUSES,
  renderProposalMarkdown,
  transitionProposal,
  validateProposals,
  type ProposalDecisionKind,
  type ProposalKind,
  type ProposalStatus,
} from "../../core/proposals/index.js";
import { commitProposal } from "../../core/proposals/git.js";

const HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk proposal add --title <title> [--slug <slug>] [--kind <kind>] [--summary <text>] [--context <text>] [--observations <text>] [--hypotheses <text>] [--direction <text>] [--evidence <text>] [--open-questions <text>] [--related-work <text>] [--related <csv>] [--json]",
  "  apk proposal list [--status <status>] [--kind <kind>] [--json]",
  "  apk proposal show <slug|id> [--json]",
  "  apk proposal validate [--json]",
  "  apk proposal accept <slug|id> --actor <operator-id> --reason <text> [--expect-revision <sha256>] [--json]",
  "  apk proposal reject <slug|id> --actor <operator-id> --reason <text> [--expect-revision <sha256>] [--json]",
  "  apk proposal supersede <slug|id> --by <successor-id> --actor <operator-id> --reason <text> [--expect-revision <sha256>] [--json]",
  "  apk proposal link <slug|id> [--canonical <path>] [--backlog <slug>] [--expect-revision <sha256>] [--json]",
  "  apk proposal commit <slug|id> [--message <text>] [--expect-revision <sha256>] [--json]",
  "",
  "Proposals are Git-tracked Markdown documents, not executable tasks or backlog cards.",
  `Kinds: ${PROPOSAL_KINDS.join(", ")}.`,
  `Statuses: ${PROPOSAL_STATUSES.join(", ")}.`,
  "add performs no git operation and creates no task. list/show/validate are read-only.",
  "accept and reject require an explicit operator decision; accepted does not mean implemented.",
  "commit publishes exactly one proposal in a local Git commit; it never pushes.",
  "link accepts only a canonical document or backlog card that already references the proposal.",
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

function rejectUnknown(argv: readonly string[], allowed: readonly string[]): void {
  const flags = new Set(allowed);
  for (const arg of argv) {
    if (arg.startsWith("-") && !flags.has(arg)) throw new Error(`Unknown option: ${arg}`);
  }
}

function parseKind(raw: string | undefined): ProposalKind | undefined {
  if (raw === undefined) return undefined;
  if ((PROPOSAL_KINDS as readonly string[]).includes(raw)) return raw as ProposalKind;
  throw new Error(`--kind must be one of: ${PROPOSAL_KINDS.join(", ")}.`);
}

function parseStatus(raw: string | undefined): ProposalStatus | undefined {
  if (raw === undefined) return undefined;
  if ((PROPOSAL_STATUSES as readonly string[]).includes(raw)) return raw as ProposalStatus;
  throw new Error(`--status must be one of: ${PROPOSAL_STATUSES.join(", ")}.`);
}

function positional(argv: readonly string[], valueFlags: ReadonlySet<string>): string[] {
  const result: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith("-")) continue;
    if (valueFlags.has(argv[index - 1] ?? "")) continue;
    result.push(arg);
  }
  return result;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function transitionName(decision: ProposalDecisionKind): string {
  return decision === "accepted" ? "accept" : decision === "rejected" ? "reject" : "supersede";
}

async function runTransition(
  command: string,
  args: string[],
  json: boolean,
  decision: ProposalDecisionKind,
): Promise<number> {
  const valueFlags = new Set(["--actor", "--reason", "--expect-revision", "--by"]);
  rejectUnknown(args, [...valueFlags, "--json", "--help", "-h"]);
  const terms = positional(args, valueFlags);
  if (terms.length !== 1) throw new Error(`Usage: apk proposal ${command} <slug|id> --actor <operator-id> --reason <text>`);
  const actor = value(args, "--actor");
  if (!actor) throw new Error("--actor is required.");
  const reason = value(args, "--reason");
  if (!reason) throw new Error("--reason is required.");
  const successor = value(args, "--by");
  if (decision === "superseded" && !successor) throw new Error("--by is required for supersede.");

  const rootDirectory = resolve(process.cwd());
  const config = await readAgenticConfigFile(rootDirectory);
  const snapshot = await transitionProposal({
    rootDirectory,
    docsDirectory: config.docsDirectory,
    idOrSlug: terms[0]!,
    decision,
    actor,
    reason,
    ...(value(args, "--expect-revision") ? { expectedRevision: value(args, "--expect-revision")! } : {}),
    ...(successor ? { successor } : {}),
  });
  if (json) {
    printJson(snapshot);
  } else {
    console.log(`${decision === "accepted" ? "Accepted" : decision === "rejected" ? "Rejected" : "Superseded"}: ${snapshot.proposal.path} (${snapshot.proposal.id}) revision=${snapshot.revision}`);
  }
  return 0;
}

export async function runProposalCommand(argv: string[]): Promise<number> {
  if (hasHelp(argv) || argv.length === 0) {
    console.log(HELP_TEXT);
    return 0;
  }
  const [command, ...args] = argv;
  const json = args.includes("--json");
  try {
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);

    if (command === "add") {
      rejectUnknown(args, [
        "--title", "--slug", "--kind", "--summary", "--context", "--observations", "--hypotheses",
        "--direction", "--evidence", "--open-questions", "--related-work", "--related", "--json", "--help", "-h",
      ]);
      const title = value(args, "--title");
      if (!title) throw new Error("--title is required.");
      const item = await createProposal(rootDirectory, config.docsDirectory, {
        title,
        slug: value(args, "--slug"),
        kind: parseKind(value(args, "--kind")),
        summary: value(args, "--summary"),
        context: value(args, "--context"),
        observations: value(args, "--observations"),
        hypotheses: value(args, "--hypotheses"),
        direction: value(args, "--direction"),
        evidence: value(args, "--evidence"),
        openQuestions: value(args, "--open-questions"),
        relatedWork: value(args, "--related-work"),
        related: csv(args, "--related"),
      });
      if (json) printJson(item);
      else console.log(`Created: ${item.path}`);
      return 0;
    }

    if (command === "list") {
      rejectUnknown(args, ["--status", "--kind", "--json", "--help", "-h"]);
      const status = parseStatus(value(args, "--status"));
      const kind = parseKind(value(args, "--kind"));
      const result = await listProposals(rootDirectory, config.docsDirectory);
      const items = result.items.filter((item) => (
        (status === undefined || item.status === status) && (kind === undefined || item.kind === kind)
      ));
      if (json) printJson({ items, diagnostics: result.diagnostics });
      else {
        if (items.length === 0) console.log("No document proposals.");
        for (const item of items) console.log(`${item.slug}\t${item.status}\t${item.kind}\t${item.title}`);
        for (const diagnostic of result.diagnostics) console.error(`Warning: ${diagnostic}`);
      }
      return result.diagnostics.length > 0 ? 1 : 0;
    }

    if (command === "show") {
      rejectUnknown(args, ["--json", "--help", "-h"]);
      const terms = positional(args, new Set());
      if (terms.length !== 1) throw new Error("Usage: apk proposal show <slug|id> [--json]");
      const snapshot = await findProposal(rootDirectory, config.docsDirectory, terms[0]!);
      if (!snapshot) throw new Error(`Proposal not found: ${terms[0]}`);
      if (json) printJson(snapshot.proposal);
      else console.log(renderProposalMarkdown(snapshot.proposal));
      return 0;
    }

    if (command === "validate") {
      rejectUnknown(args, ["--json", "--help", "-h"]);
      if (args.filter((arg) => !arg.startsWith("-")).length > 0) throw new Error("Usage: apk proposal validate [--json]");
      const result = await validateProposals(rootDirectory, config.docsDirectory);
      if (json) printJson({ items: result.items, diagnostics: result.diagnostics });
      else {
        console.log(`Validated ${result.items.length} proposal(s).`);
        for (const diagnostic of result.diagnostics) console.error(`Error: ${diagnostic}`);
      }
      return result.diagnostics.length > 0 ? 1 : 0;
    }

    if (command === "link") {
      const valueFlags = new Set(["--canonical", "--backlog", "--expect-revision"]);
      rejectUnknown(args, [...valueFlags, "--json", "--help", "-h"]);
      const terms = positional(args, valueFlags);
      if (terms.length !== 1) throw new Error("Usage: apk proposal link <slug|id> [--canonical <path>] [--backlog <slug>] [--json]");
      const canonical = value(args, "--canonical");
      const backlog = value(args, "--backlog");
      if (!canonical && !backlog) throw new Error("Provide --canonical or --backlog.");
      const snapshot = await linkProposal({
        rootDirectory,
        docsDirectory: config.docsDirectory,
        taskDirectory: config.taskDirectory,
        idOrSlug: terms[0]!,
        ...(canonical ? { canonical } : {}),
        ...(backlog ? { backlog } : {}),
        ...(value(args, "--expect-revision") ? { expectedRevision: value(args, "--expect-revision")! } : {}),
      });
      if (json) printJson(snapshot);
      else {
        const links = [
          snapshot.proposal.canonical ? `canonical=${snapshot.proposal.canonical}` : undefined,
          snapshot.proposal.backlog ? `backlog=${snapshot.proposal.backlog}` : undefined,
        ].filter(Boolean).join(" ");
        console.log(`Linked: ${snapshot.proposal.path} ${links} revision=${snapshot.revision}`);
      }
      return 0;
    }

    if (command === "commit") {
      const valueFlags = new Set(["--message", "--expect-revision"]);
      rejectUnknown(args, [...valueFlags, "--json", "--help", "-h"]);
      const terms = positional(args, valueFlags);
      if (terms.length !== 1) throw new Error("Usage: apk proposal commit <slug|id> [--message <text>] [--json]");
      const result = await commitProposal(rootDirectory, config.docsDirectory, terms[0]!, {
        ...(value(args, "--message") ? { message: value(args, "--message")! } : {}),
        ...(value(args, "--expect-revision") ? { expectedRevision: value(args, "--expect-revision")! } : {}),
      });
      if (json) printJson(result);
      else {
        console.log(`Committed: ${result.commitId} ${result.path} on ${result.branch}`);
        console.log("No push was performed. Push or open a PR explicitly when the repository policy allows it.");
      }
      return 0;
    }

    if (command === "accept" || command === "reject" || command === "supersede") {
      const decision: ProposalDecisionKind = command === "accept" ? "accepted" : command === "reject" ? "rejected" : "superseded";
      return runTransition(command, args, json, decision);
    }

    throw new Error(`Unknown proposal subcommand: ${command}`);
  } catch (error: unknown) {
    const message = error instanceof ProposalFormatError || error instanceof Error
      ? error.message
      : String(error);
    if (json) {
      console.error(JSON.stringify({
        error: {
          message,
          ...(error instanceof ProposalFormatError ? { issues: error.issues } : {}),
        },
      }));
    } else {
      console.error(message);
    }
    return 1;
  }
}

export const PROPOSAL_COMMAND_HELP = HELP_TEXT;
export const PROPOSAL_TRANSITION_NAMES = transitionName;
