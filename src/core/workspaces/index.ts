import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { readAgenticConfigFile } from "../config/index.js";
import { findTaskFile, loadTaskFile, type TaskState } from "../tasks/index.js";
import { withLocalMutationLock } from "../tasks/lock.js";
import { isSafeRunId } from "../work/contract.js";
import { resolveCanonicalRunBinding } from "../work/session.js";

const execFileAsync = promisify(execFile);

export const WORKSPACE_PROTOCOL = "apk-workspace-v1";
export const WORKSPACE_RECORDS_DIR = ".agentic/workspaces";
export const DEFAULT_WORKSPACE_BASE = ".apk-workspaces";
export const WORKSPACE_MARKER_FILE = "apk-workspace.json";
export const WORKSPACE_STATE_PROTOCOL = "apk-workspace-state-v1";

export const WORKSPACE_STATES = [
  "active",
  "missing",
  "unregistered",
  "foreign",
  "unsafe",
  "unknown",
  "ambiguous",
] as const;
export type WorkspaceState = (typeof WORKSPACE_STATES)[number];

export interface WorkspaceRecord {
  protocol: typeof WORKSPACE_PROTOCOL;
  id: string;
  taskId: string;
  runId?: string;
  resourceId?: string;
  branch: string;
  /** Absolute real path of the managed worktree. Runtime-only, never analytics. */
  worktreePath: string;
  /** Stable hash of the normalized absolute path. */
  worktreeId: string;
  repositoryId: string;
  baselineHeadSha?: string;
  candidateRevision?: string;
  marker: string;
  createdAt: string;
}

interface WorkspaceMarkerFile {
  protocol: typeof WORKSPACE_PROTOCOL;
  id: string;
  taskId: string;
  runId?: string;
  resourceId?: string;
  worktreeId: string;
  marker: string;
}

export interface WorkspaceStatusEntry {
  id: string;
  taskId: string;
  runId?: string;
  resourceId?: string;
  branch: string;
  worktreeId: string;
  state: WorkspaceState;
  safeToCleanup: boolean;
  reason: string;
  nextAction: string;
}

export interface CreateWorkspaceOptions {
  rootDirectory: string;
  taskId: string;
  owner: string;
  resourceId?: string;
  runId?: string;
  branch?: string;
  /** Relative directory name under the workspace base. Defaults to the id. */
  name?: string;
  baseline?: string;
  baseDirectory?: string;
}

export interface CreateWorkspaceResult {
  record: WorkspaceRecord;
}

export interface RemoveWorkspaceOptions {
  rootDirectory: string;
  id: string;
  apply?: boolean;
}

export interface RemoveWorkspaceResult {
  applied: boolean;
  removed: boolean;
  state: WorkspaceState;
  reason: string;
  record?: WorkspaceRecord;
}

export class WorkspaceSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceSafetyError";
  }
}

interface GitWorktreeEntry {
  path: string;
  head?: string;
  branch?: string;
  detached: boolean;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePathCase(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

/** Resolve a path to a real absolute path, allowing the final segments to be absent. */
async function realpathAllowMissing(path: string): Promise<string> {
  let current = resolve(path);
  const suffix: string[] = [];
  for (;;) {
    try {
      const real = await realpath(current);
      return suffix.length === 0 ? real : join(real, ...suffix.reverse());
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
      const parent = resolve(current, "..");
      if (parent === current) {
        throw new WorkspaceSafetyError(`Cannot resolve path: ${path}`);
      }
      suffix.push(current.slice(parent.length).replace(/^[/\\]+/, ""));
      current = parent;
    }
  }
}

function isContainedWithin(parentReal: string, childReal: string): boolean {
  const parent = normalizePathCase(resolve(parentReal));
  const child = normalizePathCase(resolve(childReal));
  if (parent === child) return false;
  const rel = relative(parent, child);
  return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel);
}

function requireSafeSegment(name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name === "." || name === ".." || name.includes("..")) {
    throw new WorkspaceSafetyError(`Workspace name must be a single safe path segment: ${name}`);
  }
  return name;
}

