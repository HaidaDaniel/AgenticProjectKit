import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { repositoryRelativePathIssue, resolveContainedRepositoryPath } from "../config/paths.js";

export const PROPOSAL_SCHEMA_VERSION = 1 as const;

export const PROPOSAL_KINDS = [
  "idea",
  "research",
  "experiment",
  "adapter-design",
  "architecture",
  "optimization",
  "documentation",
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_STATUSES = ["proposed", "accepted", "rejected", "superseded"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_DECISIONS = ["accepted", "rejected", "superseded"] as const;
export type ProposalDecisionKind = (typeof PROPOSAL_DECISIONS)[number];

export const PROPOSAL_LIMITS = {
  bytesPerProposal: 128 * 1024,
  proposals: 1024,
  sectionCharacters: 32 * 1024,
  lineCharacters: 4096,
  related: 64,
  decisionReasonCharacters: 1000,
  slugCharacters: 80,
} as const;

const PROPOSAL_SECTIONS = [
  "Summary",
  "Context",
  "Observations",
  "Hypotheses",
  "Proposed direction",
  "Evidence and references",
  "Open questions",
  "Related work",
  "Decision history",
] as const;
type ProposalSection = (typeof PROPOSAL_SECTIONS)[number];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ACTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REVISION_PATTERN = /^[a-f0-9]{64}$/;
const METADATA_PATTERN = /^(Proposal-Id|Proposal-Schema|Kind|Status|Created|Updated|Superseded-By|Canonical|Backlog|Related):[ \t]*(.*)$/;

const CYRILLIC_SLUG_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g",
};

export interface ProposalDecision {
  time: string;
  decision: ProposalDecisionKind;
  actor: string;
  revision: string;
  reason: string;
  successor?: string;
}

export interface ProposalItem {
  slug: string;
  path: string;
  id: string;
  title: string;
  kind: ProposalKind;
  status: ProposalStatus;
  created: string;
  updated?: string;
  supersededBy?: string;
  canonical?: string;
  backlog?: string;
  related: string[];
  summary: string;
  context?: string;
  observations?: string;
  hypotheses?: string;
  direction?: string;
  evidence?: string;
  openQuestions?: string;
  relatedWork?: string;
  decisions: ProposalDecision[];
}

export interface ProposalCreateInput {
  title: string;
  slug?: string;
  kind?: ProposalKind;
  summary?: string;
  context?: string;
  observations?: string;
  hypotheses?: string;
  direction?: string;
  evidence?: string;
  openQuestions?: string;
  relatedWork?: string;
  related?: string[];
  canonical?: string;
  backlog?: string;
  created?: string;
}

export interface ProposalSnapshot {
  proposal: ProposalItem;
  content: string;
  revision: string;
}

export interface ProposalListResult {
  items: ProposalItem[];
  diagnostics: string[];
}

export class ProposalFormatError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid document proposal:\n- ${issues.join("\n- ")}`);
    this.name = "ProposalFormatError";
    this.issues = issues;
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error.code === "ENOENT" || error.code === "ENOTDIR"),
  );
}

function asciiSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "-")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugifyProposalTitle(text: string): string {
  const direct = asciiSlug(text);
  if (direct) return direct.slice(0, PROPOSAL_LIMITS.slugCharacters).replace(/-+$/g, "");
  const transliterated = asciiSlug(
    [...text.toLowerCase()].map((character) => CYRILLIC_SLUG_MAP[character] ?? character).join(""),
  );
  if (transliterated) {
    return transliterated.slice(0, PROPOSAL_LIMITS.slugCharacters).replace(/-+$/g, "");
  }
  const digest = createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
  return `proposal-${digest}`;
}

export function normalizeProposalSlug(slug: string): string {
  const trimmed = slug.trim();
  if (!SLUG_PATTERN.test(trimmed) || /^\d{4,}(?:-|$)/.test(trimmed)) {
    throw new ProposalFormatError([
      "Proposal slug must be a lowercase hyphenated filename that does not resemble a numeric task id.",
    ]);
  }
  return trimmed;
}

export function proposalDirectoryRelative(docsDirectory: string): string {
  return `${docsDirectory.replace(/\\/g, "/").replace(/\/+$/, "")}/proposals`;
}

export function proposalRelativePath(docsDirectory: string, slug: string): string {
  return `${proposalDirectoryRelative(docsDirectory)}/${slug}.md`;
}

function bounded(issues: string[], condition: boolean, message: string): void {
  if (!condition) issues.push(message);
}

function sectionText(lines: readonly string[] | undefined): string | undefined {
  if (lines === undefined) return undefined;
  const text = lines.join("\n").trim();
  return text.length === 0 ? undefined : text;
}

function splitMetadataList(value: string, label: string, issues: string[]): string[] {
  if (value.trim().length === 0) return [];
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length > PROPOSAL_LIMITS.related) {
    issues.push(`${label} must contain at most ${PROPOSAL_LIMITS.related} entries.`);
  }
  for (const item of items) {
    if (item.length > 160) issues.push(`${label} entries must be at most 160 characters.`);
  }
  return items;
}

function escapeDecisionField(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function unescapeDecisionField(text: string): string {
  return text.replace(/\\([\\|])/g, "$1");
}

function parseDecisionLine(line: string, index: number, issues: string[]): ProposalDecision | undefined {
  const prefix = `Decision history line ${index}`;
  if (!line.startsWith("- ")) {
    issues.push(`${prefix} must be a "- " list item.`);
    return undefined;
  }
  const parts = line.slice(2).split(" | ");
  if (parts.length < 5 || parts.length > 6) {
    issues.push(`${prefix} must use "- <time> | <decision> | <actor> | <revision> | <reason>[ | <successor-id>]" syntax.`);
    return undefined;
  }
  const [time, decision, actor, revision, escapedReason, successor] = parts;
  const reason = unescapeDecisionField(escapedReason ?? "");
  if (Number.isNaN(Date.parse(time))) issues.push(`${prefix} time must be an ISO timestamp.`);
  if (!(PROPOSAL_DECISIONS as readonly string[]).includes(decision)) {
    issues.push(`${prefix} decision must be one of: ${PROPOSAL_DECISIONS.join(", ")}.`);
  }
  if (!ACTOR_PATTERN.test(actor)) issues.push(`${prefix} actor must be a compact identifier.`);
  if (!REVISION_PATTERN.test(revision)) issues.push(`${prefix} revision must be a lowercase sha256 hex digest.`);
  if (reason.trim().length === 0 || reason.length > PROPOSAL_LIMITS.decisionReasonCharacters) {
    issues.push(`${prefix} reason must contain 1-${PROPOSAL_LIMITS.decisionReasonCharacters} characters.`);
  }
  if (decision === "superseded") {
    if (!successor || !ID_PATTERN.test(successor)) {
      issues.push(`${prefix} superseded decisions require a successor proposal id.`);
    }
  } else if (successor !== undefined) {
    issues.push(`${prefix} successor is only valid for a superseded decision.`);
  }
  return {
    time,
    decision: decision as ProposalDecisionKind,
    actor,
    revision,
    reason: reason.trim(),
    ...(successor ? { successor } : {}),
  };
}

export function parseProposalMarkdown(
  markdown: string,
  slug: string,
  path = proposalRelativePath("docs", slug),
): ProposalItem {
  if (Buffer.byteLength(markdown, "utf8") > PROPOSAL_LIMITS.bytesPerProposal) {
    throw new ProposalFormatError([`Proposal exceeds the ${PROPOSAL_LIMITS.bytesPerProposal} byte limit.`]);
  }
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const issues: string[] = [];
  for (const line of lines) {
    if (line.length > PROPOSAL_LIMITS.lineCharacters) {
      issues.push(`Line exceeds the ${PROPOSAL_LIMITS.lineCharacters} character limit.`);
      break;
    }
  }

  let index = 0;
  while (index < lines.length && lines[index]!.trim() === "") index += 1;
  const titleMatch = /^# (.+)$/.exec(lines[index] ?? "");
  if (!titleMatch) {
    throw new ProposalFormatError(["Proposal must start with a single '# <title>' heading."]);
  }
  const title = titleMatch[1]!.trim();
  bounded(issues, title.length > 0 && title.length <= 200, "Title must contain 1-200 characters.");
  index += 1;

  const metadata = new Map<string, string>();
  while (index < lines.length && !lines[index]!.startsWith("## ")) {
    const line = lines[index]!;
    index += 1;
    if (line.trim() === "") continue;
    const match = METADATA_PATTERN.exec(line);
    if (!match) {
      issues.push(`Unsupported proposal metadata line: ${line.slice(0, 160)}`);
      continue;
    }
    const key = match[1]!;
    if (metadata.has(key)) issues.push(`Duplicate metadata field: ${key}`);
    metadata.set(key, match[2]!.trim());
  }

  const schema = metadata.get("Proposal-Schema") ?? String(PROPOSAL_SCHEMA_VERSION);
  if (schema !== String(PROPOSAL_SCHEMA_VERSION)) {
    throw new ProposalFormatError([
      `Unsupported proposal schema version ${JSON.stringify(schema)}; the file was not mutated.`,
    ]);
  }

  const sections = new Map<ProposalSection, string[]>();
  let current: ProposalSection | undefined;
  for (; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.startsWith("## ")) {
      const name = line.slice(3).trim();
      if (!(PROPOSAL_SECTIONS as readonly string[]).includes(name)) {
        issues.push(`Unsupported proposal section: ${name}`);
        current = undefined;
        continue;
      }
      if (sections.has(name as ProposalSection)) issues.push(`Duplicate proposal section: ${name}`);
      current = name as ProposalSection;
      sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
  }

  if (!sections.has("Summary")) issues.push("Missing required section: ## Summary");
  for (const [name, sectionLines] of sections) {
    const value = sectionText(sectionLines);
    if (value !== undefined && value.length > PROPOSAL_LIMITS.sectionCharacters) {
      issues.push(`${name} exceeds the ${PROPOSAL_LIMITS.sectionCharacters} character limit.`);
    }
  }

  const id = metadata.get("Proposal-Id") ?? "";
  if (!ID_PATTERN.test(id) || /^\d+$/.test(id)) {
    issues.push("Proposal-Id must be an opaque non-numeric identifier.");
  }
  const kind = metadata.get("Kind") ?? "";
  if (!(PROPOSAL_KINDS as readonly string[]).includes(kind)) {
    issues.push(`Kind must be one of: ${PROPOSAL_KINDS.join(", ")}.`);
  }
  const status = metadata.get("Status") ?? "";
  if (!(PROPOSAL_STATUSES as readonly string[]).includes(status)) {
    issues.push(`Status must be one of: ${PROPOSAL_STATUSES.join(", ")}.`);
  }
  const created = metadata.get("Created") ?? "";
  if (Number.isNaN(Date.parse(created))) issues.push("Created must be an ISO timestamp.");
  const updated = metadata.get("Updated");
  if (updated !== undefined && Number.isNaN(Date.parse(updated))) issues.push("Updated must be an ISO timestamp.");
  const supersededBy = metadata.get("Superseded-By");
  if (supersededBy !== undefined) {
    bounded(issues, ID_PATTERN.test(supersededBy), "Superseded-By must be a proposal id.");
    bounded(issues, status === "superseded", "Superseded-By is only valid for a superseded proposal.");
    bounded(issues, supersededBy !== id, "Superseded-By must not reference the same proposal.");
  } else if (status === "superseded") {
    issues.push("Superseded proposals require Superseded-By.");
  }
  const canonical = metadata.get("Canonical");
  if (canonical !== undefined) {
    const issue = repositoryRelativePathIssue(canonical, "file");
    if (issue) issues.push(`Canonical destination: ${issue}.`);
  }
  const backlog = metadata.get("Backlog");
  if (backlog !== undefined) {
    bounded(issues, SLUG_PATTERN.test(backlog), "Backlog must name a valid backlog slug.");
  }
  const related = splitMetadataList(metadata.get("Related") ?? "", "Related", issues);

  const decisionLines = sections.get("Decision history") ?? [];
  const decisions: ProposalDecision[] = [];
  for (const [lineIndex, line] of decisionLines.entries()) {
    if (line.trim() === "") continue;
    const decision = parseDecisionLine(line, lineIndex + 1, issues);
    if (decision) decisions.push(decision);
  }

  if (status === "proposed" && decisions.length > 0) {
    issues.push("A proposed proposal must not have decision-history entries.");
  }
  if (status !== "proposed" && status !== "superseded" && status !== "accepted" && status !== "rejected") {
    // Status validation already reported the unsupported value.
  } else if (status !== "proposed") {
    const last = decisions[decisions.length - 1];
    if (!last) {
      issues.push(`A ${status} proposal requires a decision-history entry.`);
    } else if (last.decision !== status) {
      issues.push(`The last decision (${last.decision}) must match Status: ${status}.`);
    }
    if (status === "superseded" && last?.successor !== undefined && supersededBy !== undefined && last.successor !== supersededBy) {
      issues.push("The last superseded decision successor must match Superseded-By.");
    }
  }

  if (issues.length > 0) throw new ProposalFormatError(issues);

  return {
    slug,
    path,
    id,
    title,
    kind: kind as ProposalKind,
    status: status as ProposalStatus,
    created,
    ...(updated !== undefined ? { updated } : {}),
    ...(supersededBy !== undefined ? { supersededBy } : {}),
    ...(canonical !== undefined ? { canonical } : {}),
    ...(backlog !== undefined ? { backlog } : {}),
    related,
    summary: sectionText(sections.get("Summary")) ?? "",
    ...(sectionText(sections.get("Context")) !== undefined ? { context: sectionText(sections.get("Context"))! } : {}),
    ...(sectionText(sections.get("Observations")) !== undefined ? { observations: sectionText(sections.get("Observations"))! } : {}),
    ...(sectionText(sections.get("Hypotheses")) !== undefined ? { hypotheses: sectionText(sections.get("Hypotheses"))! } : {}),
    ...(sectionText(sections.get("Proposed direction")) !== undefined ? { direction: sectionText(sections.get("Proposed direction"))! } : {}),
    ...(sectionText(sections.get("Evidence and references")) !== undefined ? { evidence: sectionText(sections.get("Evidence and references"))! } : {}),
    ...(sectionText(sections.get("Open questions")) !== undefined ? { openQuestions: sectionText(sections.get("Open questions"))! } : {}),
    ...(sectionText(sections.get("Related work")) !== undefined ? { relatedWork: sectionText(sections.get("Related work"))! } : {}),
    decisions,
  };
}

function decisionLine(decision: ProposalDecision): string {
  return `- ${decision.time} | ${decision.decision} | ${decision.actor} | ${decision.revision} | ${escapeDecisionField(decision.reason)}`
    + (decision.successor ? ` | ${decision.successor}` : "");
}

export function renderProposalMarkdown(item: ProposalItem): string {
  const lines = [
    `# ${item.title}`,
    "",
    `Proposal-Schema: ${PROPOSAL_SCHEMA_VERSION}`,
    `Proposal-Id: ${item.id}`,
    `Kind: ${item.kind}`,
    `Status: ${item.status}`,
    `Created: ${item.created}`,
    ...(item.updated !== undefined ? [`Updated: ${item.updated}`] : []),
    ...(item.supersededBy !== undefined ? [`Superseded-By: ${item.supersededBy}`] : []),
    ...(item.canonical !== undefined ? [`Canonical: ${item.canonical}`] : []),
    ...(item.backlog !== undefined ? [`Backlog: ${item.backlog}`] : []),
    ...(item.related.length > 0 ? [`Related: ${item.related.join(", ")}`] : []),
    "",
    "## Summary",
    "",
    item.summary,
    "",
  ];

  const sections: Array<[ProposalSection, string | undefined]> = [
    ["Context", item.context],
    ["Observations", item.observations],
    ["Hypotheses", item.hypotheses],
    ["Proposed direction", item.direction],
    ["Evidence and references", item.evidence],
    ["Open questions", item.openQuestions],
    ["Related work", item.relatedWork],
  ];
  for (const [name, value] of sections) {
    if (value === undefined) continue;
    lines.push(`## ${name}`, "", value, "");
  }

  lines.push("## Decision history", "");
  for (const decision of item.decisions) lines.push(decisionLine(decision));
  lines.push("");
  return lines.join("\n");
}

