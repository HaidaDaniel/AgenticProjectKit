import fsPromises from "node:fs/promises";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { format } from "node:util";
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";

import { createWorkerPackage, parseWorkerPackage } from "../core/work/contract.js";
import { resolveExecutionRoute, resolveAssurancePlan } from "../core/execution/index.js";
import { resolveTaskPolicy } from "../core/tasks/policy.js";
import { parseTaskMarkdown } from "../core/tasks/index.js";
import { dispatchPublicCommand, PUBLIC_COMMANDS } from "./command-registry.js";

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const TEST_ROOT = process.cwd();
let commandQueue: Promise<void> = Promise.resolve();

// Command handlers use process.cwd() and console. Serialize invocations within
// this isolated test-file process; never change environment or mock core services.
async function captureCommand(handler: () => Promise<number>, cwd: string): Promise<CommandResult> {
  const preceding = commandQueue;
  let release!: () => void;
  commandQueue = new Promise<void>((resolve) => { release = resolve; });
  await preceding;
  const previousCwd = process.cwd();
  const log = console.log;
  const error = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];
  try {
    process.chdir(cwd);
    console.log = (...values: unknown[]) => { stdout.push(`${format(...values)}\n`); };
    console.error = (...values: unknown[]) => { stderr.push(`${format(...values)}\n`); };
    const exitCode = await handler();
    assert.ok(Number.isInteger(exitCode) && exitCode >= 0, "Handler must return an explicit exit code");
    return { exitCode, stdout: stdout.join(""), stderr: stderr.join("") };
  } finally {
    console.log = log;
    console.error = error;
    try { process.chdir(previousCwd); } finally { release(); }
  }
}

async function runCommand(args: readonly string[], cwd = TEST_ROOT): Promise<CommandResult> {
  const [command, ...rest] = args;
  assert.ok(command, "Command-layer tests must specify a public command");
  return captureCommand(async () => {
    const result = await dispatchPublicCommand(command, rest);
    assert.notEqual(result, undefined, `Unknown command in command-layer test: ${command}`);
    return result!;
  }, cwd);
}

test("command harness captures streams and restores process state after a nonzero result", async () => {
  const cwd = process.cwd();
  const log = console.log;
  const error = console.error;
  await withTempDirectory(async (directory) => {
    const result = await captureCommand(async () => {
      assert.equal(process.cwd(), directory);
      console.log("%s %d", "слово", 7);
      console.error("expected refusal");
      return 3;
    }, directory);
    assert.deepEqual(result, { exitCode: 3, stdout: "слово 7\n", stderr: "expected refusal\n" });
    assert.equal(process.cwd(), cwd);
    assert.equal(console.log, log);
    assert.equal(console.error, error);
  });
});

test("command harness serializes overlapping invocations without mixing cwd or output", async () => {
  await withTempDirectory(async (directory) => {
    const first = join(directory, "first");
    const second = join(directory, "second");
    await mkdir(first);
    await mkdir(second);
    const order: string[] = [];
    const results = await Promise.all([
      captureCommand(async () => {
        order.push("first-start");
        console.log("first-start");
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(process.cwd(), first);
        order.push("first-end");
        console.log("first-end");
        return 0;
      }, first),
      captureCommand(async () => {
        assert.equal(process.cwd(), second);
        order.push("second");
        console.log("second");
        return 0;
      }, second),
    ]);
    assert.deepEqual(order, ["first-start", "first-end", "second"]);
    assert.deepEqual(results.map((result) => result.stdout), ["first-start\nfirst-end\n", "second\n"]);
  });
});

test("command harness restores state and releases its queue after throws and invalid cwd", async () => {
  const cwd = process.cwd();
  const log = console.log;
  const error = console.error;
  await withTempDirectory(async (directory) => {
    await assert.rejects(captureCommand(async () => { throw new Error("unexpected handler crash"); }, directory), /unexpected handler crash/);
    await assert.rejects(captureCommand(async () => 0, join(directory, "missing")), /ENOENT/);
    await assert.rejects(captureCommand(async () => undefined as unknown as number, directory), /explicit exit code/);
    assert.equal(process.cwd(), cwd);
    assert.equal(console.log, log);
    assert.equal(console.error, error);
    assert.deepEqual(await captureCommand(async () => 0, directory), { exitCode: 0, stdout: "", stderr: "" });
  });
});

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-cli-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

function executionWorker(
  id: string,
  roles: string[],
  overrides: { occupied?: number; availability?: "available" | "unavailable" | "unknown" } = {},
) {
  return {
    id,
    modelId: "model-a",
    harnessId: "harness-a",
    location: "local" as const,
    billingMode: "free" as const,
    costClass: "local-free" as const,
    availability: overrides.availability ?? ("available" as const),
    capacity: 1,
    occupied: overrides.occupied ?? 0,
    capabilities: { roles, tools: [], workspaceModes: [], workerProtocols: ["apk-worker-v1"] },
  };
}

const BASE_EXECUTION_POLICY = {
  automatedVerification: true,
  scope: false,
  independentReview: false,
  reviewLevel: "none" as const,
  evidenceRequired: false,
  evidenceCategories: [] as string[],
  assurance: "none" as const,
};

async function writeExecutionRepo(directory: string, extra: Record<string, unknown> = {}): Promise<void> {
  await mkdir(join(directory, ".agentic"), { recursive: true });
  await mkdir(join(directory, ".tasks"), { recursive: true });
  await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({
    schemaVersion: 2,
    executionProfile: "constrained",
    resources: {
      models: [{ id: "model-a", roles: ["implementation", "review"] }],
      harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"], sessionIsolation: true }],
      workers: [
        executionWorker("local-a", ["implementation", "review"]),
        executionWorker("local-b", ["implementation", "review"]),
      ],
    },
    ...extra,
  }), "utf8");
}

function buildTaskMarkdown(id: string, title: string, state: string, owner = "none"): string {
  return [
    `# Task ${id} - ${title}`,
    "",
    `State: ${state}`,
    `Owner: ${owner}`,
    "Mode: mvp",
    "Lane: implementation",
    "Scope: none",
    "Risk: low",
    "Parallel: false",
    "Depends on: none",
    "Tags: none",
    "",
    "## Goal",
    "",
    "A task.",
    "",
    "## Context files",
    "",
    "- AGENTS.md",
    "",
    "## Files allowed to edit",
    "",
    `- .tasks/${id}-task.md`,
    "",
    "## Files forbidden to edit",
    "",
    "- package.json",
    "",
    "## Steps",
    "",
    "1. Do something.",
    "",
    "## Acceptance criteria",
    "",
    "- It works.",
    "",
    "## Verification commands",
    "",
    "- pnpm test",
    "",
    "## Documentation updates",
    "",
    "- docs/progress.md",
    "",
    "## Notes",
    "",
    "None.",
    "",
  ].join("\n");
}

function explicitConfig(agentStyle: string | undefined, projectName: string): string {
  const record: Record<string, unknown> = {
    schemaVersion: 2,
    projectName,
    defaultMode: "mvp",
    documentationProfile: "minimal",
    taskDirectory: ".tasks",
    docsDirectory: "docs",
  };
  if (agentStyle !== undefined) {
    record.agentStyle = agentStyle;
  }
  return `${JSON.stringify(record, null, 2)}\n`;
}

test("command-handler help options are represented by the canonical reference registry", async () => {
  const helpPaths = new Set(PUBLIC_COMMANDS.flatMap((entry) => entry.variants.map((variant) => {
    const words = variant.usage.split(/\s+/);
    const path: string[] = [];
    for (const word of words) {
      if (word.startsWith("-") || word.startsWith("<") || word.startsWith("[") || word.startsWith("\"")) break;
      path.push(word);
    }
    return path.join(" ");
  })));

  for (const path of helpPaths) {
    const [command, ...subcommands] = path.split(" ");
    const help = await runCommand([command!, ...subcommands, "--help"]);
    assert.equal(help.exitCode, 0, `${path} --help failed: ${help.stdout}${help.stderr}`);

    const sourceUsage = help.stdout.split(/\r?\n/).filter((line) => {
      const usage = line.trim().replace(/^Usage:\s*/, "");
      return /^(?:apk|apkit)\s/.test(usage);
    });
    const documentedFlags = new Set(PUBLIC_COMMANDS
      .find((entry) => entry.command === command)?.variants
      .flatMap((variant) => [...variant.usage.matchAll(/--[a-z][a-z-]*/g)].map((match) => match[0])) ?? []);

    for (const line of sourceUsage) {
      for (const match of line.matchAll(/--[a-z][a-z-]*/g)) {
        assert.ok(documentedFlags.has(match[0]!), `${path} help exposes ${match[0]} without a registry entry`);
      }
    }
  }
});

