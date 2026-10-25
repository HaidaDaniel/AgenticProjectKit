import { lstat, readFile, readdir, readlink, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { readAgenticConfigFile, type AgenticConfig } from "../config/index.js";
import { observedExecFile } from "../perf/index.js";
import type { TaskEvidenceCandidateSubject } from "./evidence.js";

const MAX_WITNESS_ENTRIES = 50_000;

export class DiagnosticSnapshotError extends Error {
  constructor(message: string) {
    super(`Diagnostic snapshot unavailable: ${message}; retry with a new invocation.`);
    this.name = "DiagnosticSnapshotError";
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
}

async function metadata(path: string): Promise<string> {
  try {
    const info = await lstat(path, { bigint: true });
    const fields = (value: typeof info) => [value.dev, value.ino, value.mode, value.size, value.mtimeNs, value.ctimeNs].map(String);
    if (info.isSymbolicLink()) {
      const target = await readlink(path);
      try { return JSON.stringify([fields(info), target, fields(await stat(path, { bigint: true }))]); }
      catch (error) { return JSON.stringify([fields(info), target, errorCode(error)]); }
    }
    return JSON.stringify(fields(info));
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(errorCode(error))) return errorCode(error);
    throw error;
  }
}

/** Optimistic, bounded version witness. It never reads journal/task contents. */
async function witness(roots: ReadonlyMap<string, boolean>): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const ancestors = new Set<string>();
  const visit = async (path: string, recursive: boolean): Promise<void> => {
    if (result.has(path)) return;
    if (result.size >= MAX_WITNESS_ENTRIES) throw new DiagnosticSnapshotError("input metadata exceeds the consistency bound");
    result.set(path, await metadata(path));
    if (!recursive) return;
    let directory: boolean;
    try { directory = (await stat(path)).isDirectory(); }
    catch (error) {
      if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(errorCode(error))) return;
      throw error;
    }
    if (!directory) return;
    const identity = await realpath(path);
    if (ancestors.has(identity)) throw new DiagnosticSnapshotError("cyclic input directory");
    ancestors.add(identity);
    try {
      let entries: string[];
      try { entries = await readdir(path); }
      catch (error) {
        if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(errorCode(error))) {
          result.set(`${path}\0enumeration`, errorCode(error));
          return;
        }
        throw error;
      }
      for (const entry of entries.sort()) await visit(join(path, entry), true);
    } finally { ancestors.delete(identity); }
  };
  for (const [path, recursive] of roots) await visit(path, recursive);
  return result;
}

async function git(root: string, args: string[]): Promise<string> {
  return (await observedExecFile("git", ["--no-optional-locks", ...args], {
    cwd: root, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" },
  })).stdout;
}

/** Only withDiagnosticSnapshot creates instances; no instance survives its callback. */
export class TaskDiagnosticSnapshot {
  private active = true;
  private readonly values = new Map<string, Promise<unknown>>();
  private readonly bytes = new Map<string, Promise<Buffer>>();
  private readonly subjects = new Map<string, string>();
  private readonly roots = new Map<string, boolean>();
  private versions = new Map<string, string>();
  private gitIdentity = "";
  readonly rootDirectory: string;
  readonly taskDirectory: string;
  readonly config: AgenticConfig;
  readonly configExists: boolean;

  private constructor(root: string, taskDirectory: string, config: AgenticConfig, configExists: boolean) {
    this.rootDirectory = resolve(root);
    this.taskDirectory = taskDirectory;
    this.config = freeze(config);
    this.configExists = configExists;
  }

  assertLocation(root: string, taskDirectory?: string): void {
    if (!this.active) throw new DiagnosticSnapshotError("the invocation has already ended");
    if (resolve(root) !== this.rootDirectory
      || (taskDirectory !== undefined && resolve(root, taskDirectory) !== resolve(root, this.taskDirectory))) {
      throw new DiagnosticSnapshotError("repository or task-directory identity differs");
    }
  }

  memo<T>(root: string, key: string, load: () => Promise<T>): Promise<T> {
    this.assertLocation(root);
    let value = this.values.get(key);
    if (!value) {
      value = Promise.resolve().then(load).then((captured) => {
        this.assertLocation(root);
        return freeze(captured);
      });
      this.values.set(key, value);
    }
    return value as Promise<T>;
  }