export function proposalRevision(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function assertProposalStorageSafe(rootDirectory: string, docsDirectory: string): Promise<void> {
  const docsIssue = repositoryRelativePathIssue(docsDirectory, "directory");
  if (docsIssue) throw new ProposalFormatError([`docsDirectory: ${docsIssue}.`]);
  await resolveContainedRepositoryPath(rootDirectory, proposalDirectoryRelative(docsDirectory), "directory");
}

async function readBoundedProposal(path: string, displayPath: string): Promise<string> {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new ProposalFormatError([`Proposal must not be a symbolic link: ${displayPath}`]);
  if (!info.isFile()) throw new ProposalFormatError([`Proposal must be a regular file: ${displayPath}`]);
  if (info.size > PROPOSAL_LIMITS.bytesPerProposal) {
    throw new ProposalFormatError([`Proposal exceeds the ${PROPOSAL_LIMITS.bytesPerProposal} byte limit: ${displayPath}`]);
  }

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP") {
      throw new ProposalFormatError([`Proposal must not be a symbolic link: ${displayPath}`]);
    }
    throw error;
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new ProposalFormatError([`Proposal must be a regular file: ${displayPath}`]);
    if (opened.size > PROPOSAL_LIMITS.bytesPerProposal) {
      throw new ProposalFormatError([`Proposal exceeds the ${PROPOSAL_LIMITS.bytesPerProposal} byte limit: ${displayPath}`]);
    }
    const buffer = Buffer.alloc(PROPOSAL_LIMITS.bytesPerProposal + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > PROPOSAL_LIMITS.bytesPerProposal) {
      throw new ProposalFormatError([`Proposal exceeds the ${PROPOSAL_LIMITS.bytesPerProposal} byte limit: ${displayPath}`]);
    }
    if (size !== opened.size) {
      throw new ProposalFormatError([`Proposal changed while being read (truncated or grown): ${displayPath}`]);
    }
    const after = await handle.stat();
    if (!after.isFile()
      || after.size !== opened.size
      || after.mtimeMs !== opened.mtimeMs
      || after.ctimeMs !== opened.ctimeMs
      || after.ino !== opened.ino
      || after.dev !== opened.dev) {
      throw new ProposalFormatError([`Proposal changed while being read: ${displayPath}`]);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
    } catch {
      throw new ProposalFormatError([`Proposal is not valid UTF-8: ${displayPath}`]);
    }
  } finally {
    await handle.close();
  }
}