test("execution resolver keeps profiles independent and handles tie, capacity, and deterministic lanes", () => {
  const worker = (id: string, costClass: "local-free" | "cheap" | "scarce-frontier", location: "local" | "remote" = "local", occupied = 0) => ({
    id,
    modelId: `${id}-model`,
    harnessId: `${id}-harness`,
    location,
    billingMode: costClass === "local-free" ? "free" as const : "metered" as const,
    costClass,
    availability: "available" as const,
    capacity: 1,
    occupied,
    capabilities: { roles: ["implementation"], tools: [], workspaceModes: [], workerProtocols: ["apk-worker-v1"] },
  });
  const registry = {
    models: [],
    harnesses: [],
    workers: [worker("local-a", "local-free"), worker("cheap-b", "cheap"), worker("cheap-a", "cheap"), worker("frontier-a", "scarce-frontier", "remote")],
  };
  const policy = { automatedVerification: true, scope: false, independentReview: false, reviewLevel: "none" as const, evidenceRequired: false, evidenceCategories: [] };

  for (const profile of ["local", "constrained", "balanced", "abundant"] as const) {
    assert.equal(resolveExecutionRoute({ profile, role: "implementation", policy, registry }).resourceId, "local-a");
  }
  assert.equal(resolveExecutionRoute({ profile: "balanced", role: "implementation", policy, registry, override: { preferCostClass: "cheap" } }).resourceId, "cheap-a");
  assert.equal(resolveExecutionRoute({ profile: "local", role: "implementation", policy, registry: { ...registry, workers: [worker("frontier-a", "scarce-frontier", "remote")] } }).kind, "needs-human");
  assert.equal(resolveExecutionRoute({ profile: "balanced", role: "implementation", policy, registry: { ...registry, workers: [worker("local-a", "local-free", "local", 1)] } }).kind, "wait");
  assert.equal(resolveExecutionRoute({ profile: "balanced", role: "verification", policy, registry }).kind, "deterministic");
  assert.equal(resolveExecutionRoute({ profile: "balanced", role: "review", policy, registry }).kind, "deterministic");
  const lightweightReview = { ...policy, independentReview: true, reviewLevel: "lightweight" as const };
  assert.equal(resolveExecutionRoute({
    profile: "constrained",
    role: "review",
    policy: lightweightReview,
    registry: { ...registry, workers: [worker("frontier-only", "scarce-frontier", "remote")] },
  }).kind, "needs-human");
  const diverseRegistry = {
    models: [{ id: "model-a", family: "family-a", roles: ["review"] }, { id: "model-b", family: "family-b", roles: ["review"] }],
    harnesses: [
      { id: "harness-a", sessionIsolation: true, tools: [], workspaceModes: [], subagentSupport: false, workerProtocols: ["apk-worker-v1"] },
      { id: "harness-b", sessionIsolation: true, tools: [], workspaceModes: [], subagentSupport: false, workerProtocols: ["apk-worker-v1"] },
    ],
    workers: [
      { ...worker("review-a", "cheap"), modelId: "model-a", harnessId: "harness-a", capabilities: { roles: ["review"], tools: [], workspaceModes: [], workerProtocols: ["apk-worker-v1"] } },
      { ...worker("review-b", "cheap"), modelId: "model-b", harnessId: "harness-b", capabilities: { roles: ["review"], tools: [], workspaceModes: [], workerProtocols: ["apk-worker-v1"] } },
    ],
  };
  const diverse = resolveExecutionRoute({
    profile: "balanced",
    role: "review",
    policy: { ...lightweightReview, assurance: "diverse", reviewBudget: { maxReviewPasses: 2, maxFrontierReviewPasses: 1, maxFrontierRuns: 1, paidEscalation: false } },
    registry: diverseRegistry,
  });
  assert.equal(diverse.kind, "worker");
  assert.deepEqual(diverse.assurance?.resourceIds, ["review-a", "review-b"]);
  assert.equal(resolveExecutionRoute({
    profile: "balanced",
    role: "review",
    policy: { ...lightweightReview, assurance: "independent", reviewBudget: { maxReviewPasses: 0, maxFrontierReviewPasses: 0, maxFrontierRuns: 0, paidEscalation: false } },
    registry: diverseRegistry,
  }).kind, "budget-exhausted");
});

test("ordinary medium task does not spend constrained scarce-frontier review capacity", () => {
  const task = parseTaskMarkdown(buildTaskMarkdown("0001", "Ordinary Medium", "todo").replace("Risk: low", "Risk: medium"));
  const policy = resolveTaskPolicy(task).requirements;
  assert.equal(policy.assurance, "self-check");
  assert.equal(policy.independentReview, false);

  const frontierReviewWorker = {
    id: "frontier-review",
    modelId: "frontier-model",
    harnessId: "frontier-harness",
    location: "remote" as const,
    billingMode: "metered" as const,
    costClass: "scarce-frontier" as const,
    availability: "available" as const,
    capacity: 1,
    occupied: 0,
    capabilities: { roles: ["review"], tools: [], workspaceModes: [], workerProtocols: ["apk-worker-v1"] },
  };
  const route = resolveExecutionRoute({
    profile: "constrained",
    role: "review",
    policy,
    registry: { models: [], harnesses: [], workers: [frontierReviewWorker] },
  });
  assert.equal(route.kind, "deterministic");
  assert.equal(route.resourceId, undefined);

  const assurance = resolveAssurancePlan({
    policy,
    registry: { models: [], harnesses: [], workers: [frontierReviewWorker] },
  });
  assert.equal(assurance.status, "ready");
  assert.deepEqual(assurance.resourceIds, []);
});

