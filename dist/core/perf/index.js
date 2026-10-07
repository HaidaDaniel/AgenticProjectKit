import { exec, execFile, spawn } from "node:child_process";
import { appendFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { promisify } from "node:util";
export const PERF_SCHEMA_VERSION = 1;
export const PERF_RUNTIME_DIRECTORY = ".agentic/perf";
const ACTIVE_SESSION_FILE = "session.json";
const LAST_SESSION_FILE = "last-session.json";
const TRACE_FILE = "trace.jsonl";
const MAX_TRACE_BYTES = 8 * 1024 * 1024;
const MAX_RECORD_BYTES = 64 * 1024;
export const monotonicClock = {
    now: () => process.hrtime.bigint(),
};
let activeInvocation;
const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
function runtimePath(rootDirectory, file) {
    return join(rootDirectory, PERF_RUNTIME_DIRECTORY, file);
}
function boundedLabel(label) {
    const value = label.trim();
    if (value.length === 0 || value.length > 120 || /[\r\n]/.test(value)) {
        throw new Error("Performance session label must be 1-120 characters without line breaks.");
    }
    return value;
}
function durationMs(startNs, endNs) {
    const delta = endNs >= startNs ? endNs - startNs : 0n;
    return Number(delta) / 1_000_000;
}
function interval(startNs, endNs) {
    return { startNs: String(startNs), endNs: String(endNs) };
}
function parseNs(value) {
    if (typeof value !== "string" || !/^\d+$/.test(value))
        return undefined;
    try {
        return BigInt(value);
    }
    catch {
        return undefined;
    }
}
function isPerfSessionState(value) {
    if (!value || typeof value !== "object")
        return false;
    const record = value;
    return record.schemaVersion === PERF_SCHEMA_VERSION
        && typeof record.sessionId === "string"
        && typeof record.label === "string"
        && typeof record.startedAt === "string";
}
async function readOptional(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
async function readSessionFile(rootDirectory, file) {
    const text = await readOptional(runtimePath(rootDirectory, file));
    if (text === undefined)
        return undefined;
    try {
        const value = JSON.parse(text);
        return isPerfSessionState(value) ? value : undefined;
    }
    catch {
        return undefined;
    }
}
async function readActiveSession(rootDirectory) {
    return readSessionFile(rootDirectory, ACTIVE_SESSION_FILE);
}
async function ensureRuntimeDirectory(rootDirectory) {
    await mkdir(join(rootDirectory, PERF_RUNTIME_DIRECTORY), { recursive: true });
}
async function safeAppendRecord(rootDirectory, record) {
    try {
        const serialized = JSON.stringify(record);
        if (serialized.length > MAX_RECORD_BYTES)
            return;
        await ensureRuntimeDirectory(rootDirectory);
        const tracePath = runtimePath(rootDirectory, TRACE_FILE);
        try {
            const traceStat = await stat(tracePath);
            if (traceStat.size + Buffer.byteLength(serialized) + 1 > MAX_TRACE_BYTES)
                return;
        }
        catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
                return;
        }
        await appendFile(tracePath, `${serialized}\n`, "utf8");
    }
    catch {
        // Profiling is diagnostic and must never make normal APK work fail.
    }
}
export async function startPerfSession(rootDirectory, label) {
    const activePath = runtimePath(rootDirectory, ACTIVE_SESSION_FILE);
    const existing = await readOptional(activePath);
    if (existing !== undefined) {
        try {
            const parsed = JSON.parse(existing);
            if (isPerfSessionState(parsed))
                throw new Error(`Performance session is already active: ${parsed.label}.`);
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith("Performance session is already active:"))
                throw error;
            throw new Error("Performance session state is malformed; inspect or remove only the local .agentic/perf/session.json file.");
        }
    }
    const session = {
        schemaVersion: PERF_SCHEMA_VERSION,
        sessionId: randomUUID(),
        label: boundedLabel(label),
        startedAt: new Date().toISOString(),
    };
    await ensureRuntimeDirectory(rootDirectory);
    await writeFile(activePath, `${JSON.stringify(session)}\n`, { encoding: "utf8", flag: "wx" });
    return session;
}
export async function stopPerfSession(rootDirectory) {
    const active = await readActiveSession(rootDirectory);
    if (!active)
        return undefined;
    await ensureRuntimeDirectory(rootDirectory);
    await writeFile(runtimePath(rootDirectory, LAST_SESSION_FILE), `${JSON.stringify(active)}\n`, "utf8");
    await rm(runtimePath(rootDirectory, ACTIVE_SESSION_FILE), { force: true });
    return active;
}
export async function getPerfStatus(rootDirectory) {
    const session = await readActiveSession(rootDirectory);
    return session
        ? { active: true, sessionId: session.sessionId, label: session.label, startedAt: session.startedAt }
        : { active: false };
}
export async function runWithPerfInvocation(rootDirectory, commandKind, action, clock = monotonicClock) {
    if (activeInvocation)
        return action();
    const session = await readActiveSession(rootDirectory);
    if (!session)
        return action();
    const invocation = {
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
    }
    finally {
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
export async function withPerfSpan(category, commandKind, action, metadata = {}) {
    const invocation = activeInvocation;
    if (!invocation)
        return action();
    const startNs = invocation.clock.now();
    try {
        return await action();
    }
    finally {
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
function safeIdentity(file) {
    const normalized = file.replaceAll("\\", "/").split("/").pop() ?? "process";
    return /^[a-zA-Z0-9._-]{1,64}$/.test(normalized) ? normalized : "process";
}
function classifyFile(file) {
    const identity = safeIdentity(file).toLowerCase();
    if (identity === "git.exe" || identity === "git")
        return { category: "git", commandKind: "git" };
    return { category: "external-other", commandKind: identity };
}
export async function observedExecFile(file, args, options, metadata) {
    const inferred = classifyFile(file);
    const category = metadata?.category ?? inferred.category;
    const commandKind = metadata?.commandKind ?? inferred.commandKind;
    return withPerfSpan(category, commandKind, () => execFileAsync(file, [...args], options), {
        normalizedIdentity: metadata?.normalizedIdentity ?? safeIdentity(file),
        spanKind: "subprocess",
    });
}
function classifyShell(command) {
    if (/\bgit\b/i.test(command))
        return "git";
    if (/\b(?:test|pytest|vitest|jest|mocha|cargo test|go test)\b/i.test(command))
        return "test";
    if (/\b(?:eslint|lint|ruff|clippy)\b/i.test(command))
        return "lint";
    if (/\b(?:tsc|typecheck|mypy)\b/i.test(command))
        return "typecheck";
    if (/\b(?:coverage|c8|nyc)\b/i.test(command))
        return "coverage";
    if (/\b(?:build|compile|package)\b/i.test(command))
        return "build";
    return "external-other";
}
export async function observedExec(command, options, metadata) {
    const commandKind = metadata?.commandKind ?? classifyShell(command);
    const category = metadata?.category ?? (commandKind === "git" ? "git" : "external-check");
    const result = await withPerfSpan(category, commandKind, () => execAsync(command, options), {
        ...metadata,
        spanKind: "subprocess",
    });
    return { stdout: String(result.stdout), stderr: String(result.stderr) };
}
function categoryForExec(category) {
    if (category === "git")
        return { category: "git", commandKind: "git" };
    if (category === "repo-tool")
        return { category: "repo-tool", commandKind: "repo-tool" };
    return { category: "repo-tool", commandKind: category };
}
export async function runPerfExec(rootDirectory, category, command, args) {
    const metadata = categoryForExec(category);
    return withPerfSpan(metadata.category, metadata.commandKind, () => new Promise((resolve) => {
        const child = spawn(command, [...args], { cwd: rootDirectory, stdio: "inherit", windowsHide: true });
        child.once("error", () => resolve(1));
        child.once("close", (code, signal) => resolve(typeof code === "number" ? code : signal ? 1 : 0));
    }), { normalizedIdentity: safeIdentity(command), wrapped: true, spanKind: "subprocess" });
}
function isPerfCategory(value) {
    return ["apk-process", "apk-internal", "apk-bootstrap", "task-config", "filesystem", "git", "external-check", "external-other", "repo-tool"].includes(value);
}
async function readTraceRecords(rootDirectory, sessionId) {
    const text = await readOptional(runtimePath(rootDirectory, TRACE_FILE));
    if (!text)
        return { records: [], malformed: 0 };
    const records = [];
    let malformed = 0;
    for (const line of text.split(/\r?\n/)) {
        if (line.trim().length === 0)
            continue;
        try {
            const value = JSON.parse(line);
            if (!value || typeof value !== "object")
                throw new Error("not object");
            const record = value;
            const start = parseNs(record.interval && typeof record.interval === "object" ? record.interval.startNs : undefined);
            const end = parseNs(record.interval && typeof record.interval === "object" ? record.interval.endNs : undefined);
            const spans = Array.isArray(record.spans) ? record.spans : [];
            if (record.schemaVersion !== PERF_SCHEMA_VERSION || record.recordType !== "invocation"
                || typeof record.sessionId !== "string" || (sessionId && record.sessionId !== sessionId)
                || typeof record.invocationId !== "string" || typeof record.commandKind !== "string"
                || typeof record.durationMs !== "number" || !Number.isFinite(record.durationMs)
                || start === undefined || end === undefined || end < start || !Array.isArray(record.spans)
                || spans.some((span) => !span || typeof span !== "object" || !isPerfCategory(span.category) || !validRange(span)))
                throw new Error("invalid record");
            records.push(record);
        }
        catch {
            malformed += 1;
        }
    }
    return { records, malformed };
}
function validRange(value) {
    const start = parseNs(value.interval?.startNs);
    const end = parseNs(value.interval?.endNs);
    return start !== undefined && end !== undefined && end >= start ? { start, end } : undefined;
}
function unionNs(ranges) {
    const sorted = ranges.filter((range) => range.end > range.start).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    let total = 0n;
    let start;
    let end;
    for (const range of sorted) {
        if (start === undefined) {
            start = range.start;
            end = range.end;
        }
        else if (range.start <= end) {
            if (range.end > end)
                end = range.end;
        }
        else {
            total += end - start;
            start = range.start;
            end = range.end;
        }
    }
    if (start !== undefined)
        total += end - start;
    return total;
}
function subtractNs(root, children) {
    const sorted = children.filter((child) => child.end > root.start && child.start < root.end)
        .map((child) => ({ ...child, start: child.start < root.start ? root.start : child.start, end: child.end > root.end ? root.end : child.end }))
        .sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    const output = [];
    let cursor = root.start;
    for (const child of sorted) {
        if (child.start > cursor)
            output.push({ ...root, start: cursor, end: child.start, id: `${root.id}:residual` });
        if (child.end > cursor)
            cursor = child.end;
        if (cursor >= root.end)
            break;
    }
    if (cursor < root.end)
        output.push({ ...root, start: cursor, end: root.end, id: `${root.id}:residual` });
    return output;
}
function categoryPriority(category) {
    if (category === "git")
        return 50;
    if (category === "external-check")
        return 45;
    if (category === "external-other")
        return 40;
    if (category === "repo-tool")
        return 35;
    if (category === "apk-bootstrap")
        return 30;
    if (category === "task-config")
        return 25;
    if (category === "filesystem")
        return 20;
    return 10;
}
function exclusiveCategoryNs(ranges) {
    const boundaries = [...new Set(ranges.flatMap((range) => [range.start.toString(), range.end.toString()]))]
        .map((value) => BigInt(value)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const totals = new Map();
    for (let index = 0; index + 1 < boundaries.length; index += 1) {
        const start = boundaries[index];
        const end = boundaries[index + 1];
        if (end <= start)
            continue;
        const owners = ranges.filter((range) => range.start <= start && range.end >= end)
            .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
        const winner = owners[0];
        if (winner)
            totals.set(winner.category, (totals.get(winner.category) ?? 0n) + end - start);
    }
    return totals;
}
function ms(value) {
    return Number(value) / 1_000_000;
}
function percentile(sorted, rank) {
    if (sorted.length === 0)
        return undefined;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
    return sorted[index];
}
function stats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length === 0 ? {} : {
        minMs: sorted[0],
        medianMs: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        maxMs: sorted[sorted.length - 1],
    };
}
function scenario(label, factor, totalMs, apkMs) {
    const estimated = totalMs - apkMs + apkMs * factor;
    return {
        factor,
        label,
        estimatedToolingWallMs: estimated,
        improvementPercent: totalMs > 0 ? ((totalMs - estimated) / totalMs) * 100 : 0,
        speedup: estimated > 0 ? totalMs / estimated : 1,
    };
}
export function buildPerfReport(records, malformedRecordCount = 0, session) {
    const roots = [];
    const attribution = [];
    let childSum = 0n;
    let childUnion = 0n;
    let wrappedToolCount = 0;
    const invocationDurationsMs = [];
    const rssSamplesBytes = [];
    const heapUsedSamplesBytes = [];
    for (const record of records) {
        const rootBounds = validRange(record);
        if (!rootBounds)
            continue;
        const root = { ...rootBounds, category: "apk-process", priority: 0, id: record.invocationId };
        roots.push(root);
        invocationDurationsMs.push(record.durationMs);
        if (record.memory && Number.isFinite(record.memory.rssBytes) && Number.isFinite(record.memory.heapUsedBytes)) {
            rssSamplesBytes.push(record.memory.rssBytes);
            heapUsedSamplesBytes.push(record.memory.heapUsedBytes);
        }
        const spans = [];
        for (const [index, span] of record.spans.entries()) {
            const bounds = validRange(span);
            if (!bounds)
                continue;
            const range = {
                ...bounds,
                category: span.category,
                priority: categoryPriority(span.category),
                id: `${record.invocationId}:${index}`,
                spanKind: span.spanKind,
                wrapped: span.wrapped,
            };
            spans.push(range);
            if (span.wrapped)
                wrappedToolCount += 1;
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
    const categoryMs = {};
    for (const [category, value] of exclusive.entries())
        categoryMs[category] = ms(value);
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
export async function readPerfReport(rootDirectory, sessionId) {
    const selected = sessionId ? await readSessionFile(rootDirectory, ACTIVE_SESSION_FILE) : await readSessionFile(rootDirectory, ACTIVE_SESSION_FILE) ?? await readSessionFile(rootDirectory, LAST_SESSION_FILE);
    const result = await readTraceRecords(rootDirectory, sessionId ?? selected?.sessionId);
    return buildPerfReport(result.records, result.malformed, selected);
}
export const getPerfReport = readPerfReport;
export function renderPerfReport(report) {
    const percent = (value) => report.observedToolingWallMs > 0 ? `${((value / report.observedToolingWallMs) * 100).toFixed(1)}%` : "0.0%";
    const statsText = report.invocationStats.medianMs === undefined
        ? "n/a"
        : `min ${report.invocationStats.minMs.toFixed(1)} ms, median ${report.invocationStats.medianMs.toFixed(1)} ms, p95 ${report.invocationStats.p95Ms.toFixed(1)} ms, max ${report.invocationStats.maxMs.toFixed(1)} ms`;
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
        ...(report.rssSamplesBytes.length > 0 ? [`RSS sample (not peak): ${Math.round(report.rssSamplesBytes.at(-1))} bytes`] : []),
        ...(report.heapUsedSamplesBytes.length > 0 ? [`Heap used sample: ${Math.round(report.heapUsedSamplesBytes.at(-1))} bytes`] : []),
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
export async function getPerfTracePath(rootDirectory) {
    return runtimePath(rootDirectory, TRACE_FILE);
}