export interface ProposalCreateRuntime {
  beforePublish?: (temporary: string, target: string) => Promise<void> | void;
  writeTemporary?: (path: string, content: string) => Promise<void>;
  link?: (temporary: string, target: string) => Promise<void>;
  removeTemporary?: (path: string) => Promise<void>;
}

const UNSUPPORTED_EXCLUSIVE_PUBLICATION_CODES = new Set(["EPERM", "EOPNOTSUPP", "ENOTSUP", "ENOSYS", "EXDEV"]);
const IGNORED_TEMPORARY_SYNC_CODES = new Set(["EINVAL", "EOPNOTSUPP", "ENOTSUP", "ENOSYS"]);

function fsErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

async function writeExclusiveProposalTemporary(path: string, content: string): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(content, { encoding: "utf8" });
    try {
      await handle.sync();
    } catch (error: unknown) {
      if (!IGNORED_TEMPORARY_SYNC_CODES.has(fsErrorCode(error) ?? "")) throw error;
    }
  } finally {
    await handle.close();
  }
}

async function createProposalFileExclusive(
  path: string,
  markdown: string,
  runtime: ProposalCreateRuntime = {},
): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${basename(path)}.${randomUUID()}.tmp`);
  const removeTemporary = runtime.removeTemporary ?? ((temporaryPath: string) => rm(temporaryPath, { force: true }));
  try {
    await (runtime.writeTemporary ?? writeExclusiveProposalTemporary)(temporary, markdown);
    await runtime.beforePublish?.(temporary, path);
    try {
      await (runtime.link ?? link)(temporary, path);
    } catch (error: unknown) {
      const code = fsErrorCode(error);
      if (code === "EEXIST") {
        throw new ProposalFormatError([`Proposal already exists: ${path}`]);
      }
      if (code && UNSUPPORTED_EXCLUSIVE_PUBLICATION_CODES.has(code)) {
        throw new ProposalFormatError([
          `Exclusive proposal publication is not supported on this filesystem (${code}): ${path}. `
          + "Refusing to publish without an existing-target guarantee.",
        ]);
      }
      throw error;
    }
  } catch (error: unknown) {
    await removeTemporary(temporary).catch(() => undefined);
    throw error;
  }
  try {
    await removeTemporary(temporary);
  } catch (error: unknown) {
    throw new ProposalFormatError([
      `Proposal was published at ${path} but temporary file ${temporary} could not be removed `
      + `(${fsErrorCode(error) ?? "unknown error"}); remove it manually.`,
    ]);
  }
}

export async function createProposal(
  rootDirectory: string,
  docsDirectory: string,
  input: ProposalCreateInput,
  runtime: ProposalCreateRuntime = {},
): Promise<ProposalItem> {
  const title = input.title.trim();
  if (title.length === 0 || title.length > 200) {
    throw new ProposalFormatError(["Title must contain 1-200 characters."]);
  }
  const slug = normalizeProposalSlug(input.slug?.trim() || slugifyProposalTitle(title));
  const kind = input.kind ?? "idea";
  if (!(PROPOSAL_KINDS as readonly string[]).includes(kind)) {
    throw new ProposalFormatError([`Kind must be one of: ${PROPOSAL_KINDS.join(", ")}.`]);
  }
  const canonical = input.canonical?.trim();
  if (canonical !== undefined) {
    const issue = repositoryRelativePathIssue(canonical, "file");
    if (issue) throw new ProposalFormatError([`Canonical destination: ${issue}.`]);
  }
  const backlog = input.backlog?.trim();
  if (backlog !== undefined && !SLUG_PATTERN.test(backlog)) {
    throw new ProposalFormatError(["Backlog must name a valid backlog slug."]);
  }
  const item: ProposalItem = {
    slug,
    path: proposalRelativePath(docsDirectory, slug),
    id: randomUUID(),
    title,
    kind,
    status: "proposed",
    created: input.created ?? new Date().toISOString(),
    ...(canonical !== undefined ? { canonical } : {}),
    ...(backlog !== undefined ? { backlog } : {}),
    related: (input.related ?? []).map((entry) => entry.trim()).filter(Boolean),
    summary: input.summary?.trim() || "Not recorded yet.",
    ...(input.context?.trim() ? { context: input.context.trim() } : {}),
    ...(input.observations?.trim() ? { observations: input.observations.trim() } : {}),
    ...(input.hypotheses?.trim() ? { hypotheses: input.hypotheses.trim() } : {}),
    ...(input.direction?.trim() ? { direction: input.direction.trim() } : {}),
    ...(input.evidence?.trim() ? { evidence: input.evidence.trim() } : {}),
    ...(input.openQuestions?.trim() ? { openQuestions: input.openQuestions.trim() } : {}),
    ...(input.relatedWork?.trim() ? { relatedWork: input.relatedWork.trim() } : {}),
    decisions: [],
  };
  const markdown = renderProposalMarkdown(item);
  parseProposalMarkdown(markdown, slug, item.path);

  await assertProposalStorageSafe(rootDirectory, docsDirectory);
  await resolveContainedRepositoryPath(rootDirectory, item.path, "file");
  await createProposalFileExclusive(
    join(rootDirectory, proposalDirectoryRelative(docsDirectory), `${slug}.md`),
    markdown,
    runtime,
  );
  return item;
}

export async function readProposalSnapshot(
  rootDirectory: string,
  docsDirectory: string,
  slug: string,
): Promise<ProposalSnapshot> {
  const normalized = normalizeProposalSlug(slug);
  await assertProposalStorageSafe(rootDirectory, docsDirectory);
  const path = join(rootDirectory, proposalDirectoryRelative(docsDirectory), `${normalized}.md`);
  const displayPath = proposalRelativePath(docsDirectory, normalized);
  const content = await readBoundedProposal(path, displayPath);
  return {
    proposal: parseProposalMarkdown(content, normalized, displayPath),
    content,
    revision: proposalRevision(content),
  };
}

export async function readProposalItem(
  rootDirectory: string,
  docsDirectory: string,
  slug: string,
): Promise<ProposalItem> {
  return (await readProposalSnapshot(rootDirectory, docsDirectory, slug)).proposal;
}

export async function listProposals(
  rootDirectory: string,
  docsDirectory: string,
): Promise<ProposalListResult> {
  await assertProposalStorageSafe(rootDirectory, docsDirectory);
  const directory = join(rootDirectory, proposalDirectoryRelative(docsDirectory));
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isMissingFileError(error)) return { items: [], diagnostics: [] };
    throw error;
  }

  const diagnostics: string[] = [];
  const items: ProposalItem[] = [];
  let inspected = 0;
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.name.endsWith(".md")) continue;
    if (inspected >= PROPOSAL_LIMITS.proposals) {
      diagnostics.push(`Proposal inventory exceeds the ${PROPOSAL_LIMITS.proposals} entry limit; remaining files were not inspected.`);
      break;
    }
    inspected += 1;
    const slug = entry.name.slice(0, -3);
    try {
      items.push(await readProposalItem(rootDirectory, docsDirectory, slug));
    } catch (error: unknown) {
      diagnostics.push(`${proposalRelativePath(docsDirectory, slug)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { items, diagnostics };
}