test("frontier review caps remain independent from total review headroom", () => {
  const frontierReview = {
    id: "frontier-review",
    modelId: "frontier-model",
    harnessId: "frontier-harness",
    location: "remote" as const,
    billingMode: "subscription" as const,
    costClass: "scarce-frontier" as const,
    availability: "available" as const,
    capacity: 1,
    occupied: 0,
    capabilities: { roles: ["review"], tools: [], workspaceModes: [], workerProtocols: ["apk-worker-v1"] },
  };
  const cheapReview = {
    ...frontierReview,
    id: "cheap-review",
    modelId: "cheap-model",
    harnessId: "cheap-harness",
    location: "local" as const,
    billingMode: "free" as const,
    costClass: "cheap" as const,
  };
  const policy = {
    automatedVerification: true,
    scope: true,
    independentReview: true,
    reviewLevel: "independent" as const,
    assurance: "independent" as const,
    evidenceRequired: false,
    evidenceCategories: [],
    reviewBudget: { maxReviewPasses: 8, maxFrontierReviewPasses: 1, maxFrontierRuns: 1, paidEscalation: false },
  };
  const frontierOnly = { models: [], harnesses: [], workers: [frontierReview] };
  const initial = resolveAssurancePlan({ policy, registry: frontierOnly, frontierUsage: { reviewPassesUsed: 0, runsUsed: 0 } });
  assert.equal(initial.status, "ready");
  assert.equal(initial.budget.maxReviewPasses, 8);
  assert.equal(initial.budget.maxFrontierReviewPasses, 1);

  for (const frontierUsage of [
    { reviewPassesUsed: 1, runsUsed: 0 },
    { reviewPassesUsed: 0, runsUsed: 1 },
  ]) {
    const exhausted = resolveExecutionRoute({
      profile: "balanced",
      role: "review",
      policy,
      registry: frontierOnly,
      frontierUsage,
    });
    assert.equal(exhausted.kind, "needs-human");
    assert.match(exhausted.explanation, /Frontier review budget exhausted/);
  }

  const localFallback = resolveExecutionRoute({
    profile: "balanced",
    role: "review",
    policy,
    registry: { models: [], harnesses: [], workers: [frontierReview, cheapReview] },
    frontierUsage: { reviewPassesUsed: 1, runsUsed: 1 },
  });
  assert.equal(localFallback.kind, "worker");
  assert.equal(localFallback.resourceId, "cheap-review");
  assert.equal(localFallback.assurance?.budget.maxReviewPasses, 8);
  assert.equal(localFallback.assurance?.budget.maxFrontierReviewPasses, 1);
  assert.equal(localFallback.assurance?.budget.maxFrontierRuns, 1);

  const blockedImplementation = resolveExecutionRoute({
    profile: "constrained",
    role: "implementation",
    complexity: "complex",
    policy,
    registry: frontierOnly,
    frontierUsage: { runsUsed: 1 },
  });
  assert.equal(blockedImplementation.kind, "needs-human");
  assert.match(
    blockedImplementation.candidates[0]?.reasons.join(" ") ?? "",
    /recorded frontier review\/run budget is exhausted/,
  );

  for (const override of [
    { resourceId: "frontier-review" },
    { resourceId: "frontier-review", allowProfileBypass: true },
  ]) {
    const blockedOverride = resolveExecutionRoute({
      profile: "balanced",
      role: "review",
      policy,
      registry: { models: [], harnesses: [], workers: [frontierReview, cheapReview] },
      frontierUsage: { reviewPassesUsed: 1, runsUsed: 1 },
      override,
    });
    assert.notEqual(blockedOverride.kind, "worker");
    assert.match(
      blockedOverride.candidates.find((candidate) => candidate.resourceId === "frontier-review")?.reasons.join(" ") ?? "",
      /recorded frontier review\/run budget is exhausted/,
    );
  }

  const blockedCalibration = resolveExecutionRoute({
    profile: "balanced",
    role: "review",
    policy,
    registry: { models: [], harnesses: [], workers: [frontierReview, cheapReview] },
    frontierUsage: { reviewPassesUsed: 1, runsUsed: 1 },
    calibrationRoute: "frontier-review",
  });
  assert.equal(blockedCalibration.resourceId, "cheap-review");
  assert.equal(blockedCalibration.routeSource, "resolver");
});

test("CLI resources detect keeps credential-like endpoints out of human and JSON output", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    const configPath = join(directory, ".agentic", "config.json");
    const worker = {
      id: "worker-a",
      modelId: "model-a",
      harnessId: "harness-a",
      location: "local",
      billingMode: "free",
      costClass: "local-free",
      availability: "available",
      capacity: 1,
      capabilities: { roles: ["implementation"] },
    };
    const base = {
      schemaVersion: 2,
      resources: {
        models: [{ id: "model-a", roles: ["implementation"] }],
        harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"] }],
      },
    };

    await writeFile(configPath, JSON.stringify({
      ...base,
      resources: {
        ...base.resources,
        workers: [{ ...worker, endpoint: "https://user:TOPSECRETPW@example.com/v1" }],
      },
    }), "utf8");
    const json = await runCommand(["resources", "detect", "--json"], directory);
    assert.equal(json.exitCode, 0, `${json.stdout}${json.stderr}`);
    assert.doesNotMatch(json.stdout, /TOPSECRETPW/);
    assert.doesNotMatch(json.stderr, /TOPSECRETPW/);

    const human = await runCommand(["resources", "detect"], directory);
    assert.equal(human.exitCode, 0, `${human.stdout}${human.stderr}`);
    assert.doesNotMatch(human.stdout, /TOPSECRETPW/);
    assert.doesNotMatch(human.stderr, /TOPSECRETPW/);

    await writeFile(configPath, JSON.stringify({
      ...base,
      resources: {
        ...base.resources,
        workers: [{ ...worker, endpoint: "https://example.com/v1?key=TOPSECRETPW" }],
      },
    }), "utf8");
    const rejected = await runCommand(["resources", "detect", "--json"], directory);
    assert.equal(rejected.exitCode, 1);
    assert.doesNotMatch(rejected.stdout, /TOPSECRETPW/);
    assert.doesNotMatch(rejected.stderr, /TOPSECRETPW/);
  });
});

test("CLI execution explain keeps --json valid with saved calibration", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-task.md"), buildTaskMarkdown("0001", "Task", "todo"), "utf8");
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({
      schemaVersion: 2,
      executionCalibration: {
        profile: "constrained",
        inventoryFingerprint: "deadbeef",
        generatedAt: "2026-01-01T00:00:00Z",
        planner: "codex",
        routes: { implementation: "worker-a" },
      },
    }), "utf8");

    const result = await runCommand(["execution", "explain", "0001", "--role", "implementation", "--json"], directory);
    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    const payload = JSON.parse(result.stdout) as { calibration?: { status?: string } };
    assert.equal(payload.calibration?.status, "stale");
  });
});

test("CLI execution explain uses a current calibration route with provenance", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    await writeFile(join(directory, ".tasks/0001-task.md"), buildTaskMarkdown("0001", "Task", "todo"), "utf8");

    const applied = await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "local-b" },
      planner: "codex",
    }), "--apply"], directory);
    assert.equal(applied.exitCode, 0, `${applied.stdout}${applied.stderr}`);

    const result = await runCommand(["execution", "explain", "0001", "--role", "implementation", "--json"], directory);
    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    const payload = JSON.parse(result.stdout) as {
      resourceId?: string;
      routeSource?: string;
      profileSource?: string;
      calibration?: { status?: string; routeApplied?: boolean };
    };
    assert.equal(payload.resourceId, "local-b");
    assert.equal(payload.routeSource, "calibration");
    assert.equal(payload.profileSource, "calibration");
    assert.equal(payload.calibration?.status, "current");
    assert.equal(payload.calibration?.routeApplied, true);
  });
});

test("CLI execution explain ignores stale calibration and falls back to the resolver", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    await writeFile(join(directory, ".tasks/0001-task.md"), buildTaskMarkdown("0001", "Task", "todo"), "utf8");
    const applied = await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "local-b" },
      planner: "codex",
    }), "--apply"], directory);
    assert.equal(applied.exitCode, 0, `${applied.stdout}${applied.stderr}`);

    const configPath = join(directory, ".agentic", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as { resources: { workers: unknown[] } };
    config.resources.workers.push(executionWorker("local-c", ["implementation"]));
    await writeFile(configPath, JSON.stringify(config), "utf8");

    const result = await runCommand(["execution", "explain", "0001", "--role", "implementation", "--json"], directory);
    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    const payload = JSON.parse(result.stdout) as {
      resourceId?: string;
      routeSource?: string;
      calibration?: { status?: string; routeApplied?: boolean };
    };
    assert.equal(payload.resourceId, "local-a");
    assert.equal(payload.routeSource, "resolver");
    assert.equal(payload.calibration?.status, "stale");
    assert.equal(payload.calibration?.routeApplied, false);
  });
});

test("CLI execution explain lets a user override outrank current calibration", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory, { executionOverrides: { resourceId: "local-a" } });
    await writeFile(join(directory, ".tasks/0001-task.md"), buildTaskMarkdown("0001", "Task", "todo"), "utf8");
    const applied = await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "local-b" },
      planner: "codex",
    }), "--apply"], directory);
    assert.equal(applied.exitCode, 0, `${applied.stdout}${applied.stderr}`);

    const result = await runCommand(["execution", "explain", "0001", "--role", "implementation", "--json"], directory);
    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    const payload = JSON.parse(result.stdout) as { resourceId?: string; routeSource?: string; calibration?: { status?: string } };
    assert.equal(payload.resourceId, "local-a");
    assert.equal(payload.routeSource, "override");
    assert.equal(payload.calibration?.status, "current");
  });
});

