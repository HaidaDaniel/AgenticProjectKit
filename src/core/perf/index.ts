import { exec, execFile, spawn, type ExecFileOptions, type ExecOptions } from "node:child_process";
import { appendFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

export const PERF_SCHEMA_VERSION = 2 as const;
export const LEGACY_PERF_SCHEMA_VERSION = 1 as const;
type PerfTraceSchemaVersion = typeof LEGACY_PERF_SCHEMA_VERSION | typeof PERF_SCHEMA_VERSION;
export const PERF_RUNTIME_DIRECTORY = ".agentic/perf";
const ACTIVE_SESSION_FILE = "session.json";
const LAST_SESSION_FILE = "last-session.json";
const TRACE_FILE = "trace.jsonl";
const PERF_GIT_EXCLUDE_ENTRY = ".agentic/perf/*";
const MAX_TRACE_BYTES = 8 * 1024 * 1024;
const MAX_RECORD_BYTES = 64 * 1024;

export type PerfCategory =
  | "apk-process"
  | "apk-internal"
  | "apk-startup"
  | "apk-bootstrap"
  | "task-config"
  | "filesystem"
  | "git"
  | "external-check"
  | "external-other"
  | "repo-tool";

export type PerfExecCategory = "repo-tool" | "test" | "lint" | "typecheck" | "build" | "git";

export interface PerfClock {
  now(): bigint;
}

export const monotonicClock: PerfClock = {
  now: () => process.hrtime.bigint(),
};

interface PerfSessionState {
  schemaVersion: PerfTraceSchemaVersion;
  sessionId: string;
  label: string;
  startedAt: string;
}

export interface PerfInterval {
  startNs: string;
  endNs: string;
}

export interface PerfSpanRecord {
  spanKind: "internal" | "subprocess";
  category: PerfCategory;
  commandKind: string;
  interval: PerfInterval;
  durationMs: number;
  normalizedIdentity?: string;
  wrapped?: boolean;
}

export interface PerfInvocationRecord {
  schemaVersion: PerfTraceSchemaVersion;
  recordType: "invocation";
  sessionId: string;
  invocationId: string;
  commandKind: string;
  interval: PerfInterval;
  /** Present only in schema v2: reconstructed monotonic Node process lifetime. */
  fullProcessInterval?: PerfInterval;
  durationMs: number;
  spans: PerfSpanRecord[];
  memory?: {
    rssBytes: number;
    heapUsedBytes: number;
  };
}

interface ActiveInvocation {
  session: PerfSessionState;
  invocationId: string;
  commandKind: string;
  startNs: bigint;
  spans: PerfSpanRecord[];
  clock: PerfClock;
  fullProcessStartNs: bigint;
}

export interface PerfSubprocessMetadata {
  category?: PerfCategory;
  commandKind?: string;
  normalizedIdentity?: string;
  wrapped?: boolean;
}

export interface PerfStatus {
  active: boolean;
  sessionId?: string;
  label?: string;
  startedAt?: string;
}

export interface PerfAmdahlScenario {
  factor: number;
  label: string;
  estimatedToolingWallMs: number;
  improvementPercent: number;
  speedup: number;
}

export interface PerfReport {
  schemaVersion: typeof PERF_SCHEMA_VERSION;
  traceSchemaVersions: PerfTraceSchemaVersion[];
  fullProcessAvailable: boolean;
  sessionId?: string;
  label?: string;
  invocationCount: number;
  wrappedToolCount: number;
  observedCommandCount: number;
  unwrappedExternalCommands: "unknown";
  malformedRecordCount: number;
  incompleteCoverage: boolean;
  observedToolingWallMs: number;
  apkFullProcessUnionMs: number | null;
  apkInstrumentedUnionMs: number;
  apkStartupResidualMs: number | null;
  apkInternalInstrumentedMs: number;
  apkRewriteSensitiveMs: number | null;
  gitMs: number;
  externalCheckMs: number;
  wrappedRepoToolMs: number;
  otherObservedMs: number;
  commandKindMs: Record<string, number>;
  childDurationSumMs: number;
  childWallClockUnionMs: number;
  categoryMs: Record<string, number>;
  invocationDurationsMs: number[];
  invocationStats: PerfStats;
  fullProcessDurationsMs: number[];
  fullProcessStats: PerfStats;
  rssSamplesBytes: number[];
  heapUsedSamplesBytes: number[];
  scenarios: PerfAmdahlScenario[];
  exclusions: {
    llmGeneration: "excluded";
    idleAndUnobservedGaps: "excluded";
  };
  warnings: string[];
}

export interface PerfStats {
  minMs?: number;
  medianMs?: number;
  p95Ms?: number;
  maxMs?: number;
}

let activeInvocation: ActiveInvocation | undefined;

// Node does not expose a process-start hrtime directly. At module evaluation,
// reconstruct the monotonic boundary from the current monotonic clock and the
// monotonic process uptime. This is deliberately named reconstructed rather
// than spawn-to-exit: the parent process remains the independent benchmark
// boundary for exact process spawn timing.
const RECONSTRUCTED_PROCESS_START_NS = process.hrtime.bigint()
  - BigInt(Math.max(0, Math.floor(process.uptime() * 1_000_000_000)));

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

function runtimePath(rootDirectory: string, file: string): string {
  return join(rootDirectory, PERF_RUNTIME_DIRECTORY, file);
}

function boundedLabel(label: string): string {
  const value = label.trim();
  if (value.length === 0 || value.length > 120 || /[\r\n]/.test(value)) {
    throw new Error("Performance session label must be 1-120 characters without line breaks.");
  }
  return value;
}

function durationMs(startNs: bigint, endNs: bigint): number {
  const delta = endNs >= startNs ? endNs - startNs : 0n;
  return Number(delta) / 1_000_000;
}

function interval(startNs: bigint, endNs: bigint): PerfInterval {
  return { startNs: String(startNs), endNs: String(endNs) };
}

function parseNs(value: unknown): bigint | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function isPerfSessionState(value: unknown): value is PerfSessionState {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (record.schemaVersion === LEGACY_PERF_SCHEMA_VERSION || record.schemaVersion === PERF_SCHEMA_VERSION)
    && typeof record.sessionId === "string"
    && typeof record.label === "string"
    && typeof record.startedAt === "string";
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function readSessionFile(rootDirectory: string, file: string): Promise<PerfSessionState | undefined> {
  const text = await readOptional(runtimePath(rootDirectory, file));
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return isPerfSessionState(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function readActiveSession(rootDirectory: string): Promise<PerfSessionState | undefined> {
  return readSessionFile(rootDirectory, ACTIVE_SESSION_FILE);
}

async function ensureRuntimeDirectory(rootDirectory: string): Promise<void> {
  await mkdir(join(rootDirectory, PERF_RUNTIME_DIRECTORY), { recursive: true });
}

/**
 * Keep profiler state local even when a downstream checkout predates the
 * canonical APK .gitignore entry. Git's per-repository exclude file is local
 * metadata, so this does not mutate tracked project files or task provenance.
 */
async function ensurePerfGitExclude(rootDirectory: string): Promise<void> {
  try {
    const result = await execFileAsync("git", ["rev-parse", "--git-path", "info/exclude"], {
      cwd: rootDirectory,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const excludePath = resolve(rootDirectory, result.stdout.trim());
    if (excludePath.length === 0) return;
    const existing = await readOptional(excludePath);
    const lines = (existing ?? "").split(/\r?\n/);
    if (lines.includes(PERF_GIT_EXCLUDE_ENTRY)) return;
    let content = existing ?? "";
    if (content.length > 0 && !content.endsWith("\n")) content += "\n";
    await mkdir(dirname(excludePath), { recursive: true });
    await writeFile(excludePath, `${content}${PERF_GIT_EXCLUDE_ENTRY}\n`, "utf8");
  } catch {
    // Local profiling must remain best-effort; normal APK work must not fail.
  }
}

async function safeAppendRecord(rootDirectory: string, record: PerfInvocationRecord): Promise<void> {
  try {
    const serialized = JSON.stringify(record);
    if (serialized.length > MAX_RECORD_BYTES) return;
    await ensureRuntimeDirectory(rootDirectory);
    const tracePath = runtimePath(rootDirectory, TRACE_FILE);
    try {
      const traceStat = await stat(tracePath);
      if (traceStat.size + Buffer.byteLength(serialized) + 1 > MAX_TRACE_BYTES) return;
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) return;
    }
    await appendFile(tracePath, `${serialized}\n`, "utf8");
  } catch {
    // Profiling is diagnostic and must never make normal APK work fail.
  }
}

export async function startPerfSession(rootDirectory: string, label: string): Promise<PerfSessionState> {
  const activePath = runtimePath(rootDirectory, ACTIVE_SESSION_FILE);
  const existing = await readOptional(activePath);
  if (existing !== undefined) {
    try {
      const parsed: unknown = JSON.parse(existing);
      if (isPerfSessionState(parsed)) throw new Error(`Performance session is already active: ${parsed.label}.`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith("Performance session is already active:")) throw error;
      throw new Error("Performance session state is malformed; inspect or remove only the local .agentic/perf/session.json file.");
    }
  }
  const session: PerfSessionState = {
    schemaVersion: PERF_SCHEMA_VERSION,
    sessionId: randomUUID(),
    label: boundedLabel(label),
    startedAt: new Date().toISOString(),
  };
  await ensurePerfGitExclude(rootDirectory);
  await ensureRuntimeDirectory(rootDirectory);
  await writeFile(activePath, `${JSON.stringify(session)}\n`, { encoding: "utf8", flag: "wx" });
  return session;
}

export async function stopPerfSession(rootDirectory: string): Promise<PerfSessionState | undefined> {
  const active = await readActiveSession(rootDirectory);
  if (!active) return undefined;
  await ensureRuntimeDirectory(rootDirectory);
  await writeFile(runtimePath(rootDirectory, LAST_SESSION_FILE), `${JSON.stringify(active)}\n`, "utf8");
  await rm(runtimePath(rootDirectory, ACTIVE_SESSION_FILE), { force: true });
  return active;
}

export async function getPerfStatus(rootDirectory: string): Promise<PerfStatus> {
  const session = await readActiveSession(rootDirectory);
  return session
    ? { active: true, sessionId: session.sessionId, label: session.label, startedAt: session.startedAt }
    : { active: false };
}

export async function runWithPerfInvocation<T>(
  rootDirectory: string,
  commandKind: string,
  action: () => Promise<T>,
  clock: PerfClock = monotonicClock,
): Promise<T> {
  if (activeInvocation) return action();
  const session = await readActiveSession(rootDirectory);
  if (!session) return action();
  const invocationStartNs = clock.now();
  const invocation: ActiveInvocation = {
    session,
    invocationId: randomUUID(),
    commandKind,
    startNs: invocationStartNs,
    spans: [],
    clock,
    fullProcessStartNs: RECONSTRUCTED_PROCESS_START_NS <= invocationStartNs
      ? RECONSTRUCTED_PROCESS_START_NS
      : invocationStartNs,
  };
  activeInvocation = invocation;
  try {
    return await action();
  } finally {
    const endNs = clock.now();
    const memory = process.memoryUsage();
    activeInvocation = undefined;
    await safeAppendRecord(rootDirectory, {
      schemaVersion: PERF_SCHEMA_VERSION,
      recordType: "invocation",
      sessionId: session.sessionId,
      invocationId: invocation.invocationId,
      commandKind,
      interval: interval(invocation.startNs, endNs),
      fullProcessInterval: interval(invocation.fullProcessStartNs, endNs),
      durationMs: durationMs(invocation.startNs, endNs),
      spans: invocation.spans,
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
      },
    });
  }
}

export async function withPerfSpan<T>(
  category: PerfCategory,
  commandKind: string,
  action: () => Promise<T>,
  metadata: Partial<Pick<PerfSpanRecord, "normalizedIdentity" | "wrapped" | "spanKind">> = {},
): Promise<T> {
  const invocation = activeInvocation;
  if (!invocation) return action();
  const startNs = invocation.clock.now();
  try {
    return await action();
  } finally {
    const endNs = invocation.clock.now();
    invocation.spans.push({
      spanKind: metadata.spanKind ?? "internal",
      category,
      commandKind,
      interval: interval(startNs, endNs),
      durationMs: durationMs(startNs, endNs),
      ...(metadata.normalizedIdentity ? { normalizedIdentity: metadata.normalizedIdentity } : {}),
      ...(metadata.wrapped ? { wrapped: true } : {}),
    });
  }
}

function safeIdentity(file: string): string {
  const normalized = file.replaceAll("\\", "/").split("/").pop() ?? "process";
  return /^[a-zA-Z0-9._-]{1,64}$/.test(normalized) ? normalized : "process";
}

function classifyFile(file: string): { category: PerfCategory; commandKind: string } {
  const identity = safeIdentity(file).toLowerCase();
  if (identity === "git.exe" || identity === "git") return { category: "git", commandKind: "git" };
  return { category: "external-other", commandKind: identity };
}

export function observedExecFile(
  file: string,
  args: readonly string[],
  options: ExecFileOptions & { encoding: "buffer" },
  metadata?: PerfSubprocessMetadata,
): Promise<{ stdout: Buffer; stderr: Buffer }>;

export function observedExecFile(
  file: string,
  args: readonly string[],
  options?: ExecFileOptions,
  metadata?: PerfSubprocessMetadata,
): Promise<{ stdout: string; stderr: string }>;

export async function observedExecFile(
  file: string,
  args: readonly string[],
  options?: ExecFileOptions,
  metadata?: PerfSubprocessMetadata,
): Promise<{ stdout: string | Buffer; stderr: string | Buffer }> {
  const inferred = classifyFile(file);
  const category = metadata?.category ?? inferred.category;
  const commandKind = metadata?.commandKind ?? inferred.commandKind;
  return withPerfSpan(category, commandKind, () => execFileAsync(file, [...args], options), {
    normalizedIdentity: metadata?.normalizedIdentity ?? safeIdentity(file),
    spanKind: "subprocess",
  });
}

function classifyShell(command: string): string {
  if (/\bgit\b/i.test(command)) return "git";
  if (/\b(?:test|pytest|vitest|jest|mocha|cargo test|go test)\b/i.test(command)) return "test";
  if (/\b(?:eslint|lint|ruff|clippy)\b/i.test(command)) return "lint";
  if (/\b(?:tsc|typecheck|mypy)\b/i.test(command)) return "typecheck";
  if (/\b(?:coverage|c8|nyc)\b/i.test(command)) return "coverage";
  if (/\b(?:build|compile|package)\b/i.test(command)) return "build";
  return "external-other";
}

export async function observedExec(
  command: string,
  options?: ExecOptions,
  metadata?: PerfSubprocessMetadata,
): Promise<{ stdout: string; stderr: string }> {
  const commandKind = metadata?.commandKind ?? classifyShell(command);
  const category = metadata?.category ?? (commandKind === "git" ? "git" : "external-check");
  const result = await withPerfSpan(category, commandKind, () => execAsync(command, options), {
    ...metadata,
    spanKind: "subprocess",
  });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}

function categoryForExec(category: PerfExecCategory): { category: PerfCategory; commandKind: string } {
  if (category === "git") return { category: "git", commandKind: "git" };
  if (category === "repo-tool") return { category: "repo-tool", commandKind: "repo-tool" };
  return { category: "repo-tool", commandKind: category };
}

export async function runPerfExec(
  rootDirectory: string,
  category: PerfExecCategory,
  command: string,
  args: readonly string[],
): Promise<number> {
  const metadata = categoryForExec(category);
  return withPerfSpan(metadata.category, metadata.commandKind, () => new Promise<number>((resolve) => {
    const child = spawn(command, [...args], { cwd: rootDirectory, stdio: "inherit", windowsHide: true });
    child.once("error", () => resolve(1));
    child.once("close", (code, signal) => resolve(typeof code === "number" ? code : signal ? 1 : 0));
  }), { normalizedIdentity: safeIdentity(command), wrapped: true, spanKind: "subprocess" });
}

function isPerfCategory(value: unknown): value is PerfCategory {
  return ["apk-process", "apk-internal", "apk-startup", "apk-bootstrap", "task-config", "filesystem", "git", "external-check", "external-other", "repo-tool"].includes(value as PerfCategory);
}

async function readTraceRecords(rootDirectory: string, sessionId?: string): Promise<{ records: PerfInvocationRecord[]; malformed: number }> {
  const text = await readOptional(runtimePath(rootDirectory, TRACE_FILE));
  if (!text) return { records: [], malformed: 0 };
  const records: PerfInvocationRecord[] = [];
  let malformed = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== "object") throw new Error("not object");
      const record = value as Partial<PerfInvocationRecord>;
      if (sessionId && typeof record.sessionId === "string" && record.sessionId !== sessionId) continue;
      const start = parseNs(record.interval && typeof record.interval === "object" ? record.interval.startNs : undefined);
      const end = parseNs(record.interval && typeof record.interval === "object" ? record.interval.endNs : undefined);
      const fullStart = parseNs(record.fullProcessInterval && typeof record.fullProcessInterval === "object" ? record.fullProcessInterval.startNs : undefined);
      const fullEnd = parseNs(record.fullProcessInterval && typeof record.fullProcessInterval === "object" ? record.fullProcessInterval.endNs : undefined);
      const spans = Array.isArray(record.spans) ? record.spans : [];
      if ((record.schemaVersion !== LEGACY_PERF_SCHEMA_VERSION && record.schemaVersion !== PERF_SCHEMA_VERSION) || record.recordType !== "invocation"
        || typeof record.sessionId !== "string"
        || typeof record.invocationId !== "string" || typeof record.commandKind !== "string"
        || typeof record.durationMs !== "number" || !Number.isFinite(record.durationMs)
        || start === undefined || end === undefined || end < start
        || (record.schemaVersion === PERF_SCHEMA_VERSION
          && (fullStart === undefined || fullEnd === undefined || fullEnd < fullStart || fullStart > start || fullEnd < end))
        || !Array.isArray(record.spans)
        || spans.some((span) => !span || typeof span !== "object" || !isPerfCategory((span as PerfSpanRecord).category) || !validRange(span as PerfSpanRecord))) throw new Error("invalid record");
      records.push(record as PerfInvocationRecord);
    } catch {
      malformed += 1;
    }
  }
  return { records, malformed };
}

interface Range {
  start: bigint;
  end: bigint;
  category: string;
  commandKind: string;
  priority: number;
  id: string;
  spanKind?: "internal" | "subprocess";
  wrapped?: boolean;
}

function validRange(value: { interval?: PerfInterval }): { start: bigint; end: bigint } | undefined {
  const start = parseNs(value.interval?.startNs);
  const end = parseNs(value.interval?.endNs);
  return start !== undefined && end !== undefined && end >= start ? { start, end } : undefined;
}

function unionNs(ranges: readonly Range[]): bigint {
  const sorted = ranges.filter((range) => range.end > range.start).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  let total = 0n;
  let start: bigint | undefined;
  let end: bigint | undefined;
  for (const range of sorted) {
    if (start === undefined) {
      start = range.start;
      end = range.end;
    } else if (range.start <= end!) {
      if (range.end > end!) end = range.end;
    } else {
      total += end! - start;
      start = range.start;
      end = range.end;
    }
  }
  if (start !== undefined) total += end! - start;
  return total;
}

function subtractNs(root: Range, children: readonly Range[]): Range[] {
  const sorted = children.filter((child) => child.end > root.start && child.start < root.end)
    .map((child) => ({ ...child, start: child.start < root.start ? root.start : child.start, end: child.end > root.end ? root.end : child.end }))
    .sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const output: Range[] = [];
  let cursor = root.start;
  for (const child of sorted) {
    if (child.start > cursor) output.push({ ...root, start: cursor, end: child.start, id: `${root.id}:residual` });
    if (child.end > cursor) cursor = child.end;
    if (cursor >= root.end) break;
  }
  if (cursor < root.end) output.push({ ...root, start: cursor, end: root.end, id: `${root.id}:residual` });
  return output;
}

function categoryPriority(category: string): number {
  if (category === "git") return 50;
  if (category === "external-check") return 45;
  if (category === "external-other") return 40;
  if (category === "repo-tool") return 35;
  if (category === "apk-startup") return 32;
  if (category === "apk-bootstrap") return 30;
  if (category === "task-config") return 25;
  if (category === "filesystem") return 20;
  return 10;
}

function commandKindPriority(commandKind: string): number {
  if (commandKind === "git") return 50;
  if (["test", "lint", "typecheck", "coverage", "build", "package-manager"].includes(commandKind)) return 45;
  if (commandKind === "repo-tool" || commandKind === "external-other") return 40;
  if (commandKind === "apk-startup") return 32;
  return 10;
}

function exclusiveRangeNs(ranges: readonly Range[], key: (range: Range) => string, priority: (range: Range) => number): Map<string, bigint> {
  const boundaries = [...new Set(ranges.flatMap((range) => [range.start.toString(), range.end.toString()]))]
    .map((value) => BigInt(value)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const totals = new Map<string, bigint>();
  for (let index = 0; index + 1 < boundaries.length; index += 1) {
    const start = boundaries[index]!;
    const end = boundaries[index + 1]!;
    if (end <= start) continue;
    const owners = ranges.filter((range) => range.start <= start && range.end >= end)
      .sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
    const winner = owners[0];
    if (winner) {
      const name = key(winner);
      totals.set(name, (totals.get(name) ?? 0n) + end - start);
    }
  }
  return totals;
}

function exclusiveCategoryNs(ranges: readonly Range[]): Map<string, bigint> {
  return exclusiveRangeNs(ranges, (range) => range.category, (range) => range.priority);
}

function exclusiveCommandKindNs(ranges: readonly Range[]): Map<string, bigint> {
  return exclusiveRangeNs(ranges, (range) => range.commandKind, (range) => commandKindPriority(range.commandKind));
}

function ms(value: bigint): number {
  return Number(value) / 1_000_000;
}

function percentile(sorted: readonly number[], rank: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
  return sorted[index];
}

function stats(values: readonly number[]): PerfStats {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? {} : {
    minMs: sorted[0],
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1],
  };
}

function scenario(label: string, factor: number, totalMs: number, apkMs: number): PerfAmdahlScenario {
  const estimated = totalMs - apkMs + apkMs * factor;
  return {
    factor,
    label,
    estimatedToolingWallMs: estimated,
    improvementPercent: totalMs > 0 ? ((totalMs - estimated) / totalMs) * 100 : 0,
    speedup: estimated > 0 ? totalMs / estimated : 1,
  };
}

export function buildPerfReport(
  records: readonly PerfInvocationRecord[],
  malformedRecordCount = 0,
  session?: Pick<PerfSessionState, "sessionId" | "label">,
): PerfReport {
  const roots: Range[] = [];
  const instrumentedRoots: Range[] = [];
  const fullRoots: Range[] = [];
  const attribution: Range[] = [];
  const subprocessRanges: Range[] = [];
  let childSum = 0n;
  let wrappedToolCount = 0;
  const invocationDurationsMs: number[] = [];
  const fullProcessDurationsMs: number[] = [];
  const rssSamplesBytes: number[] = [];
  const heapUsedSamplesBytes: number[] = [];
  for (const record of records) {
    const instrumentedBounds = validRange(record);
    if (!instrumentedBounds) continue;
    const instrumentedRoot: Range = {
      ...instrumentedBounds,
      category: "apk-process",
      commandKind: "apk-process",
      priority: 0,
      id: `${record.invocationId}:instrumented`,
    };
    instrumentedRoots.push(instrumentedRoot);
    const fullBounds = record.schemaVersion === PERF_SCHEMA_VERSION && record.fullProcessInterval
      ? validRange({ interval: record.fullProcessInterval })
      : undefined;
    const observedRoot: Range = fullBounds
      ? { ...fullBounds, category: "apk-process", commandKind: "apk-process", priority: 0, id: `${record.invocationId}:full` }
      : instrumentedRoot;
    roots.push(observedRoot);
    if (fullBounds) {
      fullRoots.push(observedRoot);
      fullProcessDurationsMs.push(ms(fullBounds.end - fullBounds.start));
      attribution.push(...subtractNs(observedRoot, [instrumentedRoot]).map((range) => ({
        ...range,
        category: "apk-startup",
        commandKind: "apk-startup",
        priority: categoryPriority("apk-startup"),
      })));
    }
    invocationDurationsMs.push(record.durationMs);
    if (record.memory && Number.isFinite(record.memory.rssBytes) && Number.isFinite(record.memory.heapUsedBytes)) {
      rssSamplesBytes.push(record.memory.rssBytes);
      heapUsedSamplesBytes.push(record.memory.heapUsedBytes);
    }
    const spans: Range[] = [];
    for (const [index, span] of record.spans.entries()) {
      const bounds = validRange(span);
      if (!bounds) continue;
      const range: Range = {
        ...bounds,
        category: span.category,
        commandKind: span.commandKind,
        priority: categoryPriority(span.category),
        id: `${record.invocationId}:${index}`,
        spanKind: span.spanKind,
        wrapped: span.wrapped,
      };
      spans.push(range);
      if (span.wrapped) wrappedToolCount += 1;
    }
    const subprocesses = spans.filter((span) => (span.spanKind === "subprocess" || span.spanKind === undefined)
      && (span.category === "git"
      || span.category === "external-check"
      || span.category === "external-other"
      || span.category === "repo-tool"));
    childSum += subprocesses.reduce((total, span) => total + span.end - span.start, 0n);
    subprocessRanges.push(...subprocesses);
    attribution.push(...subtractNs(instrumentedRoot, subprocesses).map((range) => ({
      ...range,
      category: "apk-internal",
      commandKind: "apk-internal",
      priority: categoryPriority("apk-internal"),
    })));
    attribution.push(...subprocesses);
    attribution.push(...spans.filter((span) => (span.spanKind === "internal" || span.spanKind === undefined)
      && ["apk-bootstrap", "task-config", "filesystem"].includes(span.category)));
  }
  const observedNs = unionNs(roots);
  const instrumentedNs = unionNs(instrumentedRoots);
  const fullNs = unionNs(fullRoots);
  const childUnion = unionNs(subprocessRanges);
  const exclusive = exclusiveCategoryNs(attribution);
  const commandKindExclusive = exclusiveCommandKindNs(attribution);
  const categoryMs: Record<string, number> = {};
  for (const [category, value] of exclusive.entries()) categoryMs[category] = ms(value);
  const commandKindMs: Record<string, number> = {};
  for (const [commandKind, value] of commandKindExclusive.entries()) commandKindMs[commandKind] = ms(value);
  const apkInternalNs = [...exclusive.entries()]
    .filter(([category]) => ["apk-internal", "apk-bootstrap", "task-config", "filesystem"].includes(category))
    .reduce((total, [, value]) => total + value, 0n);
  const gitNs = exclusive.get("git") ?? 0n;
  const externalNs = exclusive.get("external-check") ?? 0n;
  const wrappedNs = exclusive.get("repo-tool") ?? 0n;
  const otherNs = (exclusive.get("external-other") ?? 0n);
  const totalMs = ms(observedNs);
  const internalMs = ms(apkInternalNs);
  const startupNs = exclusive.get("apk-startup") ?? 0n;
  const fullProcessAvailable = records.length > 0 && fullRoots.length === records.length;
  const rewriteSensitiveMs = fullProcessAvailable ? ms(startupNs + apkInternalNs) : null;
  const scenarios = rewriteSensitiveMs === null ? [] : [
    scenario("25% faster APK rewrite-sensitive runtime", 0.75, totalMs, rewriteSensitiveMs),
    scenario("50% faster APK rewrite-sensitive runtime", 0.5, totalMs, rewriteSensitiveMs),
    scenario("75% faster APK rewrite-sensitive runtime", 0.25, totalMs, rewriteSensitiveMs),
    scenario("2x faster APK rewrite-sensitive runtime", 0.5, totalMs, rewriteSensitiveMs),
    scenario("3x faster APK rewrite-sensitive runtime", 1 / 3, totalMs, rewriteSensitiveMs),
    scenario("5x faster APK rewrite-sensitive runtime", 0.2, totalMs, rewriteSensitiveMs),
    scenario("infinite APK rewrite-sensitive runtime speedup", 0, totalMs, rewriteSensitiveMs),
  ];
  const warnings = [
    ...(malformedRecordCount > 0 ? [`Ignored ${malformedRecordCount} malformed or incomplete trace record(s).`] : []),
    ...(records.length === 0 ? ["No complete profiling records were observed."] : []),
    ...(records.some((record) => record.schemaVersion === LEGACY_PERF_SCHEMA_VERSION)
      ? ["schemaVersion 1 traces do not contain full Node process/startup timing; rewrite-sensitive metrics and ceilings are unavailable."] : []),
    ...(records.length > 0 && !fullProcessAvailable && records.some((record) => record.schemaVersion === PERF_SCHEMA_VERSION)
      ? ["Full-process timing is incomplete for this mixed or malformed trace set; rewrite-sensitive metrics are unavailable."] : []),
    "Unwrapped external commands: unknown",
    "LLM generation and idle/unobserved gaps are excluded.",
  ];
  return {
    schemaVersion: PERF_SCHEMA_VERSION,
    traceSchemaVersions: [...new Set(records.map((record) => record.schemaVersion))].sort((a, b) => a - b),
    fullProcessAvailable,
    ...(session ? { sessionId: session.sessionId, label: session.label } : {}),
    invocationCount: records.length,
    wrappedToolCount,
    observedCommandCount: records.length + wrappedToolCount,
    unwrappedExternalCommands: "unknown",
    malformedRecordCount,
    incompleteCoverage: malformedRecordCount > 0 || (records.length > 0 && !fullProcessAvailable),
    observedToolingWallMs: totalMs,
    apkFullProcessUnionMs: fullProcessAvailable ? ms(fullNs) : null,
    apkInstrumentedUnionMs: ms(instrumentedNs),
    apkStartupResidualMs: fullProcessAvailable ? ms(startupNs) : null,
    apkInternalInstrumentedMs: internalMs,
    apkRewriteSensitiveMs: rewriteSensitiveMs,
    gitMs: ms(gitNs),
    externalCheckMs: ms(externalNs),
    wrappedRepoToolMs: ms(wrappedNs),
    otherObservedMs: ms(otherNs),
    commandKindMs,
    childDurationSumMs: ms(childSum),
    childWallClockUnionMs: ms(childUnion),
    categoryMs,
    invocationDurationsMs,
    invocationStats: stats(invocationDurationsMs),
    fullProcessDurationsMs,
    fullProcessStats: stats(fullProcessDurationsMs),
    rssSamplesBytes,
    heapUsedSamplesBytes,
    scenarios,
    exclusions: { llmGeneration: "excluded", idleAndUnobservedGaps: "excluded" },
    warnings,
  };
}

export async function readPerfReport(rootDirectory: string, sessionId?: string): Promise<PerfReport> {
  const selected = sessionId ? await readSessionFile(rootDirectory, ACTIVE_SESSION_FILE) : await readSessionFile(rootDirectory, ACTIVE_SESSION_FILE) ?? await readSessionFile(rootDirectory, LAST_SESSION_FILE);
  const result = await readTraceRecords(rootDirectory, sessionId ?? selected?.sessionId);
  return buildPerfReport(result.records, result.malformed, selected);
}

export const getPerfReport = readPerfReport;

export function renderPerfReport(report: PerfReport): string {
  const percent = (value: number): string => report.observedToolingWallMs > 0 ? `${((value / report.observedToolingWallMs) * 100).toFixed(1)}%` : "0.0%";
  const seconds = (value: number | null): string => value === null ? "unavailable" : `${(value / 1000).toFixed(3)} s`;
  const statsText = report.invocationStats.medianMs === undefined
    ? "n/a"
    : `min ${report.invocationStats.minMs!.toFixed(1)} ms, median ${report.invocationStats.medianMs.toFixed(1)} ms, p95 ${report.invocationStats.p95Ms!.toFixed(1)} ms, max ${report.invocationStats.maxMs!.toFixed(1)} ms`;
  const infinite = report.scenarios.find((item) => item.factor === 0);
  return [
    `Session: ${report.label ?? "unknown"}`,
    `Observed tooling wall: ${(report.observedToolingWallMs / 1000).toFixed(3)} s`,
    "",
    `APK invocations: ${report.invocationCount}`,
    `  full observed process: ${seconds(report.apkFullProcessUnionMs)}`,
    `  instrumented invocation wall: ${seconds(report.apkInstrumentedUnionMs)}`,
    `  startup/import residual: ${seconds(report.apkStartupResidualMs)}`,
    `  APK internal after instrumentation: ${seconds(report.apkInternalInstrumentedMs)} (${percent(report.apkInternalInstrumentedMs)})`,
    `  rewrite-sensitive APK runtime: ${seconds(report.apkRewriteSensitiveMs)}${report.apkRewriteSensitiveMs === null ? "" : ` (${percent(report.apkRewriteSensitiveMs)})`}`,
    `  Git: ${(report.gitMs / 1000).toFixed(3)} s (${percent(report.gitMs)})`,
    `  external checks: ${(report.externalCheckMs / 1000).toFixed(3)} s (${percent(report.externalCheckMs)})`,
    `Wrapped repo tools: ${(report.wrappedRepoToolMs / 1000).toFixed(3)} s (${percent(report.wrappedRepoToolMs)})`,
    `Other observed: ${(report.otherObservedMs / 1000).toFixed(3)} s (${percent(report.otherObservedMs)})`,
    "",
    `Child duration sum: ${(report.childDurationSumMs / 1000).toFixed(3)} s`,
    `Child wall-clock union: ${(report.childWallClockUnionMs / 1000).toFixed(3)} s`,
    `Invocation stats: ${statsText}`,
    `Full-process stats: ${report.fullProcessStats.medianMs === undefined ? "unavailable" : `min ${report.fullProcessStats.minMs!.toFixed(1)} ms, median ${report.fullProcessStats.medianMs.toFixed(1)} ms, p95 ${report.fullProcessStats.p95Ms!.toFixed(1)} ms, max ${report.fullProcessStats.maxMs!.toFixed(1)} ms`}`,
    ...(report.rssSamplesBytes.length > 0 ? [`RSS sample (not peak): ${Math.round(report.rssSamplesBytes.at(-1)!)} bytes`] : []),
    ...(report.heapUsedSamplesBytes.length > 0 ? [`Heap used sample: ${Math.round(report.heapUsedSamplesBytes.at(-1)!)} bytes`] : []),
    `Observed commands: ${report.observedCommandCount}`,
    "Unwrapped external commands: unknown",
    "LLM generation: excluded",
    "Idle/unobserved gaps: excluded",
    "",
    "Primary command-kind attribution:",
    ...Object.entries(report.commandKindMs).sort(([left], [right]) => left.localeCompare(right)).map(([kind, value]) => `  ${kind}: ${(value / 1000).toFixed(3)} s (${percent(value)})`),
    "",
    `Maximum possible tooling improvement if rewrite-sensitive APK runtime became zero: ${infinite ? (infinite.improvementPercent).toFixed(1) : "unavailable"}${infinite ? "%" : ""}`,
    ...report.scenarios.filter((item) => [0.5, 0.2].includes(item.factor)).map((item) => `${item.label} -> overall tooling improvement: ${item.improvementPercent.toFixed(1)}%`),
    ...report.warnings.filter((warning) => !warning.startsWith("Unwrapped") && !warning.startsWith("LLM generation")).map((warning) => `Warning: ${warning}`),
  ].join("\n");
}

export async function getPerfTracePath(rootDirectory: string): Promise<string> {
  return runtimePath(rootDirectory, TRACE_FILE);
}
