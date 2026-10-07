#!/usr/bin/env node

import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDirectory = resolve(new URL("../..", import.meta.url).pathname);
const apkPath = join(rootDirectory, "dist", "cli", "index.js");
const defaultOutput = join(rootDirectory, "docs", "benchmarks", "apk-performance-v050-self-baseline.md");

function monotonicMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function runProcess(command, args, cwd) {
  const started = monotonicMs();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parentWallMs = monotonicMs() - started;
  if (result.error) throw result.error;
  return { ...result, parentWallMs };
}

function runApk(cwd, args) {
  const result = runProcess(process.execPath, [apkPath, ...args], cwd);
  if (result.status !== 0) {
    throw new Error(`APK command failed (${result.status}): ${args.join(" ")}\n${result.stderr}`);
  }
  return result;
}

function runProjectCommand(cwd, command, args) {
  const result = runProcess(command, args, cwd);
  if (result.status !== 0) {
    throw new Error(`Project command failed (${result.status}): ${command} ${args.join(" ")}\n${result.stderr}`);
  }
  return result;
}

function report(cwd) {
  return JSON.parse(runApk(cwd, ["perf", "report", "--json"]).stdout);
}

function sessionCommands(cwd, label, commands, profiled) {
  if (profiled) runApk(cwd, ["perf", "start", "--label", label]);
  const parentWallMs = [];
  for (const args of commands) parentWallMs.push(runApk(cwd, args).parentWallMs);
  if (profiled) {
    runApk(cwd, ["perf", "stop"]);
    return { parentWallMs, report: report(cwd) };
  }
  return { parentWallMs, report: undefined };
}

function pairedSession(cwd, label, commands) {
  const off = sessionCommands(cwd, `${label}-off`, commands, false);
  const on = sessionCommands(cwd, `${label}-on`, commands, true);
  return { off, on };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function percentile(values, rank) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))];
}

function stats(values) {
  return {
    min: Math.min(...values),
    median: median(values),
    p95: percentile(values, 0.95),
    max: Math.max(...values),
    repetitions: values.length,
  };
}

function sumParentWall(session) {
  return session.parentWallMs.reduce((total, value) => total + value, 0);
}

function aggregatePaired(pairs) {
  const onReports = pairs.map((pair) => pair.on.report);
  const offWalls = pairs.map((pair) => sumParentWall(pair.off));
  const onWalls = pairs.map((pair) => sumParentWall(pair.on));
  const reportMetric = (selector) => stats(onReports.map(selector));
  return {
    repetitions: pairs.length,
    offWall: stats(offWalls),
    onWall: stats(onWalls),
    observedWall: reportMetric((value) => value.observedToolingWallMs),
    fullProcess: reportMetric((value) => value.apkFullProcessUnionMs ?? 0),
    startup: reportMetric((value) => value.apkStartupResidualMs ?? 0),
    instrumentedInternal: reportMetric((value) => value.apkInternalInstrumentedMs),
    rewriteSensitive: reportMetric((value) => value.apkRewriteSensitiveMs ?? 0),
    git: reportMetric((value) => value.gitMs),
    commandKind: Object.fromEntries([...new Set(onReports.flatMap((value) => Object.keys(value.commandKindMs)))].map((kind) => [
      kind,
      reportMetric((value) => value.commandKindMs[kind] ?? 0),
    ])),
    childDurationSum: reportMetric((value) => value.childDurationSumMs),
    childWallClockUnion: reportMetric((value) => value.childWallClockUnionMs),
    scenarios: Object.fromEntries([0.5, 0.2, 0].map((factor) => [
      factor,
      reportMetric((value) => value.scenarios.find((item) => item.factor === factor)?.improvementPercent ?? 0),
    ])),
  };
}

function shortCommands() {
  return [["--help"], ["status"], ["tasks"], ["doctor"]];
}

function verificationCommands() {
  return [
    ["perf", "exec", "--category", "test", "--", "pnpm", "exec", "tsx", "--test", "src/core/perf/index.test.ts"],
    ["perf", "exec", "--category", "lint", "--", "pnpm", "lint"],
    ["perf", "exec", "--category", "typecheck", "--", "pnpm", "typecheck"],
    ["perf", "exec", "--category", "build", "--", "pnpm", "build"],
  ];
}

