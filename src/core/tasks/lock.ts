import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname as readHostname } from "node:os";
import { dirname } from "node:path";
import { promisify } from "node:util";

export const LOCAL_LOCK_STALE_AFTER_MS = 5 * 60 * 1000;

export type LocalLockState = "absent" | "live" | "dead" | "malformed" | "uncertain";
export type ProcessLiveness = "alive" | "dead" | "uncertain";

export interface LocalLockMetadata {
  schema: 1;
  ownerId: string;
  kind: string;
  pid: number;
  hostname: string;
  processStart: string;
  created: string;
  command?: string;
  taskId?: string;
}

export interface LocalLockInspection {
  path: string;
  state: LocalLockState;
  reason: string;
  old: boolean;
  ageMs?: number;
  metadata?: LocalLockMetadata;
}

export interface LocalLockRuntime {
  now?: () => number;
  hostname?: string;
  pid?: number;
  processStart?: string;
  processLiveness?: (pid: number) => ProcessLiveness | Promise<ProcessLiveness>;
  processStartIdentity?: (pid: number) => string | undefined | Promise<string | undefined>;
  ownerId?: () => string;
  readLockFile?: (path: string) => Promise<string>;
  beforePublish?: (path: string, metadata: LocalLockMetadata) => void | Promise<void>;
  beforeOwnedRemoval?: (path: string, metadata: LocalLockMetadata) => void | Promise<void>;
}

export interface LocalLockOptions {
  path: string;
  kind: string;
  command?: string;
  taskId?: string;
  timeoutMs?: number;
  retryMs?: number;
  runtime?: LocalLockRuntime;
}

interface ResolvedLocalLockRuntime {
  now: () => number;
  hostname: string;
  pid: number;
  processStart: string;
  processLiveness: NonNullable<LocalLockRuntime["processLiveness"]>;
  processStartIdentity: NonNullable<LocalLockRuntime["processStartIdentity"]>;
  ownerId: () => string;
  readLockFile: NonNullable<LocalLockRuntime["readLockFile"]>;
  beforePublish?: LocalLockRuntime["beforePublish"];
  beforeOwnedRemoval?: LocalLockRuntime["beforeOwnedRemoval"];
}

const execFileAsync = promisify(execFile);
const PROCESS_START = new Date(Date.now() - process.uptime() * 1000).toISOString();
const PROCESS_START_TOLERANCE_MS = 5_000;
const LOCK_READ_MAX_ATTEMPTS = 4;
const LOCK_READ_RETRY_MS = 5;
const TRANSIENT_LOCK_READ_ERRORS = new Set(["EBUSY", "EPERM"]);

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
}

function defaultProcessLiveness(pid: number): ProcessLiveness {
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error: unknown) {
    return errorCode(error) === "ESRCH" ? "dead" : "uncertain";
  }
}

async function defaultProcessStartIdentity(pid: number): Promise<string | undefined> {
  if (pid === process.pid) return PROCESS_START;
  try {
    const result = process.platform === "win32"
      ? await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `[System.Diagnostics.Process]::GetProcessById(${pid}).StartTime.ToUniversalTime().ToString('O')`,
      ], { windowsHide: true })
      : await execFileAsync("ps", ["-o", "lstart=", "-p", String(pid)]);
    const timestamp = Date.parse(String(result.stdout).trim());
    return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
  } catch {
    return undefined;
  }
}

function runtimeValues(runtime: LocalLockRuntime = {}): ResolvedLocalLockRuntime {
  return {
    now: runtime.now ?? Date.now,
    hostname: runtime.hostname ?? readHostname(),
    pid: runtime.pid ?? process.pid,
    processStart: runtime.processStart ?? PROCESS_START,
    processLiveness: runtime.processLiveness ?? defaultProcessLiveness,
    processStartIdentity: runtime.processStartIdentity ?? defaultProcessStartIdentity,
    ownerId: runtime.ownerId ?? randomUUID,
    readLockFile: runtime.readLockFile ?? ((path) => readFile(path, "utf8")),
    beforePublish: runtime.beforePublish,
    beforeOwnedRemoval: runtime.beforeOwnedRemoval,
  };
}

