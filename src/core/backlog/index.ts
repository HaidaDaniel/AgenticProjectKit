import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { slugifyTitle } from "../tasks/index.js";

export const BACKLOG_STATUSES = ["idea", "deferred", "promoted", "discarded"] as const;
export type BacklogStatus = (typeof BACKLOG_STATUSES)[number];

export const BACKLOG_LIMITS = {
  bytesPerCard: 64 * 1024,
  cards: 1024,
  sectionCharacters: 32 * 1024,
  criteria: 64,
  references: 64,
  lineCharacters: 4096,
  slugCharacters: 80,
} as const;

const BACKLOG_SECTIONS = [
  "Motivation",
  "Why not now",
  "Promotion criteria",
  "Proposed outcome",
  "References",
] as const;
type BacklogSection = (typeof BACKLOG_SECTIONS)[number];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface BacklogPromotionCriterion {
  id: string;
  text: string;
}

export interface BacklogItem {
  slug: string;
  path: string;
  id: string;
  title: string;
  status: BacklogStatus;
  priority?: string;
  promotedTask?: string;
  motivation: string;
  whyNotNow: string;
  promotionCriteria: BacklogPromotionCriterion[];
  proposedOutcome: string;
  references: string[];
}

export interface BacklogCreateInput {
  title: string;
  slug?: string;
  status?: BacklogStatus;
  priority?: string;
  motivation?: string;
  whyNotNow?: string;
  criteria?: string[];
  proposedOutcome?: string;
  references?: string[];
}

export interface BacklogListResult {
  items: BacklogItem[];
  diagnostics: string[];
}

export interface BacklogCardSnapshot {
  item: BacklogItem;
  content: string;
  revision: string;
}

export interface BoundedReadHandle {
  stat(): Promise<{
    isFile(): boolean;
    size: number;
    mtimeMs?: number;
    ctimeMs?: number;
    ino?: number;
    dev?: number;
  }>;
  read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number }>;
}

export async function readBoundedFileHandle(
  handle: BoundedReadHandle,
  limit = BACKLOG_LIMITS.bytesPerCard,
): Promise<string> {
  const opened = await handle.stat();
  if (!opened.isFile()) throw new BacklogFormatError(["Backlog card must be a regular file."]);
  if (opened.size > limit) throw new BacklogFormatError([`Backlog card exceeds the ${limit} byte limit.`]);

  const buffer = Buffer.alloc(limit + 1);
  let size = 0;
  while (size < buffer.length) {
    const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
    if (bytesRead === 0) break;
    size += bytesRead;
  }
  if (size > limit) throw new BacklogFormatError([`Backlog card exceeds the ${limit} byte limit.`]);
  if (size !== opened.size) throw new BacklogFormatError(["Backlog card changed while being read (truncated or grown)."]);
  const after = await handle.stat();
  if (!after.isFile()
    || after.size !== opened.size
    || after.mtimeMs !== opened.mtimeMs
    || after.ctimeMs !== opened.ctimeMs
    || after.ino !== opened.ino
    || after.dev !== opened.dev) {
    throw new BacklogFormatError(["Backlog card changed while being read."]);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
  } catch {
    throw new BacklogFormatError(["Backlog card is not valid UTF-8."]);
  }
}