export async function validateProposals(
  rootDirectory: string,
  docsDirectory: string,
): Promise<ProposalListResult> {
  const listed = await listProposals(rootDirectory, docsDirectory);
  const diagnostics = [...listed.diagnostics];
  const ids = new Map<string, string[]>();
  for (const item of listed.items) {
    const paths = ids.get(item.id) ?? [];
    paths.push(item.path);
    ids.set(item.id, paths);
  }
  for (const [id, paths] of ids) {
    if (paths.length > 1) diagnostics.push(`Proposal-Id ${id} is duplicated: ${paths.join(", ")}`);
  }
  const known = new Set(listed.items.map((item) => item.id));
  for (const item of listed.items) {
    if (item.supersededBy !== undefined && !known.has(item.supersededBy)) {
      diagnostics.push(`${item.path}: Superseded-By ${item.supersededBy} does not match an existing proposal.`);
    }
    for (const decision of item.decisions) {
      if (decision.successor !== undefined && !known.has(decision.successor)) {
        diagnostics.push(`${item.path}: decision successor ${decision.successor} does not match an existing proposal.`);
      }
    }
  }
  return { items: listed.items, diagnostics };
}

export async function findProposal(
  rootDirectory: string,
  docsDirectory: string,
  idOrSlug: string,
): Promise<ProposalSnapshot | undefined> {
  const value = idOrSlug.trim();
  if (value.length === 0) return undefined;
  const slugLike = SLUG_PATTERN.test(value)
    && !/^\d+$/.test(value)
    && !/^\d{4,}(?:-|$)/.test(value);
  let bySlug: ProposalSnapshot | undefined;
  if (slugLike) {
    try {
      bySlug = await readProposalSnapshot(rootDirectory, docsDirectory, value);
    } catch (error: unknown) {
      if (!isMissingFileError(error)) throw error;
    }
  }

  const listed = await listProposals(rootDirectory, docsDirectory);
  const idMatches = listed.items.filter((item) => item.id === value);
  if (idMatches.length > 1) {
    throw new ProposalFormatError([`Proposal-Id ${value} is ambiguous: ${idMatches.map((item) => item.path).join(", ")}`]);
  }
  const byId = idMatches[0];
  if (bySlug && byId && bySlug.proposal.slug !== byId.slug) {
    throw new ProposalFormatError([
      `Proposal identifier ${value} is ambiguous: it names slug ${bySlug.proposal.slug} and Proposal-Id ${byId.path}. `
      + "Use the full stable id or rename one proposal.",
    ]);
  }
  if (bySlug) return bySlug;
  if (!byId) return undefined;
  return readProposalSnapshot(rootDirectory, docsDirectory, byId.slug);
}