test("CLI execution explain clamps calibration assurance to canonical policy", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    const taskPath = join(directory, ".tasks/0001-task.md");

    await writeFile(taskPath, buildTaskMarkdown("0001", "Task", "todo").replace("Risk: low", "Risk: medium"), "utf8");
    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { review: "local-a" },
      assuranceMinimum: "fresh-context",
      planner: "codex",
    }), "--apply"], directory);
    const medium = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "review", "--json"], directory)).stdout) as {
      kind?: string;
      assurance?: { required?: string; canonicalRequired?: string; calibrationPreference?: string };
    };
    assert.equal(medium.kind, "deterministic");
    assert.equal(medium.assurance, undefined);

    await writeFile(taskPath, buildTaskMarkdown("0001", "Task", "todo").replace("Risk: low", "Risk: high"), "utf8");
    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { review: "local-a" },
      assuranceMinimum: "none",
      planner: "codex",
    }), "--apply"], directory);
    const high = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "review", "--json"], directory)).stdout) as {
      assurance?: { required?: string; canonicalRequired?: string; calibrationPreference?: string };
    };
    assert.equal(high.assurance?.canonicalRequired, "fresh-context");
    assert.equal(high.assurance?.required, "fresh-context");
    assert.equal(high.assurance?.calibrationPreference, undefined);

    await writeFile(taskPath, buildTaskMarkdown("0001", "Task", "todo").replace("Risk: low", "Risk: critical"), "utf8");
    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { review: "local-a" },
      assuranceMinimum: "self-check",
      planner: "codex",
    }), "--apply"], directory);
    const critical = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "review", "--json"], directory)).stdout) as {
      assurance?: { required?: string; canonicalRequired?: string };
    };
    assert.equal(critical.assurance?.canonicalRequired, "independent");
    assert.equal(critical.assurance?.required, "independent");
  });
});

test("CLI execution explain honors current calibration wait and needs-human sentinels", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    await writeFile(join(directory, ".tasks/0001-task.md"), buildTaskMarkdown("0001", "Task", "todo"), "utf8");

    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "wait" },
      planner: "codex",
    }), "--apply"], directory);
    const wait = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "implementation", "--json"], directory)).stdout) as {
      kind?: string;
      queue?: string;
      routeSource?: string;
      calibration?: { status?: string; routeApplied?: boolean; routeRecommendation?: string };
    };
    assert.equal(wait.kind, "wait");
    assert.equal(wait.queue, "wait");
    assert.equal(wait.routeSource, "calibration");
    assert.equal(wait.calibration?.status, "current");
    assert.equal(wait.calibration?.routeApplied, true);
    assert.equal(wait.calibration?.routeRecommendation, "wait");

    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "needs-human" },
      planner: "codex",
    }), "--apply"], directory);
    const human = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "implementation", "--json"], directory)).stdout) as {
      kind?: string;
      queue?: string;
      routeSource?: string;
      resourceId?: string;
      calibration?: { routeApplied?: boolean };
    };
    assert.equal(human.kind, "needs-human");
    assert.equal(human.queue, "manual");
    assert.equal(human.routeSource, "calibration");
    assert.equal(human.resourceId, undefined);
    assert.equal(human.calibration?.routeApplied, true);

    // A deterministic lane (verification) is also pausable by current calibration.
    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { verification: "wait" },
      planner: "codex",
    }), "--apply"], directory);
    const verificationWait = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "verification", "--json"], directory)).stdout) as {
      kind?: string;
      queue?: string;
      routeSource?: string;
      calibration?: { routeApplied?: boolean };
    };
    assert.equal(verificationWait.kind, "wait");
    assert.equal(verificationWait.queue, "wait");
    assert.equal(verificationWait.routeSource, "calibration");
    assert.equal(verificationWait.calibration?.routeApplied, true);
  });
});

test("CLI execution explain ignores a stale sentinel and lets an override outrank wait", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    await writeFile(join(directory, ".tasks/0001-task.md"), buildTaskMarkdown("0001", "Task", "todo"), "utf8");
    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "wait" },
      planner: "codex",
    }), "--apply"], directory);

    const overridden = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "implementation", "--resource", "local-b", "--json"], directory)).stdout) as {
      kind?: string;
      resourceId?: string;
      routeSource?: string;
    };
    assert.equal(overridden.resourceId, "local-b");
    assert.equal(overridden.kind, "worker");
    assert.equal(overridden.routeSource, "override");

    const configPath = join(directory, ".agentic", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as { resources: { workers: unknown[] } };
    config.resources.workers.push(executionWorker("local-c", ["implementation"]));
    await writeFile(configPath, JSON.stringify(config), "utf8");
    const stale = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "implementation", "--json"], directory)).stdout) as {
      kind?: string;
      resourceId?: string;
      routeSource?: string;
      calibration?: { status?: string; routeApplied?: boolean };
    };
    assert.equal(stale.calibration?.status, "stale");
    assert.equal(stale.calibration?.routeApplied, false);
    assert.equal(stale.kind, "worker");
    assert.equal(stale.resourceId, "local-a");
    assert.equal(stale.routeSource, "resolver");
  });
});

test("deterministic calibration sentinel never bypasses canonical semantic review", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    const taskPath = join(directory, ".tasks/0001-task.md");

    await writeFile(taskPath, buildTaskMarkdown("0001", "Task", "todo"), "utf8");
    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { verification: "deterministic" },
      planner: "codex",
    }), "--apply"], directory);
    const verification = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "verification", "--json"], directory)).stdout) as {
      kind?: string;
      routeSource?: string;
      calibration?: { routeApplied?: boolean };
    };
    assert.equal(verification.kind, "deterministic");
    assert.equal(verification.routeSource, "deterministic");
    assert.equal(verification.calibration?.routeApplied, true);

    await writeFile(taskPath, buildTaskMarkdown("0001", "Task", "todo").replace("Risk: low", "Risk: high"), "utf8");
    await runCommand(["execution", "calibrate", "--recommendation", JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { review: "deterministic" },
      planner: "codex",
    }), "--apply"], directory);
    const review = JSON.parse((await runCommand(["execution", "explain", "0001", "--role", "review", "--json"], directory)).stdout) as {
      kind?: string;
      routeSource?: string;
      assurance?: { canonicalRequired?: string; required?: string };
      calibration?: { routeApplied?: boolean; reason?: string };
    };
    assert.notEqual(review.kind, "deterministic");
    assert.equal(review.assurance?.canonicalRequired, "fresh-context");
    assert.equal(review.assurance?.required, "fresh-context");
    assert.equal(review.calibration?.routeApplied, false);
    assert.match(review.calibration?.reason ?? "", /incompatible|authoritative/i);
  });
});

test("execution resolver applies wait, needs-human, and override precedence deterministically", () => {
  const registry = {
    models: [],
    harnesses: [],
    workers: [executionWorker("local-a", ["implementation"])],
  };
  const calibration = {
    status: "current" as const,
    planner: "codex",
    inventoryFingerprint: "fp",
    routeRecommendation: "wait",
    routeApplied: false,
    reason: "seed",
  };
  const waitRoute = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "implementation",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "wait",
    calibration,
  });
  assert.equal(waitRoute.kind, "wait");
  assert.equal(waitRoute.queue, "wait");
  assert.equal(waitRoute.routeSource, "calibration");
  assert.equal(waitRoute.calibration?.routeApplied, true);

  const humanRoute = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "implementation",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "needs-human",
    calibration: { ...calibration, routeRecommendation: "needs-human" },
  });
  assert.equal(humanRoute.kind, "needs-human");
  assert.equal(humanRoute.queue, "manual");
  assert.equal(humanRoute.routeSource, "calibration");
  assert.equal(humanRoute.calibration?.routeApplied, true);

  const overrideRoute = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "implementation",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "wait",
    calibration,
    override: { resourceId: "local-a" },
  });
  assert.equal(overrideRoute.resourceId, "local-a");
  assert.equal(overrideRoute.routeSource, "override");
  assert.equal(overrideRoute.calibration?.routeApplied, false);
});