export class BacklogFormatError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid backlog card:\n- ${issues.join("\n- ")}`);
    this.name = "BacklogFormatError";
    this.issues = issues;
  }
}

function bounded(issues: string[], condition: boolean, message: string): void {
  if (!condition) issues.push(message);
}

function sectionText(lines: readonly string[]): string {
  return lines.join("\n").trim();
}

function parseCriteria(lines: readonly string[], issues: string[]): BacklogPromotionCriterion[] {
  const criteria: BacklogPromotionCriterion[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.trim() === "") continue;
    const match = /^- ([a-z0-9][a-z0-9-]{0,63}): (.+)$/.exec(line);
    if (!match) {
      issues.push(`Promotion criteria entry must use "- <criterion-id>: <text>": ${line.slice(0, 160)}`);
      continue;
    }
    const id = match[1]!;
    const text = match[2]!.trim();
    if (seen.has(id)) issues.push(`Duplicate promotion criterion id: ${id}`);
    seen.add(id);
    if (text.length === 0) issues.push(`Promotion criterion ${id} has no text.`);
    criteria.push({ id, text });
    if (criteria.length > BACKLOG_LIMITS.criteria) {
      issues.push(`Promotion criteria exceed the ${BACKLOG_LIMITS.criteria} item limit.`);
      break;
    }
  }
  return criteria;
}

function parseReferences(lines: readonly string[], issues: string[]): string[] {
  const references: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    if (!line.startsWith("- ")) {
      issues.push(`Reference entry must be a single "- " item: ${line.slice(0, 160)}`);
      continue;
    }
    const value = line.slice(2).trim();
    if (value.length === 0) {
      issues.push("Reference entry has no text.");
      continue;
    }
    references.push(value);
    if (references.length > BACKLOG_LIMITS.references) {
      issues.push(`References exceed the ${BACKLOG_LIMITS.references} item limit.`);
      break;
    }
  }
  return references;
}

export function parseBacklogMarkdown(markdown: string, slug: string, path = slug): BacklogItem {
  if (Buffer.byteLength(markdown, "utf8") > BACKLOG_LIMITS.bytesPerCard) {
    throw new BacklogFormatError([`Card exceeds the ${BACKLOG_LIMITS.bytesPerCard} byte limit.`]);
  }
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const issues: string[] = [];
  for (const line of lines) {
    if (line.length > BACKLOG_LIMITS.lineCharacters) {
      issues.push(`Line exceeds the ${BACKLOG_LIMITS.lineCharacters} character limit.`);
      break;
    }
  }
  let index = 0;
  while (index < lines.length && lines[index]!.trim() === "") index += 1;
  const titleMatch = /^# (.+)$/.exec(lines[index] ?? "");
  if (!titleMatch) {
    throw new BacklogFormatError(["Card must start with a single '# <title>' heading."]);
  }
  const title = titleMatch[1]!.trim();
  bounded(issues, title.length > 0 && title.length <= 200, "Title must contain 1-200 characters.");
  index += 1;

  const metadata = new Map<string, string>();
  while (index < lines.length && !lines[index]!.startsWith("## ")) {
    const line = lines[index]!;
    index += 1;
    if (line.trim() === "") continue;
    const match = /^(Backlog-Id|Status|Priority|Promoted-Task):[ \t]*(.*)$/.exec(line);
    if (!match) {
      issues.push(`Unexpected metadata line: ${line.slice(0, 160)}`);
      continue;
    }
    const key = match[1]!;
    const value = match[2]!.trim();
    if (metadata.has(key)) issues.push(`Duplicate metadata field: ${key}`);
    metadata.set(key, value);
  }

  const sections = new Map<BacklogSection, string[]>();
  let current: BacklogSection | undefined;
  for (; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.startsWith("## ")) {
      const name = line.slice(3).trim();
      if (!(BACKLOG_SECTIONS as readonly string[]).includes(name)) {
        issues.push(`Unknown backlog section: ${name}`);
        current = undefined;
        continue;
      }
      if (sections.has(name as BacklogSection)) issues.push(`Duplicate backlog section: ${name}`);
      current = name as BacklogSection;
      sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
  }

  for (const required of ["Motivation", "Why not now", "Promotion criteria", "Proposed outcome"] as const) {
    if (!sections.has(required)) issues.push(`Missing required section: ## ${required}`);
  }

  const id = metadata.get("Backlog-Id") ?? "";
  if (!ID_PATTERN.test(id) || /^\d+$/.test(id)) {
    issues.push("Backlog-Id must be an opaque non-numeric identifier.");
  }
  const status = metadata.get("Status") ?? "";
  if (!(BACKLOG_STATUSES as readonly string[]).includes(status)) {
    issues.push(`Status must be one of: ${BACKLOG_STATUSES.join(", ")}.`);
  }
  const priority = metadata.get("Priority");
  if (priority !== undefined) bounded(issues, priority.length > 0 && priority.length <= 40, "Priority must contain 1-40 characters.");
  const promotedTask = metadata.get("Promoted-Task");
  if (promotedTask !== undefined) {
    bounded(issues, /^\d{4}$/.test(promotedTask), "Promoted-Task must be a four-digit task id.");
    bounded(issues, status === "promoted", "Promoted-Task is only valid for a promoted card.");
  } else {
    bounded(issues, status !== "promoted", "Promoted cards require a Promoted-Task id.");
  }

  const motivation = sectionText(sections.get("Motivation") ?? []);
  const whyNotNow = sectionText(sections.get("Why not now") ?? []);
  const proposedOutcome = sectionText(sections.get("Proposed outcome") ?? []);
  for (const [name, value] of [["Motivation", motivation], ["Why not now", whyNotNow], ["Proposed outcome", proposedOutcome]] as const) {
    bounded(issues, value.length <= BACKLOG_LIMITS.sectionCharacters, `${name} exceeds the ${BACKLOG_LIMITS.sectionCharacters} character limit.`);
  }
  const promotionCriteria = parseCriteria(sections.get("Promotion criteria") ?? [], issues);
  const references = parseReferences(sections.get("References") ?? [], issues);

  if (!SLUG_PATTERN.test(slug) || /^\d{4}(?:-|$)/.test(slug)) {
    issues.push("Slug must be a lowercase hyphenated filename that does not resemble a numeric task id.");
  }
  if ((status === "deferred" || status === "promoted") && promotionCriteria.length === 0) {
    issues.push("Deferred and promoted cards require at least one promotion criterion.");
  }

  if (issues.length > 0) throw new BacklogFormatError(issues);
  return {
    slug,
    path,
    id,
    title,
    status: status as BacklogStatus,
    ...(priority !== undefined ? { priority } : {}),
    ...(promotedTask !== undefined ? { promotedTask } : {}),
    motivation,
    whyNotNow,
    promotionCriteria,
    proposedOutcome,
    references,
  };
}