export interface ProposalTransitionInput {
  rootDirectory: string;
  docsDirectory: string;
  idOrSlug: string;
  decision: ProposalDecisionKind;
  actor: string;
  reason: string;
  expectedRevision?: string;
  successor?: string;
}

function assertTransitionAllowed(item: ProposalItem, decision: ProposalDecisionKind, successor?: string): void {
  if (decision === "accepted" || decision === "rejected") {
    if (item.status !== "proposed") {
      throw new ProposalFormatError([
        `Proposal ${item.slug} is ${item.status}; only a proposed proposal can be ${decision}.`,
      ]);
    }
    if (successor !== undefined) {
      throw new ProposalFormatError(["A successor is only valid for a supersede decision."]);
    }
    return;
  }
  if (item.status !== "proposed" && item.status !== "accepted") {
    throw new ProposalFormatError([
      `Proposal ${item.slug} is ${item.status}; only a proposed or accepted proposal can be superseded.`,
    ]);
  }
  if (!successor || !ID_PATTERN.test(successor)) {
    throw new ProposalFormatError(["Supersede requires --by with a successor proposal id."]);
  }
  if (successor === item.id) {
    throw new ProposalFormatError(["A proposal cannot supersede itself."]);
  }
}

async function withProposalMutationLock<T>(
  rootDirectory: string,
  docsDirectory: string,
  slug: string,
  command: string,
  run: () => Promise<T>,
): Promise<T> {
  const rootReal = await realpath(rootDirectory);
  const lockDirectory = join(tmpdir(), "apk-proposal-locks");
  await mkdir(lockDirectory, { recursive: true });
  const key = createHash("sha256")
    .update(`${rootReal}\0${proposalDirectoryRelative(docsDirectory)}\0${slug}`, "utf8")
    .digest("hex");
  const { withLocalMutationLock } = await import("../tasks/lock.js");
  return withLocalMutationLock({
    path: join(lockDirectory, `${key}.lock`),
    kind: "proposal-mutation",
    command,
    timeoutMs: 10_000,
  }, run);
}