async function prepareVerificationFixture(fixture) {
  runProjectCommand(fixture, "git", ["init", "-q"]);
  runProjectCommand(fixture, "git", ["config", "user.name", "APK benchmark"]);
  runProjectCommand(fixture, "git", ["config", "user.email", "benchmark@example.invalid"]);
  runApk(rootDirectory, ["init", fixture]);
  await writeFile(join(fixture, "fixture-check.mjs"), "console.log('fixture verification passed');\n", "utf8");
  runProjectCommand(fixture, "git", ["add", "."]);
  runProjectCommand(fixture, "git", ["-c", "user.name=APK benchmark", "-c", "user.email=benchmark@example.invalid", "commit", "-m", "fixture baseline"]);
  runApk(fixture, ["agent", "register", "--id", "fixture-owner", "--platform", "benchmark", "--model", "fixture"]);
  runApk(fixture, [
    "task", "create",
    "--title", "Disposable verification fixture",
    "--scope", "benchmark",
    "--context", "AGENTS.md",
    "--allowed", "fixture-check.mjs",
    "--verification", "node fixture-check.mjs",
    "--mode", "mvp",
    "--lane", "implementation",
    "--risk", "low",
  ]);
  const taskFiles = (await readdir(join(fixture, ".tasks")))
    .filter((file) => /^\d{4}-.+\.md$/.test(file))
    .sort();
  const taskFile = taskFiles.at(-1);
  if (!taskFile) throw new Error("Fixture task was not created.");
  const taskId = taskFile.slice(0, 4);
  runApk(fixture, ["claim", taskId, "--owner", "fixture-owner"]);
  return taskId;
}

function fixtureVerificationCommands(taskId) {
  return [["task", "verify", taskId, "--owner", "fixture-owner"]];
}

function percent(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function seconds(value) {
  return `${(value / 1000).toFixed(3)} s`;
}

function number(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "unavailable";
}

function checkAggregate(label, aggregate) {
  if (aggregate.onWall.median <= 0 || aggregate.observedWall.median <= 0) {
    throw new Error(`${label}: benchmark produced no positive wall-clock measurement`);
  }
  if (aggregate.childDurationSum.median + 0.001 < aggregate.childWallClockUnion.median) {
    throw new Error(`${label}: child union exceeded child duration sum`);
  }
  for (const [factor, value] of Object.entries(aggregate.scenarios)) {
    if (!Number.isFinite(value.median)) throw new Error(`${label}: scenario ${factor} was not finite`);
  }
}

async function benchmark({ checkOnly = false, output = defaultOutput } = {}) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "apk-perf-v050-fixture-"));
  try {
    const fixtureTaskId = await prepareVerificationFixture(temporaryRoot);
    const shortFirstRepetitions = checkOnly ? 1 : 5;
    const shortRepeatedRepetitions = checkOnly ? 1 : 10;
    const verificationRepetitions = checkOnly ? 1 : 3;
    const fixtureRepetitions = checkOnly ? 1 : 3;
    const shortFirst = [];
    const shortRepeated = [];
    const verificationHeavy = [];
    const fixtureVerification = [];
    for (let index = 0; index < shortFirstRepetitions; index += 1) {
      shortFirst.push(pairedSession(rootDirectory, `short-first-${index + 1}`, shortCommands()));
    }
    for (let index = 0; index < shortRepeatedRepetitions; index += 1) {
      shortRepeated.push(pairedSession(rootDirectory, `short-repeated-${index + 1}`, shortCommands()));
    }
    for (let index = 0; index < verificationRepetitions; index += 1) {
      verificationHeavy.push(pairedSession(rootDirectory, `verification-heavy-${index + 1}`, verificationCommands()));
    }
    for (let index = 0; index < fixtureRepetitions; index += 1) {
      fixtureVerification.push(pairedSession(temporaryRoot, `fixture-verification-${index + 1}`, fixtureVerificationCommands(fixtureTaskId)));
    }
    const aggregates = {
      shortFirst: aggregatePaired(shortFirst),
      shortRepeated: aggregatePaired(shortRepeated),
      verificationHeavy: aggregatePaired(verificationHeavy),
      fixtureVerification: aggregatePaired(fixtureVerification),
    };
    for (const [label, value] of Object.entries(aggregates)) checkAggregate(label, value);
    const payload = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      platform: `${process.platform}/${process.arch}`,
      node: process.version,
      methodology: {
        firstRunGroup: "first command group after each profiling session starts; no OS-cache purity claimed",
        repeatedRunGroup: "same command group repeated in independent sessions; no OS-cache purity claimed",
        parentBoundary: "parent monotonic time from APK spawn to exit, independent of Node-observed lifetime",
        verificationRepetitions,
        shortFirstRepetitions,
        shortRepeatedRepetitions,
      },
      coverage: {
        llmGeneration: "excluded",
        idleAndUnobservedGaps: "excluded",
        unwrappedExternalCommands: "unknown",
        rawTraceCommitted: false,
        parentSpawnToExitCompared: true,
        v1TraceCompatibility: "covered by profiler tests and release smoke, not part of this raw benchmark run",
      },
      workloads: aggregates,
    };
    if (!checkOnly) await writeReport(output, payload);
    return payload;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function rowStats(value) {
  return `min ${seconds(value.min)}, median ${seconds(value.median)}, p95 ${seconds(value.p95)}, max ${seconds(value.max)} (n=${value.repetitions})`;
}