export function renderBacklogMarkdown(item: BacklogItem): string {
  const lines = [
    `# ${item.title}`,
    "",
    `Backlog-Id: ${item.id}`,
    `Status: ${item.status}`,
    ...(item.priority !== undefined ? [`Priority: ${item.priority}`] : []),
    ...(item.promotedTask !== undefined ? [`Promoted-Task: ${item.promotedTask}`] : []),
    "",
    "## Motivation",
    "",
    item.motivation,
    "",
    "## Why not now",
    "",
    item.whyNotNow,
    "",
    "## Promotion criteria",
    "",
    ...item.promotionCriteria.map((criterion) => `- ${criterion.id}: ${criterion.text}`),
    "",
    "## Proposed outcome",
    "",
    item.proposedOutcome,
    "",
    "## References",
    "",
    ...item.references.map((reference) => `- ${reference}`),
    "",
  ];
  return lines.join("\n");
}

export function slugifyBacklogTitle(title: string): string {
  const slug = slugifyTitle(title).slice(0, BACKLOG_LIMITS.slugCharacters).replace(/-+$/g, "");
  if (!slug) throw new BacklogFormatError(["Title cannot produce a non-empty slug."]);
  return /^\d{4}(?:-|$)/.test(slug) ? `item-${slug}`.slice(0, BACKLOG_LIMITS.slugCharacters) : slug;
}

export function normalizeBacklogSlug(slug: string): string {
  if (!SLUG_PATTERN.test(slug) || /^\d{4}(?:-|$)/.test(slug)) {
    throw new BacklogFormatError(["Slug must be a lowercase hyphenated filename that does not resemble a numeric task id."]);
  }
  return slug;
}

export function backlogDirectory(rootDirectory: string, taskDirectory = ".tasks"): string {
  return join(rootDirectory, taskDirectory, "backlog");
}

export function backlogRelativePath(taskDirectory: string, slug: string): string {
  return `${taskDirectory.replace(/\/+$/, "")}/backlog/${slug}.md`;
}

async function lstatOptional(path: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(path);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function assertBacklogDirectorySafe(rootDirectory: string, taskDirectory: string): Promise<void> {
  const normalized = taskDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/");
  if (isAbsolute(normalized) || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new BacklogFormatError([`Task directory must be a repository-relative path without dot segments: ${taskDirectory}`]);
  }
  let current = rootDirectory;
  for (const segment of segments) {
    current = join(current, segment);
    const info = await lstatOptional(current);
    if (info?.isSymbolicLink()) {
      throw new BacklogFormatError([`Task directory must not contain a symbolic link: ${taskDirectory}`]);
    }
    if (info && !info.isDirectory()) {
      throw new BacklogFormatError([`Task directory component is not a directory: ${taskDirectory}`]);
    }
  }
  const directory = join(current, "backlog");
  const info = await lstatOptional(directory);
  if (info?.isSymbolicLink()) {
    throw new BacklogFormatError([`Backlog directory must not be a symbolic link: ${taskDirectory}/backlog`]);
  }
  if (info && !info.isDirectory()) {
    throw new BacklogFormatError([`Backlog path is not a directory: ${taskDirectory}/backlog`]);
  }
}

async function readBoundedCard(path: string): Promise<string> {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new BacklogFormatError([`Backlog card must not be a symbolic link: ${path}`]);
  if (!info.isFile()) throw new BacklogFormatError([`Backlog card must be a regular file: ${path}`]);
  if (info.size > BACKLOG_LIMITS.bytesPerCard) {
    throw new BacklogFormatError([`Backlog card exceeds the ${BACKLOG_LIMITS.bytesPerCard} byte limit: ${path}`]);
  }

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP") {
      throw new BacklogFormatError([`Backlog card must not be a symbolic link: ${path}`]);
    }
    throw error;
  }
  try {
    return await readBoundedFileHandle(handle);
  } catch (error: unknown) {
    if (error instanceof BacklogFormatError) {
      throw new BacklogFormatError(error.issues.map((issue) => `${issue.replace(/\.$/, "")}: ${path}`));
    }
    throw error;
  } finally {
    await handle.close();
  }
}