export async function transitionProposal(input: ProposalTransitionInput): Promise<ProposalSnapshot> {
  const actor = input.actor.trim();
  if (!ACTOR_PATTERN.test(actor)) {
    throw new ProposalFormatError(["Actor must be a compact operator identifier."]);
  }
  const reason = input.reason.trim();
  if (reason.length === 0 || reason.length > PROPOSAL_LIMITS.decisionReasonCharacters) {
    throw new ProposalFormatError([
      `Reason must contain 1-${PROPOSAL_LIMITS.decisionReasonCharacters} characters.`,
    ]);
  }
  const initial = await findProposal(input.rootDirectory, input.docsDirectory, input.idOrSlug);
  if (!initial) {
    throw new ProposalFormatError([`Proposal not found: ${input.idOrSlug}`]);
  }

  return withProposalMutationLock(
    input.rootDirectory,
    input.docsDirectory,
    initial.proposal.slug,
    `proposal ${input.decision}`,
    async () => {
      const current = await findProposal(
        input.rootDirectory,
        input.docsDirectory,
        initial.proposal.id,
      );
      if (!current) {
        throw new ProposalFormatError([`Proposal not found: ${input.idOrSlug}`]);
      }
      if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
        throw new ProposalFormatError([
          `Proposal revision changed: expected ${input.expectedRevision}, found ${current.revision}. Re-read the proposal and retry.`,
        ]);
      }

      let successorId: string | undefined;
      if (input.decision === "superseded") {
        if (!input.successor) {
          throw new ProposalFormatError(["Supersede requires --by with a successor proposal id."]);
        }
        const successor = await findProposal(input.rootDirectory, input.docsDirectory, input.successor);
        if (!successor) {
          throw new ProposalFormatError([`Successor proposal not found: ${input.successor}`]);
        }
        successorId = successor.proposal.id;
      }
      assertTransitionAllowed(current.proposal, input.decision, successorId);

      const now = new Date().toISOString();
      const next: ProposalItem = {
        ...current.proposal,
        status: input.decision === "accepted" ? "accepted" : input.decision === "rejected" ? "rejected" : "superseded",
        updated: now,
        ...(input.decision === "superseded" ? { supersededBy: successorId } : {}),
        decisions: [
          ...current.proposal.decisions,
          {
            time: now,
            decision: input.decision,
            actor,
            revision: current.revision,
            reason,
            ...(successorId !== undefined ? { successor: successorId } : {}),
          },
        ],
      };
      const markdown = renderProposalMarkdown(next);
      parseProposalMarkdown(markdown, next.slug, next.path);

      await assertProposalStorageSafe(input.rootDirectory, input.docsDirectory);
      const path = join(input.rootDirectory, proposalDirectoryRelative(input.docsDirectory), `${next.slug}.md`);
      const displayPath = proposalRelativePath(input.docsDirectory, next.slug);
      const fresh = await readBoundedProposal(path, displayPath);
      if (proposalRevision(fresh) !== current.revision) {
        throw new ProposalFormatError([
          `Proposal ${next.slug} changed while the decision was being prepared; re-read it and retry.`,
        ]);
      }

      const temporary = join(
        input.rootDirectory,
        proposalDirectoryRelative(input.docsDirectory),
        `.${next.slug}.${randomUUID()}.tmp`,
      );
      try {
        await writeFile(temporary, markdown, { encoding: "utf8", flag: "wx" });
        await rename(temporary, path);
      } catch (error: unknown) {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }

      return {
        proposal: parseProposalMarkdown(markdown, next.slug, next.path),
        content: markdown,
        revision: proposalRevision(markdown),
      };
    },
  );
}

