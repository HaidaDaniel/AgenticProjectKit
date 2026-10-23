import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CURRENT_CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG, serializeAgenticConfig, } from "../config/index.js";
import { renderTemplateFile } from "../templates/index.js";
import { execFile } from "node:child_process";
const initTemplateDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "minimal-docs");
export const GITIGNORE_PATH = ".gitignore";
/**
 * Canonical APK-owned operational/generated ignore entries. This is an additive
 * contract: it covers only APK runtime state and generated reports, never the
 * host repository's own build output or environment files.
 */
export const APK_OPERATIONAL_IGNORE_ENTRIES = [
    ".tasks/.apk.lock",
    ".agentic/agents.jsonl",
    ".agentic/runs.jsonl",
    ".agentic/agents/*",
    "!.agentic/agents/.gitkeep",
    ".agentic/runs/*",
    "!.agentic/runs/.gitkeep",
    ".agentic/evidence.jsonl",
    ".agentic/task-baselines.jsonl",
    ".agentic/evidence.append.lock",
    ".agentic/reviews/*",
    ".agentic/sessions/*",
    ".agentic/perf/*",
    ".agentic/workspaces/*",
    ".apk-workspaces/",
    "docs/audit-report.md",
    "docs/project-map.md",
];
const TRACKED_OPERATIONAL_SPECS = [
    ".tasks/.apk.lock",
    ".agentic/agents.jsonl",
    ".agentic/runs.jsonl",
    ".agentic/agents",
    ".agentic/runs",
    ".agentic/evidence.jsonl",
    ".agentic/task-baselines.jsonl",
    ".agentic/evidence.append.lock",
    ".agentic/reviews",
    ".agentic/sessions",
    ".agentic/perf",
    ".agentic/workspaces",
    ".apk-workspaces",
    "docs/audit-report.md",
    "docs/project-map.md",
];
function normalizeIgnoreLine(line) {
    return line.replace(/\r$/, "");
}
/**
 * Additively add missing canonical APK ignore entries to existing `.gitignore`
 * content without reformatting, reordering, or removing anything else.
 */