function isMetadata(value: unknown): value is LocalLockMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Partial<LocalLockMetadata>;
  return metadata.schema === 1
    && typeof metadata.ownerId === "string"
    && metadata.ownerId.length > 0
    && typeof metadata.kind === "string"
    && metadata.kind.length > 0
    && Number.isSafeInteger(metadata.pid)
    && (metadata.pid ?? 0) > 0
    && typeof metadata.hostname === "string"
    && metadata.hostname.length > 0
    && typeof metadata.processStart === "string"
    && !Number.isNaN(Date.parse(metadata.processStart))
    && typeof metadata.created === "string"
    && !Number.isNaN(Date.parse(metadata.created))
    && (metadata.command === undefined || typeof metadata.command === "string")
    && (metadata.taskId === undefined || typeof metadata.taskId === "string");
}

async function missingOrRead(
  path: string,
  readLockFile: NonNullable<LocalLockRuntime["readLockFile"]> = (target) => readFile(target, "utf8"),
): Promise<string | undefined> {
  for (let attempt = 1; attempt <= LOCK_READ_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await readLockFile(path);
    } catch (error: unknown) {
      const code = errorCode(error);
      if (code === "ENOENT") return undefined;
      if (!TRANSIENT_LOCK_READ_ERRORS.has(code ?? "") || attempt === LOCK_READ_MAX_ATTEMPTS) throw error;
      await wait(LOCK_READ_RETRY_MS);
    }
  }
  throw new Error("Unreachable lock read retry state.");
}

function parseMetadata(raw: string | undefined): LocalLockMetadata | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMetadata(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function sameOwner(left: LocalLockMetadata | undefined, right: LocalLockMetadata | undefined): boolean {
  return left !== undefined && right !== undefined && left.ownerId === right.ownerId;
}

function sameProcessStart(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return !Number.isNaN(leftTime)
    && !Number.isNaN(rightTime)
    && Math.abs(leftTime - rightTime) <= PROCESS_START_TOLERANCE_MS;
}

function recoveryHint(path: string): string {
  const kind = path.replace(/\\/g, "/").includes("/evidence.append.lock") ? "evidence" : "task";
  return `apk task lock recover --kind ${kind} --force`;
}

function deadInspection(
  path: string,
  metadata: LocalLockMetadata,
  ageMs: number,
  old: boolean,
): LocalLockInspection {
  return {
    path,
    state: "dead",
    metadata,
    ageMs,
    old,
    reason: `local owner PID ${metadata.pid} is not running`,
  };
}

export async function inspectLocalLock(
  path: string,
  runtime: LocalLockRuntime = {},
): Promise<LocalLockInspection> {
  const values = runtimeValues(runtime);
  const raw = await missingOrRead(path, values.readLockFile);
  if (raw === undefined) return { path, state: "absent", reason: "lock does not exist", old: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      path,
      state: "malformed",
      reason: `metadata is not valid JSON; verify no owner is running, then use ${recoveryHint(path)}`,
      old: false,
    };
  }
  if (!isMetadata(parsed)) {
    return {
      path,
      state: "malformed",
      reason: `metadata does not match local lock schema v1; verify no owner is running, then use ${recoveryHint(path)}`,
      old: false,
    };
  }

  const ageMs = Math.max(0, values.now() - Date.parse(parsed.created));
  const old = ageMs > LOCAL_LOCK_STALE_AFTER_MS;
  if (parsed.hostname !== values.hostname) {
    return {
      path,
      state: "uncertain",
      metadata: parsed,
      ageMs,
      old,
      reason: `owner host ${parsed.hostname} differs from local host ${values.hostname}; age cannot prove death`,
    };
  }

  const liveness = await values.processLiveness(parsed.pid);
  if (liveness === "dead") return deadInspection(path, parsed, ageMs, old);
  if (liveness === "uncertain") {
    return {
      path,
      state: "uncertain",
      metadata: parsed,
      ageMs,
      old,
      reason: `local owner PID ${parsed.pid} liveness is unavailable; age cannot prove death`,
    };
  }

  const observedStart = parsed.pid === values.pid
    ? values.processStart
    : await values.processStartIdentity(parsed.pid);
  if (observedStart === undefined) {
    const rechecked = await values.processLiveness(parsed.pid);
    if (rechecked === "dead") return deadInspection(path, parsed, ageMs, old);
    return {
      path,
      state: "uncertain",
      metadata: parsed,
      ageMs,
      old,
      reason: `PID ${parsed.pid} is running but process-start identity is unavailable; age cannot prove ownership`,
    };
  }
  if (!sameProcessStart(parsed.processStart, observedStart)) {
    return {
      path,
      state: "uncertain",
      metadata: parsed,
      ageMs,
      old,
      reason: `PID ${parsed.pid} process-start identity differs; PID reuse cannot prove owner death`,
    };
  }
  return {
    path,
    state: "live",
    metadata: parsed,
    ageMs,
    old,
    reason: `local owner PID ${parsed.pid} is running${old ? "; lock is old but cannot be stolen" : ""}`,
  };
}