test("calibration wait/needs-human pause deterministic lanes while soft preferences do not defeat them", () => {
  const registry = {
    models: [],
    harnesses: [],
    workers: [executionWorker("local-a", ["implementation"])],
  };
  const calibration = {
    status: "current" as const,
    planner: "codex",
    inventoryFingerprint: "fp",
    routeApplied: false,
    reason: "seed",
  };

  const waitVerification = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "verification",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "wait",
    calibration: { ...calibration, routeRecommendation: "wait" },
  });
  assert.equal(waitVerification.kind, "wait");
  assert.equal(waitVerification.queue, "wait");
  assert.equal(waitVerification.routeSource, "calibration");
  assert.equal(waitVerification.calibration?.routeApplied, true);

  const humanVerification = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "verification",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "needs-human",
    calibration: { ...calibration, routeRecommendation: "needs-human" },
  });
  assert.equal(humanVerification.kind, "needs-human");
  assert.equal(humanVerification.queue, "manual");
  assert.equal(humanVerification.routeSource, "calibration");

  // A soft location/cost preference must not defeat the conservative pause.
  const softPreference = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "implementation",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "wait",
    calibration: { ...calibration, routeRecommendation: "wait" },
    override: { preferCostClass: "cheap" },
  });
  assert.equal(softPreference.kind, "wait");
  assert.equal(softPreference.routeSource, "calibration");

  // A hard resource selection outranks the sentinel.
  const hardOverride = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "implementation",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "wait",
    calibration: { ...calibration, routeRecommendation: "wait" },
    override: { resourceId: "local-a" },
  });
  assert.equal(hardOverride.resourceId, "local-a");
  assert.equal(hardOverride.routeSource, "override");
  assert.equal(hardOverride.kind, "worker");
});

test("execution resolver rejects an ineligible calibrated worker and clamps assurance", () => {
  const registry = {
    models: [],
    harnesses: [],
    workers: [
      executionWorker("local-a", ["implementation"]),
      executionWorker("local-b", ["implementation"], { occupied: 1 }),
    ],
  };
  const route = resolveExecutionRoute({
    profile: "constrained",
    profileSource: "calibration",
    role: "implementation",
    policy: BASE_EXECUTION_POLICY,
    registry,
    calibrationRoute: "local-b",
    calibration: {
      status: "current",
      planner: "codex",
      inventoryFingerprint: "fp",
      routeRecommendation: "local-b",
      routeApplied: false,
      reason: "seed",
    },
  });
  assert.equal(route.resourceId, "local-a");
  assert.equal(route.routeSource, "resolver");
  assert.equal(route.calibration?.routeApplied, false);

  assert.equal(resolveAssurancePlan({ policy: BASE_EXECUTION_POLICY, registry }).canonicalRequired, "none");
  const raised = resolveAssurancePlan({ policy: BASE_EXECUTION_POLICY, registry, assuranceFloor: "fresh-context" });
  assert.equal(raised.canonicalRequired, "none");
  assert.equal(raised.required, "fresh-context");
  const highPolicy = { ...BASE_EXECUTION_POLICY, assurance: "fresh-context" as const, independentReview: true };
  const notLowered = resolveAssurancePlan({ policy: highPolicy, registry, assuranceFloor: "none" });
  assert.equal(notLowered.required, "fresh-context");
  assert.equal(notLowered.calibrationPreference, undefined);
  const criticalPolicy = { ...BASE_EXECUTION_POLICY, assurance: "independent" as const, independentReview: true };
  const critical = resolveAssurancePlan({ policy: criticalPolicy, registry, assuranceFloor: "self-check" });
  assert.equal(critical.required, "independent");
});

test("CLI tasks --all shows every parsed task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await writeFile(join(tasksDir, "0002-done-task.md"), buildTaskMarkdown("0002", "Done Task", "done", "archive"), "utf8");

    const allResult = await runCommand(["tasks", "--all"], directory);
    assert.equal(allResult.exitCode, 0);
    assert.match(allResult.stdout, /0001/);
    assert.match(allResult.stdout, /0002/);
  });
});

test("CLI tasks --state done shows done tasks", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await writeFile(join(tasksDir, "0002-done-task.md"), buildTaskMarkdown("0002", "Done Task", "done", "archive"), "utf8");

    const stateResult = await runCommand(["tasks", "--state", "done"], directory);
    assert.equal(stateResult.exitCode, 0);
    assert.doesNotMatch(stateResult.stdout, /0001/);
    assert.match(stateResult.stdout, /0002/);
  });
});

test("CLI doctor advises on explicit caveman style without mutating config or failing", async () => {
  await withTempDirectory(async (directory) => {
    const agenticDir = join(directory, ".agentic");
    await mkdir(agenticDir, { recursive: true });
    const configPath = join(agenticDir, "config.json");
    const config = explicitConfig("caveman", "Caveman Project");
    await writeFile(configPath, config, "utf8");

    const result = await runCommand(["doctor"], directory);

    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /agent-style: agentStyle: caveman is explicitly set/);
    assert.match(result.stdout, /defaults omitted\/new agentStyle to normal/);
    assert.match(result.stdout, /preserves an explicit value intentionally/);
    assert.match(result.stdout, /Remove the setting or set agentStyle to normal/);
    assert.doesNotMatch(result.stdout, /legacy|deprecated|failed to migrate/i);
    assert.equal(await readFile(configPath, "utf8"), config);
  });
});

test("CLI doctor stays quiet for explicit normal and omitted agentStyle", async () => {
  for (const agentStyle of ["normal", undefined] as const) {
    await withTempDirectory(async (directory) => {
      const agenticDir = join(directory, ".agentic");
      await mkdir(agenticDir, { recursive: true });
      const configPath = join(agenticDir, "config.json");
      const config = explicitConfig(agentStyle, "Quiet Project");
      await writeFile(configPath, config, "utf8");

      const result = await runCommand(["doctor"], directory);

      assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
      assert.doesNotMatch(result.stdout, /agent-style/);
      assert.equal(await readFile(configPath, "utf8"), config);
    });
  }
});

test("CLI task create rejects overlapping allowed and forbidden paths before writing", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCommand([
      "task", "create",
      "--title", "Scoped Internal App Change",
      "--mode", "product",
      "--lane", "implementation",
      "--scope", "tasks",
      "--risk", "medium",
      "--context", "AGENTS.md",
      "--allowed", "internal/app/asset/**",
      "--forbidden", "internal/app/**",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.match(`${result.stdout}${result.stderr}`, /positive allowedFiles already bounds edits/);
    assert.match(`${result.stdout}${result.stderr}`, /remove or narrow the broad forbidden parent/);
    await assert.rejects(
      () => readFile(join(directory, ".tasks", "0001-scoped-internal-app-change.md"), "utf8"),
      /ENOENT/,
    );
  });
});

test("CLI task create reports malformed structured verification", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCommand([
      "task", "create",
      "--title", "Bad Verification Task",
      "--mode", "mvp",
      "--lane", "release",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "src/cli/index.ts",
      "--verification-json", JSON.stringify([{
        id: "broken",
        type: "manual",
        required: true,
        environment: "local",
        profile: "integration",
        command: "pnpm test",
      }]),
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/manual checks require instruction/) || result.stderr.match(/manual checks require instruction/),
      "Expected actionable structured verification error",
    );
  });
});

test("CLI task create supports explicit --goal", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCommand([
      "task", "create",
      "--title", "Goal Task",
      "--goal", "Use this detailed goal.",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "src/cli/index.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 0);
    assert.match(
      await readFile(join(directory, ".tasks", "0001-goal-task.md"), "utf8"),
      /Use this detailed goal\./,
    );
  });
});

test("CLI task create supports bugfix template defaults", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCommand([
      "task", "create",
      "--template", "bugfix",
      "--title", "Fix Parser",
      "--scope", "cli",
      "--allowed", "src/cli/index.ts",
    ], directory);

    assert.equal(result.exitCode, 0);
    const content = await readFile(join(directory, ".tasks", "0001-fix-parser.md"), "utf8");
    assert.match(content, /Lane: bugfix/);
    assert.match(content, /Risk: medium/);
    assert.match(content, /Tags: bugfix/);
    assert.match(content, /"command":"pnpm test"/);
  });
});