  async readBytes(root: string, path: string, load = () => readFile(path)): Promise<Buffer> {
    this.assertLocation(root);
    const absolute = resolve(path);
    let value = this.bytes.get(absolute);
    if (!value) {
      value = (async () => {
        if (!this.versions.has(absolute)) {
          this.roots.set(absolute, false);
          this.versions.set(absolute, await metadata(absolute));
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

  bindCandidate(subject: TaskEvidenceCandidateSubject): void {
    this.assertLocation(this.rootDirectory);
    if (subject.candidateId !== "candidate:unknown") {
      const head = this.gitIdentity === "no-git" ? undefined : (JSON.parse(this.gitIdentity) as string[])[1].trim();
      const expectedHead = head && /^[0-9a-f]{40,64}$/.test(head) ? head : undefined;
      if (subject.headSha !== expectedHead || subject.repository !== (expectedHead ? "git" : "none")) {
        throw new DiagnosticSnapshotError("inputs changed during capture (candidate Git identity)");
      }
    }
    const identity = JSON.stringify([subject.repository, subject.baselineId, subject.candidateId, subject.worktreeId, subject.headSha]);
    const prior = this.subjects.get(subject.taskId);
    if (prior !== undefined && prior !== identity) throw new DiagnosticSnapshotError(`task ${subject.taskId} candidate identity differs`);
    this.subjects.set(subject.taskId, identity);
  }

  private async gitState(): Promise<string> {
    let location: string;
    try { location = await git(this.rootDirectory, ["rev-parse", "--show-toplevel", "--absolute-git-dir", "--git-common-dir"]); }
    catch (error) {
      const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
      if (/not a git repository/i.test(stderr)) return "no-git";
      if (errorCode(error) === "ENOENT" && await this.filesystemOnly()) return "no-git";
      throw new DiagnosticSnapshotError("Git repository identity could not be established");
    }
    const [top, directory, common] = location.trim().split(/\r?\n/);
    if (!top || !directory || !common) throw new DiagnosticSnapshotError("Git location cannot be established");
    const commonDirectory = isAbsolute(common) ? common : resolve(this.rootDirectory, common);
    // Git's read commands may create/remove an optional index.lock. The Git
    // directory timestamp is not a version of its contents; watch the actual
    // index/HEAD/refs and the linked-worktree pointer instead.
    const marker = join(top, ".git");
    if (!(await lstat(marker)).isDirectory()) this.roots.set(marker, false);
    for (const path of [join(directory, "HEAD"), join(directory, "index"), join(commonDirectory, "packed-refs"), join(commonDirectory, "config")]) this.roots.set(path, false);
    this.roots.set(join(commonDirectory, "refs"), true);
    let head: string;
    try { head = await git(this.rootDirectory, ["rev-parse", "--verify", "HEAD"]); }
    catch { head = "unborn-or-unavailable"; }
    const status = await git(this.rootDirectory, ["-c", "core.filemode=true", "status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    // Version already-dirty files too: a second edit need not change status flags.
    const entries = status.split("\0");
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      this.roots.set(join(top, entry.slice(3)), true);
      if (/[RC]/.test(entry.slice(0, 2)) && entries[i + 1]) this.roots.set(join(top, entries[++i]), true);
    }
    return JSON.stringify([location, head, status]);
  }

  /** Preserve filesystem-only diagnostics when Git is not installed. Never
   * interpret inaccessible or existing Git metadata as repository absence. */
  private async filesystemOnly(): Promise<boolean> {
    if (process.env.GIT_DIR || process.env.GIT_WORK_TREE || process.env.GIT_COMMON_DIR) return false;
    let directory = await realpath(this.rootDirectory);
    for (;;) {
      const marker = join(directory, ".git");
      this.roots.set(marker, false);
      if (!["ENOENT", "ENOTDIR"].includes(await metadata(marker))) return false;
      // A bare repository also cannot be diagnosed as an ordinary directory.
      const head = join(directory, "HEAD"), objects = join(directory, "objects");
      this.roots.set(head, false);
      this.roots.set(objects, false);
      if (!["ENOENT", "ENOTDIR"].includes(await metadata(head))
        && !["ENOENT", "ENOTDIR"].includes(await metadata(objects))) return false;
      const parent = dirname(directory);
      if (parent === directory) return true;
      directory = parent;
    }
  }

  private async finish(): Promise<void> {
    const state = await this.gitState();
    const after = await witness(this.roots);
    const changed = [...new Set([...this.versions.keys(), ...after.keys()])]
      .find((path) => this.versions.get(path) !== after.get(path));
    if (state !== this.gitIdentity || changed !== undefined) {
      throw new DiagnosticSnapshotError(`inputs changed during capture${changed ? ` (${relative(this.rootDirectory, changed).slice(0, 160)})` : " (Git state)"}`);
    }
  }

  static async run<T>(root: string, taskDirectory: string | undefined, project: (snapshot: TaskDiagnosticSnapshot) => Promise<T>): Promise<T> {
    const configPath = join(root, ".agentic/config.json");
    const beforeConfig = await metadata(configPath);
    const config = await readAgenticConfigFile(root);
    const snapshot = new TaskDiagnosticSnapshot(root, taskDirectory ?? config.taskDirectory, config, !["ENOENT", "ENOTDIR"].includes(beforeConfig));
    snapshot.roots.set(resolve(root, snapshot.taskDirectory), true);
    for (const path of [".agentic/config.json", ".agentic/evidence.jsonl", ".agentic/task-baselines.jsonl", ".agentic/agents.jsonl", ".agentic/runs.jsonl"]) snapshot.roots.set(resolve(root, path), false);
    for (const path of [".agentic/agents", ".agentic/runs", ".agentic/sessions/work"]) snapshot.roots.set(resolve(root, path), true);
    try {
      snapshot.gitIdentity = await snapshot.gitState();
      snapshot.versions = await witness(snapshot.roots);
      if (snapshot.versions.get(resolve(configPath)) !== beforeConfig) throw new DiagnosticSnapshotError("configuration changed during capture");
      const result = await project(snapshot);
      await snapshot.finish();
      return result;
    } finally {
      snapshot.active = false;
      snapshot.values.clear();
      snapshot.bytes.clear();
    }
  }
}

export const withDiagnosticSnapshot = TaskDiagnosticSnapshot.run;
