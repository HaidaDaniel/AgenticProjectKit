import { exec, execFile, spawn, type ExecFileOptions, type ExecOptions } from "node:child_process";
import { appendFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { promisify } from "node:util";

export const PERF_SCHEMA_VERSION = 1 as const;
export const PERF_RUNTIME_DIRECTORY = ".agentic/perf";
const ACTIVE_SESSION_FILE = "session.json";
const LAST_SESSION_FILE = "last-session.json";
const TRACE_FILE = "trace.jsonl";
const MAX_TRACE_BYTES = 8 * 1024 * 1024;
const MAX_RECORD_BYTES = 64 * 1024;

export type PerfCategory =
  | "apk-process"
  | "apk-internal"
  | "apk-bootstrap"
  | "task-config"
  | "filesystem"
  | "git"
  | "external-check"
  | "external-other"
  | "repo-tool";

export type PerfExecCategory = "repo-tool" | "test" | "lint" | "build" | "git";

export interface PerfClock {
  now(): bigint;
}

export const monotonicClock: PerfClock = {
  now: () => process.hrtime.bigint(),
};

interface PerfSessionState {
  schemaVersion: typeof PERF_SCHEMA_VERSION;
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
  schemaVersion: typeof PERF_SCHEMA_VERSION;
  recordType: "invocation";
  sessionId: string;
  invocationId: string;
  commandKind: string;
  interval: PerfInterval;
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
  sessionId?: string;
  label?: string;
  invocationCount: number;
  wrappedToolCount: number;
  observedCommandCount: number;
  unwrappedExternalCommands: "unknown";
  malformedRecordCount: number;
  incompleteCoverage: boolean;
  observedToolingWallMs: number;
  apkProcessTotalMs: number;
  apkInvocationDurationSumMs: number;
  apkInternalMs: number;
  gitMs: number;
  externalCheckMs: number;
  wrappedRepoToolMs: number;
  otherObservedMs: number;
  childDurationSumMs: number;
  childWallClockUnionMs: number;
  categoryMs: Record<string, number>;
  invocationDurationsMs: number[];
  invocationStats: PerfStats;
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
  return record.schemaVersion === PERF_SCHEMA_VERSION
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
  const invocation: ActiveInvocation = {
    session,
    invocationId: randomUUID(),
    commandKind,
    startNs: clock.now(),
    spans: [],
    clock,
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
  return ["apk-process", "apk-internal", "apk-bootstrap", "task-config", "filesystem", "git", "external-check", "external-other", "repo-tool"].includes(value as PerfCategory);
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
      const start = parseNs(record.interval && typeof record.interval === "object" ? record.interval.startNs : undefined);
      const end = parseNs(record.interval && typeof record.interval === "object" ? record.interval.endNs : undefined);
      const spans = Array.isArray(record.spans) ? record.spans : [];
      if (record.schemaVersion !== PERF_SCHEMA_VERSION || record.recordType !== "invocation"
        || typeof record.sessionId !== "string" || (sessionId && record.sessionId !== sessionId)
        || typeof record.invocationId !== "string" || typeof record.commandKind !== "string"
        || typeof record.durationMs !== "number" || !Number.isFinite(record.durationMs)
        || start === undefined || end === undefined || end < start || !Array.isArray(record.spans)
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
  if (category === "apk-bootstrap") return 30;
  if (category === "task-config") return 25;
  if (category === "filesystem") return 20;
  return 10;
}

function exclusiveCategoryNs(ranges: readonly Range[]): Map<string, bigint> {
  const boundaries = [...new Set(ranges.flatMap((range) => [range.start.toString(), range.end.toString()]))]
    .map((value) => BigInt(value)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const totals = new Map<string, bigint>();
  for (let index = 0; index + 1 < boundaries.length; index += 1) {
    const start = boundaries[index]!;
    const end = boundaries[index + 1]!;
    if (end <= start) continue;
    const owners = ranges.filter((range) => range.start <= start && range.end >= end)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    const winner = owners[0];
    if (winner) totals.set(winner.category, (totals.get(winner.category) ?? 0n) + end - start);
  }
  return totals;
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
  const attribution: Range[] = [];
  let childSum = 0n;
  let childUnion = 0n;
  let wrappedToolCount = 0;
  const invocationDurationsMs: number[] = [];
  const rssSamplesBytes: number[] = [];
  const heapUsedSamplesBytes: number[] = [];
  for (const record of records) {
    const rootBounds = validRange(record);
    if (!rootBounds) continue;
    const root: Range = { ...rootBounds, category: "apk-process", priority: 0, id: record.invocationId };
    roots.push(root);
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
    childUnion += unionNs(subprocesses);
    attribution.push(...subtractNs(root, subprocesses).map((range) => ({ ...range, category: "apk-internal", priority: categoryPriority("apk-internal") })));
    attribution.push(...subprocesses);
    attribution.push(...spans.filter((span) => (span.spanKind === "internal" || span.spanKind === undefined)
      && ["apk-bootstrap", "task-config", "filesystem"].includes(span.category)));
  }
  const observedNs = unionNs(roots);
  const exclusive = exclusiveCategoryNs(attribution);
  const categoryMs: Record<string, number> = {};
  for (const [category, value] of exclusive.entries()) categoryMs[category] = ms(value);
  const apkInternalNs = [...exclusive.entries()]
    .filter(([category]) => ["apk-internal", "apk-bootstrap", "task-config", "filesystem"].includes(category))
    .reduce((total, [, value]) => total + value, 0n);
  const gitNs = exclusive.get("git") ?? 0n;
  const externalNs = exclusive.get("external-check") ?? 0n;
  const wrappedNs = exclusive.get("repo-tool") ?? 0n;
  const otherNs = (exclusive.get("external-other") ?? 0n);
  const totalMs = ms(observedNs);
  const internalMs = ms(apkInternalNs);
  const scenarios = [
    scenario("25% faster APK internals", 0.75, totalMs, internalMs),
    scenario("50% faster APK internals", 0.5, totalMs, internalMs),
    scenario("75% faster APK internals", 0.25, totalMs, internalMs),
    scenario("2x faster APK internals", 0.5, totalMs, internalMs),
    scenario("3x faster APK internals", 1 / 3, totalMs, internalMs),
    scenario("5x faster APK internals", 0.2, totalMs, internalMs),
    scenario("infinite APK internal speedup", 0, totalMs, internalMs),
  ];
  const warnings = [
    ...(malformedRecordCount > 0 ? [`Ignored ${malformedRecordCount} malformed or incomplete trace record(s).`] : []),
    ...(records.length === 0 ? ["No complete profiling records were observed."] : []),
    "Unwrapped external commands: unknown",
    "LLM generation and idle/unobserved gaps are excluded.",
  ];
  return {
    schemaVersion: PERF_SCHEMA_VERSION,
    ...(session ? { sessionId: session.sessionId, label: session.label } : {}),
    invocationCount: records.length,
    wrappedToolCount,
    observedCommandCount: records.length + wrappedToolCount,
    unwrappedExternalCommands: "unknown",
    malformedRecordCount,
    incompleteCoverage: malformedRecordCount > 0,
    observedToolingWallMs: totalMs,
    apkProcessTotalMs: totalMs,
    apkInvocationDurationSumMs: invocationDurationsMs.reduce((sum, value) => sum + value, 0),
    apkInternalMs: internalMs,
    gitMs: ms(gitNs),
    externalCheckMs: ms(externalNs),
    wrappedRepoToolMs: ms(wrappedNs),
    otherObservedMs: ms(otherNs),
    childDurationSumMs: ms(childSum),
    childWallClockUnionMs: ms(childUnion),
    categoryMs,
    invocationDurationsMs,
    invocationStats: stats(invocationDurationsMs),
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
  const statsText = report.invocationStats.medianMs === undefined
    ? "n/a"
    : `min ${report.invocationStats.minMs!.toFixed(1)} ms, median ${report.invocationStats.medianMs.toFixed(1)} ms, p95 ${report.invocationStats.p95Ms!.toFixed(1)} ms, max ${report.invocationStats.maxMs!.toFixed(1)} ms`;
  const infinite = report.scenarios.find((item) => item.factor === 0);
  return [
    `Session: ${report.label ?? "unknown"}`,
    `Observed tooling wall: ${(report.observedToolingWallMs / 1000).toFixed(3)} s`,
    "",
    `APK invocations: ${report.invocationCount} (process wall ${(report.apkProcessTotalMs / 1000).toFixed(3)} s)`,
    `  APK internal/self: ${(report.apkInternalMs / 1000).toFixed(3)} s (${percent(report.apkInternalMs)})`,
    `  Git: ${(report.gitMs / 1000).toFixed(3)} s (${percent(report.gitMs)})`,
    `  external checks: ${(report.externalCheckMs / 1000).toFixed(3)} s (${percent(report.externalCheckMs)})`,
    `Wrapped repo tools: ${(report.wrappedRepoToolMs / 1000).toFixed(3)} s (${percent(report.wrappedRepoToolMs)})`,
    `Other observed: ${(report.otherObservedMs / 1000).toFixed(3)} s (${percent(report.otherObservedMs)})`,
    "",
    `Child duration sum: ${(report.childDurationSumMs / 1000).toFixed(3)} s`,
    `Child wall-clock union: ${(report.childWallClockUnionMs / 1000).toFixed(3)} s`,
    `Invocation stats: ${statsText}`,
    ...(report.rssSamplesBytes.length > 0 ? [`RSS sample (not peak): ${Math.round(report.rssSamplesBytes.at(-1)!)} bytes`] : []),
    ...(report.heapUsedSamplesBytes.length > 0 ? [`Heap used sample: ${Math.round(report.heapUsedSamplesBytes.at(-1)!)} bytes`] : []),
    `Observed commands: ${report.observedCommandCount}`,
    "Unwrapped external commands: unknown",
    "LLM generation: excluded",
    "Idle/unobserved gaps: excluded",
    "",
    `Maximum possible tooling improvement if APK self time became zero: ${infinite ? (infinite.improvementPercent).toFixed(1) : "0.0"}%`,
    ...report.scenarios.filter((item) => [0.5, 0.2].includes(item.factor)).map((item) => `${item.label} -> overall tooling improvement: ${item.improvementPercent.toFixed(1)}%`),
    ...report.warnings.filter((warning) => !warning.startsWith("Unwrapped") && !warning.startsWith("LLM generation")).map((warning) => `Warning: ${warning}`),
  ].join("\n");
}

export async function getPerfTracePath(rootDirectory: string): Promise<string> {
  return runtimePath(rootDirectory, TRACE_FILE);
}