const REFERENCE_FILE_LIMIT = 1024 * 1024;

export interface ProposalLinkInput {
  rootDirectory: string;
  docsDirectory: string;
  taskDirectory: string;
  idOrSlug: string;
  canonical?: string;
  backlog?: string;
  expectedRevision?: string;
}

async function readReferenceFile(rootDirectory: string, relativePath: string): Promise<string> {
  await resolveContainedRepositoryPath(rootDirectory, relativePath, "file");
  const absolute = join(rootDirectory, relativePath);
  const info = await lstat(absolute);
  if (info.size > REFERENCE_FILE_LIMIT) {
    throw new ProposalFormatError([`Reference file exceeds the ${REFERENCE_FILE_LIMIT} byte limit: ${relativePath}`]);
  }
  const buffer = await readFile(absolute);
  if (buffer.byteLength > REFERENCE_FILE_LIMIT) {
    throw new ProposalFormatError([`Reference file exceeds the ${REFERENCE_FILE_LIMIT} byte limit: ${relativePath}`]);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new ProposalFormatError([`Reference file is not valid UTF-8: ${relativePath}`]);
  }
}

function containsProposalReference(content: string, item: ProposalItem, docsDirectory: string): boolean {
  return content.includes(item.id)
    || content.includes(proposalRelativePath(docsDirectory, item.slug))
    || content.includes(`proposals/${item.slug}.md`);
}

