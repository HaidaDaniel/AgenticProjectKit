import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_PATH, readAgenticConfigFile } from "../config/index.js";
import { observedExecFile } from "../perf/index.js";
import { detectQualityCapabilities, inspectPythonProject } from "../quality/index.js";
import { APK_OPERATIONAL_IGNORE_ENTRIES, inspectTrackedApkOperationalArtifacts, renderTrackedApkOperationalReport, } from "../init/index.js";
import { scanRepository } from "../scanners/index.js";
import { listAgents } from "../agents/index.js";
import { syncAgentExports } from "../sync/index.js";
import { listTaskFiles } from "../tasks/index.js";
import { TASK_EVIDENCE_LOCK_PATH } from "../tasks/evidence.js";
import { inspectLocalMutationLock, renderLocalLockInspection } from "../tasks/lock.js";
import { inspectApkInstallation, renderInstallationFinding } from "./installation.js";
const IGNORE_PROBE_FAMILIES = [
    {
        entries: [".tasks/.apk.lock"],
        probePath: ".tasks/.apk.lock",
        expect: "ignore",
    },
    {
        entries: [
            ".agentic/agents.jsonl",
            ".agentic/runs.jsonl",
            ".agentic/evidence.jsonl",
            ".agentic/task-baselines.jsonl",
            ".agentic/evidence.append.lock",
        ],
        probePath: ".agentic/evidence.jsonl",
        expect: "ignore",
    },
    {
        entries: [
            ".agentic/agents/*",
            ".agentic/runs/*",
            ".agentic/reviews/*",
            ".agentic/sessions/*",
            ".agentic/perf/*",
            ".agentic/workspaces/*",
        ],
        probePath: ".agentic/agents/sample.jsonl",
        expect: "ignore",
    },
    {
        entries: ["!.agentic/agents/.gitkeep"],
        probePath: ".agentic/agents/.gitkeep",
        expect: "reinclude",
    },
    {
        entries: ["!.agentic/runs/.gitkeep"],
        probePath: ".agentic/runs/.gitkeep",
        expect: "reinclude",
    },
    {
        entries: [".apk-workspaces/"],
        probePath: ".apk-workspaces/sample",
        expect: "ignore",
    },
    {
        entries: ["/tmp/apk/"],
        probePath: "tmp/apk/sample",
        expect: "ignore",
    },
    {
        entries: ["docs/audit-report.md", "docs/project-map.md"],
        probePath: "docs/audit-report.md",
        expect: "ignore",
    },
];
function isMissingPathError(error) {
    return Boolean(error
        && typeof error === "object"
        && "code" in error
        && error.code === "ENOENT");
}
function runCheckIgnore(rootDirectory, probePaths) {
    return new Promise((resolveResult, reject) => {
        const input = `${probePaths.join("\0")}\0`;
        const child = execFile("git", ["check-ignore", "--no-index", "--verbose", "--non-matching", "-z", "--stdin"], {
            cwd: rootDirectory,
            env: { ...process.env, LC_ALL: "C", GIT_OPTIONAL_LOCKS: "0" },
            encoding: "buffer",
            maxBuffer: 1024 * 1024,
            timeout: 5000,
            windowsHide: true,
        }, (error, stdout) => {
            if (error && (typeof error.code !== "number" || error.killed || error.signal)) {
                reject(error);
                return;
            }
            try {
                resolveResult({
                    code: error && typeof error.code === "number" ? error.code : 0,
                    stdout: new TextDecoder("utf-8", { fatal: true }).decode(stdout),
                });
            }
            catch (decodeError) {
                reject(decodeError);
            }
        });
        child.stdin?.on("error", () => { });
        child.stdin?.end(input);
    });
}
function parseCheckIgnoreOutput(raw, probePaths) {
    const fields = raw.split("\0");
    if (fields.length < 1 || fields[fields.length - 1] !== "")
        return undefined;
    const body = fields.slice(0, -1);
    if (body.length % 4 !== 0)
        return undefined;
    const matches = new Map();
    for (let index = 0; index < body.length; index += 4) {
        const [source, line, pattern, pathname] = body.slice(index, index + 4);
        if (!probePaths.includes(pathname))
            return undefined;
        if (source === "") {
            if (line !== "" || pattern !== "")
                return undefined;
            continue;
        }
        if (!/^\d+$/.test(line) || pattern === "" || matches.has(pathname))
            return undefined;
        matches.set(pathname, { source, line, pattern });
    }
    return matches;
}
async function ignoreEntriesCheck(rootDirectory, gitState, operational) {
    const label = "ignore-entries";
    let rootIgnore;
    try {
        rootIgnore = await readFile(join(rootDirectory, ".gitignore"), "utf8");
    }
    catch (error) {
        if (!isMissingPathError(error)) {
            return {
                level: "warn",
                label,
                message: `Effective ignore inspection unavailable: cannot read .gitignore (${error instanceof Error ? error.message : String(error)}).`,
            };
        }
    }
    const lines = rootIgnore === undefined ? [] : rootIgnore.split(/\r?\n/);
    const present = new Set(lines);
    const missing = APK_OPERATIONAL_IGNORE_ENTRIES.filter((entry) => !present.has(entry));
    if (missing.length === 0) {
        return { level: "pass", label, message: "canonical operational ignore entries present" };
    }
    const trackedSuffix = operational.status === "complete" && operational.count !== null && operational.count > 0
        ? ` ${operational.count} tracked operational artifact(s) remain in the Git index.`
        : "";
    const unavailable = (reason) => ({
        level: "warn",
        label,
        message: `Effective ignore inspection unavailable: ${reason}. Cannot prove effective ignore for: ${missing.join(", ")}. Run apk init or apk adopt to add canonical entries.${trackedSuffix}`,
    });
    if (gitState.unavailable || gitState.outsideWorktree) {
        return unavailable(gitState.unavailable ? "git is not available" : "not inside a Git worktree");
    }
    const families = IGNORE_PROBE_FAMILIES.filter((family) => (family.entries.some((entry) => missing.includes(entry))));
    const probePaths = [...new Set(families.map((family) => family.probePath))];
    if (probePaths.length === 0 || probePaths.length > 8) {
        return unavailable("probe set could not be bounded to eight paths");
    }
    let result;
    try {
        result = await runCheckIgnore(rootDirectory, probePaths);
    }
    catch (error) {
        const reason = error && typeof error === "object" && "code" in error
            ? `git check-ignore could not start (${String(error.code)})`
            : "git check-ignore could not start";
        return unavailable(reason);
    }
    if (result.code !== 0 && result.code !== 1) {
        return unavailable(`git check-ignore exited ${result.code}`);
    }
    const matches = parseCheckIgnoreOutput(result.stdout, probePaths);
    if (!matches) {
        return unavailable("git check-ignore output was malformed");
    }
    const unproven = [];
    const notes = [];
    for (const family of families) {
        const familyMissing = family.entries.filter((entry) => missing.includes(entry));
        const match = matches.get(family.probePath);
        const proven = match !== undefined
            && (family.expect === "reinclude"
                ? match.pattern.startsWith("!")
                : !match.pattern.startsWith("!"));
        if (!proven || match === undefined) {
            unproven.push(...familyMissing);
            continue;
        }
        const assertion = family.expect === "reinclude" ? "re-included" : "ignored";
        notes.push(`${familyMissing.join(", ")}: ${assertion} via ${match.source}:${match.line}:${match.pattern}`);
    }
    if (unproven.length > 0) {
        return {
            level: "warn",
            label,
            message: `Canonical ignore entries absent from .gitignore without proven effective ignore: ${unproven.join(", ")}. Run apk init or apk adopt to add them.${notes.length > 0 ? ` Proven: ${notes.join("; ")}.` : ""}${trackedSuffix}`,
        };
    }
    return {
        level: "pass",
        label,
        message: `Canonical entries absent as literal strings but effective behavior confirmed: ${notes.join("; ")}.${trackedSuffix}`,
    };
}
async function exists(path) {
    try {
        await stat(path);
        return true;
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
}
async function readJson(path) {
    try {
        return JSON.parse(await readFile(path, "utf8"));
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}
async function gitCheck(rootDirectory) {
    try {
        await observedExecFile("git", ["--version"], { cwd: rootDirectory });
    }
    catch {
        return [{ level: "warn", label: "git", message: "git is not available" }];
    }
    try {
        await observedExecFile("git", ["rev-parse", "--is-inside-work-tree"], { cwd: rootDirectory });
        return [{ level: "pass", label: "git", message: "inside git worktree" }];
    }
    catch {
        return [{ level: "warn", label: "git", message: "not inside git worktree" }];
    }
}
async function lockCheck(label, lockPath) {
    const inspection = await inspectLocalMutationLock(lockPath);
    if (inspection.state === "absent") {
        return { level: "pass", label, message: "none" };
    }
    return {
        level: inspection.state === "live" ? "warn" : "fail",
        label,
        message: renderLocalLockInspection(inspection),
    };
}
async function packageChecks(rootDirectory, componentPath) {
    const raw = await readJson(join(rootDirectory, componentPath, "package.json"));
    if (!raw || typeof raw !== "object") {
        return [{ level: "warn", label: "package", message: "package.json missing" }];
    }
    const scripts = "scripts" in raw && raw.scripts && typeof raw.scripts === "object"
        ? raw.scripts
        : {};
    const checks = [];
    for (const script of ["test", "lint", "typecheck", "build"]) {
        const label = componentPath === "." ? `script:${script}` : `script:${componentPath}:${script}`;
        checks.push(script in scripts
            ? { level: "pass", label, message: "present" }
            : { level: "warn", label, message: "missing" });
    }
    return checks;
}
async function applicationChecks(rootDirectory) {
    try {
        // Reuse canonical runtime ownership (including explicit config overrides and
        // bounded nested components), instead of inventing another Node classifier.
        const { runtime } = await scanRepository(rootDirectory);
        const checks = [];
        const applications = new Set();
        const nodePaths = new Set();
        for (const component of runtime.components) {
            if (component.role !== "application" && component.role !== "mixed")
                continue;
            if (component.runtime === "Python") {
                const python = await inspectPythonProject(join(rootDirectory, component.path));
                if (python.diagnostic)
                    checks.push({ level: "warn", label: "python-configuration", message: `${component.path}: ${python.diagnostic}` });
                if (!python.tables.some((table) => /^(?:project|build-system|tool\.(?:poetry|mypy|pyright|ruff|pylint|pytest|tox|coverage|pdm|hatch))(?:\.|$)/.test(table))) {
                    // Other existing canonical Python markers (requirements/setup) remain valid.
                    if (!component.evidence.some((item) => /requirements|setup\.(?:py|cfg)/.test(item)))
                        continue;
                }
            }
            applications.add(component.runtime);
            if (component.runtime === "Node.js")
                nodePaths.add(component.path);
        }
        checks.unshift({
            level: applications.size > 0 ? "pass" : "warn",
            label: "application-stack",
            message: applications.size > 0 ? [...applications].sort().join(", ") : "No reliable application runtime evidence; package.json alone is not a Node application.",
        });
        if (runtime.discoveryLimited)
            checks.push({ level: "warn", label: "application-discovery", message: "Runtime discovery reached its depth/directory bound; additional components may be uninspected." });
        if (runtime.ambiguousRuntimes.length > 0)
            checks.push({ level: "warn", label: "application-ownership", message: `Ambiguous runtime evidence: ${runtime.ambiguousRuntimes.join(", ")}; declare runtimeManifestRole when known.` });
        for (const path of [...nodePaths].sort())
            checks.push(...await packageChecks(rootDirectory, path));
        return checks;
    }
    catch {
        return [{ level: "warn", label: "application-stack", message: "Application inventory unavailable; inspect malformed or unreadable project manifests. No Node script conclusion was inferred." }];
    }
}
export async function runDoctor(rootDirectory) {
    const checks = [];
    let qualityPolicy;
    const gitChecks = await gitCheck(rootDirectory);
    checks.push(...gitChecks);
    const operational = await inspectTrackedApkOperationalArtifacts(rootDirectory);
    checks.push({
        level: operational.status === "not-applicable" || (operational.status === "complete" && operational.count === 0) ? "pass" : "warn",
        label: "tracked-operational-artifacts",
        message: renderTrackedApkOperationalReport(operational).join("\n  "),
    });
    checks.push(await ignoreEntriesCheck(rootDirectory, {
        unavailable: gitChecks.some((check) => check.label === "git" && check.message === "git is not available"),
        outsideWorktree: gitChecks.some((check) => check.label === "git" && check.message === "not inside git worktree"),
    }, operational));
    let taskDirectory = ".tasks";
    try {
        const configExists = await exists(join(rootDirectory, CONFIG_PATH));
        const config = await readAgenticConfigFile(rootDirectory);
        taskDirectory = config.taskDirectory;
        qualityPolicy = config.quality;
        checks.push(configExists
            ? { level: "pass", label: "config", message: "ok" }
            : { level: "warn", label: "config", message: "missing; using defaults" });
        if (config.agentStyle === "caveman") {
            checks.push({
                level: "warn",
                label: "agent-style",
                message: "agentStyle: caveman is explicitly set in .agentic/config.json; APK defaults omitted/new agentStyle to normal and preserves an explicit value intentionally. Remove the setting or set agentStyle to normal to return to normal communication.",
            });
        }
    }
    catch (error) {
        checks.push({ level: "fail", label: "config", message: error instanceof Error ? error.message : String(error) });
    }
    try {
        const tasks = await listTaskFiles(rootDirectory, taskDirectory);
        checks.push(tasks.length > 0
            ? { level: "pass", label: "tasks", message: `${tasks.length} active task(s)` }
            : { level: "warn", label: "tasks", message: "no active task files" });
    }
    catch (error) {
        checks.push({ level: "fail", label: "tasks", message: error instanceof Error ? error.message.split("\n")[0] : String(error) });
    }
    const agents = await listAgents(rootDirectory);
    checks.push(agents.length > 0
        ? { level: "pass", label: "agents", message: `${agents.length} registered agent(s)` }
        : { level: "warn", label: "agents", message: "none registered" });
    checks.push(await lockCheck("task lock", join(rootDirectory, taskDirectory, ".apk.lock")));
    checks.push(await lockCheck("evidence lock", join(rootDirectory, TASK_EVIDENCE_LOCK_PATH)));
    try {
        const sync = await syncAgentExports(rootDirectory);
        checks.push(sync.hasDrift
            ? { level: "warn", label: "exports", message: `missing:${sync.missing.length} stale:${sync.stale.length}` }
            : { level: "pass", label: "exports", message: "in sync" });
    }
    catch (error) {
        checks.push({ level: "warn", label: "exports", message: error instanceof Error ? error.message : String(error) });
    }
    checks.push(...await applicationChecks(rootDirectory));
    const installation = await inspectApkInstallation(rootDirectory);
    checks.push(...installation.findings.map((finding) => ({
        level: finding.level, label: `installation:${finding.code}`, message: renderInstallationFinding(finding),
    })));
    try {
        const quality = await detectQualityCapabilities(rootDirectory, qualityPolicy);
        const nonDetected = quality.capabilities.filter((capability) => capability.status !== "detected").length;
        checks.push({
            level: quality.policy.status === "fail" ? "fail" : nonDetected > 0 ? "warn" : "pass",
            label: "quality",
            message: quality.policy.status === "fail"
                ? `policy failed; missing:${quality.policy.missingRequired.length} unknown:${quality.policy.unknownRequired.length}`
                : `${quality.capabilities.length - nonDetected}/${quality.capabilities.length} capabilities detected`,
        });
    }
    catch (error) {
        checks.push({ level: "fail", label: "quality", message: error instanceof Error ? error.message : String(error) });
    }
    checks.push(await exists(join(rootDirectory, "README.md"))
        ? { level: "pass", label: "readme", message: "present" }
        : { level: "warn", label: "readme", message: "missing" });
    checks.push(await exists(join(rootDirectory, "LICENSE"))
        ? { level: "pass", label: "license", message: "present" }
        : { level: "warn", label: "license", message: "missing" });
    checks.push(await exists(join(rootDirectory, ".env.example"))
        ? { level: "pass", label: "env", message: ".env.example present" }
        : { level: "warn", label: "env", message: ".env.example missing" });
    return {
        checks,
        ok: !checks.some((check) => check.level === "fail"),
    };
}
export function renderDoctor(result) {
    const lines = ["Doctor:"];
    for (const level of ["fail", "warn", "pass"]) {
        const checks = result.checks.filter((check) => check.level === level);
        lines.push(`${level}: ${checks.length}`);
        for (const check of checks) {
            lines.push(`- ${check.label}: ${check.message}`);
        }
    }
    lines.push(result.ok ? "Result: pass" : "Result: fail");
    lines.push("");
    return lines.join("\n");
}
