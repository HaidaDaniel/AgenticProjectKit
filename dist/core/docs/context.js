import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
const DEFAULT_DOCS_DIRECTORY = "docs";
const DEFAULT_TASK_DIRECTORY = ".tasks";
function docsPath(docsDirectory, fileName) {
    return `${docsDirectory.replace(/\\/g, "/").replace(/\/$/, "")}/${fileName}`;
}
function normalizePath(path) {
    return path.replace(/\\/g, "/");
}
function level1BaseFiles(docsDirectory) {
    return [
        "AGENTS.md",
        docsPath(docsDirectory, "project.md"),
        docsPath(docsDirectory, "scope.md"),
        docsPath(docsDirectory, "architecture.md"),
    ];
}
function level2BaseFiles(docsDirectory) {
    return [docsPath(docsDirectory, "decisions.md")];
}
function uniqueFiles(files) {
    const seen = new Set();
    const output = [];
    for (const file of files) {
        if (!seen.has(file)) {
            seen.add(file);
            output.push(file);
        }
    }
    return output;
}
function availableFileSet(options) {
    const files = [
        ...(options.availableFiles ?? []),
        ...(options.repositoryScan?.kitDocs.present ?? []),
        ...(options.repositoryScan?.agentExports.present ?? []),
        ...(options.repositoryScan?.taskFiles ?? []),
    ].map(normalizePath);
    return files.length === 0 ? undefined : new Set(files);
}
function includeIfAvailable(files, available) {
    return available ? files.filter((file) => available.has(file)) : [];
}
function taskMetadataTokens(task) {
    return new Set([
        task.mode,
        task.lane,
        ...task.scope,
        ...task.tags,
    ].map((token) => token.toLowerCase()));
}
function metadataDocs(task, docsDirectory) {
    const tokens = taskMetadataTokens(task);
    const docs = [];
    function addWhen(matches, files) {
        if (matches.some((match) => tokens.has(match))) {
            docs.push(...files.map((file) => docsPath(docsDirectory, file)));
        }
    }
    addWhen(["product", "requirements"], [
        "product/requirements.md",
        "product/use-cases.md",
        "product/workflows.md",
    ]);
    addWhen(["adopt", "adoption"], ["adoption-flow.md"]);
    addWhen(["audit", "scanner", "context"], [
        "engineering/scanner-system.md",
        "context-system.md",
    ]);
    addWhen(["sync", "exporters"], ["agent-exporters.md"]);
    addWhen(["cli", "tests", "testing"], ["engineering/testing-strategy.md"]);
    addWhen(["load"], ["engineering/load-profile.md"]);
    addWhen(["tech", "architecture"], [
        "engineering/tech-options.md",
        "engineering/tech-stack.md",
    ]);
    addWhen(["delivery", "production"], [
        "delivery/milestones.md",
        "delivery/risks.md",
    ]);
    return uniqueFiles(docs);
}
function isDocsFile(path, docsDirectory) {
    const normalizedDocsDirectory = docsDirectory.replace(/\\/g, "/").replace(/\/$/, "");
    const normalizedPath = normalizePath(path);
    return normalizedPath === "AGENTS.md" || normalizedPath.startsWith(`${normalizedDocsDirectory}/`);
}
function isOperationalFile(path) {
    const normalized = path.replace(/\\/g, "/");
    return (normalized === ".tasks/.apk.lock" ||
        normalized === ".agentic/agents.jsonl" ||
        normalized === ".agentic/runs.jsonl" ||
        normalized === ".agentic/evidence.jsonl" ||
        normalized === ".agentic/task-baselines.jsonl" ||
        normalized === ".agentic/evidence.append.lock" ||
        normalized.startsWith(".agentic/reviews/") ||
        normalized.startsWith(".agentic/sessions/") ||
        normalized.startsWith(".agentic/agents/") ||
        normalized.startsWith(".agentic/runs/") ||
        normalized.startsWith(".tasks/archive/"));
}
function taskPath(task, taskDirectory) {
    const normalizedTaskDirectory = taskDirectory.replace(/\\/g, "/").replace(/\/$/, "");
    return `${normalizedTaskDirectory}/${task.id}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;
}
function globRegex(pattern) {
    let source = "";
    const normalized = normalizePath(pattern);
    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index];
        const next = normalized[index + 1];
        if (char === "*" && next === "*") {
            source += ".*";
            index += 1;
        }
        else if (char === "*") {
            source += "[^/]*";
        }
        else {
            source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
        }
    }
    return new RegExp(`^${source}$`);
}
function pathMatchesPattern(path, pattern) {
    const normalizedPath = normalizePath(path);
    const normalizedPattern = normalizePath(pattern);
    return normalizedPattern.includes("*")
        ? globRegex(normalizedPattern).test(normalizedPath)
        : normalizedPath === normalizedPattern;
}
function contextSignalTokens(task) {
    return new Set([
        task.title,
        task.goal,
        task.mode,
        task.lane,
        ...task.scope,
        ...task.tags,
    ].join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}
function pathSignalScore(path, task) {
    const tokens = contextSignalTokens(task);
    const lower = path.toLowerCase();
    const filename = basename(lower);
    let score = 0;
    for (const token of tokens) {
        if (filename.includes(token))
            score += 12;
        else if (lower.includes(token))
            score += 5;
    }
    if (/\.(test|spec)\.[a-z]+$/.test(lower))
        score += 5;
    if (lower === "docs/decisions.md")
        score += 35;
    if (lower.startsWith("docs/") && tokens.has("docs"))
        score += 4;
    return score;
}
function addCandidate(candidates, candidate) {
    const path = normalizePath(candidate.path);
    if (isOperationalFile(path))
        return;
    const existing = candidates.get(path);
    if (!existing || candidate.tier === "required" || candidate.score > existing.score) {
        candidates.set(path, { ...candidate, path });
    }
}
function fileUnits(path, options) {
    const normalizedPath = normalizePath(path);
    const size = Object.entries(options.fileSizes ?? {})
        .find(([candidate]) => normalizePath(candidate) === normalizedPath)?.[1];
    if (typeof size === "number" && Number.isFinite(size) && size >= 0) {
        return Math.max(1, Math.ceil(size));
    }
    return Math.max(1, Math.ceil(path.length / 4));
}
function budgetedContext(task, level, options, docsDirectory, taskDirectory) {
    const budget = options.budget;
    if (!Number.isInteger(budget) || budget <= 0) {
        throw new Error("Context budget must be a positive integer.");
    }
    const available = availableFileSet(options) ?? new Set();
    const taskFile = normalizePath(options.taskFile ?? taskPath(task, taskDirectory));
    const required = new Map();
    let order = 0;
    const addRequired = (path, reason) => addCandidate(required, {
        path,
        tier: "required",
        reason,
        score: Number.MAX_SAFE_INTEGER,
        order: order++,
    });
    for (const path of level1BaseFiles(docsDirectory))
        addRequired(path, "base contract");
    addRequired(taskFile, "active task contract");
    if (level >= 2) {
        addRequired(docsPath(docsDirectory, "decisions.md"), "architecture decisions");
        for (const path of metadataDocs(task, docsDirectory)) {
            if (available.has(normalizePath(path)))
                addRequired(path, "metadata-relevant design contract");
        }
    }
    for (const path of task.contextFiles)
        addRequired(path, "explicit task context");
    const changed = new Set((options.changedFiles ?? []).map(normalizePath));
    const dependencies = new Set((options.dependencyFiles ?? []).map(normalizePath));
    const recent = new Set((options.recentFiles ?? []).map(normalizePath));
    const metadata = new Set(metadataDocs(task, docsDirectory).map(normalizePath));
    const relevant = new Map();
    const optional = new Map();
    for (const path of [...available].sort()) {
        if (required.has(path) || isOperationalFile(path))
            continue;
        const allowed = task.allowedFiles.some((pattern) => pathMatchesPattern(path, pattern));
        const changedMatch = changed.has(path);
        const dependencyMatch = dependencies.has(path);
        const recentMatch = recent.has(path);
        const score = pathSignalScore(path, task)
            + (allowed ? 80 : 0)
            + (changedMatch ? 100 : 0)
            + (dependencyMatch ? 90 : 0)
            + (recentMatch ? 40 : 0)
            + (metadata.has(path) ? 30 : 0);
        const reason = changedMatch ? "changed file"
            : dependencyMatch ? "declared dependency"
                : allowed ? "allowed task path"
                    : recentMatch ? "recent relevant file"
                        : metadata.has(path) ? "metadata-relevant design contract"
                            : "lexical task/path signal";
        const candidate = {
            path,
            tier: score > 0 ? "relevant" : "optional",
            reason,
            score,
            order: order++,
        };
        (candidate.tier === "relevant" ? relevant : optional).set(path, candidate);
    }
    const sortCandidates = (candidates) => [...candidates].sort((left, right) => right.score - left.score || left.order - right.order || left.path.localeCompare(right.path));
    const selected = [];
    let estimatedUnits = 0;
    for (const candidate of required.values()) {
        const units = fileUnits(candidate.path, options);
        selected.push({ path: candidate.path, tier: candidate.tier, units, reason: candidate.reason });
        estimatedUnits += units;
    }
    const diagnostics = [];
    if (estimatedUnits > budget) {
        diagnostics.push({
            code: "required-over-budget",
            message: `Required context uses ${estimatedUnits} units, exceeding budget ${budget}; no required file was dropped.`,
            requiredUnits: estimatedUnits,
            budget,
        });
    }
    else {
        for (const candidate of [...sortCandidates(relevant.values()), ...sortCandidates(optional.values())]) {
            const units = fileUnits(candidate.path, options);
            if (estimatedUnits + units > budget)
                continue;
            selected.push({ path: candidate.path, tier: candidate.tier, units, reason: candidate.reason });
            estimatedUnits += units;
        }
    }
    return {
        taskId: task.id,
        level,
        files: selected.map((entry) => entry.path),
        budget,
        estimatedUnits,
        entries: selected,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
        ...(options.includeModeGuidance ? { modeGuidance: modeGuidanceFor(task.mode) } : {}),
    };
}
const CONTEXT_IGNORED_DIRECTORIES = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".cache",
    "coverage",
]);
async function listRepositoryFiles(rootDirectory, relativeDirectory = "") {
    const directory = join(rootDirectory, relativeDirectory);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    const files = [];
    for (const entry of entries) {
        const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (!CONTEXT_IGNORED_DIRECTORIES.has(entry.name)) {
                files.push(...await listRepositoryFiles(rootDirectory, relativePath));
            }
        }
        else if (entry.isFile()) {
            files.push(normalizePath(relativePath));
        }
    }
    return files.sort();
}
async function repositoryFileSizes(rootDirectory, files) {
    const sizes = {};
    for (const path of files) {
        try {
            sizes[path] = Math.max(1, Math.ceil(Buffer.byteLength(await readFile(join(rootDirectory, path), "utf8"), "utf8") / 4));
        }
        catch {
            // Missing explicit task files still use deterministic path-size fallback.
        }
    }
    return sizes;
}
function dependencyTaskFiles(task, taskDirectory, availableFiles) {
    const prefix = `${taskDirectory.replace(/\\/g, "/").replace(/\/$/, "")}/`;
    return availableFiles.filter((path) => {
        const normalized = normalizePath(path);
        return task.dependsOn.some((dependency) => (normalized.startsWith(`${prefix}${dependency}-`) && normalized.endsWith(".md")));
    });
}
export async function buildTaskContextPack(rootDirectory, task, level, options = {}) {
    if (options.budget === undefined)
        return selectTaskContext(task, level, options);
    const availableFiles = options.availableFiles ?? await listRepositoryFiles(rootDirectory);
    const fileSizes = options.fileSizes ?? await repositoryFileSizes(rootDirectory, availableFiles);
    const dependencyFiles = [
        ...(options.dependencyFiles ?? []),
        ...dependencyTaskFiles(task, options.taskDirectory ?? DEFAULT_TASK_DIRECTORY, availableFiles),
    ];
    return selectTaskContext(task, level, {
        ...options,
        availableFiles,
        fileSizes,
        dependencyFiles,
    });
}
export function modeGuidanceFor(mode) {
    const guidance = {
        discovery: [
            "Clarify requirements before implementation.",
            "Record open risks and constraints.",
        ],
        mvp: [
            "Prefer smallest useful vertical slice.",
            "Avoid premature abstractions.",
        ],
        product: [
            "Improve maintainability and tests.",
            "Preserve validated behavior.",
        ],
        production: [
            "Prefer safer changes and stronger verification.",
            "Document operational risks.",
        ],
        maintenance: [
            "Preserve behavior.",
            "Keep diffs small and regression-focused.",
        ],
        audit: [
            "Inspect repository state without source rewrites.",
            "Report gaps as findings.",
        ],
        adopt: [
            "Preserve existing code and conventions.",
            "Prefer documentation cleanup before code changes.",
        ],
    };
    return guidance[mode];
}
export function selectTaskContext(task, level = 1, options = {}) {
    const docsDirectory = options.docsDirectory ?? DEFAULT_DOCS_DIRECTORY;
    const taskDirectory = options.taskDirectory ?? DEFAULT_TASK_DIRECTORY;
    if (options.budget !== undefined) {
        return budgetedContext(task, level, options, docsDirectory, taskDirectory);
    }
    const available = availableFileSet(options);
    const files = [
        ...level1BaseFiles(docsDirectory),
        options.taskFile?.replace(/\\/g, "/") ?? taskPath(task, taskDirectory),
    ];
    if (level >= 2) {
        files.push(...level2BaseFiles(docsDirectory));
        files.push(...includeIfAvailable(metadataDocs(task, docsDirectory), available));
        files.push(...task.contextFiles.filter((file) => isDocsFile(file, docsDirectory)));
    }
    if (level >= 3) {
        files.push(...task.contextFiles.filter((file) => !isDocsFile(file, docsDirectory) && !isOperationalFile(file)));
        files.push(...task.allowedFiles.filter((file) => !isOperationalFile(file)));
    }
    return {
        taskId: task.id,
        level,
        files: uniqueFiles(files),
        ...(options.includeModeGuidance ? { modeGuidance: modeGuidanceFor(task.mode) } : {}),
    };
}
export function renderTaskContext(selection) {
    const budgetLines = selection.budget === undefined
        ? []
        : [
            `Budget: ${selection.budget} units`,
            `Estimated units: ${selection.estimatedUnits ?? 0}`,
            "",
        ];
    const fileLines = selection.entries
        ? selection.entries.map((entry) => `- ${entry.path} [${entry.tier}; ${entry.units} units; ${entry.reason}]`)
        : selection.files.map((file) => `- ${file}`);
    return [
        `Task: ${selection.taskId}`,
        `Context level: ${selection.level}`,
        "",
        ...budgetLines,
        "Files:",
        ...fileLines,
        ...(selection.diagnostics && selection.diagnostics.length > 0
            ? ["", "Diagnostics:", ...selection.diagnostics.map((diagnostic) => `- ${diagnostic.message}`)]
            : []),
        ...(selection.modeGuidance
            ? [
                "",
                "Mode guidance:",
                ...selection.modeGuidance.map((rule) => `- ${rule}`),
            ]
            : []),
        "",
    ].join("\n");
}