export async function linkProposal(input: ProposalLinkInput): Promise<ProposalSnapshot> {
  const canonical = input.canonical?.trim();
  const backlog = input.backlog?.trim();
  if (canonical === undefined && backlog === undefined) {
    throw new ProposalFormatError(["Provide --canonical or --backlog."]);
  }
  if (canonical !== undefined) {
    const issue = repositoryRelativePathIssue(canonical, "file");
    if (issue) throw new ProposalFormatError([`Canonical destination: ${issue}.`]);
  }
  if (backlog !== undefined && !SLUG_PATTERN.test(backlog)) {
    throw new ProposalFormatError(["Backlog must name a valid backlog slug."]);
  }
  const taskIssue = repositoryRelativePathIssue(input.taskDirectory, "directory");
  if (taskIssue) throw new ProposalFormatError([`taskDirectory: ${taskIssue}.`]);

  const initial = await findProposal(input.rootDirectory, input.docsDirectory, input.idOrSlug);
  if (!initial) throw new ProposalFormatError([`Proposal not found: ${input.idOrSlug}`]);

  return withProposalMutationLock(
    input.rootDirectory,
    input.docsDirectory,
    initial.proposal.slug,
    "proposal link",
    async () => {
      const current = await findProposal(input.rootDirectory, input.docsDirectory, initial.proposal.id);
      if (!current) throw new ProposalFormatError([`Proposal not found: ${input.idOrSlug}`]);
      if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
        throw new ProposalFormatError([
          `Proposal revision changed: expected ${input.expectedRevision}, found ${current.revision}. Re-read the proposal and retry.`,
        ]);
      }

      if (canonical !== undefined) {
        const content = await readReferenceFile(input.rootDirectory, canonical);
        if (!containsProposalReference(content, current.proposal, input.docsDirectory)) {
          throw new ProposalFormatError([
            `Canonical destination ${canonical} does not contain a verifiable reference to proposal ${current.proposal.id} or proposals/${current.proposal.slug}.md.`,
          ]);
        }
      }
      if (backlog !== undefined) {
        const normalizedTaskDirectory = input.taskDirectory.replaceAll("\\", "/").replace(/\/+$/, "");
        const backlogPath = `${normalizedTaskDirectory}/backlog/${backlog}.md`;
        const content = await readReferenceFile(input.rootDirectory, backlogPath);
        if (!containsProposalReference(content, current.proposal, input.docsDirectory)) {
          throw new ProposalFormatError([
            `Backlog card ${backlogPath} does not contain a verifiable reference to proposal ${current.proposal.id} or proposals/${current.proposal.slug}.md.`,
          ]);
        }
      }

      const next: ProposalItem = {
        ...current.proposal,
        updated: new Date().toISOString(),
        ...(canonical !== undefined ? { canonical } : {}),
        ...(backlog !== undefined ? { backlog } : {}),
      };
      const markdown = renderProposalMarkdown(next);
      parseProposalMarkdown(markdown, next.slug, next.path);

      await assertProposalStorageSafe(input.rootDirectory, input.docsDirectory);
      const path = join(input.rootDirectory, proposalDirectoryRelative(input.docsDirectory), `${next.slug}.md`);
      const displayPath = proposalRelativePath(input.docsDirectory, next.slug);
      const fresh = await readBoundedProposal(path, displayPath);
      if (proposalRevision(fresh) !== current.revision) {
        throw new ProposalFormatError([
          `Proposal ${next.slug} changed while the link was being prepared; re-read it and retry.`,
        ]);
      }
      const temporary = join(
        input.rootDirectory,
        proposalDirectoryRelative(input.docsDirectory),
        `.${next.slug}.${randomUUID()}.tmp`,
      );
      try {
        await writeFile(temporary, markdown, { encoding: "utf8", flag: "wx" });
        await rename(temporary, path);
      } catch (error: unknown) {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }
      return {
        proposal: parseProposalMarkdown(markdown, next.slug, next.path),
        content: markdown,
        revision: proposalRevision(markdown),
      };
    },
  );
}
