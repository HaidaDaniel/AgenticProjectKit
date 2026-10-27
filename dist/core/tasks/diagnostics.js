import { lstat, readFile, readdir, readlink, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { readAgenticConfigFile } from "../config/index.js";
import { observedExecFile } from "../perf/index.js";
const MAX_WITNESS_ENTRIES = 50_000;
export class DiagnosticSnapshotError extends Error {
    constructor(message) {
        super(`Diagnostic snapshot unavailable: ${message}; retry with a new invocation.`);
        this.name = "DiagnosticSnapshotError";
    }
}
function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function errorCode(error) {
    return error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
}
async function metadata(path) {
    try {
        const info = await lstat(path, { bigint: true });
        const fields = (value) => [value.dev, value.ino, value.mode, value.size, value.mtimeNs, value.ctimeNs].map(String);
        if (info.isSymbolicLink()) {
            const target = await readlink(path);
            try {
                return JSON.stringify([fields(info), target, fields(await stat(path, { bigint: true }))]);
            }
            catch (error) {
                return JSON.stringify([fields(info), target, errorCode(error)]);
            }
        }
        return JSON.stringify(fields(info));
    }
    catch (error) {
        if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(errorCode(error)))
            return errorCode(error);
        throw error;
    }
}
/** Optimistic, bounded version witness. It never reads journal/task contents. */
async function witness(roots) {
    const result = new Map();
    const ancestors = new Set();
    const discoveredLinks = new Set();
    const visit = async (path, recursive) => {
        if (result.has(path))
            return;
        if (result.size >= MAX_WITNESS_ENTRIES)
            throw new DiagnosticSnapshotError("input metadata exceeds the consistency bound");
        const version = await metadata(path);
        if (["EACCES", "EPERM"].includes(version))
            throw new DiagnosticSnapshotError("input metadata cannot be inspected");
        result.set(path, version);
        // A recursive store can contain linked shards or directories that its
        // reader opens directly. Their external ancestry is an input too.
        if (version.startsWith("[["))
            await watchInputPath(roots, path, new Set(), discoveredLinks);
        if (!recursive)
            return;
        let directory;
        try {
            directory = (await stat(path)).isDirectory();
        }
        catch (error) {
            if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(errorCode(error)))
                return;
            throw error;
        }
        if (!directory)
            return;
        const identity = await realpath(path);
        if (ancestors.has(identity))
            throw new DiagnosticSnapshotError("cyclic input directory");
        ancestors.add(identity);
        try {
            let entries;
            try {
                entries = await readdir(path);
            }
            catch (error) {
                if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(errorCode(error))) {
                    result.set(`${path}\0enumeration`, errorCode(error));
                    return;
                }
                throw error;
            }
            for (const entry of entries.sort())
                await visit(join(path, entry), true);
        }
        finally {
            ancestors.delete(identity);
        }
    };
    for (const [path, recursive] of roots)
        await visit(path, recursive === true);
    return result;
}
function inputChanged(path, before, after, roots) {
    if (before.get(path) === after.get(path))
        return false;
    if (roots.get(path) !== "ancestor")
        return true;
    const directoryFields = (value) => {
        if (!value?.startsWith("["))
            return undefined;
        const fields = JSON.parse(value);
        return Array.isArray(fields) && fields.length === 6 && fields.every((field) => typeof field === "string")
            && (BigInt(fields[2]) & 61440n) === 16384n ? fields : undefined;
    };
    const prior = directoryFields(before.get(path)), current = directoryFields(after.get(path));
    if (!prior || !current || prior.slice(0, 3).some((field, index) => field !== current[index]))
        return true;
    // An ancestor's unrelated child activity (notably other /tmp fixtures) does
    // not change this input's location. Rename-and-restore changes both the
    // directory ctime and its parent entry. Keep full checks on direct parents
    // and symlinks; only remote ordinary ancestors use this namespace check.
    const parent = dirname(path);
    return parent !== path && prior[5] !== current[5]
        && before.get(parent) !== after.get(parent);
}
/** Guard lexical paths, symlink resolution and missing-input create/remove cycles. */
async function watchInputPath(roots, path, links = new Set(), discovered = new Set()) {
    const absolute = resolve(path);
    const add = (input, mode = false) => {
        if (roots.has(input)) {
            if (roots.get(input) === "ancestor" && mode !== "ancestor")
                roots.set(input, mode);
            return;
        }
        if (roots.size >= MAX_WITNESS_ENTRIES)
            throw new DiagnosticSnapshotError("input metadata exceeds the consistency bound");
        roots.set(input, mode);
    };
    const followLink = async (input) => {
        try {
            if (!(await lstat(input)).isSymbolicLink())
                return;
            add(input);
            if (links.has(input) || links.size >= 64)
                throw new DiagnosticSnapshotError("cyclic or excessive input symlink chain");
            await watchInputPath(roots, resolve(dirname(input), await readlink(input)), new Set([...links, input]), discovered);
        }
        catch (error) {
            if (!["ENOENT", "ENOTDIR"].includes(errorCode(error)))
                throw error;
        }
    };
    add(absolute);
    if (discovered.has(absolute))
        return;
    await followLink(absolute);
    let parent = dirname(absolute);
    let missingParent = true;
    const visited = [absolute];
    for (;;) {
        add(parent, missingParent ? false : "ancestor");
        if (discovered.has(parent))
            break;
        visited.push(parent);
        await followLink(parent);
        if (missingParent && !["ENOENT", "ENOTDIR"].includes(await metadata(parent)))
            missingParent = false;
        const next = dirname(parent);
        if (next === parent)
            break;
        parent = next;
    }
    // Only discovery is reused. Every registered path is still re-statted by
    // the closing witness; no observed version is refreshed through this set.
    for (const input of visited)
        discovered.add(input);
}
async function git(root, args) {
    return (await observedExecFile("git", ["--no-optional-locks", ...args], {
        cwd: root, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" },
    })).stdout;
}
/** Only withDiagnosticSnapshot creates instances; no instance survives its callback. */
export class TaskDiagnosticSnapshot {
    active = true;
    values = new Map();
    bytes = new Map();
    subjects = new Map();
    roots = new Map();
    discoveredInputs = new Set();
    versions = new Map();
    gitIdentity = "";
    rootDirectory;
    taskDirectory;
    config;
    configExists;
    constructor(root, taskDirectory, config, configExists) {
        this.rootDirectory = resolve(root);
        this.taskDirectory = taskDirectory;
        this.config = freeze(config);
        this.configExists = configExists;
    }
    assertLocation(root, taskDirectory) {
        if (!this.active)
            throw new DiagnosticSnapshotError("the invocation has already ended");
        if (resolve(root) !== this.rootDirectory
            || (taskDirectory !== undefined && resolve(root, taskDirectory) !== resolve(root, this.taskDirectory))) {
            throw new DiagnosticSnapshotError("repository or task-directory identity differs");
        }
    }
    memo(root, key, load) {
        this.assertLocation(root);
        let value = this.values.get(key);
        if (!value) {
            value = Promise.resolve().then(load).then((captured) => {
                this.assertLocation(root);
                return freeze(captured);
            });
            this.values.set(key, value);
        }
        return value;
    }
    async readBytes(root, path, load = () => readFile(path)) {
        this.assertLocation(root);
        const absolute = resolve(path);
        let value = this.bytes.get(absolute);
        if (!value) {
            value = (async () => {
                await this.watchPath(absolute);
                const additions = new Map([...this.roots].filter(([input]) => !this.versions.has(input)));
                const addedVersions = await witness(additions);
                for (const [input, mode] of additions) {
                    if (!this.roots.has(input) || (this.roots.get(input) === "ancestor" && mode !== "ancestor"))
                        this.roots.set(input, mode);
                }
                for (const [input, version] of addedVersions) {
                    if (!this.versions.has(input))
                        this.versions.set(input, version);
                }
                return load();
            })();
            this.bytes.set(absolute, value);
        }
        // Callers cannot mutate the stored bytes through a borrowed Buffer.
        const captured = await value;
        this.assertLocation(root);
        return Buffer.from(captured);
    }
    bindCandidate(subject) {
        this.assertLocation(this.rootDirectory);
        if (subject.candidateId !== "candidate:unknown") {
            const head = this.gitIdentity === "no-git" ? undefined : JSON.parse(this.gitIdentity)[1].trim();
            const expectedHead = head && /^[0-9a-f]{40,64}$/.test(head) ? head : undefined;
            if (subject.headSha !== expectedHead || subject.repository !== (expectedHead ? "git" : "none")) {
                throw new DiagnosticSnapshotError("inputs changed during capture (candidate Git identity)");
            }
        }
        const identity = JSON.stringify([subject.repository, subject.baselineId, subject.candidateId, subject.worktreeId, subject.headSha]);
        const prior = this.subjects.get(subject.taskId);
        if (prior !== undefined && prior !== identity)
            throw new DiagnosticSnapshotError(`task ${subject.taskId} candidate identity differs`);
        this.subjects.set(subject.taskId, identity);
    }
    async gitState() {
        let location;
        try {
            location = await git(this.rootDirectory, ["rev-parse", "--show-toplevel", "--absolute-git-dir", "--git-common-dir", "--git-path", "index", "--git-path", "info/exclude", "--git-path", "config.worktree", "--shared-index-path"]);
        }
        catch (error) {
            const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
            if (/not a git repository/i.test(stderr))
                return "no-git";
            if (errorCode(error) === "ENOENT" && await this.filesystemOnly())
                return "no-git";
            throw new DiagnosticSnapshotError("Git repository identity could not be established");
        }
        const [top, directory, common, index, exclude, worktreeConfig, sharedIndex] = location.trimEnd().split(/\r?\n/);
        if (!top || !directory || !common || !index || !exclude || !worktreeConfig)
            throw new DiagnosticSnapshotError("Git location cannot be established");
        const commonDirectory = isAbsolute(common) ? common : resolve(this.rootDirectory, common);
        // Git's read commands may create/remove an optional index.lock. The Git
        // directory timestamp is not a version of its contents; watch the actual
        // index/HEAD/refs and the linked-worktree pointer instead.
        const marker = join(top, ".git");
        const markerVersion = await metadata(marker);
        if (["ENOENT", "ENOTDIR"].includes(markerVersion) || !(await lstat(marker)).isDirectory())
            await this.watchPath(marker);
        for (const path of [join(directory, "HEAD"), resolve(this.rootDirectory, index), resolve(this.rootDirectory, exclude), resolve(this.rootDirectory, worktreeConfig), join(commonDirectory, "packed-refs"), join(commonDirectory, "config"), join(commonDirectory, "info/attributes")])
            await this.watchPath(path);
        if (sharedIndex)
            await this.watchPath(resolve(this.rootDirectory, sharedIndex));
        this.roots.set(join(commonDirectory, "refs"), true);
        const configuration = await this.gitConfiguration();
        await this.watchPath(join(top, ".gitignore"));
        await this.watchPath(join(top, ".gitattributes"));
        let head;
        try {
            head = await git(this.rootDirectory, ["rev-parse", "--verify", "HEAD"]);
        }
        catch {
            head = "unborn-or-unavailable";
        }
        const status = await git(this.rootDirectory, ["-c", "core.filemode=true", "status", "--porcelain=v1", "-z", "--untracked-files=all"]);
        // Version already-dirty files too: a second edit need not change status flags.
        const entries = status.split("\0");
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry)
                continue;
            const paths = [join(top, entry.slice(3))];
            if (/[RC]/.test(entry.slice(0, 2)) && entries[i + 1])
                paths.push(join(top, entries[++i]));
            for (const path of paths) {
                this.roots.set(path, true);
                for (let parent = dirname(path); parent !== top && parent !== dirname(parent); parent = dirname(parent)) {
                    await this.watchPath(join(parent, ".gitignore"));
                    await this.watchPath(join(parent, ".gitattributes"));
                }
            }
        }
        return JSON.stringify([location, head, status, configuration]);
    }
    /** Include the nearest existing parent: creating and removing an initially
     * absent input must not look unchanged at the final witness. */
    async watchPath(path) {
        await watchInputPath(this.roots, path, new Set(), this.discoveredInputs);
    }
    async gitConfiguration() {
        // Git supplies its platform-specific default config/attribute locations,
        // including absent files. Merely listing existing origins misses ABA writes.
        const variables = (await git(this.rootDirectory, ["var", "-l"]))
            .split("\n").filter((line) => /^GIT_(CONFIG_(SYSTEM|GLOBAL)|ATTR_(SYSTEM|GLOBAL))=/.test(line));
        if (!variables.some((line) => line.startsWith("GIT_CONFIG_SYSTEM="))
            || !variables.some((line) => line.startsWith("GIT_CONFIG_GLOBAL="))) {
            throw new DiagnosticSnapshotError("Git cannot expose configuration input locations");
        }
        for (const line of variables)
            await this.watchPath(line.slice(line.indexOf("=") + 1));
        const config = await git(this.rootDirectory, ["config", "--null", "--show-origin", "--list"]);
        const fields = config.split("\0");
        for (let i = 0; i + 1 < fields.length; i += 2) {
            if (fields[i].startsWith("file:"))
                await this.watchPath(resolve(this.rootDirectory, fields[i].slice(5)));
        }
        let paths = "";
        try {
            paths = await git(this.rootDirectory, ["config", "--null", "--show-origin", "--path", "--get-regexp", "^(include(if\\..*)?\\.path|core\\.(excludesfile|attributesfile))$"]);
        }
        catch (error) {
            if (errorCode(error) !== "1")
                throw error;
        }
        const pathFields = paths.split("\0");
        let explicitExcludes = false;
        for (let i = 0; i + 1 < pathFields.length; i += 2) {
            const separator = pathFields[i + 1].indexOf("\n");
            if (separator < 0)
                throw new DiagnosticSnapshotError("Git configuration paths cannot be decoded");
            const key = pathFields[i + 1].slice(0, separator);
            const value = pathFields[i + 1].slice(separator + 1);
            explicitExcludes ||= key === "core.excludesfile";
            const origin = pathFields[i].startsWith("file:") ? resolve(this.rootDirectory, pathFields[i].slice(5)) : undefined;
            const base = /^include(if\..*)?\.path$/.test(key) && origin ? dirname(origin) : this.rootDirectory;
            if (value)
                await this.watchPath(resolve(base, value));
        }
        if (!explicitExcludes) {
            await this.watchPath(join(process.env.XDG_CONFIG_HOME || join(process.env.HOME || homedir(), ".config"), "git/ignore"));
        }
        return JSON.stringify([variables, config, paths]);
    }
    /** Preserve filesystem-only diagnostics when Git is not installed. Never
     * interpret inaccessible or existing Git metadata as repository absence. */
    async filesystemOnly() {
        if (process.env.GIT_DIR || process.env.GIT_WORK_TREE || process.env.GIT_COMMON_DIR)
            return false;
        let directory = await realpath(this.rootDirectory);
        for (;;) {
            const marker = join(directory, ".git");
            this.roots.set(marker, false);
            if (!["ENOENT", "ENOTDIR"].includes(await metadata(marker)))
                return false;
            // A bare repository also cannot be diagnosed as an ordinary directory.
            const head = join(directory, "HEAD"), objects = join(directory, "objects");
            this.roots.set(head, false);
            this.roots.set(objects, false);
            if (!["ENOENT", "ENOTDIR"].includes(await metadata(head))
                && !["ENOENT", "ENOTDIR"].includes(await metadata(objects)))
                return false;
            const parent = dirname(directory);
            if (parent === directory)
                return true;
            directory = parent;
        }
    }
    async finish() {
        const state = await this.gitState();
        const after = await witness(this.roots);
        const changed = [...new Set([...this.versions.keys(), ...after.keys()])]
            .find((path) => inputChanged(path, this.versions, after, this.roots));
        if (state !== this.gitIdentity || changed !== undefined) {
            throw new DiagnosticSnapshotError(`inputs changed during capture${changed ? ` (${relative(this.rootDirectory, changed).slice(0, 160)})` : " (Git state)"}`);
        }
    }
    static async run(root, taskDirectory, project) {
        const configPath = join(root, ".agentic/config.json");
        const configRoots = new Map();
        await watchInputPath(configRoots, configPath);
        const configVersions = await witness(configRoots);
        const beforeConfig = configVersions.get(resolve(configPath));
        const config = await readAgenticConfigFile(root);
        const snapshot = new TaskDiagnosticSnapshot(root, taskDirectory ?? config.taskDirectory, config, !["ENOENT", "ENOTDIR"].includes(beforeConfig));
        for (const [path, recursive] of configRoots)
            snapshot.roots.set(path, recursive);
        snapshot.roots.set(resolve(root, snapshot.taskDirectory), true);
        try {
            await snapshot.watchPath(resolve(root, snapshot.taskDirectory));
            for (const path of [".agentic/config.json", ".agentic/evidence.jsonl", ".agentic/task-baselines.jsonl", ".agentic/agents.jsonl", ".agentic/runs.jsonl", "package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb", "dist"])
                await snapshot.watchPath(resolve(root, path));
            for (const path of [".agentic/agents", ".agentic/runs", ".agentic/sessions/work"]) {
                snapshot.roots.set(resolve(root, path), true);
                await snapshot.watchPath(resolve(root, path));
            }
            snapshot.gitIdentity = await snapshot.gitState();
            snapshot.versions = await witness(snapshot.roots);
            if ([...configVersions.keys()].some((path) => inputChanged(path, configVersions, snapshot.versions, configRoots)))
                throw new DiagnosticSnapshotError("configuration changed during capture");
            const result = await project(snapshot);
            await snapshot.finish();
            return result;
        }
        finally {
            snapshot.active = false;
            snapshot.values.clear();
            snapshot.bytes.clear();
            snapshot.subjects.clear();
            snapshot.roots.clear();
            snapshot.versions.clear();
            snapshot.discoveredInputs.clear();
            snapshot.gitIdentity = "";
        }
    }
}
export const withDiagnosticSnapshot = TaskDiagnosticSnapshot.run;
