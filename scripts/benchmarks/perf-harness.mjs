#!/usr/bin/env node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDirectory = resolve(new URL("../..", import.meta.url).pathname);
const apkPath = join(rootDirectory, "dist", "cli", "index.js");
const defaultOutput = join(rootDirectory, "docs", "benchmarks", "apk-performance-self-baseline.md");

function runApk(cwd, args) {
  const result = spawnSync(process.execPath, [apkPath, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`APK command failed (${result.status}): ${args.join(" ")}\n${result.stderr}`);
  }
  return result.stdout;
}

function report(cwd) {
  return JSON.parse(runApk(cwd, ["perf", "report", "--json"]));
}

function runSession(cwd, label, commands) {
  runApk(cwd, ["perf", "start", "--label", label]);
  for (const args of commands) runApk(cwd, args);
  runApk(cwd, ["perf", "stop"]);
  const value = report(cwd);
  return {
    label,
    invocationCount: value.invocationCount,
    wrappedToolCount: value.wrappedToolCount,
    observedToolingWallMs: value.observedToolingWallMs,
    apkInternalMs: value.apkInternalMs,
    gitMs: value.gitMs,
    externalCheckMs: value.externalCheckMs,
    wrappedRepoToolMs: value.wrappedRepoToolMs,
    childDurationSumMs: value.childDurationSumMs,
    childWallClockUnionMs: value.childWallClockUnionMs,
    apkPercent: value.observedToolingWallMs > 0
      ? (value.apkInternalMs / value.observedToolingWallMs) * 100
      : 0,
    theoreticalMaxGainPercent: value.scenarios.find((item) => item.factor === 0)?.improvementPercent ?? 0,
    invocationStats: value.invocationStats,
  };
}

function fixtureCommands() {
  return [
    ["--help"],
    ["status"],
    ["tasks"],
    ["doctor"],
  ];
}

function repositoryCommands() {
  return [
    ["--help"],
    ["status"],
    ["tasks", "--state", "doing"],
    ["doctor"],
    ["lint", "--json"],
  ];
}

function wrappedCommand() {
  return ["perf", "exec", "--category", "test", "--", process.execPath, "-e", "setTimeout(() => {}, 5)"];
}

async function benchmark({ checkOnly = false, output = defaultOutput } = {}) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "apk-perf-fixture-"));
  try {
    runApk(rootDirectory, ["init", temporaryRoot]);
    const repetitions = checkOnly ? 1 : 3;
    const fixtureCold = runSession(temporaryRoot, "fixture-cold", fixtureCommands());
    const fixtureWarm = runSession(
      temporaryRoot,
      "fixture-warm",
      Array.from({ length: repetitions }, () => fixtureCommands()).flat(),
    );
    const wrapped = runSession(
      temporaryRoot,
      "fixture-wrapped-tool",
      Array.from({ length: checkOnly ? 1 : 2 }, () => [wrappedCommand()]).flat(),
    );
    const selfCold = runSession(rootDirectory, "self-cold", repositoryCommands());
    const selfWarm = runSession(
      rootDirectory,
      "self-warm",
      Array.from({ length: repetitions }, () => repositoryCommands()).flat(),
    );
    const results = [fixtureCold, fixtureWarm, wrapped, selfCold, selfWarm];
    for (const item of results) {
      if (item.childDurationSumMs + 0.001 < item.childWallClockUnionMs) {
        throw new Error(`${item.label}: child union cannot exceed child duration sum`);
      }
    }
    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      platform: `${process.platform}/${process.arch}`,
      node: process.version,
      repetitions: { cold: 1, warm: repetitions },
      coverage: {
        llmGeneration: "excluded",
        idleAndUnobservedGaps: "excluded",
        unwrappedExternalCommands: "unknown",
        rawTraceCommitted: false,
      },
      workloads: results,
    };
    if (!checkOnly) await writeReport(output, payload);
    return payload;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function seconds(value) {
  return `${(value / 1000).toFixed(3)} s`;
}

function number(value) {
  return Number(value).toFixed(1);
}