test("CLI task create template allows explicit overrides", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCommand([
      "task", "create",
      "--template", "docs",
      "--title", "Document CLI",
      "--mode", "maintenance",
      "--risk", "medium",
      "--tags", "docs,cli",
      "--scope", "docs",
      "--allowed", "README.md",
    ], directory);

    assert.equal(result.exitCode, 0);
    const content = await readFile(join(directory, ".tasks", "0001-document-cli.md"), "utf8");
    assert.match(content, /Mode: maintenance/);
    assert.match(content, /Risk: medium/);
    assert.match(content, /Tags: docs,cli/);
    assert.match(content, /"apkOperation":"lint"/);
    assert.doesNotMatch(content, /"command":"pnpm (?:test|lint)"/);
  });
});

test("CLI task create supports typed domain templates with correctness guardrails", async () => {
  const types = [
    "feature",
    "bugfix",
    "refactor",
    "docs",
    "audit",
    "test",
    "migration",
    "async-worker",
    "provider-integration",
    "deployment",
    "benchmark",
    "security",
    "release",
  ];
  const guardedTypes = new Set([
    "bugfix",
    "refactor",
    "migration",
    "async-worker",
    "provider-integration",
    "deployment",
    "benchmark",
    "security",
    "release",
  ]);

  for (const type of types) {
    await withTempDirectory(async (directory) => {
      await mkdir(join(directory, ".agentic"), { recursive: true });
      await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

      const result = await runCommand([
        "task", "create",
        "--type", type,
        "--title", `Template ${type}`,
        "--scope", "tasks",
        "--allowed", "src/example.ts",
      ], directory);

      assert.equal(result.exitCode, 0, `${type}: ${result.stdout}${result.stderr}`);
      const content = await readFile(join(directory, ".tasks", `0001-template-${type}.md`), "utf8");
      assert.match(content, new RegExp(`^Type: ${type}$`, "m"));
      assert.match(content, /## Verification/);
      assert.doesNotMatch(content, /## Verification commands/);
      if (type === "benchmark") {
        assert.match(content, /"evidenceType":"benchmark"/);
        assert.match(content, /"command":"pnpm benchmark"/);
      }
      if (guardedTypes.has(type)) {
        assert.match(content, /## Correctness assumptions/);
        assert.match(content, /## Counterexample searches/);
      }
    });
  }
});

test("CLI task create accepts template aliases and overrides typed guardrails", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCommand([
      "task", "create",
      "--template", "provider",
      "--title", "Provider Adapter",
      "--scope", "integration",
      "--allowed", "src/provider.ts",
      "--assumptions", "The provider is called through a sandbox.",
    ], directory);

    assert.equal(result.exitCode, 0);
    const content = await readFile(join(directory, ".tasks", "0001-provider-adapter.md"), "utf8");
    assert.match(content, /^Type: provider-integration$/m);
    assert.match(content, /Tags: provider,integration/);
    assert.match(content, /The provider is called through a sandbox\./);
    assert.doesNotMatch(content, /The external provider can be slow/);
  });
});

test("CLI task create rejects unknown template", async () => {
  const result = await runCommand([
    "task", "create",
    "--template", "unknown",
    "--title", "Bad Template",
    "--scope", "cli",
    "--allowed", "src/cli/index.ts",
  ]);

  assert.equal(result.exitCode, 1);
  assert.ok(
    result.stdout.match(/--template must be one of/) || result.stderr.match(/--template must be one of/),
    "Expected unknown template error",
  );
});

test("CLI task create rejects flag values that are missing", async () => {
  await withTempDirectory(async (directory) => {
    const result = await runCommand([
      "task", "create",
      "--title", "--mode",
      "mvp",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--title requires a value/) || result.stderr.match(/--title requires a value/),
      "Expected missing value error",
    );
  });
});

test("CLI task create rejects missing title", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCommand([
      "task", "create",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--title is required/) || result.stderr.match(/--title is required/),
      "Expected missing title error",
    );
  });
});

test("CLI task create rejects invalid mode", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCommand([
      "task", "create",
      "--title", "Bad Mode",
      "--mode", "invalid",
      "--lane", "implementation",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--mode must be one of/) || result.stderr.match(/--mode must be one of/),
      "Expected invalid mode error",
    );
  });
});

test("CLI task create rejects missing dependency", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCommand([
      "task", "create",
      "--title", "Missing Dep",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
      "--depends", "9999",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Dependency validation failed/) || result.stderr.match(/Dependency validation failed/),
      "Expected dependency validation error",
    );
  });
});

test("CLI task create increments id after existing task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0005-existing-task.md"),
      buildTaskMarkdown("0005", "Existing Task", "done", "archive"),
      "utf8",
    );
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCommand([
      "task", "create",
      "--title", "Next Task",
      "--mode", "product",
      "--lane", "tasks",
      "--scope", "cli",
      "--risk", "medium",
      "--context", "AGENTS.md",
      "--allowed", ".tasks/0006-next-task.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Created: \.tasks\/0006-next-task\.md/);
  });
});

test("CLI task create rejects duplicate file path", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    await runCommand([
      "task", "create",
      "--title", "Example Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", ".tasks/0001-example-task.md",
      "--verification", "pnpm test",
    ], directory);

    const result = await runCommand([
      "task", "create",
      "--title", "Example Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", ".tasks/0001-example-task.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Task file already exists/) || result.stderr.match(/Task file already exists/),
      "Expected duplicate file error",
    );
  });
});

test("CLI task archive refuses non-terminal task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-todo-task.md"),
      buildTaskMarkdown("0001", "Todo Task", "todo"),
      "utf8",
    );

    const result = await runCommand(["task", "archive", "0001"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/only done or canceled tasks can be archived/) || result.stderr.match(/only done or canceled tasks can be archived/),
      "Expected non-done refusal error",
    );
  });
});

test("CLI task archive reports error for missing task id", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });

    const result = await runCommand(["task", "archive", "9999"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Task file not found/) || result.stderr.match(/Task file not found/),
      "Expected task not found error",
    );
  });
});

test("CLI tasks shows only active tasks after archive", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0002-todo-task.md"),
      buildTaskMarkdown("0002", "Todo Task", "todo"),
      "utf8",
    );

    await runCommand(["task", "archive", "0001"], directory);

    const result = await runCommand(["tasks"], directory);

    assert.equal(result.exitCode, 0);
    assert.doesNotMatch(result.stdout, /0001/);
    assert.match(result.stdout, /0002/);
  });
});

test("CLI task archive rejects unknown flags before moving task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCommand(["task", "archive", "0001", "--unknown"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Unknown option: --unknown/) || result.stderr.match(/Unknown option: --unknown/),
      "Expected unknown option error",
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
      "Task should not be moved",
    );
  });
});

test("CLI task archive --all rejects unknown flags", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCommand(["task", "archive", "--all", "--unknown"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Unknown option: --unknown/) || result.stderr.match(/Unknown option: --unknown/),
      "Expected unknown option error",
    );
  });
});

test("CLI task archive --all rejects extra positional args", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCommand(["task", "archive", "--all", "0001"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/no positional args/) || result.stderr.match(/no positional args/),
      "Expected positional args error",
    );
  });
});

test("CLI tasks --all includes archived task files", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0002-todo-task.md"),
      buildTaskMarkdown("0002", "Todo Task", "todo"),
      "utf8",
    );
    await mkdir(join(tasksDir, "archive"), { recursive: true });
    await writeFile(
      join(tasksDir, "archive", "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const defaultResult = await runCommand(["tasks"], directory);
    assert.equal(defaultResult.exitCode, 0);
    assert.doesNotMatch(defaultResult.stdout, /0001/, "Default view should exclude archived tasks");
    assert.match(defaultResult.stdout, /0002/, "Default view should include active tasks");

    const allResult = await runCommand(["tasks", "--all"], directory);
    assert.equal(allResult.exitCode, 0);
    assert.match(allResult.stdout, /0001/, "--all should include archived tasks");
    assert.match(allResult.stdout, /0002/, "--all should include active tasks");
  });
});

