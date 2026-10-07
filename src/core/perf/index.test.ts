import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  buildPerfReport,
  getPerfStatus,
  getPerfTracePath,
  readPerfReport,
  runWithPerfInvocation,
  startPerfSession,
  stopPerfSession,
  withPerfSpan,
  type PerfClock,
  type PerfInvocationRecord,
} from "./index.js";

const execFileAsync = promisify(execFile);

async function withTempDirectory(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "apk-perf-test-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function fakeClock(...values: bigint[]): PerfClock {
  let index = 0;
  return { now: () => values[Math.min(index++, values.length - 1)]! };
}

test("profiling is off by default and writes no trace", async () => {
  await withTempDirectory(async (root) => {
    await runWithPerfInvocation(root, "status", async () => 0, fakeClock(0n, 10_000_000n));
    await assert.rejects(readFile(await getPerfTracePath(root), "utf8"), { code: "ENOENT" });
  });
});

test("session lifecycle records one invocation and preserves privacy", async () => {
  await withTempDirectory(async (root) => {
    const session = await startPerfSession(root, "agent-work");
    assert.equal((await getPerfStatus(root)).active, true);
    await runWithPerfInvocation(root, "task.verify", async () => {
      await withPerfSpan("git", "git", async () => undefined, { spanKind: "subprocess" });
      await withPerfSpan("external-check", "test", async () => undefined, { spanKind: "subprocess" });
    }, fakeClock(1_000_000_000n, 1_100_000_000n, 1_200_000_000n, 1_300_000_000n, 1_400_000_000n));
    const stopped = await stopPerfSession(root);
    assert.equal(stopped?.sessionId, session.sessionId);
    assert.equal((await getPerfStatus(root)).active, false);
    const report = await readPerfReport(root);
    assert.equal(report.invocationCount, 1);
    assert.equal(report.sessionId, session.sessionId);
    assert.equal(report.gitMs, 100);
    assert.equal(report.externalCheckMs, 100);
    assert.equal(report.rssSamplesBytes.length, 1);
    assert.equal(report.heapUsedSamplesBytes.length, 1);
    assert.ok(!JSON.stringify(report).includes("agent-work secret"));
  });
});

test("session start adds profiler state to local Git excludes for legacy checkouts", async () => {
  await withTempDirectory(async (root) => {
    await execFileAsync("git", ["init", "--quiet"], { cwd: root });
    await startPerfSession(root, "legacy-ignore");
    const ignored = await execFileAsync("git", ["check-ignore", "--no-index", ".agentic/perf/session.json"], { cwd: root });
    assert.equal(ignored.stdout.trim(), ".agentic/perf/session.json");
    assert.match(await readFile(join(root, ".git/info/exclude"), "utf8"), /\.agentic\/perf\/\*/);
    await stopPerfSession(root);
  });
});

test("malformed trace records are ignored with an incomplete coverage warning", async () => {
  await withTempDirectory(async (root) => {
    await startPerfSession(root, "malformed");
    const tracePath = await getPerfTracePath(root);
    await writeFile(tracePath, `${[
      "not-json",
      JSON.stringify({
        schemaVersion: 1,
        recordType: "invocation",
        sessionId: "bad",
        invocationId: "bad",
        commandKind: "status",
        interval: { startNs: "1", endNs: "2" },
        durationMs: 0.001,
        spans: [{ category: "external-check", interval: { startNs: "broken", endNs: "2" } }],
      }),
      "{\"schemaVersion\":1}",
    ].join("\n")}\n`, "utf8");
    const report = await readPerfReport(root);
    assert.equal(report.invocationCount, 0);
    assert.equal(report.malformedRecordCount, 2);
    assert.equal(report.incompleteCoverage, true);
  });
});

test("valid records from other sessions are excluded without malformed warnings", async () => {
  await withTempDirectory(async (root) => {
    await startPerfSession(root, "first");
    await runWithPerfInvocation(root, "status", async () => 0, fakeClock(0n, 10_000_000n));
    await stopPerfSession(root);
    await startPerfSession(root, "second");
    await runWithPerfInvocation(root, "status", async () => 0, fakeClock(20_000_000n, 30_000_000n));
    await stopPerfSession(root);
    const report = await readPerfReport(root);
    assert.equal(report.invocationCount, 1);
    assert.equal(report.malformedRecordCount, 0);
    assert.equal(report.incompleteCoverage, false);
  });
});

test("concurrent child intervals use union rather than duration sum", () => {
  const record: PerfInvocationRecord = {
    schemaVersion: 1,
    recordType: "invocation",
    sessionId: "session",
    invocationId: "invocation",
    commandKind: "verify",
    interval: { startNs: "0", endNs: "1000000000" },
    durationMs: 1000,
    spans: [
      { spanKind: "subprocess", category: "external-check", commandKind: "test", interval: { startNs: "100000000", endNs: "700000000" }, durationMs: 600 },
      { spanKind: "subprocess", category: "external-check", commandKind: "lint", interval: { startNs: "400000000", endNs: "900000000" }, durationMs: 500 },
    ],
  };
  const report = buildPerfReport([record]);
  assert.equal(report.childDurationSumMs, 1100);
  assert.equal(report.childWallClockUnionMs, 800);
  assert.equal(report.externalCheckMs, 800);
  assert.equal(report.apkInternalMs, 200);
  assert.equal(report.observedToolingWallMs, 1000);
});

test("Amdahl scenarios remain finite and bounded", () => {
  const report = buildPerfReport([{
    schemaVersion: 1,
    recordType: "invocation",
    sessionId: "session",
    invocationId: "invocation",
    commandKind: "status",
    interval: { startNs: "0", endNs: "1000000000" },
    durationMs: 1000,
    spans: [],
  }]);
  const infinite = report.scenarios.find((item) => item.factor === 0)!;
  assert.equal(infinite.improvementPercent, 100);
  assert.ok(report.scenarios.every((item) => Number.isFinite(item.speedup)));
});