export function renderApkGitignoreUpdate(existing) {
    const entries = [...APK_OPERATIONAL_IGNORE_ENTRIES];
    if (existing === undefined) {
        return {
            content: `${entries.join("\n")}\n`,
            changed: true,
            added: entries,
            skippedEntries: [],
        };
    }
    const existingLines = new Set(existing.split("\n").map(normalizeIgnoreLine));
    const added = entries.filter((entry) => !existingLines.has(entry));
    const skippedEntries = entries.filter((entry) => existingLines.has(entry));
    if (added.length === 0) {
        return { content: existing, changed: false, added: [], skippedEntries };
    }
    const eol = existing.includes("\r\n") ? "\r\n" : "\n";
    let content = existing;
    if (content.length > 0 && !content.endsWith("\n")) {
        content += eol;
    }
    content += `${added.join(eol)}${eol}`;
    return { content, changed: true, added, skippedEntries };
}
async function readOptionalText(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}
export const TRACKED_OPERATIONAL_LIMITS = { entries: 4096, outputBytes: 4 * 1024 * 1024, timeoutMs: 5000, samplePaths: 8, sampleCharacters: 256 };
function operationalCategory(path) {
    if (path === ".agentic/agents.jsonl" || path.startsWith(".agentic/agents/"))
        return "agents";
    if (path === ".agentic/runs.jsonl" || path.startsWith(".agentic/runs/"))
        return "runs";
    if (path === ".agentic/evidence.jsonl")
        return "evidence";
    if (path === ".agentic/task-baselines.jsonl")
        return "baselines";
    if (path.startsWith(".agentic/reviews/"))
        return "reviews";
    if (path.startsWith(".agentic/sessions/"))
        return "sessions";
    if (path === "docs/audit-report.md" || path === "docs/project-map.md")
        return "generated-docs";
    return "other-operational";
}
function operationalGit(rootDirectory, args, input) {
    return new Promise((resolveResult, reject) => {
        const child = execFile("git", args, {
            cwd: rootDirectory, encoding: "buffer", timeout: TRACKED_OPERATIONAL_LIMITS.timeoutMs,
            maxBuffer: TRACKED_OPERATIONAL_LIMITS.outputBytes, windowsHide: true,
            env: { ...process.env, LC_ALL: "C", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1" },
        }, (error, stdout, stderr) => {
            if (error && (typeof error.code !== "number" || error.killed || error.signal)) {
                reject(error);
                return;
            }
            try {
                const decoder = new TextDecoder("utf-8", { fatal: true });
                resolveResult({ code: error && typeof error.code === "number" ? error.code : 0, stdout: decoder.decode(stdout), stderr: decoder.decode(stderr) });
            }
            catch (error) {
                reject(error);
            }
        });
        child.stdin?.on("error", () => { });
        child.stdin?.end(input);
    });
}
async function operationalGitMarker(rootDirectory) {
    let directory = resolve(rootDirectory);
    for (let depth = 0; depth < 64; depth++) {
        try {
            await lstat(join(directory, ".git"));
            return true;
        }
        catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
                throw error;
        }
        const parent = dirname(directory);
        if (parent === directory)
            return false;
        directory = parent;
    }
    throw new Error("Git marker search limit");
}
/** Read only the index and object metadata; never open operational worktree files. */
export async function inspectTrackedApkOperationalArtifacts(rootDirectory) {
    const report = {
        status: "unknown", metric: "indexed blob bytes (symlinks count link text; not worktree bytes)",
        count: null, indexedBytes: null, paths: [], groups: [], limits: TRACKED_OPERATIONAL_LIMITS, diagnostics: [],
    };
    try {
        const repository = await operationalGit(rootDirectory, ["rev-parse", "--is-inside-work-tree"]);
        if (repository.code === 128 && /^fatal: not a git repository \(or any/i.test(repository.stderr) && !(await operationalGitMarker(rootDirectory))) {
            report.status = "not-applicable";
            report.diagnostics = ["Tracked APK operational artifacts: not applicable outside a Git worktree."];
            return report;
        }
        if (repository.code !== 0 || repository.stdout.trim() !== "true" || repository.stderr)
            throw new Error("Git worktree inspection failed");
        const listing = await operationalGit(rootDirectory, ["ls-files", "--stage", "-z", "--", ...TRACKED_OPERATIONAL_SPECS]);
        if (listing.code !== 0 || listing.stderr)
            throw new Error("Git index inspection failed");
        const records = listing.stdout === "" ? [] : listing.stdout.split("\0");
        if (records.length > 0 && records.pop() !== "")
            throw new Error("Incomplete index response");
        if (records.length > TRACKED_OPERATIONAL_LIMITS.entries) {
            report.status = "incomplete";
            report.diagnostics = [`Tracked APK operational inspection incomplete: index entry limit ${TRACKED_OPERATIONAL_LIMITS.entries} exceeded; counts and indexed bytes unknown.`];
            return report;
        }
        const entries = new Map();
        for (const record of records) {
            const match = /^(\d{6}) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])\t([\s\S]+)$/.exec(record);
            if (!match)
                throw new Error("Malformed index response");
            const mode = match[1], oid = match[2], stage = match[3], path = match[4];
            if (path.split("/").at(-1) === ".gitkeep")
                continue;
            entries.set(path, { oid, blob: stage === "0" && ["100644", "100755", "120000"].includes(mode) && !entries.has(path) });
        }
        report.paths = [...entries.keys()].sort();
        report.count = entries.size;
        const oids = [...new Set([...entries.values()].filter((entry) => entry.blob).map((entry) => entry.oid))];
        const sizes = new Map();
        if (oids.length > 0) {
            const batch = await operationalGit(rootDirectory, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], `${oids.join("\n")}\n`);
            if (batch.code !== 0 || batch.stderr) {
                report.diagnostics.push("Indexed object sizes unavailable; counts remain exact for the inspected index.");
            }
            else {
                const lines = batch.stdout.trimEnd().split("\n");
                if (lines.length !== oids.length)
                    throw new Error("Incomplete object metadata response");
                for (const [index, line] of lines.entries()) {
                    const match = /^([0-9a-f]+) blob (\d+)$/.exec(line);
                    if (match && match[1] === oids[index] && Number.isSafeInteger(Number(match[2])))
                        sizes.set(match[1], Number(match[2]));
                }
            }
        }
        for (const category of ["agents", "runs", "evidence", "baselines", "reviews", "sessions", "generated-docs", "other-operational"]) {
            const paths = report.paths.filter((path) => operationalCategory(path) === category);
            if (paths.length === 0)
                continue;
            let bytes = 0;
            for (const path of paths) {
                const entry = entries.get(path);
                const size = entry.blob ? sizes.get(entry.oid) : undefined;
                if (size === undefined || !Number.isSafeInteger(bytes + size)) {
                    bytes = null;
                    break;
                }
                bytes += size;
            }
            report.groups.push({ category, count: paths.length, indexedBytes: bytes,
                sample: paths.slice(0, TRACKED_OPERATIONAL_LIMITS.samplePaths).map((path) => path.length > TRACKED_OPERATIONAL_LIMITS.sampleCharacters ? `${path.slice(0, TRACKED_OPERATIONAL_LIMITS.sampleCharacters - 1)}…` : path),
                omittedPaths: Math.max(0, paths.length - TRACKED_OPERATIONAL_LIMITS.samplePaths),
            });
        }
        const total = report.groups.reduce((sum, group) => sum + (group.indexedBytes ?? 0), 0);
        report.indexedBytes = report.groups.some((group) => group.indexedBytes === null) || !Number.isSafeInteger(total) ? null : total;
        report.status = report.indexedBytes === null ? "incomplete" : "complete";
        if (report.status === "incomplete")
            report.diagnostics.push("Tracked APK operational inspection incomplete: missing/non-blob objects or unmerged entries have unknown indexed bytes; no clean-zero conclusion.");
        return report;
    }
    catch {
        report.status = "unknown";
        report.count = null;
        report.indexedBytes = null;
        report.diagnostics.push("Tracked APK operational inspection unknown: Git unavailable, failed, unreadable, malformed or over the 4 MiB/5 second bound. Absence of artifacts was not established.");
        return report;
    }
}
/** Compatibility path-only view. Use the report for coverage and failure status. */
export async function detectTrackedApkOperationalPaths(rootDirectory) {
    return (await inspectTrackedApkOperationalArtifacts(rootDirectory)).paths;
}
export function renderTrackedApkOperationalReport(report) {
    return [
        `Tracked APK operational artifacts: ${report.status}; count=${report.count ?? "unknown"}; indexed bytes=${report.indexedBytes ?? "unknown"} (${report.metric}).`,
        ...report.groups.map((group) => `${group.category}: count=${group.count}; indexed bytes=${group.indexedBytes ?? "unknown"}; sample=${group.sample.map((path) => JSON.stringify(path)).join(", ")}${group.omittedPaths ? ` (+${group.omittedPaths} paths)` : ""}`),
        ...report.diagnostics,
        ...(report.count !== null && report.count > 0 ? [
            "Tracked APK operational state remains in Git and ignore rules do not untrack it. Inventory and back up needed local evidence; decide which records must remain portable for unfinished work. Check ignore rules; preview exact path-specific git rm --cached commands, review the index and commit deliberately. Untracking does not erase past history. APK never mutates the index or deletes files.",
        ] : []),
    ];
}
export async function ensureApkGitignore(rootDirectory) {
    const { result, content } = await planApkGitignore(rootDirectory);
    if (content !== undefined) {
        await writeFile(join(rootDirectory, GITIGNORE_PATH), content, "utf8");
    }
    return result;
}
/** Read-only preview of the canonical APK ignore state and tracked-state warning. */
export async function inspectApkGitignore(rootDirectory) {
    return (await planApkGitignore(rootDirectory)).result;
}
export async function planApkGitignore(rootDirectory) {
    const existing = await readOptionalText(join(rootDirectory, GITIGNORE_PATH));
    const update = renderApkGitignoreUpdate(existing);
    const action = existing === undefined ? "created" : update.changed ? "updated" : "unchanged";
    const trackedOperational = await inspectTrackedApkOperationalArtifacts(rootDirectory);
    return {
        result: {
            path: GITIGNORE_PATH,
            action,
            added: update.added,
            skippedEntries: update.skippedEntries,
            trackedOperationalPaths: trackedOperational.paths,
            trackedOperational,
            diagnostics: trackedOperational.status === "complete" && trackedOperational.count === 0 ? [] : renderTrackedApkOperationalReport(trackedOperational),
        },
        ...(update.changed ? { content: update.content } : {}),
    };
}
const STARTER_FILES = [
    {
        path: ".agentic/config.json",
        content: serializeAgenticConfig({
            ...DEFAULT_CONFIG,
            schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
        }),
    },
    {
        path: ".agentic/agents/.gitkeep",
        content: "",
    },
    {
        path: ".agentic/runs/.gitkeep",
        content: "",
    },
    {
        path: ".agentic/modes/README.md",
        content: [
            "# Modes",
            "",
            "Mode policy lives here.",
            "",
            "Start with `mvp` unless the project task says otherwise.",
            "",
        ].join("\n"),
    },
    {
        path: ".agentic/policies/base.md",
        content: [
            "# Base Policy",
            "",
            "- Read repository docs before coding.",
            "- Work one task at a time.",
            "- Keep changes small and verifiable.",
            "",
        ].join("\n"),
    },
    {
        path: ".agentic/templates/README.md",
        content: [
            "# Templates",
            "",
            "Reusable project and agent templates live here.",
            "",
        ].join("\n"),
    },
    {
        path: ".agentic/exporters/README.md",
        content: [
            "# Exporters",
            "",
            "Agent-specific export templates live here.",
            "",
        ].join("\n"),
    },
    {
        path: "AGENTS.md",
        content: [
            "# Agent Instructions",
            "",
            "- Treat repository docs and task files as source of truth.",
            "- Read the current task before editing.",
            "- Do not overwrite user work.",
            "- Update progress when task status changes.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/project.md",
        content: [
            "# Project",
            "",
            "Describe the project, users, goals, and durable context here.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/scope.md",
        content: [
            "# Scope",
            "",
            "## Current version",
            "",
            "- Define the smallest useful scope.",
            "",
            "## Non-goals",
            "",
            "- Keep explicit exclusions here.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/architecture.md",
        content: [
            "# Architecture",
            "",
            "Document the main layers, data flow, and important constraints here.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/task-system.md",
        content: [
            "# Task System",
            "",
            "- One task file per unit of work.",
            "- Each task must list context files, allowed files, acceptance criteria, and verification commands.",
            "- Choose checks from this repository's tools and the task's changed behavior; APK does not impose its own quality pipeline.",
            "- Use focused feedback during edits and a non-overlapping final verification set on the committed candidate; coverage already runs its measured tests.",
            "- Documentation-only tasks need applicable contract, link, or example checks rather than unrelated application suites.",
            "- Independent review inspects current trusted evidence and focused counterexamples; rerun broader checks when evidence is stale, failed, missing, or insufficient.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/context-system.md",
        content: [
            "# Context System",
            "",
            "List the minimum files an agent needs before starting each task.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/decisions.md",
        content: [
            "# Decisions",
            "",
            "Record architecture and dependency decisions here.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/progress.md",
        content: [
            "# Progress",
            "",
            "## Current status",
            "",
            "Project kit initialized.",
            "",
            "## Next step",
            "",
            "Create the first task in `.tasks`.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/product/requirements.md",
        templatePath: join(initTemplateDirectory, "product-requirements.md.hbs"),
    },
    {
        path: "docs/engineering/load-profile.md",
        content: [
            "# Load Profile",
            "",
            "## Expected usage",
            "",
            "- Describe expected load patterns.",
            "",
            "## Data growth",
            "",
            "- Estimate data volumes.",
            "",
            "## Performance targets",
            "",
            "- Define latency and throughput goals.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/engineering/tech-options.md",
        content: [
            "# Technology Options",
            "",
            "## Stack decisions",
            "",
            "- Document chosen technologies.",
            "",
            "## Alternatives considered",
            "",
            "- List rejected options and why.",
            "",
        ].join("\n"),
    },
    {
        path: "docs/engineering/risk-register.md",
        content: [
            "# Risk Register",
            "",
            "## Technical risks",
            "",
            "- Identify potential technical issues.",
            "",
            "## Mitigation strategies",
            "",
            "- Describe how to address each risk.",
            "",
        ].join("\n"),
    },
    {
        path: ".tasks/0001-start.md",
        content: [
            "# Task 0001 - Start Project",
            "",
            "State: todo",
            "Owner: none",
            "Mode: mvp",
            "Lane: planning",
            "Scope: product,architecture",
            "Risk: low",
            "Parallel: false",
            "Depends on: none",
            "Tags: start,planning",
            "",
            "## Goal",
            "",
            "Define the first useful implementation task.",
            "",
            "## Context files",
            "",
            "- AGENTS.md",
            "- docs/project.md",
            "- docs/scope.md",
            "- docs/architecture.md",
            "",
            "## Files allowed to edit",
            "",
            "- docs/progress.md",
            "",
            "## Files forbidden to edit",
            "",
            "- application source files",
            "",
            "## Steps",
            "",
            "1. Read the project docs.",
            "2. Define the next implementation task.",
            "3. Update progress when the task is clear.",
            "",
            "## Acceptance criteria",
            "",
            "- The next task is explicit and verifiable.",
            "",
            "## Verification commands",
            "",
            "- echo \"No verification yet\"",
            "",
            "## Documentation updates",
            "",
            "- Update docs/progress.md.",
            "",
            "## Notes",
            "",
            "- Keep the first task small.",
            "",
        ].join("\n"),
    },
];
async function fileExists(path) {
    try {
        await readFile(path);
        return true;
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
}
export function getInitStarterFiles() {
    return STARTER_FILES;
}
export async function initProject(rootDirectory) {
    const created = [];
    const skipped = [];
    const updated = [];
    for (const file of STARTER_FILES) {
        const absolutePath = join(rootDirectory, file.path);
        if (await fileExists(absolutePath)) {
            skipped.push(file.path);
            continue;
        }
        await mkdir(dirname(absolutePath), { recursive: true });
        const content = "templatePath" in file
            ? await renderTemplateFile(file.templatePath)
            : file.content;
        await writeFile(absolutePath, content, "utf8");
        created.push(file.path);
    }
    const gitignore = await ensureApkGitignore(rootDirectory);
    if (gitignore.action === "created") {
        created.push(gitignore.path);
    }
    else if (gitignore.action === "updated") {
        updated.push(gitignore.path);
    }
    return {
        created,
        skipped,
        updated,
        gitignore,
        diagnostics: gitignore.diagnostics,
    };
}