test("CLI task create rejects missing --scope", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCommand([
      "task", "create",
      "--title", "No Scope Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--scope must include/) || result.stderr.match(/--scope must include/),
      "Expected missing scope error",
    );
  });
});

test("CLI task create rejects missing --allowed", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCommand([
      "task", "create",
      "--title", "No Allowed Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--allowed must include/) || result.stderr.match(/--allowed must include/),
      "Expected missing allowed error",
    );
  });
});

test("CLI task archive --all reports archive path collisions as skipped", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );
    await mkdir(join(tasksDir, "archive"), { recursive: true });
    await writeFile(
      join(tasksDir, "archive", "0001-done-task.md"),
      "existing",
      "utf8",
    );

    const result = await runCommand(["task", "archive", "--all"], directory);

    assert.equal(result.exitCode, 0);
    assert.ok(
      result.stdout.match(/Skipped: 0001[\s\S]*Archive path already exists/) || result.stderr.match(/Skipped: 0001[\s\S]*Archive path already exists/),
      "Expected archive collision skip reason",
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
      "Source task should not be moved",
    );
  });
});

test("CLI archive preview and apply expose ignored destinations and preserve source bytes", async () => {
  await withTempDirectory(async (directory) => {
    await runCommand(["init"], directory);
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    const source = join(directory, ".tasks/0009-done.md");
    const content = buildTaskMarkdown("0009", "Done", "done", "archive");
    await writeFile(source, content);
    await writeFile(join(directory, ".gitignore"), ".tasks/archive/\n");
    const preview = await runCommand(["task", "archive", "0009", "--preview"], directory);
    assert.match(preview.stdout + preview.stderr, /Archive destination.*ignored by/);
    const applied = await runCommand(["task", "archive", "0009", "--apply"], directory);
    assert.equal(applied.exitCode, 1);
    assert.match(applied.stdout + applied.stderr, /\.gitignore/);
    assert.equal(await readFile(source, "utf8"), content);
  });
});


test("adopt preview distinguishes schema markers from incompatible task contracts", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"));
    await mkdir(join(directory, ".agentic"));
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({ schemaVersion: 2 }));
    const valid = await readFile(join(TEST_ROOT, "src/core/tasks/fixtures/v0.3.1/.tasks/0001-legacy-task.md"), "utf8");
    const broken = valid.replace("Mode: maintenance", "Mode: bugfix");
    await writeFile(join(directory, ".tasks/0001.md"), broken);
    const result = await runCommand(["adopt", "--preview"], directory);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Schema-marker migration: not required; task-contract repair: required/);
    assert.match(result.stdout, /incompatible=1/);
    assert.match(result.stderr, /schemaVersion migration does not repair task content/);
    assert.match(result.stderr, /candidate\/baseline-bound provenance/);
    assert.equal(await readFile(join(directory, ".tasks/0001.md"), "utf8"), broken);
  });
});


interface WorkersPayload {
  workers: Array<{ id: string; state: string; occupied: number; remainingSlots: number; currentTaskId?: string; currentRunId?: string; stateReason: string }>;
  diagnostics: string[];
}

async function recordWorkerFixture(directory: string, taskId: string, runId: string, options: {
  resourceId?: string; activated?: boolean; malformed?: boolean;
} = {}): Promise<void> {
  const path = join(directory, ".agentic/sessions/work", taskId, runId);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "metadata.json"), JSON.stringify({
    protocol: options.malformed ? "invalid" : "apk-worker-v1", taskId, runId,
    owner: "fixture", role: "implement", resourceId: options.resourceId ?? "local-a",
  }));
  if (options.activated !== false) await writeFile(join(path, "activation.json"), JSON.stringify({ protocol: "apk-worker-v1", taskId, runId }));
}

async function workerPayload(directory: string): Promise<WorkersPayload> {
  const result = await runCommand(["workers", "--json"], directory);
  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as WorkersPayload;
  assert.deepEqual(Object.keys(payload).sort(), ["diagnostics", "workers"]);
  return payload;
}

test("workers reads tasks once and never reads diagnostic journals or invokes Git, with or without registry", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    for (let i = 1; i <= 100; i++) {
      const id = String(i).padStart(4, "0");
      await writeFile(join(directory, `.tasks/${id}-task.md`), buildTaskMarkdown(id, "Fixture", i <= 32 ? "doing" : "todo", i <= 32 ? "fixture" : "none"));
    }
    // Deliberately invalid journals: workers must not depend on their contents.
    await writeFile(join(directory, ".agentic/evidence.jsonl"), "malformed journal");
    await writeFile(join(directory, ".agentic/runs.jsonl"), "malformed journal");
    await recordWorkerFixture(directory, "0001", "run-active");
    for (const registry of [true, false]) {
      if (!registry) await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({ schemaVersion: 2 }));
      const reads: string[] = [];
      const taskReads: string[] = [];
      let gitCalls = 0, sessionEnumerations = 0;
      const originalRead = fsPromises.readFile, originalOpen = fsPromises.open, originalDir = fsPromises.readdir, originalGit = childProcess.execFile;
      fsPromises.readFile = ((...args: Parameters<typeof originalRead>) => { reads.push(String(args[0])); return originalRead(...args); }) as typeof originalRead;
      fsPromises.open = ((...args: Parameters<typeof originalOpen>) => { taskReads.push(String(args[0])); return originalOpen(...args); }) as typeof originalOpen;
      fsPromises.readdir = ((...args: Parameters<typeof originalDir>) => {
        if (String(args[0]) === join(directory, ".agentic/sessions/work")) sessionEnumerations++;
        return originalDir(...args);
      }) as typeof originalDir;
      childProcess.execFile = ((...args: Parameters<typeof originalGit>) => { if (args[0] === "git") gitCalls++; return originalGit(...args); }) as typeof originalGit;
      syncBuiltinESMExports();
      try {
        const payload = await workerPayload(directory);
        assert.equal(payload.workers.length, registry ? 2 : 0);
        assert.equal(payload.workers[0]?.state, registry ? "busy" : undefined);
        assert.equal(payload.workers[1]?.state, registry ? "ready" : undefined);
        assert.equal(taskReads.length, registry ? 100 : 0);
        assert.equal(new Set(taskReads).size, taskReads.length);
        assert.equal(sessionEnumerations, registry ? 1 : 0);
        assert.equal(gitCalls, 0);
        assert.deepEqual(reads.filter((path) => /evidence|runs|task-baselines|agents\//.test(path)), []);
        assert.deepEqual(reads.filter((path) => path.endsWith(".md")), []);
      } finally {
        fsPromises.readFile = originalRead; fsPromises.open = originalOpen; fsPromises.readdir = originalDir; childProcess.execFile = originalGit;
        syncBuiltinESMExports();
      }
    }
  });
});

test("workers treats all duplicate task identities as ambiguous, including archive collisions and equal states", async () => {
  for (const [active, archived] of [["doing", "done"], ["done", "doing"], ["done", "done"]]) {
    await withTempDirectory(async (directory) => {
      await writeExecutionRepo(directory);
      await mkdir(join(directory, ".tasks/archive"));
      await writeFile(join(directory, ".tasks/0100-task.md"), buildTaskMarkdown("0100", "Active", active!, "fixture"));
      await writeFile(join(directory, ".tasks/archive/0100-old.md"), buildTaskMarkdown("0100", "Archive", archived!, "fixture"));
      await recordWorkerFixture(directory, "0100", "run-bound");
      const payload = await workerPayload(directory);
      assert.equal(payload.workers[0]?.state, "unknown");
      assert.equal(payload.workers[0]?.currentTaskId, undefined);
      assert.match(payload.diagnostics.join(" "), /duplicate task ID/);
      // Attention uses exactly the same binding semantics.
      const attention = await runCommand(["attention", "--json"], directory);
      assert.equal(attention.exitCode, 0, attention.stderr);
      assert.equal((JSON.parse(attention.stdout) as WorkersPayload).workers[0]?.state, "unknown");
    });
  }
});