export async function readBacklogCardSnapshot(
  rootDirectory: string,
  taskDirectory: string,
  slug: string,
): Promise<BacklogCardSnapshot> {
  const normalized = normalizeBacklogSlug(slug);
  await assertBacklogDirectorySafe(rootDirectory, taskDirectory);
  const path = join(backlogDirectory(rootDirectory, taskDirectory), `${normalized}.md`);
  const content = await readBoundedCard(path);
  return {
    item: parseBacklogMarkdown(content, normalized, backlogRelativePath(taskDirectory, normalized)),
    content,
    revision: createHash("sha256").update(content, "utf8").digest("hex"),
  };
}

export async function readBacklogItem(
  rootDirectory: string,
  taskDirectory: string,
  slug: string,
): Promise<BacklogItem> {
  return (await readBacklogCardSnapshot(rootDirectory, taskDirectory, slug)).item;
}

export async function listBacklogItems(
  rootDirectory: string,
  taskDirectory = ".tasks",
): Promise<BacklogListResult> {
  await assertBacklogDirectorySafe(rootDirectory, taskDirectory);
  const directory = backlogDirectory(rootDirectory, taskDirectory);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { items: [], diagnostics: [] };
    }
    throw error;
  }

  const diagnostics: string[] = [];
  const items: BacklogItem[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.name.endsWith(".md")) continue;
    if (items.length + diagnostics.length >= BACKLOG_LIMITS.cards) {
      diagnostics.push(`Backlog inventory exceeds the ${BACKLOG_LIMITS.cards} entry limit; remaining cards were not inspected.`);
      break;
    }
    const slug = entry.name.slice(0, -3);
    try {
      items.push(await readBacklogItem(rootDirectory, taskDirectory, slug));
    } catch (error: unknown) {
      diagnostics.push(`${backlogRelativePath(taskDirectory, slug)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { items, diagnostics };
}

export async function validateBacklogItems(
  rootDirectory: string,
  taskDirectory = ".tasks",
): Promise<BacklogListResult> {
  const listed = await listBacklogItems(rootDirectory, taskDirectory);
  const diagnostics = [...listed.diagnostics];
  const ids = new Map<string, string[]>();
  for (const item of listed.items) {
    const paths = ids.get(item.id) ?? [];
    paths.push(item.path);
    ids.set(item.id, paths);
  }
  for (const [id, paths] of ids) {
    if (paths.length > 1) diagnostics.push(`Backlog-Id ${id} is duplicated: ${paths.join(", ")}`);
  }
  return { items: listed.items, diagnostics };
}

export async function createBacklogItem(
  rootDirectory: string,
  taskDirectory: string,
  input: BacklogCreateInput,
): Promise<BacklogItem> {
  const title = input.title.trim();
  if (title.length === 0 || title.length > 200) {
    throw new BacklogFormatError(["Title must contain 1-200 characters."]);
  }
  const slug = normalizeBacklogSlug(input.slug?.trim() || slugifyBacklogTitle(title));
  const item: BacklogItem = {
    slug,
    path: backlogRelativePath(taskDirectory, slug),
    id: randomUUID(),
    title,
    status: input.status ?? "idea",
    ...(input.priority?.trim() ? { priority: input.priority.trim() } : {}),
    motivation: input.motivation?.trim() || "Not recorded yet.",
    whyNotNow: input.whyNotNow?.trim() || "Not recorded yet.",
    promotionCriteria: (input.criteria ?? []).map((text, index) => ({
      id: `criterion-${index + 1}`,
      text: text.trim(),
    })).filter((criterion) => criterion.text.length > 0),
    proposedOutcome: input.proposedOutcome?.trim() || "Not recorded yet.",
    references: (input.references ?? []).map((reference) => reference.trim()).filter(Boolean),
  };
  const markdown = renderBacklogMarkdown(item);
  parseBacklogMarkdown(markdown, slug, item.path);

  await assertBacklogDirectorySafe(rootDirectory, taskDirectory);
  const directory = backlogDirectory(rootDirectory, taskDirectory);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(join(directory, `${slug}.md`), markdown, { encoding: "utf8", flag: "wx" });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new BacklogFormatError([`Backlog card already exists: ${item.path}`]);
    }
    throw error;
  }
  return item;
}