function commandKind(value, kind) {
  return value.commandKind[kind]?.median ?? 0;
}

async function writeReport(path, payload) {
  const shortRows = [
    ["short first-run group", payload.workloads.shortFirst],
    ["short repeated-run group", payload.workloads.shortRepeated],
  ];
  const lines = [
    "# APK performance v0.5.0 self-dogfood baseline",
    "",
    `Generated: ${payload.generatedAt}`,
    `Environment: ${payload.platform}, Node ${payload.node}`,
    "Trace/report schema: v2",
    "",
    "This bounded, LLM-free development baseline uses the v2 profiler on AgenticProjectKit and a disposable task-verification fixture. It is decision-quality self evidence for attribution, not a universal Go conclusion and not an absolute release gate.",
    "",
    "Coverage: LLM generation, model/API wait, reasoning, user think time, idle/unobserved gaps, and arbitrary unwrapped commands are excluded or unknown. Parent spawn-to-exit is measured independently from Node-observed process lifetime. Raw traces and machine paths are not committed.",
    "",
    "## Short APK commands",
    "",
    "First-run means the first command group after a session starts. Repeated-run means an identical command group in another session. Neither label claims OS-cache purity.",
    "",
    "| Group | repetitions | parent process wall | Node full process | startup residual | instrumented APK internal | Git |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [label, value] of shortRows) {
    lines.push(`| ${label} | ${value.offWall.repetitions} | ${rowStats(value.offWall)} | ${rowStats(value.fullProcess)} | ${rowStats(value.startup)} | ${rowStats(value.instrumentedInternal)} | ${rowStats(value.git)} |`);
  }
  const verification = payload.workloads.verificationHeavy;
  const fixture = payload.workloads.fixtureVerification;
  lines.push(
    "",
    "## Verification-heavy workload",
    "",
    "The AgenticProjectKit row runs the same four commands in OFF and ON groups through `apk perf exec`: focused test, lint, typecheck, and build. The disposable fixture row runs the same claimed `apk task verify` command in both modes; its task verification executes an external Node check.",
    "",
    "| Workload | repetitions | wall | rewrite-sensitive APK | Git | tests | lint | typecheck | build | other |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| AgenticProjectKit test/lint/typecheck/build | ${verification.repetitions} | ${rowStats(verification.observedWall)} | ${rowStats(verification.rewriteSensitive)} | ${seconds(commandKind(verification, "git"))} | ${seconds(commandKind(verification, "test"))} | ${seconds(commandKind(verification, "lint"))} | ${seconds(commandKind(verification, "typecheck"))} | ${seconds(commandKind(verification, "build"))} | ${seconds(commandKind(verification, "external-other") + commandKind(verification, "repo-tool"))} |`,
    `| Disposable task verify | ${fixture.repetitions} | ${rowStats(fixture.observedWall)} | ${rowStats(fixture.rewriteSensitive)} | ${seconds(commandKind(fixture, "git"))} | ${seconds(commandKind(fixture, "test"))} | ${seconds(commandKind(fixture, "lint"))} | ${seconds(commandKind(fixture, "typecheck"))} | ${seconds(commandKind(fixture, "build"))} | ${seconds(commandKind(fixture, "external-other") + commandKind(fixture, "repo-tool"))} |`,
    "",
    "Child duration sum and child wall-clock union remain separate diagnostics. Primary command-kind attribution is disjoint, so overlapping children are not added as wall-clock percentages.",
    "",
    "## Instrumentation overhead",
    "",
    "OFF and ON use identical command sequences, fixtures, Node version, and environment. Parent process wall is the external overhead comparison; no absolute timing threshold is used.",
    "",
    "| Workload | OFF parent wall | ON parent wall | delta ms | delta % |",
    "| --- | ---: | ---: | ---: | ---: |",
  );
  for (const [label, value] of [
    ["short first-run group", payload.workloads.shortFirst],
    ["short repeated-run group", payload.workloads.shortRepeated],
    ["verification-heavy", payload.workloads.verificationHeavy],
    ["disposable task verify", payload.workloads.fixtureVerification],
  ]) {
    const delta = value.onWall.median - value.offWall.median;
    lines.push(`| ${label} | ${seconds(value.offWall.median)} | ${seconds(value.onWall.median)} | ${number(delta)} ms | ${number(percent(delta, value.offWall.median))}% |`);
  }
  lines.push(
    "",
    "## Go ceilings",
    "",
    "These are Amdahl-style mathematical scenarios for the measured rewrite-sensitive APK time. They do not claim that Go would deliver any stated factor.",
    "",
    "| Workload | APK rewrite-sensitive share | 2x gain | 5x gain | zero-cost maximum |",
    "| --- | ---: | ---: | ---: | ---: |",
  );
  for (const [label, value] of [
    ["short first-run group", payload.workloads.shortFirst],
    ["short repeated-run group", payload.workloads.shortRepeated],
    ["verification-heavy", payload.workloads.verificationHeavy],
    ["disposable task verify", payload.workloads.fixtureVerification],
  ]) {
    lines.push(`| ${label} | ${number(percent(value.rewriteSensitive.median, value.observedWall.median))}% | ${number(value.scenarios[0.5].median)}% | ${number(value.scenarios[0.2].median)}% | ${number(value.scenarios[0].median)}% |`);
  }
  lines.push(
    "",
    "## Evidence controls and limits",
    "",
    "- **Baseline:** this report replaces the v0.4.9 synthetic-only self baseline for v2 self measurement; v0.4.9 remains immutable historical evidence.",
    "- **Comparability:** every OFF/ON pair uses the same fixed command list, fixture, Node version, and working directory. The ON report uses schemaVersion 2; the OFF side is independently observed by the parent because no trace is expected.",
    "- **Process boundary:** parent spawn-to-exit is not required to equal reconstructed Node process lifetime. The two measurements are reported as different observation boundaries.",
    "- **Repetitions:** short first-run groups use at least five runs and repeated-run groups use at least ten in the committed baseline; verification-heavy groups use three bounded runs because they execute real project tooling. The committed tables show min/median/p95/max for repeated workload measurements.",
    "- **Fixture:** the disposable task fixture proves APK orchestration, Git/provenance, and an external verification subprocess. The repository workload exercises test, lint, typecheck, and build through explicit wrappers.",
    "- **Privacy:** the harness fixes commands in source, does not commit stdout/stderr or raw traces, and the profiler stores neither raw argv nor environment values. Temporary fixtures are removed after each run.",
    "- **Holdout:** this self benchmark is not representative downstream evidence. Task 0215 must collect real sessions using the released v0.5.0 package before any Go decision.",
    "- **Release policy:** noisy benchmark milliseconds are not a CI or release threshold; the benchmark is a measurement artifact and methodology check.",
    "",
    "Go decision: pending real v0.5.0 downstream evidence. No full rewrite or prototype is authorized by this self benchmark alone.",
  );
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

const checkOnly = process.argv.includes("--check");
const outputFlag = process.argv.indexOf("--output");
const output = outputFlag === -1 ? defaultOutput : resolve(process.argv[outputFlag + 1]);
if (outputFlag !== -1 && !process.argv[outputFlag + 1]) throw new Error("--output requires a path");

const result = await benchmark({ checkOnly, output });
if (checkOnly) {
  console.log(`Performance v2 harness check passed (${Object.keys(result.workloads).length} bounded workloads).`);
} else {
  console.log(`Wrote ${output}`);
  for (const [label, workload] of Object.entries(result.workloads)) {
    console.log(`${label}: observed=${seconds(workload.observedWall.median)} rewrite-sensitive=${seconds(workload.rewriteSensitive.median)} repetitions=${workload.repetitions}`);
  }
}