test("workers preserves canonical occupancy and refreshes terminal, orphan, stale and multiple-session states", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    const path = join(directory, ".tasks/0001-task.md");
    await writeFile(path, buildTaskMarkdown("0001", "Unique", "doing", "fixture"));
    await recordWorkerFixture(directory, "0001", "run-first");
    let payload = await workerPayload(directory);
    assert.equal(payload.workers[0]?.state, "busy");
    assert.equal(payload.workers[0]?.occupied, 1);
    assert.equal(payload.workers[0]?.currentRunId, "run-first");
    await recordWorkerFixture(directory, "0001", "run-second");
    payload = await workerPayload(directory);
    assert.equal(payload.workers[0]?.occupied, 2);
    assert.equal(payload.workers[0]?.currentRunId, undefined);
    assert.match(payload.diagnostics.join(" "), /multiple active runs/);
    for (const state of ["done", "canceled"]) {
      await writeFile(path, buildTaskMarkdown("0001", "Unique", state, "fixture"));
      payload = await workerPayload(directory);
      assert.equal(payload.workers[0]?.state, "ready");
      assert.equal(payload.workers[0]?.occupied, 0);
    }
    await rm(path);
    assert.equal((await workerPayload(directory)).workers[0]?.state, "unknown");
    await writeFile(path, buildTaskMarkdown("0001", "Unique", "doing", "fixture"));
    await rm(join(directory, ".agentic/sessions"), { recursive: true });
    await recordWorkerFixture(directory, "0001", "run-stale", { activated: false });
    assert.equal((await workerPayload(directory)).workers[0]?.state, "unknown");
    await recordWorkerFixture(directory, "0001", "run-stale", { malformed: true });
    assert.equal((await workerPayload(directory)).workers[0]?.state, "unknown");
    await rm(join(directory, ".agentic/sessions"), { recursive: true });
    await recordWorkerFixture(directory, "0001", "run-unknown", { resourceId: "unconfigured" });
    assert.match((await workerPayload(directory)).diagnostics.join(" "), /unconfigured resource/);
    // Missing metadata cannot be attributed to any one worker.
    await rm(join(directory, ".agentic/sessions/work/0001/run-unknown/metadata.json"));
    assert.ok((await workerPayload(directory)).workers.every((worker) => worker.state === "unknown"));
  });
});

test("workers fails closed on invalid inventory, unreadable canonical store and invalid registry", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    const task = join(directory, ".tasks/0001-task.md");
    await writeFile(task, "invalid task");
    let payload = await workerPayload(directory);
    assert.ok(payload.workers.every((worker) => worker.state === "unknown"));
    assert.match(payload.diagnostics.join(" "), /inventory.*invalid|incompatible/);
    await rm(task);
    await mkdir(task); // A non-regular task is unreadable even under privileged test users.
    assert.ok((await workerPayload(directory)).workers.every((worker) => worker.state === "unknown"));
    await rm(task, { recursive: true });
    await mkdir(join(directory, ".agentic/sessions"));
    await writeFile(join(directory, ".agentic/sessions/work"), "not a directory");
    payload = await workerPayload(directory);
    assert.ok(payload.workers.every((worker) => worker.state === "unknown"));
    assert.match(payload.diagnostics.join(" "), /worker-session state unavailable/);
    await writeFile(join(directory, ".agentic/config.json"), '{"resources":{"workers":"invalid"}}');
    const result = await runCommand(["workers", "--json"], directory);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.length < 800);
    assert.equal(result.stdout, "");
  });
});


test("workers preserves declared availability, max occupancy and human rendering", async () => {
  for (const [availability, occupied, expected] of [
    ["available", 0, "ready"], ["available", 1, "busy"], ["unknown", 0, "unknown"], ["unavailable", 0, "unavailable"],
  ] as const) {
    await withTempDirectory(async (directory) => {
      await writeExecutionRepo(directory);
      const path = join(directory, ".agentic/config.json");
      const config = JSON.parse(await readFile(path, "utf8")) as { resources: { workers: unknown[] } };
      config.resources.workers = [executionWorker("local-a", ["implementation"], { availability, occupied })];
      await writeFile(path, JSON.stringify(config));
      const payload = await workerPayload(directory);
      assert.equal(payload.workers[0]?.state, expected);
      assert.equal(payload.workers[0]?.occupied, occupied);
      assert.equal(payload.workers[0]?.remainingSlots, 1 - occupied);
      const rendered = await runCommand(["workers"], directory);
      assert.equal(rendered.exitCode, 0);
      assert.match(rendered.stdout, new RegExp(`Workers: 1\\n-  local-a ${expected} ${occupied}/1`));
    });
  }
});


test("workers never treats a failed discovered session directory as empty", async () => {
  await withTempDirectory(async (directory) => {
    await writeExecutionRepo(directory);
    await writeFile(join(directory, ".tasks/0001-task.md"), buildTaskMarkdown("0001", "Active", "doing", "fixture"));
    assert.ok((await workerPayload(directory)).workers.every((worker) => worker.state === "ready"), "missing top-level store is supported");
    await recordWorkerFixture(directory, "0001", "run-active");
    assert.equal((await workerPayload(directory)).workers[0]?.state, "busy");
    for (const code of ["EACCES", "ENOENT", "ENOTDIR"]) {
      const original = fsPromises.readdir;
      fsPromises.readdir = ((...args: Parameters<typeof original>) => {
        if (String(args[0]) === join(directory, ".agentic/sessions/work/0001")) {
          return Promise.reject(Object.assign(new Error(`injected discovered directory failure: ${code}`), { code }));
        }
        return original(...args);
      }) as typeof original;
      syncBuiltinESMExports();
      try {
        const payload = await workerPayload(directory);
        assert.ok(payload.workers.every((worker) => worker.state === "unknown"), code);
        assert.match(payload.diagnostics.join(" "), new RegExp(code));
        assert.ok(payload.workers.every((worker) => worker.currentRunId === undefined));
      } finally {
        fsPromises.readdir = original;
        syncBuiltinESMExports();
      }
    }
    assert.equal((await workerPayload(directory)).workers[0]?.state, "busy");
  });
});


test("worker packages summarize long goals without losing the canonical goal or loosening parser bounds", async () => {
  for (const goal of ["x".repeat(319), "x".repeat(320), "x".repeat(321), "Цель 😀 ".repeat(100), "long goal\n".repeat(100)]) {
    await withTempDirectory(async (directory) => {
      await writeExecutionRepo(directory);
      const taskPath = join(directory, ".tasks/0001-task.md");
      const markdown = buildTaskMarkdown("0001", "Goal boundary", "todo").replace("A task.", goal.trim());
      await writeFile(taskPath, markdown);
      const task = parseTaskMarkdown(markdown);
      const pkg = createWorkerPackage(task, { taskId: task.id, level: 1, files: [".tasks/0001-task.md"] }, { role: "implement", runId: "goal-boundary" });
      assert.ok(pkg.task.goal.length <= 320);
      if (goal.length <= 320) assert.equal(pkg.task.goal, goal);
      else assert.match(pkg.task.goal, /full goal: task contract/);
      assert.equal(task.goal, goal.trim());
      assert.throws(() => parseWorkerPackage({ ...pkg, task: { ...pkg.task, goal: "x".repeat(321) } }), /at most 320/);
      const registered = await runCommand(["agent", "register", "--id", "goal-owner", "--platform", "fixture", "--model", "fixture"], directory);
      assert.equal(registered.exitCode, 0, registered.stderr);
      const issued = await runCommand(["work", "0001", "--owner", "goal-owner", "--target", "codex", "--role", "implement", "--level", "1", "--write-session", "--json"], directory);
      assert.equal(issued.exitCode, 0, issued.stderr);
      const payload = JSON.parse(issued.stdout) as { workerPackage: typeof pkg; session: { prompt: string } };
      assert.equal(payload.workerPackage.task.goal, pkg.task.goal);
      assert.ok(payload.workerPackage.context.files.includes(".tasks/0001-task.md"));
      assert.ok((await readFile(join(directory, payload.session.prompt), "utf8")).includes(goal.trim()));
      assert.equal(parseTaskMarkdown(await readFile(taskPath, "utf8")).goal, goal.trim());
    });
  }
});