async function writeReport(path, payload) {
  const lines = [
    "# APK performance self-dogfood baseline",
    "",
    `Generated: ${payload.generatedAt}`,
    `Environment: ${payload.platform}, Node ${payload.node}`,
    "",
    "This bounded development baseline uses the released-in-tree profiler on a disposable initialized fixture and on AgenticProjectKit itself. It is evidence for attribution, not a universal performance claim and not an absolute release gate. Cold means the first command group after session start; warm repeats the same command group with the same semantics. The fixture and repository commands are LLM-free.",
    "",
    "Coverage: LLM generation and idle/unobserved gaps are excluded; arbitrary commands not wrapped by `apk perf exec` remain unknown; raw local traces are not committed.",
    "",
    "| Workload | Observed wall | APK self | Git | external checks | wrapped tools | APK % | theoretical max gain |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const item of payload.workloads) {
    lines.push(`| ${item.label} | ${seconds(item.observedToolingWallMs)} | ${seconds(item.apkInternalMs)} | ${seconds(item.gitMs)} | ${seconds(item.externalCheckMs)} | ${seconds(item.wrappedRepoToolMs)} | ${number(item.apkPercent)}% | ${number(item.theoreticalMaxGainPercent)}% |`);
  }
  lines.push(
    "",
    "## Contract evidence",
    "",
    "- **Baseline:** this report is the current AgenticProjectKit self-dogfood baseline produced by the committed `dist` CLI; raw JSONL traces remain local and ignored.",
    "- **Comparability:** fixture cold, fixture warm, wrapped-tool, self cold, and self warm rows use the same schemaVersion 1 profiler, category mapping, exclusive attribution, and report formulas. Only root directory and repetition phase differ.",
    "- **Fixture:** a disposable directory is initialized with `apk init`; its read-only status/task-list/doctor commands and one explicit wrapped test process are the controlled workload.",
    "- **Metric:** observed tooling wall is the union of invocation intervals; APK self, Git, external checks, and wrapped tools are reported as exclusive categories. Child sum and child union are both retained.",
    "- **Leakage control:** no LLM, prompts, responses, environment values, secrets, raw argv, stdout/stderr, or file contents enter the report; commands are fixed in this script and arbitrary unwrapped work remains unknown.",
    "- **Holdout:** this synthetic fixture is not a holdout for real agent workflows. No product or Go decision is made from it; Task 0209 supplies the downstream holdout evidence.",
    `- **Budget:** each check run uses one repetition; the committed baseline uses cold=1 and warm=${payload.repetitions.warm} with five bounded workloads and no absolute millisecond acceptance threshold.`,
    "",
    "## Method and interpretation",
    "",
    "Each row is one profiler session. APK subprocess intervals are attributed exclusively, while `child duration sum` and `child wall-clock union` are retained separately so parallel work cannot be presented as wall time. The deterministic harness checks the invariant that union is no greater than duration sum; the profiler unit suite covers overlapping intervals directly.",
    "",
    "The fixture uses `apk init`, status/task listing/doctor commands, and explicit `apk perf exec --category test` for a short non-APK process. The self rows use read-only help/status/task-list/doctor/lint commands. No task lifecycle mutation or external agent session is inferred from this synthetic run.",
    "",
    "No Go speed claim is made from this fixture. The data is a self-dogfood baseline for instrumentation and attribution; Task 0209 must collect real downstream workflows before a runtime decision.",
    "",
  );
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

const checkOnly = process.argv.includes("--check");
const outputFlag = process.argv.indexOf("--output");
const output = outputFlag === -1 ? defaultOutput : resolve(process.argv[outputFlag + 1]);
if (outputFlag !== -1 && !process.argv[outputFlag + 1]) throw new Error("--output requires a path");

const result = await benchmark({ checkOnly, output });
if (checkOnly) {
  console.log(`Performance harness check passed (${result.workloads.length} bounded workloads).`);
} else {
  console.log(`Wrote ${output}`);
  for (const workload of result.workloads) {
    console.log(`${workload.label}: wall=${seconds(workload.observedToolingWallMs)} apk=${seconds(workload.apkInternalMs)} apk%=${number(workload.apkPercent)}%`);
  }
}
