import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const IGNORE_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".cache",
    "coverage",
]);
const ROOT_FILES = [
    "AGENTS.md",
    "README.md",
    "package.json",
    "tsconfig.json",
    "pnpm-lock.yaml",
];
const KEYWORD_GROUPS = {
    auth: ["auth", "login", "user", "session", "middleware"],
    login: ["auth", "login", "user", "session"],
    user: ["user", "auth", "profile", "account"],
    middleware: ["middleware", "route", "api", "auth"],
    api: ["api", "route", "controller", "handler"],
    route: ["route", "router", "api", "page"],
    schema: ["schema", "model", "types", "validation"],
    config: ["config", "settings", "env"],
    test: ["test", "spec"],
    docs: ["docs", "readme"],
    cli: ["cli", "command"],
    audit: ["audit", "scanner", "readiness"],
    task: ["task", "tasks", "workflow"],
    sync: ["sync", "export"],
    prompt: ["prompt", "context"],
    export: ["export", "sync"],
    status: ["status", "summary"],
    doctor: ["doctor", "diagnostic", "health"],
};
function tokenize(text) {
    return [...new Set(text
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 2))];
}
function expandTokens(tokens) {
    const expanded = new Set(tokens);
    for (const token of tokens) {
        for (const related of KEYWORD_GROUPS[token] ?? []) {
            expanded.add(related);
        }
    }
    return [...expanded];
}
function normalizePath(path) {
    return path.replace(/\\/g, "/").replace(/^\.\//, "");
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
function pathMatches(path, pattern) {
    const normalizedPath = normalizePath(path);
    const normalizedPattern = normalizePath(pattern);
    return normalizedPattern.includes("*")
        ? globRegex(normalizedPattern).test(normalizedPath)
        : normalizedPath === normalizedPattern;
}
function isTestPath(path) {
    const normalized = normalizePath(path).toLowerCase();
    return /(^|\/)(test|tests|__tests__)(\/|$)/.test(normalized)
        || /\.(test|spec)\.[a-z0-9]+$/.test(normalized);
}
function sourceImportTarget(sourcePath, specifier, available) {
    if (!specifier.startsWith("."))
        return undefined;
    const sourceParts = normalizePath(sourcePath).split("/");
    sourceParts.pop();
    const parts = [...sourceParts, ...specifier.split("/")];
    const normalizedParts = [];
    for (const part of parts) {
        if (!part || part === ".")
            continue;
        if (part === "..") {
            normalizedParts.pop();
        }
        else {
            normalizedParts.push(part);
        }
    }
    const base = normalizedParts.join("/");
    const variants = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
        `${base}/index.js`,
    ];
    return variants.find((candidate) => available.has(candidate));
}
function importSpecifiers(content) {
    const specifiers = [];
    const pattern = /(?:from\s*|import\s*|require\s*\(\s*)["']([^"']+)["']/g;
    for (const match of content.matchAll(pattern)) {
        if (match[1])
            specifiers.push(match[1]);
    }
    return specifiers;
}
async function importedDependencyMap(rootDirectory, files) {
    const available = new Set(files.map(normalizePath));
    const dependencies = new Map();
    for (const file of files) {
        if (!/\.(c|m)?tsx?$|\.(c|m)?jsx?$/.test(file))
            continue;
        let content;
        try {
            content = await readFile(join(rootDirectory, file), "utf8");
        }
        catch {
            continue;
        }
        for (const specifier of importSpecifiers(content)) {
            const target = sourceImportTarget(file, specifier, available);
            if (!target)
                continue;
            const importers = dependencies.get(target) ?? new Set();
            importers.add(file);
            dependencies.set(target, importers);
        }
    }
    return dependencies;
}
async function gitChangedFiles(rootDirectory) {
    try {
        const diff = await execFileAsync("git", ["diff", "--name-only", "HEAD"], { cwd: rootDirectory });
        const status = await execFileAsync("git", ["status", "--short", "--untracked-files=all"], { cwd: rootDirectory });
        const changed = [
            ...diff.stdout.split(/\r?\n/),
            ...status.stdout.split(/\r?\n/).map((line) => line.slice(3)),
        ].map(normalizePath).filter(Boolean);
        return [...new Set(changed)].sort();
    }
    catch {
        return [];
    }
}
async function walk(rootDirectory, relativeDirectory) {
    const directory = join(rootDirectory, relativeDirectory);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    const files = [];
    for (const entry of entries) {
        const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.has(entry.name)) {
                files.push(...await walk(rootDirectory, relativePath));
            }
        }
        else if (entry.isFile()) {
            files.push(relativePath);
        }
    }
    return files;
}
async function candidateFiles(rootDirectory) {
    const roots = ["src", "test", "tests", "docs"];
    const rootFiles = ROOT_FILES;
    const scanned = (await Promise.all(roots.map((root) => walk(rootDirectory, root)))).flat();
    return [...new Set([...rootFiles, ...scanned])]
        .filter((file) => !file.split("/").some((part) => IGNORE_DIRS.has(part)))
        .sort();
}
function lexicalScore(path, tokens) {
    const lower = path.toLowerCase();
    const filename = basename(lower);
    let score = 0;
    for (const token of tokens) {
        if (filename.includes(token)) {
            score += 4;
        }
        else if (lower.includes(token)) {
            score += 2;
        }
    }
    if (/\.(test|spec)\.[a-z]+$/.test(lower) || lower.includes("/test/") || lower.includes("/tests/")) {
        score += tokens.some((token) => token === "test" || token === "spec") ? 3 : 1;
    }
    if (lower.endsWith(".md") && tokens.includes("docs")) {
        score += 2;
    }
    return score;
}
function taskPathAllowed(path, task) {
    return task ? task.allowedFiles.some((pattern) => pathMatches(path, pattern)) : true;
}
function taskPathForbidden(path, task, extra) {
    return [
        ...(task?.forbiddenFiles ?? []),
        ...extra,
    ].some((pattern) => pathMatches(path, pattern));
}
function relatedToChangedTest(path, changed) {
    if (!isTestPath(path))
        return false;
    const lower = path.toLowerCase();
    return [...changed].some((changedPath) => {
        const target = changedPath.toLowerCase()
            .replace(/\.(test|spec)(?=\.[a-z0-9]+$)/, "")
            .replace(/\.[a-z0-9]+$/, "");
        const candidate = lower
            .replace(/\.(test|spec)(?=\.[a-z0-9]+$)/, "")
            .replace(/\.[a-z0-9]+$/, "");
        return candidate === target || candidate.endsWith(`/${basename(target)}`);
    });
}
function suggestionRole(path, task, forbidden) {
    if (forbidden || !taskPathAllowed(path, task))
        return "context";
    if (task)
        return "implementation";
    return isTestPath(path) || !path.toLowerCase().endsWith(".md") ? "implementation" : "context";
}
function suggestionReason(reasons, role) {
    const unique = [...new Set(reasons)];
    if (unique.length === 0)
        unique.push("lexical task/path match");
    if (role === "context" && !unique.includes("context-only scope"))
        unique.push("context-only scope");
    return unique.join(", ");
}
export async function suggestContext(rootDirectory, description, options = {}) {
    const tokens = expandTokens(tokenize(description));
    const limit = options.limit ?? 8;
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("Context suggestion limit must be a positive integer.");
    }
    const candidates = (options.availableFiles ?? await candidateFiles(rootDirectory))
        .map(normalizePath)
        .filter((path, index, all) => all.indexOf(path) === index)
        .sort();
    const changed = new Set((options.changedFiles ?? await gitChangedFiles(rootDirectory)).map(normalizePath));
    const recent = new Set((options.recentFiles ?? []).map(normalizePath));
    const dependencyFiles = new Set((options.dependencyFiles ?? []).map(normalizePath));
    const importedBy = await importedDependencyMap(rootDirectory, candidates);
    const changedDependencies = new Set();
    for (const changedPath of changed) {
        for (const importer of importedBy.get(changedPath) ?? [])
            changedDependencies.add(importer);
    }
    const changedImports = new Set();
    for (const changedPath of changed) {
        let content;
        try {
            content = await readFile(join(rootDirectory, changedPath), "utf8");
        }
        catch {
            content = undefined;
        }
        if (!content)
            continue;
        for (const specifier of importSpecifiers(content)) {
            const target = sourceImportTarget(changedPath, specifier, new Set(candidates));
            if (target)
                changedImports.add(target);
        }
    }
    const taskAllowed = options.task?.allowedFiles ?? [];
    const scored = candidates.map((path) => {
        const reasons = [];
        let score = lexicalScore(path, tokens);
        if (changed.has(path)) {
            score += 100;
            reasons.push("changed file");
        }
        if (changedDependencies.has(path)) {
            score += 90;
            reasons.push("imports changed file");
        }
        if (changedImports.has(path)) {
            score += 80;
            reasons.push("changed file dependency");
        }
        if (dependencyFiles.has(path)) {
            score += 85;
            reasons.push("declared dependency");
        }
        if (relatedToChangedTest(path, changed)) {
            score += 70;
            reasons.push("related test");
        }
        if (recent.has(path)) {
            score += 40;
            reasons.push("recent relevant file");
        }
        if (taskAllowed.some((pattern) => pathMatches(path, pattern))) {
            score += 60;
            reasons.push("matches task allowed scope");
        }
        const forbidden = taskPathForbidden(path, options.task, options.forbiddenFiles ?? []);
        const role = suggestionRole(path, options.task, forbidden);
        if (forbidden) {
            reasons.push("task-forbidden context only");
            score += 25;
        }
        return {
            path,
            score,
            role,
            reason: suggestionReason(reasons, role),
        };
    })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
        .slice(0, limit);
    const contextFiles = [
        "AGENTS.md",
        ...scored.map((entry) => entry.path).filter((path) => path !== "AGENTS.md"),
    ];
    const allowedFiles = scored
        .filter((entry) => entry.role === "implementation")
        .map((entry) => entry.path)
        .filter((path) => !path.endsWith(".md") || path.startsWith("docs/"));
    return {
        description,
        contextFiles: [...new Set(contextFiles)],
        allowedFiles: [...new Set(allowedFiles)],
        suggestions: scored,
    };
}
export function renderContextSuggestion(result) {
    const suggestions = result.suggestions.length === 0
        ? ["- none"]
        : result.suggestions.map((entry) => `- ${entry.path} [${entry.role}; score=${entry.score}; ${entry.reason}]`);
    const context = result.contextFiles.length === 0 ? ["- none"] : result.contextFiles.map((file) => `- ${file}`);
    const allowed = result.allowedFiles.length === 0 ? ["- none"] : result.allowedFiles.map((file) => `- ${file}`);
    return [
        `Description: ${result.description}`,
        "",
        "Suggestions",
        ...suggestions,
        "",
        "Context files",
        ...context,
        "",
        "Files allowed to edit",
        ...allowed,
        "",
    ].join("\n");
}
