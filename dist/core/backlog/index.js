import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
export const BACKLOG_STATUSES = ["idea", "deferred", "promoted", "discarded"];
export const BACKLOG_LIMITS = {
    bytesPerCard: 64 * 1024,
    cards: 1024,
    sectionCharacters: 32 * 1024,
    criteria: 64,
    references: 64,
    lineCharacters: 4096,
    slugCharacters: 80,
};
const BACKLOG_SECTIONS = [
    "Motivation",
    "Why not now",
    "Promotion criteria",
    "Proposed outcome",
    "References",
];
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export class BacklogFormatError extends Error {
    issues;
    constructor(issues) {
        super(`Invalid backlog card:\n- ${issues.join("\n- ")}`);
        this.name = "BacklogFormatError";
        this.issues = issues;
    }
}
function bounded(issues, condition, message) {
    if (!condition)
        issues.push(message);
}
function sectionText(lines) {
    return lines.join("\n").trim();
}
function parseCriteria(lines, issues) {
    const criteria = [];
    const seen = new Set();
    for (const line of lines) {
        if (line.trim() === "")
            continue;
        const match = /^- ([a-z0-9][a-z0-9-]{0,63}): (.+)$/.exec(line);
        if (!match) {
            issues.push(`Promotion criteria entry must use "- <criterion-id>: <text>": ${line.slice(0, 160)}`);
            continue;
        }
        const id = match[1];
        const text = match[2].trim();
        if (seen.has(id))
            issues.push(`Duplicate promotion criterion id: ${id}`);
        seen.add(id);
        if (text.length === 0)
            issues.push(`Promotion criterion ${id} has no text.`);
        criteria.push({ id, text });
        if (criteria.length > BACKLOG_LIMITS.criteria) {
            issues.push(`Promotion criteria exceed the ${BACKLOG_LIMITS.criteria} item limit.`);
            break;
        }
    }
    return criteria;
}
function parseReferences(lines, issues) {
    const references = [];
    for (const line of lines) {
        if (line.trim() === "")
            continue;
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
export function parseBacklogMarkdown(markdown, slug, path = slug) {
    if (Buffer.byteLength(markdown, "utf8") > BACKLOG_LIMITS.bytesPerCard) {
        throw new BacklogFormatError([`Card exceeds the ${BACKLOG_LIMITS.bytesPerCard} byte limit.`]);
    }
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const issues = [];
    let index = 0;
    while (index < lines.length && lines[index].trim() === "")
        index += 1;
    const titleMatch = /^# (.+)$/.exec(lines[index] ?? "");
    if (!titleMatch) {
        throw new BacklogFormatError(["Card must start with a single '# <title>' heading."]);
    }
    const title = titleMatch[1].trim();
    bounded(issues, title.length > 0 && title.length <= 200, "Title must contain 1-200 characters.");
    index += 1;
    const metadata = new Map();
    while (index < lines.length && !lines[index].startsWith("## ")) {
        const line = lines[index];
        index += 1;
        if (line.trim() === "")
            continue;
        const match = /^(Backlog-Id|Status|Priority):[ \t]*(.*)$/.exec(line);
        if (!match) {
            issues.push(`Unexpected metadata line: ${line.slice(0, 160)}`);
            continue;
        }
        const key = match[1];
        const value = match[2].trim();
        if (metadata.has(key))
            issues.push(`Duplicate metadata field: ${key}`);
        metadata.set(key, value);
    }
    const sections = new Map();
    let current;
    for (; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.startsWith("## ")) {
            const name = line.slice(3).trim();
            if (!BACKLOG_SECTIONS.includes(name)) {
                issues.push(`Unknown backlog section: ${name}`);
                current = undefined;
                continue;
            }
            if (sections.has(name))
                issues.push(`Duplicate backlog section: ${name}`);
            current = name;
            sections.set(current, []);
            continue;
        }
        if (current)
            sections.get(current).push(line);
    }
    for (const required of ["Motivation", "Why not now", "Promotion criteria", "Proposed outcome"]) {
        if (!sections.has(required))
            issues.push(`Missing required section: ## ${required}`);
    }
    const id = metadata.get("Backlog-Id") ?? "";
    if (!ID_PATTERN.test(id) || /^\d+$/.test(id)) {
        issues.push("Backlog-Id must be an opaque non-numeric identifier.");
    }
    const status = metadata.get("Status") ?? "";
    if (!BACKLOG_STATUSES.includes(status)) {
        issues.push(`Status must be one of: ${BACKLOG_STATUSES.join(", ")}.`);
    }
    const priority = metadata.get("Priority");
    if (priority !== undefined)
        bounded(issues, priority.length > 0 && priority.length <= 40, "Priority must contain 1-40 characters.");
    const motivation = sectionText(sections.get("Motivation") ?? []);
    const whyNotNow = sectionText(sections.get("Why not now") ?? []);
    const proposedOutcome = sectionText(sections.get("Proposed outcome") ?? []);
    for (const [name, value] of [["Motivation", motivation], ["Why not now", whyNotNow], ["Proposed outcome", proposedOutcome]]) {
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
    if (issues.length > 0)
        throw new BacklogFormatError(issues);
    return {
        slug,
        path,
        id,
        title,
        status: status,
        ...(priority !== undefined ? { priority } : {}),
        motivation,
        whyNotNow,
        promotionCriteria,
        proposedOutcome,
        references,
    };
}
export function renderBacklogMarkdown(item) {
    const lines = [
        `# ${item.title}`,
        "",
        `Backlog-Id: ${item.id}`,
        `Status: ${item.status}`,
        ...(item.priority !== undefined ? [`Priority: ${item.priority}`] : []),
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
export function slugifyBacklogTitle(title) {
    const slug = title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, BACKLOG_LIMITS.slugCharacters)
        .replace(/-+$/g, "");
    if (!slug)
        throw new BacklogFormatError(["Title cannot produce a non-empty slug."]);
    return /^\d{4}(?:-|$)/.test(slug) ? `item-${slug}`.slice(0, BACKLOG_LIMITS.slugCharacters) : slug;
}
export function normalizeBacklogSlug(slug) {
    if (!SLUG_PATTERN.test(slug) || /^\d{4}(?:-|$)/.test(slug)) {
        throw new BacklogFormatError(["Slug must be a lowercase hyphenated filename that does not resemble a numeric task id."]);
    }
    return slug;
}
export function backlogDirectory(rootDirectory, taskDirectory = ".tasks") {
    return join(rootDirectory, taskDirectory, "backlog");
}
export function backlogRelativePath(taskDirectory, slug) {
    return `${taskDirectory.replace(/\/+$/, "")}/backlog/${slug}.md`;
}
async function readBoundedCard(path) {
    const info = await lstat(path);
    if (info.isSymbolicLink())
        throw new BacklogFormatError([`Backlog card must not be a symbolic link: ${path}`]);
    if (!info.isFile())
        throw new BacklogFormatError([`Backlog card must be a regular file: ${path}`]);
    if (info.size > BACKLOG_LIMITS.bytesPerCard) {
        throw new BacklogFormatError([`Backlog card exceeds the ${BACKLOG_LIMITS.bytesPerCard} byte limit: ${path}`]);
    }
    return readFile(path, "utf8");
}
export async function readBacklogItem(rootDirectory, taskDirectory, slug) {
    const normalized = normalizeBacklogSlug(slug);
    const path = join(backlogDirectory(rootDirectory, taskDirectory), `${normalized}.md`);
    const markdown = await readBoundedCard(path);
    return parseBacklogMarkdown(markdown, normalized, backlogRelativePath(taskDirectory, normalized));
}
export async function listBacklogItems(rootDirectory, taskDirectory = ".tasks") {
    const directory = backlogDirectory(rootDirectory, taskDirectory);
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return { items: [], diagnostics: [] };
        }
        throw error;
    }
    const diagnostics = [];
    const items = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (!entry.name.endsWith(".md"))
            continue;
        if (items.length + diagnostics.length >= BACKLOG_LIMITS.cards) {
            diagnostics.push(`Backlog inventory exceeds the ${BACKLOG_LIMITS.cards} entry limit; remaining cards were not inspected.`);
            break;
        }
        const slug = entry.name.slice(0, -3);
        try {
            items.push(await readBacklogItem(rootDirectory, taskDirectory, slug));
        }
        catch (error) {
            diagnostics.push(`${backlogRelativePath(taskDirectory, slug)}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return { items, diagnostics };
}
export async function validateBacklogItems(rootDirectory, taskDirectory = ".tasks") {
    const listed = await listBacklogItems(rootDirectory, taskDirectory);
    const diagnostics = [...listed.diagnostics];
    const ids = new Map();
    for (const item of listed.items) {
        const paths = ids.get(item.id) ?? [];
        paths.push(item.path);
        ids.set(item.id, paths);
    }
    for (const [id, paths] of ids) {
        if (paths.length > 1)
            diagnostics.push(`Backlog-Id ${id} is duplicated: ${paths.join(", ")}`);
    }
    return { items: listed.items, diagnostics };
}
export async function createBacklogItem(rootDirectory, taskDirectory, input) {
    const title = input.title.trim();
    if (title.length === 0 || title.length > 200) {
        throw new BacklogFormatError(["Title must contain 1-200 characters."]);
    }
    const slug = normalizeBacklogSlug(input.slug?.trim() || slugifyBacklogTitle(title));
    const item = {
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
    const directory = backlogDirectory(rootDirectory, taskDirectory);
    await mkdir(directory, { recursive: true });
    try {
        await writeFile(join(directory, `${slug}.md`), markdown, { encoding: "utf8", flag: "wx" });
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
            throw new BacklogFormatError([`Backlog card already exists: ${item.path}`]);
        }
        throw error;
    }
    return item;
}