async function git(rootDirectory: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync("git", args, {
    cwd: rootDirectory,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout;
}

async function gitError(rootDirectory: string, args: readonly string[]): Promise<string> {
  try {
    await git(rootDirectory, args);
    return "";
  } catch (error: unknown) {
    if (error && typeof error === "object" && "stderr" in error) {
      return String((error as { stderr?: unknown }).stderr ?? "").trim();
    }
    return error instanceof Error ? error.message : String(error);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function resolveRepositoryRoot(rootDirectory: string): Promise<string> {
  try {
    const result = await git(rootDirectory, ["rev-parse", "--show-toplevel"]);
    const root = result.trim();
    if (!root) throw new Error("empty repository root");
    return realpath(root);
  } catch (error: unknown) {
    throw new WorkspaceSafetyError(
      `Workspace operations require a Git repository with a resolvable root: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function listGitWorktrees(repoRoot: string): Promise<GitWorktreeEntry[]> {
  const output = await git(repoRoot, ["worktree", "list", "--porcelain"]);
  const entries: GitWorktreeEntry[] = [];
  let current: Partial<GitWorktreeEntry> | undefined;
  const push = (): void => {
    if (current?.path) {
      entries.push({
        path: current.path,
        ...(current.head ? { head: current.head } : {}),
        ...(current.branch ? { branch: current.branch } : {}),
        detached: current.detached ?? false,
      });
    }
    current = undefined;
  };
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      push();
      current = { path: line.slice("worktree ".length).trim() };
    } else if (line.startsWith("HEAD ") && current) {
      current.head = line.slice("HEAD ".length).trim();
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch ".length).trim();
    } else if (line === "detached" && current) {
      current.detached = true;
    }
  }
  push();
  return entries;
}

function findWorktreeEntry(entries: readonly GitWorktreeEntry[], targetReal: string): GitWorktreeEntry | undefined {
  const normalized = normalizePathCase(resolve(targetReal));
  return entries.find((entry) => normalizePathCase(resolve(entry.path)) === normalized);
}

async function readWorkspaceMarker(gitDir: string): Promise<WorkspaceMarkerFile | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(gitDir, WORKSPACE_MARKER_FILE), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const raw = parsed as Record<string, unknown>;
    if (raw.protocol !== WORKSPACE_PROTOCOL || typeof raw.id !== "string" || typeof raw.worktreeId !== "string" || typeof raw.marker !== "string") {
      return undefined;
    }
    return raw as unknown as WorkspaceMarkerFile;
  } catch {
    return undefined;
  }
}

async function worktreeGitDirectory(worktreePath: string): Promise<string | undefined> {
  try {
    const result = (await git(worktreePath, ["rev-parse", "--absolute-git-dir"])).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

export function workspaceRecordPath(rootDirectory: string, id: string): string {
  return join(rootDirectory, WORKSPACE_RECORDS_DIR, `${id}.json`);
}

function validateWorkspaceId(id: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    throw new WorkspaceSafetyError(`Unsafe workspace id: ${id}`);
  }
  return id;
}

export async function readWorkspaceRecord(rootDirectory: string, id: string): Promise<WorkspaceRecord> {
  validateWorkspaceId(id);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(workspaceRecordPath(rootDirectory, id), "utf8"));
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new WorkspaceSafetyError(`Workspace record not found: ${id}`);
    }
    throw new WorkspaceSafetyError(`Workspace record ${id} is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new WorkspaceSafetyError(`Workspace record ${id} is malformed.`);
  }
  const raw = parsed as Record<string, unknown>;
  if (
    raw.protocol !== WORKSPACE_PROTOCOL
    || typeof raw.id !== "string"
    || typeof raw.taskId !== "string"
    || typeof raw.branch !== "string"
    || typeof raw.worktreePath !== "string"
    || typeof raw.worktreeId !== "string"
    || typeof raw.repositoryId !== "string"
    || typeof raw.marker !== "string"
    || typeof raw.createdAt !== "string"
  ) {
    throw new WorkspaceSafetyError(`Workspace record ${id} is malformed.`);
  }
  return raw as unknown as WorkspaceRecord;
}

async function readAllWorkspaceRecords(rootDirectory: string): Promise<{ records: WorkspaceRecord[]; malformed: string[] }> {
  const directory = join(rootDirectory, WORKSPACE_RECORDS_DIR);
  let entries: string[];
  try {
    entries = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { records: [], malformed: [] };
    throw error;
  }
  const records: WorkspaceRecord[] = [];
  const malformed: string[] = [];
  for (const entry of entries) {
    const id = entry.replace(/\.json$/, "");
    try {
      records.push(await readWorkspaceRecord(rootDirectory, id));
    } catch {
      malformed.push(id);
    }
  }
  return { records, malformed };
}

function workspaceBaseDirectory(repoRoot: string, baseDirectory?: string): string {
  if (baseDirectory === undefined) return join(repoRoot, DEFAULT_WORKSPACE_BASE);
  return isAbsolute(baseDirectory) ? baseDirectory : resolve(repoRoot, baseDirectory);
}

function newWorkspaceId(): string {
  return `ws-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

async function cleanupCreatedWorktree(repoRoot: string, worktreePath: string, branch: string): Promise<void> {
  try {
    await git(repoRoot, ["worktree", "remove", "--force", worktreePath]);
  } catch {
    // best-effort
  }
  try {
    await git(repoRoot, ["branch", "-D", branch]);
  } catch {
    // best-effort
  }
}

async function withWorkspaceLock<T>(
  rootDirectory: string,
  taskId: string,
  command: string,
  run: () => Promise<T>,
): Promise<T> {
  await mkdir(join(rootDirectory, WORKSPACE_RECORDS_DIR), { recursive: true });
  return withLocalMutationLock({
    path: join(rootDirectory, WORKSPACE_RECORDS_DIR, ".workspaces.lock"),
    kind: "workspace-mutation",
    command,
    taskId,
  }, run);
}

export async function createWorkspace(options: CreateWorkspaceOptions): Promise<CreateWorkspaceResult> {
  return withWorkspaceLock(options.rootDirectory, options.taskId, "workspace create", () => createWorkspaceLocked(options));
}

async function createWorkspaceLocked(options: CreateWorkspaceOptions): Promise<CreateWorkspaceResult> {
  const repoRoot = await resolveRepositoryRoot(options.rootDirectory);
  const repositoryId = `repository:${hashText(normalizePathCase(repoRoot))}`;
  const config = await readAgenticConfigFile(options.rootDirectory);
  const taskDirectory = config.taskDirectory;

  const taskPath = await findTaskFile(options.rootDirectory, options.taskId, taskDirectory);
  const { task } = await loadTaskFile(taskPath);
  if (task.owner !== options.owner || task.owner === "none") {
    throw new WorkspaceSafetyError(
      `Task ${task.id} is owned by ${task.owner}, not ${options.owner}; claim it before creating a workspace.`,
    );
  }
  if (task.state !== "doing" && task.state !== "review") {
    throw new WorkspaceSafetyError(`Task ${task.id} is ${task.state}; expected doing or review for workspace creation.`);
  }

  if (options.runId !== undefined && !isSafeRunId(options.runId)) {
    throw new WorkspaceSafetyError(`Unsafe run id: ${options.runId}`);
  }

  if (options.resourceId !== undefined) {
    const worker = config.resources?.workers.find((entry) => entry.id === options.resourceId);
    if (!worker) {
      throw new WorkspaceSafetyError(`Unknown worker resource: ${options.resourceId}.`);
    }
  }

  if (options.resourceId !== undefined && options.runId === undefined) {
    // A resource binding is only meaningful as provenance when the canonical run
    // it belongs to can be proven; otherwise cleanup could not re-validate it.
    throw new WorkspaceSafetyError("A workspace resource binding requires a canonical run id; pass --run together with --resource.");
  }

  if (options.runId !== undefined) {
    // Prove the caller-supplied task/run/resource binding against canonical
    // session state before any mutation. A user-provided binding is never
    // trusted on its own.
    const binding = await resolveCanonicalRunBinding(
      options.rootDirectory,
      task.id,
      options.runId,
      options.resourceId !== undefined ? { resourceId: options.resourceId } : {},
    );
    if (binding.status !== "matched") {
      throw new WorkspaceSafetyError(
        `Workspace run binding refused for task ${task.id} run ${options.runId}: ${binding.reason}.`,
      );
    }
  }

  const base = workspaceBaseDirectory(repoRoot, options.baseDirectory);
  const baseReal = await realpathAllowMissing(base);
  if (!isContainedWithin(await realpath(repoRoot), baseReal) && normalizePathCase(resolve(baseReal)) !== normalizePathCase(resolve(repoRoot))) {
    throw new WorkspaceSafetyError(`Workspace base must stay inside the repository: ${base}`);
  }

  const id = newWorkspaceId();
  const name = requireSafeSegment(options.name ?? id);
  const worktreePath = resolve(base, name);
  const worktreeReal = await realpathAllowMissing(worktreePath);
  if (normalizePathCase(worktreeReal) === normalizePathCase(await realpath(repoRoot))) {
    throw new WorkspaceSafetyError("Refusing to create a workspace at the repository root.");
  }
  if (!isContainedWithin(baseReal, worktreeReal)) {
    throw new WorkspaceSafetyError(`Workspace path escapes the allowed area: ${worktreePath}`);
  }

  // Collision checks before any mutation.
  if (await pathExists(worktreePath)) {
    throw new WorkspaceSafetyError(`Workspace path already exists: ${worktreePath}`);
  }
  const gitWorktrees = await listGitWorktrees(repoRoot);
  if (findWorktreeEntry(gitWorktrees, worktreePath)) {
    throw new WorkspaceSafetyError(`Path is already a registered Git worktree: ${worktreePath}`);
  }
  const { records: existingRecords } = await readAllWorkspaceRecords(options.rootDirectory);
  const activeForTask = existingRecords.filter((record) => record.taskId === task.id);
  if (activeForTask.some((record) => record.worktreePath === worktreePath || record.id === id)) {
    throw new WorkspaceSafetyError(`Workspace collision for task ${task.id}.`);
  }
  if (activeForTask.length > 0) {
    throw new WorkspaceSafetyError(
      `Task ${task.id} already has managed workspace ${activeForTask[0].id}; clean it up before creating another.`,
    );
  }
  if (existingRecords.some((record) => normalizePathCase(record.worktreePath) === normalizePathCase(worktreePath))) {
    throw new WorkspaceSafetyError(`An APK workspace record already claims this path: ${worktreePath}`);
  }

  const branch = options.branch ?? `apk/workspace/${id}`;
  const branchCheck = await gitError(repoRoot, ["check-ref-format", "--branch", branch]);
  if (branchCheck) {
    throw new WorkspaceSafetyError(`Invalid branch name: ${branch}.`);
  }
  const baseline = options.baseline ?? "HEAD";
  let baselineHeadSha: string;
  try {
    baselineHeadSha = (await git(repoRoot, ["rev-parse", "--verify", `${baseline}^{commit}`])).trim();
  } catch {
    throw new WorkspaceSafetyError(`Unknown baseline revision: ${baseline}`);
  }

  await mkdir(base, { recursive: true });
  try {
    await git(repoRoot, ["worktree", "add", "-b", branch, worktreePath, baselineHeadSha]);
  } catch (error: unknown) {
    const detail = error && typeof error === "object" && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr ?? "").trim()
      : error instanceof Error ? error.message : String(error);
    throw new WorkspaceSafetyError(`git worktree add failed: ${detail}`);
  }

  try {
    const worktreeRealAfter = await realpath(worktreePath);
    const gitDir = await worktreeGitDirectory(worktreePath);
    if (!gitDir) {
      throw new WorkspaceSafetyError("Cannot resolve the new worktree Git directory.");
    }
    const marker = randomBytes(16).toString("hex");
    const worktreeId = `worktree:${hashText(normalizePathCase(worktreeRealAfter))}`;
    const candidateRevision = (await git(worktreePath, ["rev-parse", "HEAD"])).trim();
    const markerFile: WorkspaceMarkerFile = {
      protocol: WORKSPACE_PROTOCOL,
      id,
      taskId: task.id,
      ...(options.runId ? { runId: options.runId } : {}),
      ...(options.resourceId ? { resourceId: options.resourceId } : {}),
      worktreeId,
      marker,
    };
    await writeFile(join(gitDir, WORKSPACE_MARKER_FILE), `${JSON.stringify(markerFile, null, 2)}\n`, "utf8");

    const record: WorkspaceRecord = {
      protocol: WORKSPACE_PROTOCOL,
      id,
      taskId: task.id,
      ...(options.runId ? { runId: options.runId } : {}),
      ...(options.resourceId ? { resourceId: options.resourceId } : {}),
      branch,
      worktreePath: worktreeRealAfter,
      worktreeId,
      repositoryId,
      baselineHeadSha,
      candidateRevision,
      marker,
      createdAt: new Date().toISOString(),
    };
    await mkdir(join(options.rootDirectory, WORKSPACE_RECORDS_DIR), { recursive: true });
    await writeFile(workspaceRecordPath(options.rootDirectory, id), `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { record };
  } catch (error: unknown) {
    await cleanupCreatedWorktree(repoRoot, worktreePath, branch);
    if (error instanceof WorkspaceSafetyError) throw error;
    throw new WorkspaceSafetyError(`Workspace creation failed after worktree add; rolled back: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface SafetyAssessment {
  state: WorkspaceState;
  safeToCleanup: boolean;
  reason: string;
  nextAction: string;
}

export async function assessWorkspaceSafety(
  rootDirectory: string,
  record: WorkspaceRecord,
  options: { repoRoot?: string; gitWorktrees?: readonly GitWorktreeEntry[]; baseDirectory?: string } = {},
): Promise<SafetyAssessment> {
  const repoRoot = options.repoRoot ?? await resolveRepositoryRoot(rootDirectory);
  const expectedRepositoryId = `repository:${hashText(normalizePathCase(repoRoot))}`;
  if (record.repositoryId !== expectedRepositoryId) {
    return { state: "foreign", safeToCleanup: false, reason: "Workspace record belongs to a different repository identity.", nextAction: "do not delete; inspect the record manually" };
  }

  const base = workspaceBaseDirectory(repoRoot, options.baseDirectory);
  const baseReal = await realpathAllowMissing(base);

  const recordPathNormalized = normalizePathCase(resolve(record.worktreePath));
  if (recordPathNormalized === normalizePathCase(await realpath(repoRoot))) {
    return { state: "unsafe", safeToCleanup: false, reason: "Workspace path resolves to the repository root.", nextAction: "remove the record manually after review" };
  }

  const exists = await pathExists(record.worktreePath);
  const worktreeReal = exists ? await realpath(record.worktreePath) : await realpathAllowMissing(record.worktreePath);
  if (!isContainedWithin(baseReal, worktreeReal)) {
    return { state: "unsafe", safeToCleanup: false, reason: "Workspace path is outside the allowed workspace area.", nextAction: "remove the record manually after review" };
  }

  const gitWorktrees = options.gitWorktrees ?? await listGitWorktrees(repoRoot);
  const registration = findWorktreeEntry(gitWorktrees, worktreeReal);

  if (!exists) {
    if (registration) {
      return { state: "unregistered", safeToCleanup: false, reason: "Worktree path is missing but still registered in Git.", nextAction: `run git worktree prune in the repository, then re-check workspace ${record.id}` };
    }
    return { state: "missing", safeToCleanup: true, reason: "Managed worktree no longer exists and Git has no registration.", nextAction: `apk workspaces cleanup ${record.id} --apply to remove stale metadata` };
  }

  if (!registration) {
    return { state: "foreign", safeToCleanup: false, reason: "Path exists but is not a registered Git worktree of this repository.", nextAction: "do not delete; inspect the path manually" };
  }
  if (registration.detached) {
    return { state: "ambiguous", safeToCleanup: false, reason: "Registered worktree is detached; branch ownership cannot be proven.", nextAction: "do not delete; inspect the worktree manually" };
  }
  const registeredBranch = registration.branch?.replace(/^refs\/heads\//, "");
  if (!registeredBranch || registeredBranch !== record.branch) {
    return { state: "foreign", safeToCleanup: false, reason: "Git worktree branch does not match the APK record.", nextAction: "do not delete; inspect the worktree manually" };
  }

  const gitDir = await worktreeGitDirectory(record.worktreePath);
  if (!gitDir) {
    return { state: "ambiguous", safeToCleanup: false, reason: "Cannot resolve the worktree Git directory.", nextAction: "inspect the worktree manually" };
  }
  const marker = await readWorkspaceMarker(gitDir);
  if (
    !marker
    || marker.id !== record.id
    || marker.taskId !== record.taskId
    || marker.marker !== record.marker
    || marker.worktreeId !== record.worktreeId
    || marker.runId !== record.runId
    || marker.resourceId !== record.resourceId
  ) {
    return { state: "foreign", safeToCleanup: false, reason: "Ownership marker is missing or does not match the APK record.", nextAction: "do not delete; inspect the path manually" };
  }

  const currentWorktreeId = `worktree:${hashText(normalizePathCase(worktreeReal))}`;
  if (currentWorktreeId !== record.worktreeId) {
    return { state: "foreign", safeToCleanup: false, reason: "Worktree path no longer matches the recorded worktree identity.", nextAction: "do not delete; inspect the path manually" };
  }

  let dirty = "";
  try {
    dirty = (await git(record.worktreePath, ["status", "--porcelain"])).trim();
  } catch {
    return { state: "ambiguous", safeToCleanup: false, reason: "Cannot read worktree Git status.", nextAction: "inspect the worktree manually" };
  }
  if (dirty.length > 0) {
    return { state: "active", safeToCleanup: false, reason: "Worktree has uncommitted or unmerged changes.", nextAction: `commit, stash, or discard the work in ${record.worktreeId} before cleanup` };
  }

  if (record.runId) {
    const runState = await assessWorkspaceRun(rootDirectory, record.taskId, record.runId, record.resourceId);
    if (runState.state === "active") {
      return { state: "active", safeToCleanup: false, reason: `Workspace is bound to an open activated run: ${runState.reason}`, nextAction: `finish or release run ${record.runId} before cleanup` };
    }
    if (runState.state === "unknown") {
      return { state: "unknown", safeToCleanup: false, reason: `Cannot prove the bound run is inactive: ${runState.reason}`, nextAction: `inspect run ${record.runId} session state manually; automatic cleanup is refused` };
    }
  }

  return { state: "active", safeToCleanup: true, reason: "Exact APK-owned worktree with a clean, registered Git state.", nextAction: `apk workspaces cleanup ${record.id} --apply` };
}

export const WORKSPACE_RUN_STATES = ["active", "terminal", "unknown"] as const;
export type WorkspaceRunState = (typeof WORKSPACE_RUN_STATES)[number];

export interface WorkspaceRunAssessment {
  state: WorkspaceRunState;
  reason: string;
}

/**
 * Resolve a bound worker run's lifecycle and canonical resource identity without
 * ever treating an unreadable or malformed record as inactive. An activated
 * session is active only while its task is still open; a done/canceled task
 * makes the activation historical. When the record carries a resourceId it must
 * match the canonical session resource exactly. Any uncertainty fails closed to
 * `unknown`, which refuses destructive cleanup.
 */
export async function assessWorkspaceRun(
  rootDirectory: string,
  taskId: string,
  runId: string,
  expectedResourceId?: string,
): Promise<WorkspaceRunAssessment> {
  const binding = await resolveCanonicalRunBinding(
    rootDirectory,
    taskId,
    runId,
    expectedResourceId !== undefined ? { resourceId: expectedResourceId } : {},
  );
  if (binding.status === "unavailable") {
    return { state: "unknown", reason: `canonical worker-session state unavailable: ${binding.reason}` };
  }
  if (binding.status === "missing") {
    return { state: "unknown", reason: "no canonical worker-session record for the bound run" };
  }
  if (binding.status === "malformed") {
    return { state: "unknown", reason: "bound worker-session metadata is malformed" };
  }
  if (binding.status === "mismatch") {
    return { state: "unknown", reason: `bound run/resource identity mismatch: ${binding.reason}` };
  }
  if (!binding.activated) {
    return { state: "unknown", reason: "bound worker session has no activation marker" };
  }

  let taskState: TaskState;
  try {
    const config = await readAgenticConfigFile(rootDirectory);
    const taskPath = await findTaskFile(rootDirectory, taskId, config.taskDirectory);
    const { task } = await loadTaskFile(taskPath);
    taskState = task.state;
  } catch (error: unknown) {
    return { state: "unknown", reason: `cannot resolve the bound task state: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (taskState === "done" || taskState === "canceled") {
    return { state: "terminal", reason: `bound task is ${taskState}; activation is historical` };
  }
  return { state: "active", reason: `bound task is ${taskState}` };
}

export async function listWorkspaceStatuses(
  rootDirectory: string,
  options: { baseDirectory?: string } = {},
): Promise<WorkspaceStatusEntry[]> {
  let repoRoot: string | undefined;
  try {
    repoRoot = await resolveRepositoryRoot(rootDirectory);
  } catch {
    repoRoot = undefined;
  }
  const { records, malformed } = await readAllWorkspaceRecords(rootDirectory);
  const gitWorktrees = repoRoot ? await listGitWorktrees(repoRoot) : [];
  const entries: WorkspaceStatusEntry[] = [];
  for (const id of malformed) {
    entries.push({
      id,
      taskId: "unknown",
      branch: "unknown",
      worktreeId: "unknown",
      state: "ambiguous",
      safeToCleanup: false,
      reason: "Workspace record is malformed and cannot be verified.",
      nextAction: "inspect the record manually; automatic cleanup is refused",
    });
  }
  for (const record of records) {
    const assessment = await assessWorkspaceSafety(rootDirectory, record, {
      ...(repoRoot ? { repoRoot } : {}),
      gitWorktrees,
      ...(options.baseDirectory ? { baseDirectory: options.baseDirectory } : {}),
    });
    entries.push({
      id: record.id,
      taskId: record.taskId,
      ...(record.runId ? { runId: record.runId } : {}),
      ...(record.resourceId ? { resourceId: record.resourceId } : {}),
      branch: record.branch,
      worktreeId: record.worktreeId,
      state: assessment.state,
      safeToCleanup: assessment.safeToCleanup,
      reason: assessment.reason,
      nextAction: assessment.nextAction,
    });
  }
  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export async function removeWorkspace(options: RemoveWorkspaceOptions): Promise<RemoveWorkspaceResult> {
  return withWorkspaceLock(options.rootDirectory, options.id, "workspace cleanup", () => removeWorkspaceLocked(options));
}

async function removeWorkspaceLocked(options: RemoveWorkspaceOptions): Promise<RemoveWorkspaceResult> {
  const record = await readWorkspaceRecord(options.rootDirectory, options.id);
  const repoRoot = await resolveRepositoryRoot(options.rootDirectory);
  const assessment = await assessWorkspaceSafety(options.rootDirectory, record, { repoRoot });

  if (assessment.state === "missing" && assessment.safeToCleanup) {
    if (!options.apply) {
      return { applied: false, removed: false, state: assessment.state, reason: `dry-run: ${assessment.reason}`, record };
    }
    await rm(workspaceRecordPath(options.rootDirectory, record.id), { force: true });
    return { applied: true, removed: true, state: assessment.state, reason: "Removed stale APK workspace metadata.", record };
  }

  if (assessment.state !== "active" || !assessment.safeToCleanup) {
    throw new WorkspaceSafetyError(`Refusing to remove workspace ${record.id}: ${assessment.reason}`);
  }

  if (!options.apply) {
    return { applied: false, removed: false, state: assessment.state, reason: `dry-run: ${assessment.reason}`, record };
  }

  try {
    await git(repoRoot, ["worktree", "remove", record.worktreePath]);
  } catch (error: unknown) {
    const detail = error && typeof error === "object" && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr ?? "").trim()
      : error instanceof Error ? error.message : String(error);
    throw new WorkspaceSafetyError(`Refusing to remove workspace ${record.id}: git worktree remove failed: ${detail}`);
  }
  await git(repoRoot, ["worktree", "prune"]);
  await rm(workspaceRecordPath(options.rootDirectory, record.id), { force: true });
  return { applied: true, removed: true, state: assessment.state, reason: "Removed exact APK-owned workspace.", record };
}

export function renderWorkspaceStatuses(entries: readonly WorkspaceStatusEntry[], json = false): string {
  if (json) {
    return `${JSON.stringify({ protocol: WORKSPACE_STATE_PROTOCOL, workspaces: entries }, null, 2)}\n`;
  }
  const lines = [`Workspaces: ${entries.length}`];
  for (const entry of entries) {
    lines.push(`- ${entry.id} task=${entry.taskId}${entry.runId ? ` run=${entry.runId}` : ""} branch=${entry.branch} state=${entry.state} cleanup=${entry.safeToCleanup ? "safe" : "blocked"} worktree=${entry.worktreeId.slice(0, 16)} reason=${entry.reason} next=${entry.nextAction}`);
  }
  if (entries.length === 0) lines.push("- none");
  lines.push("");
  return lines.join("\n");
}

export function renderCreateWorkspaceResult(result: CreateWorkspaceResult, json = false): string {
  if (json) {
    return `${JSON.stringify({ protocol: WORKSPACE_STATE_PROTOCOL, workspace: result.record }, null, 2)}\n`;
  }
  return [
    `Workspace: ${result.record.id}`,
    `Task: ${result.record.taskId}`,
    `Branch: ${result.record.branch}`,
    `Worktree id: ${result.record.worktreeId}`,
    `Baseline: ${result.record.baselineHeadSha ?? "unknown"}`,
    `Candidate: ${result.record.candidateRevision ?? "unknown"}`,
    "",
  ].join("\n");
}

export function renderRemoveWorkspaceResult(result: RemoveWorkspaceResult, json = false): string {
  if (json) {
    return `${JSON.stringify({ protocol: WORKSPACE_STATE_PROTOCOL, applied: result.applied, removed: result.removed, state: result.state, reason: result.reason, ...(result.record ? { workspace: result.record } : {}) }, null, 2)}\n`;
  }
  return [
    `Workspace: ${result.record?.id ?? "unknown"}`,
    `Applied: ${result.applied}`,
    `Removed: ${result.removed}`,
    `State: ${result.state}`,
    `Reason: ${result.reason}`,
    "",
  ].join("\n");
}