export async function inspectLocalMutationLock(
  path: string,
  runtime: LocalLockRuntime = {},
): Promise<LocalLockInspection> {
  const recovery = await inspectLocalLock(`${path}.recovery`, runtime);
  return recovery.state === "absent" ? inspectLocalLock(path, runtime) : {
    ...recovery,
    reason: `recovery marker: ${recovery.reason}`,
  };
}

export function renderLocalLockInspection(inspection: LocalLockInspection): string {
  const owner = inspection.metadata
    ? ` owner=${inspection.metadata.ownerId} pid=${inspection.metadata.pid} host=${inspection.metadata.hostname}`
    : "";
  const context = inspection.metadata?.taskId ? ` task=${inspection.metadata.taskId}` : "";
  const command = inspection.metadata?.command ? ` command=${inspection.metadata.command}` : "";
  return `${inspection.state}:${owner}${context}${command} ${inspection.reason}`.replace(/:\s+/, ": ");
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function lockMetadata(options: LocalLockOptions, values: ResolvedLocalLockRuntime, kind = options.kind): LocalLockMetadata {
  return {
    schema: 1,
    ownerId: values.ownerId(),
    kind,
    pid: values.pid,
    hostname: values.hostname,
    processStart: values.processStart,
    created: new Date(values.now()).toISOString(),
    command: options.command,
    taskId: options.taskId,
  };
}

async function tryPublishLock(
  path: string,
  metadata: LocalLockMetadata,
  values: ResolvedLocalLockRuntime,
): Promise<boolean> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.owner-${metadata.ownerId}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(metadata)}\n`, { encoding: "utf8", flag: "wx" });
  try {
    await values.beforePublish?.(path, metadata);
    try {
      await link(temporaryPath, path);
      return true;
    } catch (error: unknown) {
      if (errorCode(error) === "EEXIST") return false;
      throw error;
    }
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function removeIfOwned(
  path: string,
  metadata: LocalLockMetadata,
  values: ResolvedLocalLockRuntime,
  invokeHook: boolean,
): Promise<boolean> {
  if (!sameOwner(parseMetadata(await missingOrRead(path, values.readLockFile)), metadata)) return false;
  if (invokeHook) await values.beforeOwnedRemoval?.(path, metadata);
  if (!sameOwner(parseMetadata(await missingOrRead(path, values.readLockFile)), metadata)) return false;
  await rm(path, { force: true });
  return true;
}

function lockError(options: LocalLockOptions, inspection: LocalLockInspection): Error {
  const label = options.kind === "task-mutation" ? "Task lock exists" : "Local lock exists";
  return new Error(`${label}: ${options.path}. ${renderLocalLockInspection(inspection)}`);
}

async function withRecoveryGuard<T>(options: LocalLockOptions, run: () => Promise<T>): Promise<T> {
  const recoveryPath = `${options.path}.recovery`;
  const values = runtimeValues(options.runtime);
  const metadata = lockMetadata(options, values, `${options.kind}-recovery`);
  const deadline = values.now() + 10_000;
  while (!await tryPublishLock(recoveryPath, metadata, values)) {
    const inspection = await inspectLocalLock(recoveryPath, options.runtime);
    if (inspection.state === "absent") continue;
    if (inspection.state === "dead") {
      await recoverLocalLock({
        path: recoveryPath,
        kind: `${options.kind}-recovery`,
        command: options.command,
        runtime: options.runtime,
      });
      continue;
    }
    if (inspection.state === "live" && values.now() < deadline) {
      await wait(options.retryMs ?? 5);
      continue;
    }
    throw lockError(options, inspection);
  }

  try {
    return await run();
  } finally {
    await removeIfOwned(recoveryPath, metadata, values, false);
  }
}

async function recoverDeadLock(
  options: LocalLockOptions,
  expected: LocalLockInspection,
): Promise<boolean> {
  return withRecoveryGuard(options, async () => {
    const current = await inspectLocalLock(options.path, options.runtime);
    if (current.state !== "dead" || !sameOwner(current.metadata, expected.metadata)) return false;
    await rm(options.path, { force: true });
    return true;
  });
}

async function releaseOwnedLock(options: LocalLockOptions, metadata: LocalLockMetadata): Promise<void> {
  const values = runtimeValues(options.runtime);
  await withRecoveryGuard(options, async () => {
    await removeIfOwned(options.path, metadata, values, true);
  });
}

export async function withLocalMutationLock<T>(
  options: LocalLockOptions,
  run: () => Promise<T>,
): Promise<T> {
  const values = runtimeValues(options.runtime);
  const deadline = values.now() + (options.timeoutMs ?? 0);
  const retryMs = options.retryMs ?? 5;
  const metadata = lockMetadata(options, values);

  while (!await tryPublishLock(options.path, metadata, values)) {
    const recovery = await inspectLocalLock(`${options.path}.recovery`, options.runtime);
    if (recovery.state !== "absent") {
      if (recovery.state === "dead") {
        await recoverLocalLock({
          path: recovery.path,
          kind: `${options.kind}-recovery`,
          command: options.command,
          runtime: options.runtime,
        });
        continue;
      }
      if (recovery.state !== "live" || values.now() >= deadline) throw lockError(options, recovery);
      await wait(retryMs);
      continue;
    }

    const inspection = await inspectLocalLock(options.path, options.runtime);
    if (inspection.state === "absent") continue;
    if (inspection.state === "dead") {
      await recoverDeadLock(options, inspection);
      continue;
    }
    if (inspection.state === "live" && values.now() < deadline) {
      await wait(retryMs);
      continue;
    }
    throw lockError(options, inspection);
  }

  try {
    return await run();
  } finally {
    await releaseOwnedLock(options, metadata);
  }
}

export interface RecoverLocalLockResult {
  recovered: boolean;
  inspection: LocalLockInspection;
}

export async function recoverLocalLock(
  options: Pick<LocalLockOptions, "path" | "kind" | "command" | "runtime"> & { force?: boolean },
): Promise<RecoverLocalLockResult> {
  let recoveredMarker = false;
  const recovery = await inspectLocalLock(`${options.path}.recovery`, options.runtime);
  if (recovery.state !== "absent") {
    if (recovery.state === "live") {
      throw new Error(`Refusing recovery while another recovery owner is live. ${renderLocalLockInspection(recovery)}`);
    }
    if (recovery.state !== "dead" && !options.force) {
      throw new Error(`Recovery marker ownership is ${recovery.state}; rerun with --force only after verifying no owner is running. ${renderLocalLockInspection(recovery)}`);
    }
    const nested = await recoverLocalLock({
      path: recovery.path,
      kind: `${options.kind}-recovery`,
      command: options.command,
      runtime: options.runtime,
      force: options.force,
    });
    recoveredMarker = nested.recovered;
  }

  const inspection = await inspectLocalLock(options.path, options.runtime);
  if (inspection.state === "absent") return { recovered: recoveredMarker, inspection };
  if (inspection.state === "live") {
    throw new Error(`Refusing to recover a live lock. ${renderLocalLockInspection(inspection)}`);
  }
  if (inspection.state !== "dead" && !options.force) {
    throw new Error(`Lock ownership is ${inspection.state}; rerun with --force only after verifying no owner is running. ${renderLocalLockInspection(inspection)}`);
  }
  if (inspection.state === "dead") {
    const recovered = await recoverDeadLock(options, inspection);
    return { recovered, inspection: await inspectLocalLock(options.path, options.runtime) };
  }

  const values = runtimeValues(options.runtime);
  const expectedRaw = await missingOrRead(options.path, values.readLockFile);
  const recovered = await withRecoveryGuard(options, async () => {
    if (await missingOrRead(options.path, values.readLockFile) !== expectedRaw) {
      throw new Error("Lock changed while recovery was being prepared; inspect the new owner and retry.");
    }
    const current = await inspectLocalLock(options.path, options.runtime);
    if (current.state === "live") {
      throw new Error(`Refusing to recover a live lock. ${renderLocalLockInspection(current)}`);
    }
    await rm(options.path, { force: true });
    return true;
  });
  return { recovered, inspection: await inspectLocalLock(options.path, options.runtime) };
}
