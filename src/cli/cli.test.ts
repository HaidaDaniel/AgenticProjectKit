import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

import { startWork } from "../core/work/index.js";
import { resolveExecutionRoute } from "../core/execution/index.js";
import {
  assessWorkspaceSafety,
  createWorkspace,
  listWorkspaceStatuses,
  removeWorkspace,
  workspaceRecordPath,
  type WorkspaceRecord,
} from "../core/workspaces/index.js";
import { captureTaskEvidenceSubject, parseTaskMarkdown } from "../core/tasks/index.js";

const execFileAsync = promisify(execFile);
const CLI_PATH = join(process.cwd(), "src/cli/index.ts");
const TSX_LOADER = pathToFileURL(join(process.cwd(), "node_modules/tsx/dist/loader.mjs")).href;

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: readonly string[], cwd = process.cwd()): Promise<CliResult> {
  try {
    const result = await execFileAsync(process.execPath, ["--import", TSX_LOADER, CLI_PATH, ...args], {
      cwd,
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      "stdout" in error &&
      "stderr" in error
    ) {
      return {
        exitCode: typeof error.code === "number" ? error.code : 1,
        stdout: String(error.stdout),
        stderr: String(error.stderr),
      };
    }

    throw error;
  }
}

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

test("CLI help lists implemented commands", async () => {
  const result = await runCli(["--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk audit \[directory\]/);
  assert.match(result.stdout, /apk analytics summary \[--month YYYY-MM\] \[--write\]/);
  assert.match(result.stdout, /apk sync \[agent\] \[--write\]/);
  assert.match(result.stdout, /apk status/);
  assert.match(result.stdout, /apk doctor/);
  assert.match(result.stdout, /apk quality detect \[directory\] \[--json\]/);
  assert.match(result.stdout, /apk lint \[--json\]/);
  assert.match(result.stdout, /apk context <task-id> \[--level 1\|2\|3\] \[--budget <units>\]/);
  assert.match(result.stdout, /apk prompt <agent> --task <task-id> \[--level 1\|2\|3\] \[--budget <units>\]/);
  assert.match(result.stdout, /apk suggest-context/);
  assert.match(result.stdout, /apk work <task-id>/);
  assert.match(result.stdout, /apk resources \[--json\]/);
  assert.match(result.stdout, /apk execution explain <task-id>/);
  assert.match(result.stdout, /apk task deps <task-id>/);
  assert.match(result.stdout, /apk tasks \[--all\] \[--state <state>\] \[--owner <agent-id>\]/);
});

test("CLI execution explains stable profile routing and explicit override", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({
      executionProfile: "constrained",
      resources: {
        models: [{ id: "model-a", contextLimit: 32000, roles: ["implementation"] }],
        harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"] }],
        workers: [
          {
            id: "local-a", modelId: "model-a", harnessId: "harness-a", location: "local",
            billingMode: "free", costClass: "local-free", availability: "available", capacity: 1,
            capabilities: { roles: ["implementation"], contextLimit: 16000, workerProtocols: ["apk-worker-v1"] },
          },
          {
            id: "frontier-a", modelId: "model-a", harnessId: "harness-a", location: "remote",
            billingMode: "subscription", costClass: "scarce-frontier", availability: "available", capacity: 1,
            capabilities: { roles: ["implementation"], contextLimit: 32000, workerProtocols: ["apk-worker-v1"] },
          },
        ],
      },
    }), "utf8");
    await writeFile(join(directory, ".tasks/0001-task.md"), buildTaskMarkdown("0001", "Task", "todo").replace("Risk: low", "Risk: medium"), "utf8");

    const local = await runCli(["execution", "explain", "0001", "--role", "implementation", "--complexity", "simple", "--json"], directory);
    assert.equal(local.exitCode, 0, `${local.stdout}${local.stderr}`);
    assert.equal(JSON.parse(local.stdout).resourceId, "local-a");

    const override = await runCli(["execution", "explain", "0001", "--role", "implementation", "--resource", "frontier-a", "--json"], directory);
    assert.equal(override.exitCode, 0, `${override.stdout}${override.stderr}`);
    const payload = JSON.parse(override.stdout) as { resourceId?: string; override?: { resourceId?: string } };
    assert.equal(payload.resourceId, "frontier-a");
    assert.equal(payload.override?.resourceId, "frontier-a");
  });
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

test("CLI resources renders a stable read-only registry in human and JSON forms", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({
      schemaVersion: 2,
      resources: {
        models: [{ id: "model-a", roles: ["implement"] }],
        harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"] }],
        workers: [{
          id: "worker-a",
          modelId: "model-a",
          harnessId: "harness-a",
          location: "local",
          billingMode: "free",
          costClass: "local-free",
          availability: "available",
          capacity: 1,
          capabilities: { roles: ["implement"] },
        }],
      },
    }), "utf8");

    const human = await runCli(["resources"], directory);
    assert.equal(human.exitCode, 0, `${human.stdout}${human.stderr}`);
    assert.match(human.stdout, /Resource registry \(read-only\)/);
    assert.match(human.stdout, /worker worker-a model=model-a harness=harness-a/);

    const machine = await runCli(["resources", "--json"], directory);
    assert.equal(machine.exitCode, 0, `${machine.stdout}${machine.stderr}`);
    const payload = JSON.parse(machine.stdout) as { workers: Array<{ id: string; occupied: number }> };
    assert.deepEqual(payload.workers.map((worker) => worker.id), ["worker-a"]);
    assert.equal(payload.workers[0]?.occupied, 0);
  });
});

test("CLI resources detect reports a deterministic read-only inventory", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({
      schemaVersion: 2,
      resources: {
        models: [{ id: "model-a", roles: ["implementation"] }],
        harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"] }],
        workers: [{
          id: "worker-a",
          modelId: "model-a",
          harnessId: "harness-a",
          location: "local",
          billingMode: "free",
          costClass: "local-free",
          availability: "available",
          capacity: 1,
          capabilities: { roles: ["implementation"] },
        }],
      },
    }), "utf8");
    await writeFile(join(directory, "CLAUDE.md"), "@AGENTS.md\n", "utf8");

    const first = await runCli(["resources", "detect", "--json"], directory);
    assert.equal(first.exitCode, 0, `${first.stdout}${first.stderr}`);
    const inventory = JSON.parse(first.stdout) as { fingerprint: string; resources: Array<{ id: string; kind: string }> };
    assert.ok(inventory.resources.some((resource) => resource.id === "worker-a" && resource.kind === "worker"));
    assert.ok(inventory.resources.some((resource) => resource.id === "claude" && resource.kind === "harness"));
    assert.doesNotMatch(first.stdout, /apiKey|secret|password/i);

    const second = await runCli(["resources", "detect", "--json"], directory);
    const secondInventory = JSON.parse(second.stdout) as { fingerprint: string };
    assert.equal(inventory.fingerprint, secondInventory.fingerprint);
  });
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
    const json = await runCli(["resources", "detect", "--json"], directory);
    assert.equal(json.exitCode, 0, `${json.stdout}${json.stderr}`);
    assert.doesNotMatch(json.stdout, /TOPSECRETPW/);
    assert.doesNotMatch(json.stderr, /TOPSECRETPW/);

    const human = await runCli(["resources", "detect"], directory);
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
    const rejected = await runCli(["resources", "detect", "--json"], directory);
    assert.equal(rejected.exitCode, 1);
    assert.doesNotMatch(rejected.stdout, /TOPSECRETPW/);
    assert.doesNotMatch(rejected.stderr, /TOPSECRETPW/);
  });
});

test("CLI execution calibrate validates and applies a recommendation", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({
      schemaVersion: 2,
      executionOverrides: { resourceId: "worker-a", allowProfileBypass: true },
      resources: {
        models: [{ id: "model-a", roles: ["implementation"] }],
        harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"] }],
        workers: [{
          id: "worker-a",
          modelId: "model-a",
          harnessId: "harness-a",
          location: "local",
          billingMode: "free",
          costClass: "local-free",
          availability: "available",
          capacity: 1,
          capabilities: { roles: ["implementation"] },
        }],
      },
    }), "utf8");

    const pkg = await runCli(["execution", "calibrate", "--json"], directory);
    assert.equal(pkg.exitCode, 0, `${pkg.stdout}${pkg.stderr}`);
    assert.match(pkg.stdout, /apk-calibration-v1/);

    const valid = JSON.stringify({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "worker-a" },
      planner: "codex",
    });
    const applied = await runCli(["execution", "calibrate", "--recommendation", valid, "--apply"], directory);
    assert.equal(applied.exitCode, 0, `${applied.stdout}${applied.stderr}`);
    const config = JSON.parse(await readFile(join(directory, ".agentic/config.json"), "utf8")) as {
      executionOverrides?: { resourceId?: string };
      executionCalibration?: { profile?: string };
    };
    assert.equal(config.executionOverrides?.resourceId, "worker-a");
    assert.equal(config.executionCalibration?.profile, "constrained");

    const idempotent = await runCli(["execution", "calibrate", "--recommendation", valid, "--apply"], directory);
    assert.match(idempotent.stdout, /unchanged/);

    const rejected = await runCli([
      "execution", "calibrate",
      "--recommendation",
      JSON.stringify({
        protocol: "apk-calibration-v1-result",
        profile: "constrained",
        routes: { implementation: "ghost" },
        planner: "codex",
      }),
    ], directory);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stdout, /unknown worker/);
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

    const result = await runCli(["execution", "explain", "0001", "--role", "implementation", "--json"], directory);
    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    const payload = JSON.parse(result.stdout) as { calibration?: { status?: string } };
    assert.equal(payload.calibration?.status, "stale");
  });
});

test("CLI attention and workers project semantic state without live process claims", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({
      schemaVersion: 2,
      resources: {
        models: [{ id: "model-a", roles: ["implementation"] }],
        harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"] }],
        workers: [
          {
            id: "worker-a",
            modelId: "model-a",
            harnessId: "harness-a",
            location: "local",
            billingMode: "free",
            costClass: "local-free",
            availability: "available",
            capacity: 1,
            occupied: 0,
            capabilities: { roles: ["implementation"] },
          },
          {
            id: "worker-b",
            modelId: "model-a",
            harnessId: "harness-a",
            location: "local",
            billingMode: "free",
            costClass: "standard",
            availability: "available",
            capacity: 2,
            occupied: 1,
            capabilities: { roles: ["implementation"] },
          },
          {
            id: "worker-c",
            modelId: "model-a",
            harnessId: "harness-a",
            location: "remote",
            billingMode: "free",
            costClass: "scarce-frontier",
            availability: "unavailable",
            capacity: 1,
            occupied: 0,
            capabilities: { roles: ["review"] },
          },
          {
            id: "worker-d",
            modelId: "model-a",
            harnessId: "harness-a",
            location: "local",
            billingMode: "free",
            costClass: "local-free",
            availability: "available",
            capacity: 1,
            occupied: 1,
            capabilities: { roles: ["implementation"] },
          },
        ],
      },
    }), "utf8");
    await writeFile(
      join(directory, ".tasks", "0001-task.md"),
      buildTaskMarkdown("0001", "Task", "doing", "codex-a"),
      "utf8",
    );

    const workers = await runCli(["workers", "--json"], directory);
    assert.equal(workers.exitCode, 0, `${workers.stdout}${workers.stderr}`);
    const workerPayload = JSON.parse(workers.stdout) as {
      workers: Array<{ id: string; state: string; capacity: number }>;
    };
    const stateById = Object.fromEntries(workerPayload.workers.map((worker) => [worker.id, worker.state]));
    assert.equal(stateById["worker-a"], "ready");
    assert.equal(stateById["worker-b"], "ready");
    assert.equal(stateById["worker-c"], "unavailable");
    assert.equal(stateById["worker-d"], "busy");
    assert.doesNotMatch(workers.stdout, /pid|process|terminal|ssh/i);

    const attention = await runCli(["attention", "--json"], directory);
    assert.equal(attention.exitCode, 0, `${attention.stdout}${attention.stderr}`);
    const attentionPayload = JSON.parse(attention.stdout) as {
      items: Array<{ taskId: string; priority: string; assurance: string; assuranceStatus: string; runs: number }>;
    };
    const item = attentionPayload.items.find((entry) => entry.taskId === "0001");
    assert.ok(item);
    assert.ok(["satisfied", "unavailable", "not-required"].includes(item.assuranceStatus));
    assert.equal(typeof item.runs, "number");

    const reread = await runCli(["attention", "--json"], directory);
    assert.equal(attention.stdout, reread.stdout);
  });
});

interface SessionFixtureOptions {
  resourceId: string;
  role?: string;
  activated?: boolean;
  protocol?: string;
}

async function writeWorkerSession(
  directory: string,
  taskId: string,
  runId: string,
  options: SessionFixtureOptions,
): Promise<void> {
  const sessionDir = join(directory, ".agentic", "sessions", "work", taskId, runId);
  await mkdir(sessionDir, { recursive: true });
  await writeFile(join(sessionDir, "metadata.json"), `${JSON.stringify({
    protocol: options.protocol ?? "apk-worker-v1",
    taskId,
    runId,
    owner: "local-agent-0100",
    resourceId: options.resourceId,
    role: options.role ?? "implement",
    packageHash: "fixture",
  })}\n`, "utf8");
  if (options.activated !== false) {
    await writeFile(join(sessionDir, "activation.json"), `${JSON.stringify({
      protocol: "apk-worker-v1",
      taskId,
      runId,
      packageHash: "fixture",
      activatedAt: "2026-09-11T00:00:00.000Z",
    })}\n`, "utf8");
  }
}

test("CLI workers binds canonical sessions and fails closed on stale or orphaned runs", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await mkdir(join(directory, ".tasks"), { recursive: true });
    const workers = [
      { id: "worker-a", costClass: "local-free", location: "local", availability: "available", capacity: 1, occupied: 0 },
      { id: "worker-b", costClass: "local-free", location: "local", availability: "available", capacity: 2, occupied: 0 },
      { id: "frontier", costClass: "scarce-frontier", location: "remote", availability: "available", capacity: 1, occupied: 1 },
      { id: "worker-d", costClass: "local-free", location: "local", availability: "available", capacity: 1, occupied: 0 },
      { id: "worker-e", costClass: "local-free", location: "local", availability: "available", capacity: 1, occupied: 0 },
      { id: "worker-f", costClass: "local-free", location: "local", availability: "available", capacity: 1, occupied: 0 },
      { id: "worker-g", costClass: "local-free", location: "local", availability: "available", capacity: 3, occupied: 0 },
      { id: "worker-u", costClass: "standard", location: "remote", availability: "unavailable", capacity: 1, occupied: 0 },
    ].map((worker) => ({
      ...worker,
      modelId: "model-a",
      harnessId: "harness-a",
      billingMode: "free",
      capabilities: { roles: ["implementation", "review"] },
    }));
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({
      schemaVersion: 2,
      resources: {
        models: [{ id: "model-a", roles: ["implementation", "review"] }],
        harnesses: [{ id: "harness-a", workerProtocols: ["apk-worker-v1"] }],
        workers,
      },
    }), "utf8");

    for (const [id, state, owner] of [
      ["0001", "doing", "codex-a"],
      ["0002", "done", "archive"],
      ["0003", "doing", "codex-a"],
      ["0004", "doing", "codex-a"],
      ["0005", "doing", "codex-a"],
    ] as const) {
      await writeFile(join(directory, ".tasks", `${id}-task.md`), buildTaskMarkdown(id, "Task", state, owner), "utf8");
    }

    await writeWorkerSession(directory, "0001", "run-a1", { resourceId: "worker-a" });
    await writeWorkerSession(directory, "0002", "run-b1", { resourceId: "worker-b" });
    await writeWorkerSession(directory, "0003", "run-d1", { resourceId: "worker-d", activated: false });
    await writeWorkerSession(directory, "9999", "run-e1", { resourceId: "worker-e" });
    await writeWorkerSession(directory, "0005", "run-f1", { resourceId: "worker-f", protocol: "not-apk-worker-v1" });
    await writeWorkerSession(directory, "0004", "run-g1", { resourceId: "worker-g" });
    await writeWorkerSession(directory, "0004", "run-ghost", { resourceId: "ghost" });

    const result = await runCli(["workers", "--json"], directory);
    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    const payload = JSON.parse(result.stdout) as {
      workers: Array<{
        id: string;
        state: string;
        capacity: number;
        occupied: number;
        declaredOccupied: number;
        remainingSlots: number;
        capabilities: string[];
        currentTaskId?: string;
        currentRunId?: string;
        stateReason: string;
      }>;
      diagnostics: string[];
    };
    const byId = Object.fromEntries(payload.workers.map((worker) => [worker.id, worker]));

    assert.equal(byId["worker-a"]?.state, "busy");
    assert.equal(byId["worker-a"]?.currentTaskId, "0001");
    assert.equal(byId["worker-a"]?.currentRunId, "run-a1");
    assert.equal(byId["worker-a"]?.remainingSlots, 0);
    assert.deepEqual(byId["worker-a"]?.capabilities, ["implementation", "review"]);

    assert.equal(byId["worker-b"]?.state, "ready", "a completed run must not permanently occupy a worker");
    assert.equal(byId["worker-b"]?.remainingSlots, 2);

    assert.equal(byId["frontier"]?.state, "busy");
    assert.equal(byId["worker-b"]?.state, "ready", "a local worker stays usable while a scarce frontier worker is occupied");

    assert.equal(byId["worker-d"]?.state, "unknown", "an unactivated session must not report ready");
    assert.equal(byId["worker-e"]?.state, "unknown", "an orphaned session must not report ready");
    assert.equal(byId["worker-f"]?.state, "unknown", "a malformed session identity must not report ready");
    assert.equal(byId["worker-g"]?.state, "busy");
    assert.equal(byId["worker-g"]?.remainingSlots, 2);
    assert.equal(byId["worker-u"]?.state, "unavailable");

    assert.ok(payload.diagnostics.some((diagnostic) => /stale\/orphaned/.test(diagnostic)));
    assert.ok(payload.diagnostics.some((diagnostic) => /unconfigured resource ghost/.test(diagnostic)));
    assert.doesNotMatch(result.stdout, /pid|process|terminal|ssh/i);

    const human = await runCli(["workers"], directory);
    assert.equal(human.exitCode, 0, `${human.stdout}${human.stderr}`);
    assert.match(human.stdout, /capabilities=implementation,review/);
    assert.match(human.stdout, /remaining=2/);
    assert.doesNotMatch(human.stdout, /pid|process|terminal|ssh/i);
  });
});

async function pathExistsForTest(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function initGitRepo(directory: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: directory });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: directory });
  await execFileAsync("git", ["config", "user.name", "Test"], { cwd: directory });
  await writeFile(join(directory, ".gitignore"), ".apk-workspaces/\n.agentic/workspaces/\n", "utf8");
  await writeFile(join(directory, "README.md"), "init\n", "utf8");
  await execFileAsync("git", ["add", ".gitignore", "README.md"], { cwd: directory });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: directory });
}

async function writeTaskFile(directory: string, id: string, state: string, owner: string): Promise<void> {
  await mkdir(join(directory, ".tasks"), { recursive: true });
  await writeFile(join(directory, ".tasks", `${id}-task.md`), buildTaskMarkdown(id, "Task", state, owner), "utf8");
}

async function writeWorkspaceRecord(directory: string, record: WorkspaceRecord): Promise<void> {
  await mkdir(join(directory, ".agentic", "workspaces"), { recursive: true });
  await writeFile(workspaceRecordPath(directory, record.id), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

test("CLI workspaces creates lists idempotently and removes only an exact owned worktree", async () => {
  await withTempDirectory(async (directory) => {
    await initGitRepo(directory);
    await writeTaskFile(directory, "0001", "doing", "owner");

    const created = await runCli(["workspaces", "create", "--task", "0001", "--owner", "owner", "--json"], directory);
    assert.equal(created.exitCode, 0, `${created.stdout}${created.stderr}`);
    const record = (JSON.parse(created.stdout) as { workspace: WorkspaceRecord }).workspace;
    assert.equal(record.taskId, "0001");
    assert.equal(record.baselineHeadSha, record.candidateRevision);
    assert.ok(record.worktreePath.includes(".apk-workspaces"));
    assert.ok(await pathExistsForTest(record.worktreePath));

    const first = await runCli(["workspaces", "list", "--json"], directory);
    const second = await runCli(["workspaces", "list", "--json"], directory);
    assert.equal(first.stdout, second.stdout);
    const entries = (JSON.parse(first.stdout) as { workspaces: Array<{ id: string; state: string }> }).workspaces;
    assert.equal(entries[0]?.state, "active");

    const dry = await runCli(["workspaces", "cleanup", record.id], directory);
    assert.equal(dry.exitCode, 0, `${dry.stdout}${dry.stderr}`);
    assert.match(dry.stdout, /Applied: false/);
    assert.ok(await pathExistsForTest(record.worktreePath));

    const applied = await runCli(["workspaces", "cleanup", record.id, "--apply"], directory);
    assert.equal(applied.exitCode, 0, `${applied.stdout}${applied.stderr}`);
    assert.match(applied.stdout, /Removed: true/);
    assert.equal(await pathExistsForTest(record.worktreePath), false);

    // The default single-worktree workflow still runs.
    const status = await runCli(["status"], directory);
    assert.equal(status.exitCode, 0, `${status.stdout}${status.stderr}`);
  });
});

test("CLI workspaces create rejects unsafe names and foreign task owners", async () => {
  await withTempDirectory(async (directory) => {
    await initGitRepo(directory);
    await writeTaskFile(directory, "0001", "doing", "owner");

    const escape = await runCli(["workspaces", "create", "--task", "0001", "--owner", "owner", "--name", "../escape"], directory);
    assert.equal(escape.exitCode, 1);
    assert.match(escape.stderr, /safe path segment/i);

    const wrongOwner = await runCli(["workspaces", "create", "--task", "0001", "--owner", "someone-else"], directory);
    assert.equal(wrongOwner.exitCode, 1);
    assert.match(wrongOwner.stderr, /owned by owner, not someone-else/);
  });
});

test("workspace safety refuses root, path escape, foreign, dirty, unmerged, and active-run cases", async () => {
  await withTempDirectory(async (directory) => {
    await initGitRepo(directory);
    await writeTaskFile(directory, "0001", "doing", "owner");
    const created = await createWorkspace({ rootDirectory: directory, taskId: "0001", owner: "owner" });
    const record = created.record;

    await assert.rejects(
      () => createWorkspace({ rootDirectory: directory, taskId: "0001", owner: "owner" }),
      /already has managed workspace/i,
    );

    const rootRecord: WorkspaceRecord = { ...record, id: "ws-root", worktreePath: directory, worktreeId: "worktree:root", marker: "root" };
    assert.equal((await assessWorkspaceSafety(directory, rootRecord)).state, "unsafe");

    const escapeRecord: WorkspaceRecord = {
      ...record,
      id: "ws-escape",
      worktreePath: join(directory, "..", "outside-worktree"),
      worktreeId: "worktree:escape",
      marker: "escape",
    };
    await writeWorkspaceRecord(directory, escapeRecord);
    assert.equal((await assessWorkspaceSafety(directory, escapeRecord)).state, "unsafe");
    await assert.rejects(
      () => removeWorkspace({ rootDirectory: directory, id: "ws-escape", apply: true }),
      /Refusing to remove/,
    );

    const userWorktree = join(directory, ".apk-workspaces", "user-made");
    await execFileAsync("git", ["worktree", "add", "-b", "user-branch", userWorktree, "HEAD"], { cwd: directory });
    const foreignRecord: WorkspaceRecord = { ...record, id: "ws-foreign", worktreePath: userWorktree, worktreeId: "worktree:foreign", marker: "foreign" };
    await writeWorkspaceRecord(directory, foreignRecord);
    assert.equal((await assessWorkspaceSafety(directory, foreignRecord)).state, "foreign");
    await assert.rejects(
      () => removeWorkspace({ rootDirectory: directory, id: "ws-foreign", apply: true }),
      /Refusing to remove/,
    );
    assert.ok(await pathExistsForTest(userWorktree), "foreign/user worktree must be preserved");

    // Active run binding blocks cleanup.
    const runDir = join(directory, ".agentic", "sessions", "work", "0001", "run-x");
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, "metadata.json"), JSON.stringify({ protocol: "apk-worker-v1", taskId: "0001", runId: "run-x", owner: "owner", role: "implement" }), "utf8");
    await writeFile(join(runDir, "activation.json"), JSON.stringify({ protocol: "apk-worker-v1", taskId: "0001", runId: "run-x", packageHash: "x", activatedAt: "2026-01-01T00:00:00.000Z" }), "utf8");
    const activeRecord: WorkspaceRecord = { ...record, runId: "run-x" };
    const assessed = await assessWorkspaceSafety(directory, activeRecord);
    assert.equal(assessed.safeToCleanup, false);
    assert.match(assessed.reason, /activated worker run/);

    // Dirty state blocks cleanup.
    await writeFile(join(record.worktreePath, "README.md"), "dirty\n", "utf8");
    const dirty = await assessWorkspaceSafety(directory, record);
    assert.equal(dirty.safeToCleanup, false);
    await assert.rejects(
      () => removeWorkspace({ rootDirectory: directory, id: record.id, apply: true }),
      /Refusing to remove/,
    );
    assert.ok(await pathExistsForTest(record.worktreePath), "dirty worktree must be preserved");
  });
});

test("workspace safety refuses an unmerged worktree", async () => {
  await withTempDirectory(async (directory) => {
    await initGitRepo(directory);
    await writeTaskFile(directory, "0001", "doing", "owner");
    const created = await createWorkspace({ rootDirectory: directory, taskId: "0001", owner: "owner" });
    const record = created.record;
    const mainBranch = (await execFileAsync("git", ["symbolic-ref", "--short", "HEAD"], { cwd: directory })).stdout.trim();

    await writeFile(join(record.worktreePath, "README.md"), "workspace-side\n", "utf8");
    await execFileAsync("git", ["commit", "-qam", "workspace"], { cwd: record.worktreePath });
    await writeFile(join(directory, "README.md"), "main-side\n", "utf8");
    await execFileAsync("git", ["commit", "-qam", "main"], { cwd: directory });

    try {
      await execFileAsync("git", ["merge", mainBranch], { cwd: record.worktreePath });
    } catch {
      // expected conflict
    }
    const status = (await execFileAsync("git", ["status", "--porcelain"], { cwd: record.worktreePath })).stdout;
    assert.match(status, /UU README\.md/);
    const assessed = await assessWorkspaceSafety(directory, record);
    assert.equal(assessed.safeToCleanup, false);
    await assert.rejects(
      () => removeWorkspace({ rootDirectory: directory, id: record.id, apply: true }),
      /Refusing to remove/,
    );
    assert.ok(await pathExistsForTest(record.worktreePath));
  });
});

test("workspace stale metadata reports recovery guidance and is removable only with apply", async () => {
  await withTempDirectory(async (directory) => {
    await initGitRepo(directory);
    await writeTaskFile(directory, "0001", "doing", "owner");
    const created = await createWorkspace({ rootDirectory: directory, taskId: "0001", owner: "owner" });
    const stale: WorkspaceRecord = {
      ...created.record,
      id: "ws-stale",
      worktreePath: join(directory, ".apk-workspaces", "ghost"),
      worktreeId: "worktree:ghost",
      marker: "ghost",
    };
    await writeWorkspaceRecord(directory, stale);

    const statuses = await listWorkspaceStatuses(directory);
    const entry = statuses.find((workspace) => workspace.id === "ws-stale");
    assert.equal(entry?.state, "missing");
    assert.match(entry?.nextAction ?? "", /cleanup/);

    const dry = await removeWorkspace({ rootDirectory: directory, id: "ws-stale" });
    assert.equal(dry.removed, false);
    assert.equal(await pathExistsForTest(workspaceRecordPath(directory, "ws-stale")), true);

    const applied = await removeWorkspace({ rootDirectory: directory, id: "ws-stale", apply: true });
    assert.equal(applied.removed, true);
    assert.equal(await pathExistsForTest(workspaceRecordPath(directory, "ws-stale")), false);

    // Malformed metadata is surfaced as ambiguous and refused.
    await writeFile(join(directory, ".agentic", "workspaces", "ws-bad.json"), "{ not json", "utf8");
    const withMalformed = await listWorkspaceStatuses(directory);
    const badEntry = withMalformed.find((workspace) => workspace.id === "ws-bad");
    assert.equal(badEntry?.state, "ambiguous");
    assert.equal(badEntry?.safeToCleanup, false);
    await assert.rejects(
      () => removeWorkspace({ rootDirectory: directory, id: "ws-bad", apply: true }),
      /unreadable|malformed/i,
    );
  });
});

test("workspace records bind distinct candidates across revisions", async () => {
  await withTempDirectory(async (directory) => {
    await initGitRepo(directory);
    await writeTaskFile(directory, "0001", "doing", "owner");
    const task = parseTaskMarkdown(buildTaskMarkdown("0001", "Task", "doing", "owner"));

    const first = await createWorkspace({ rootDirectory: directory, taskId: "0001", owner: "owner" });
    const subjectA = await captureTaskEvidenceSubject(first.record.worktreePath, task, []);
    await removeWorkspace({ rootDirectory: directory, id: first.record.id, apply: true });

    await writeFile(join(directory, "README.md"), "second\n", "utf8");
    await execFileAsync("git", ["commit", "-qam", "second"], { cwd: directory });

    const second = await createWorkspace({ rootDirectory: directory, taskId: "0001", owner: "owner" });
    const subjectB = await captureTaskEvidenceSubject(second.record.worktreePath, task, []);

    assert.notEqual(subjectA.candidateId, subjectB.candidateId);
    assert.notEqual(first.record.worktreeId, second.record.worktreeId);
    assert.notEqual(first.record.candidateRevision, second.record.candidateRevision);
  });
});

test("CLI attention fails conservatively without a resource registry", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({ schemaVersion: 2 }), "utf8");
    await writeFile(
      join(directory, ".tasks", "0001-task.md"),
      buildTaskMarkdown("0001", "Task", "doing", "codex-a"),
      "utf8",
    );

    const attention = await runCli(["attention", "--json"], directory);
    assert.equal(attention.exitCode, 0, `${attention.stdout}${attention.stderr}`);
    const payload = JSON.parse(attention.stdout) as { diagnostics: string[]; workers: unknown[] };
    assert.equal(payload.workers.length, 0);
    assert.ok(payload.diagnostics.some((diagnostic) => /No declared resource registry/.test(diagnostic)));
  });
});

test("CLI attention sanitizes lock liveness diagnostics", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({ schemaVersion: 2 }), "utf8");
    await writeFile(
      join(directory, ".tasks", "0001-task.md"),
      buildTaskMarkdown("0001", "Task", "doing", "codex-a"),
      "utf8",
    );
    await writeFile(join(directory, ".tasks", ".apk.lock"), JSON.stringify({
      schema: 1,
      ownerId: "remote-owner",
      kind: "task-mutation",
      pid: 424242,
      hostname: "some-other-host",
      processStart: "2026-09-11T00:00:00.000Z",
      created: "2026-09-11T00:00:00.000Z",
      command: "apk claim",
      taskId: "0001",
    }), "utf8");

    const attention = await runCli(["attention", "--json"], directory);
    assert.equal(attention.exitCode, 0, `${attention.stdout}${attention.stderr}`);
    assert.doesNotMatch(attention.stdout, /424242|some-other-host|pid/i);
    const payload = JSON.parse(attention.stdout) as { diagnostics: string[] };
    assert.ok(payload.diagnostics.some((diagnostic) => /lock is present/.test(diagnostic)));
  });
});

test("CLI adopt previews legacy migration without writes and applies it idempotently", async () => {
  await withTempDirectory(async (directory) => {
    await cp(
      join(process.cwd(), "src/core/tasks/fixtures/v0.3.1"),
      directory,
      { recursive: true },
    );
    const configPath = join(directory, ".agentic/config.json");
    const agentsPath = join(directory, "AGENTS.md");
    const taskPath = join(directory, ".tasks/0001-legacy-task.md");
    const beforeConfig = await readFile(configPath, "utf8");
    const beforeAgents = await readFile(agentsPath, "utf8");
    const beforeTask = await readFile(taskPath, "utf8");

    for (const command of [["doctor"], ["lint", "--json"], ["status"]] as const) {
      const result = await runCli(command, directory);
      assert.ok(
        command[0] === "lint" ? [0, 1].includes(result.exitCode) : result.exitCode === 0,
        `${command.join(" ")}: ${result.stdout}${result.stderr}`,
      );
      if (command[0] === "lint") {
        assert.match(result.stdout, /generated-file-missing/);
      }
    }

    const preview = await runCli(["adopt", "--preview"], directory);
    assert.equal(preview.exitCode, 0, `${preview.stdout}${preview.stderr}`);
    assert.match(preview.stdout, /Compatibility: legacy/);
    assert.match(preview.stdout, /update \.agentic\/config\.json/);
    assert.match(preview.stdout, /No files were written/);
    assert.equal(await readFile(configPath, "utf8"), beforeConfig);
    assert.equal(await readFile(agentsPath, "utf8"), beforeAgents);
    assert.equal(await readFile(taskPath, "utf8"), beforeTask);

    const applied = await runCli(["adopt", "--apply"], directory);
    assert.equal(applied.exitCode, 0, `${applied.stdout}${applied.stderr}`);
    assert.match(applied.stdout, /Updated 1 file/);
    assert.equal((JSON.parse(await readFile(configPath, "utf8")) as { schemaVersion: number }).schemaVersion, 2);
    assert.equal(await readFile(agentsPath, "utf8"), beforeAgents);
    assert.equal(await readFile(taskPath, "utf8"), beforeTask);

    const repeated = await runCli(["adopt", "--apply"], directory);
    assert.equal(repeated.exitCode, 0, `${repeated.stdout}${repeated.stderr}`);
    assert.match(repeated.stdout, /Updated 0 file/);
  });
});

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

test("CLI tasks hides done and canceled tasks by default", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await writeFile(join(tasksDir, "0002-done-task.md"), buildTaskMarkdown("0002", "Done Task", "done", "archive"), "utf8");
    await writeFile(join(tasksDir, "0003-canceled-task.md"), buildTaskMarkdown("0003", "Canceled Task", "canceled"), "utf8");

    const defaultResult = await runCli(["tasks"], directory);
    assert.equal(defaultResult.exitCode, 0);
    assert.match(defaultResult.stdout, /0001/);
    assert.doesNotMatch(defaultResult.stdout, /0002/);
    assert.doesNotMatch(defaultResult.stdout, /0003/);
  });
});

test("CLI tasks --all shows every parsed task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await writeFile(join(tasksDir, "0002-done-task.md"), buildTaskMarkdown("0002", "Done Task", "done", "archive"), "utf8");

    const allResult = await runCli(["tasks", "--all"], directory);
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

    const stateResult = await runCli(["tasks", "--state", "done"], directory);
    assert.equal(stateResult.exitCode, 0);
    assert.doesNotMatch(stateResult.stdout, /0001/);
    assert.match(stateResult.stdout, /0002/);
  });
});

test("CLI tasks rejects unknown options", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });

    const result = await runCli(["tasks", "--unknown"], directory);
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Unknown option: --unknown/) || result.stderr.match(/Unknown option: --unknown/),
      "Expected error about unknown option",
    );
  });
});

test("CLI tasks help shows active filtering info", async () => {
  const result = await runCli(["tasks", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /--all/);
  assert.match(result.stdout, /active tasks/);
});

test("CLI status shows compact workflow state", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");

    const result = await runCli(["status"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Mode:/);
    assert.match(result.stdout, /Tasks:/);
    assert.match(result.stdout, /todo:1/);
    assert.match(result.stdout, /Next task: 0001 Todo Task/);
    assert.match(result.stdout, /Generated instructions:/);
    assert.match(result.stdout, /Latest run:/);
    assert.match(result.stdout, /Active tasks:/);
    assert.match(result.stdout, /0001 \[todo\]/);
    assert.match(result.stdout, /gate=blocked/);
    assert.match(result.stdout, /Warnings:/);
  });
});

test("CLI status help shows usage", async () => {
  const result = await runCli(["status", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk status \[--detail\]/);
  assert.match(result.stdout, /bounded gate, evidence and provenance/);
});

test("CLI status shows ready and dependency-blocked next actions", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-done-task.md"), buildTaskMarkdown("0001", "Done Task", "done", "archive"), "utf8");
    await writeFile(
      join(tasksDir, "0002-ready-task.md"),
      buildTaskMarkdown("0002", "Ready Task", "todo").replace("Depends on: none", "Depends on: 0001"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0003-blocked-task.md"),
      buildTaskMarkdown("0003", "Blocked Task", "todo").replace("Depends on: none", "Depends on: 0099"),
      "utf8",
    );

    const result = await runCli(["status"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /0002 \[todo\].*deps=ready.*next=claim with --owner <agent-id>/);
    assert.match(result.stdout, /0003 \[todo\].*deps=blocked\(0099\).*next=wait for dependencies: 0099/);
  });
});

test("CLI status detail matches gate blockers and includes pending live review", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    const task = buildTaskMarkdown("0001", "Live Task", "doing", "codex-owner")
      .replace("Risk: low", "Risk: medium")
      .replace(
        "## Verification commands\n\n- pnpm test",
        "## Verification\n\n- `{" +
          "\"id\":\"live-smoke\",\"type\":\"manual\",\"required\":true,\"environment\":\"live\",\"profile\":\"trusted\",\"instruction\":\"Check the live candidate.\",\"evidence\":\"release URL\"" +
          "}`",
      );
    await writeFile(join(tasksDir, "0001-live-task.md"), task, "utf8");

    const status = await runCli(["status", "--detail"], directory);
    const gate = await runCli(["task", "gate", "0001"], directory);

    assert.equal(status.exitCode, 0);
    assert.equal(gate.exitCode, 1);
    assert.match(status.stdout, /Task 0001: Live Task/);
    assert.match(status.stdout, /Policy: .*review=lightweight/);
    assert.match(status.stdout, /Verification: required=1/);
    assert.match(status.stdout, /Review: missing/);
    assert.match(status.stdout, /Provenance:/);
    assert.match(status.stdout, /missing independent review evidence/);
    assert.match(gate.stdout, /missing independent review evidence/);
    assert.match(status.stdout, /live-smoke/);
  });
});

test("CLI status projects unavailable scope and low-risk review correctly", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(
      join(directory, ".tasks", "0001-local-task.md"),
      buildTaskMarkdown("0001", "Local Task", "doing", "codex-owner"),
      "utf8",
    );
    const status = await runCli(["status", "--detail"], directory);
    assert.equal(status.exitCode, 0);
    assert.match(status.stdout, /Scope: unavailable/);
    assert.match(status.stdout, /Review: not-required/);
  });
});

test("CLI status exposes stale verification and task-attributed changed counts", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    const task = buildTaskMarkdown("0001", "Status Task", "todo")
      .replace("- .tasks/0001-task.md", "- src/**")
      .replace("- pnpm test", "- node -e \"process.exit(0)\"");
    await writeFile(join(directory, ".tasks", "0001-status-task.md"), task, "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);
    await runCli(["claim", "0001", "--owner", "codex-a"], directory);
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "change.ts"), "export const v = 1;\n", "utf8");
    const verification = await runCli(["task", "verify", "0001", "--owner", "codex-a"], directory);
    assert.equal(verification.exitCode, 0);
    await writeFile(join(directory, "src", "change.ts"), "export const v = 2;\n", "utf8");
    await writeFile(join(directory, "unrelated.txt"), "parallel task\n", "utf8");

    const status = await runCli(["status", "--detail"], directory);
    assert.equal(status.exitCode, 0);
    assert.match(status.stdout, /Verification: required=1; passed=0; failed=0; pending=0; missing=0; stale=1; unknown=0/);
    assert.match(status.stdout, /Provenance: .*changed-files=1/);
  });
});

test("CLI status reports broken task files as warnings", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-broken.md"), "# Broken\n", "utf8");

    const result = await runCli(["status"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /task parse warning/);
  });
});

test("CLI doctor help shows usage", async () => {
  const result = await runCli(["doctor", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk doctor/);
});

test("CLI doctor reports warnings without failing", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");

    const result = await runCli(["doctor"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Doctor:/);
    assert.match(result.stdout, /warn:/);
    assert.match(result.stdout, /Result: pass/);
  });
});

test("CLI quality detect exposes the shared capability result in JSON", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "package.json"), JSON.stringify({
      scripts: { test: "node --test", lint: "eslint ." },
    }), "utf8");
    await writeFile(join(directory, ".gitlab-ci.yml"), "test: {}\n", "utf8");

    const result = await runCli(["quality", "detect", "--json"], directory);

    assert.equal(result.exitCode, 0, `${result.stdout}${result.stderr}`);
    const payload = JSON.parse(result.stdout) as {
      capabilities: Array<{ id: string; status: string; evidence: Array<{ source: string }> }>;
      policy: { status: string };
    };
    assert.equal(payload.policy.status, "pass");
    assert.deepEqual(payload.capabilities.map((capability) => capability.id), [
      "typecheck", "lint", "tests", "build", "coverage", "hooks", "ci",
    ]);
    assert.equal(payload.capabilities.find((capability) => capability.id === "lint")?.status, "detected");
    assert.equal(payload.capabilities.find((capability) => capability.id === "ci")?.status, "detected");
  });
});

test("CLI lock diagnostics preserve live owners and explicitly recover malformed locks", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    const lockPath = join(tasksDir, ".apk.lock");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(lockPath, JSON.stringify({
      schema: 1,
      ownerId: "parent-process",
      kind: "task-mutation",
      pid: process.pid,
      hostname: hostname(),
      processStart: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      created: "2026-01-01T00:00:01.000Z",
      command: "test holder",
      taskId: "0001",
    }), "utf8");

    const live = await runCli(["task", "lock", "status", "--kind", "task"], directory);
    assert.equal(live.exitCode, 0);
    assert.match(live.stdout, /task: live:.*pid=.*lock is old but cannot be stolen/);
    const refused = await runCli(["task", "lock", "recover", "--kind", "task", "--force"], directory);
    assert.equal(refused.exitCode, 1);
    assert.match(refused.stderr, /Refusing to recover a live lock/);
    assert.match((await runCli(["status"], directory)).stdout, /task lock: live:/);
    assert.match((await runCli(["doctor"], directory)).stdout, /task lock: live:/);

    await writeFile(lockPath, "broken", "utf8");
    const malformed = await runCli(["task", "lock", "status", "--kind", "task"], directory);
    assert.equal(malformed.exitCode, 1);
    assert.match(malformed.stdout, /malformed:.*lock recover.*--force/);
    const doctor = await runCli(["doctor"], directory);
    assert.equal(doctor.exitCode, 1);
    assert.match(doctor.stdout, /task lock: malformed:/);
    const recovered = await runCli(["task", "lock", "recover", "--kind", "task", "--force"], directory);
    assert.equal(recovered.exitCode, 0);
    assert.match(recovered.stdout, /recovered; absent:/);
  });
});

test("CLI doctor fails on broken task files", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-broken.md"), "# Broken\n", "utf8");

    const result = await runCli(["doctor"], directory);

    assert.equal(result.exitCode, 1);
    assert.match(result.stdout, /tasks:/);
    assert.match(result.stdout, /Result: fail/);
  });
});

test("CLI suggest-context returns deterministic local candidates", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, "src", "auth"), { recursive: true });
    await mkdir(join(directory, "src", "auth", "__tests__"), { recursive: true });
    await writeFile(join(directory, "src", "auth", "middleware.ts"), "export {}\n", "utf8");
    await writeFile(join(directory, "src", "auth", "__tests__", "middleware.test.ts"), "test('x', () => {});\n", "utf8");
    await writeFile(join(directory, "package.json"), JSON.stringify({}), "utf8");

    const result = await runCli(["suggest-context", "Add auth middleware", "--limit", "4"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Suggestions/);
    assert.match(result.stdout, /\[implementation; score=.*; /);
    assert.match(result.stdout, /Context files/);
    assert.match(result.stdout, /Files allowed to edit/);
    assert.match(result.stdout, /src\/auth\/middleware\.ts/);
    assert.doesNotMatch(result.stdout, /node_modules/);
  });
});

test("CLI suggest-context help shows usage", async () => {
  const result = await runCli(["suggest-context", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk suggest-context/);
});

test("CLI work claims todo task and prints prompt", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);

    const result = await runCli(["work", "0001", "--owner", "codex-a", "--target", "codex", "--level", "2"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Agent: codex/);
    assert.match(result.stdout, /Claimed: yes/);
    assert.match(result.stdout, /Worker role: implement/);
    assert.match(result.stdout, /Run:/);
    assert.match(result.stdout, /pnpm exec apk task verify 0001 --owner codex-a/);
    assert.match(await readFile(join(directory, ".tasks", "0001-todo-task.md"), "utf8"), /State: doing/);
  });
});

test("CLI context and prompt accept budgeted packs and report overflow", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");

    const context = await runCli(["context", "0001", "--budget", "1000"], directory);
    assert.equal(context.exitCode, 0);
    assert.match(context.stdout, /Budget: 1000 units/);
    assert.match(context.stdout, /Estimated units:/);

    const prompt = await runCli(["prompt", "codex", "--task", "0001", "--budget", "1000"], directory);
    assert.equal(prompt.exitCode, 0);
    assert.match(prompt.stdout, /Context budget: 1000 units/);

    const overflow = await runCli(["context", "0001", "--budget", "1"], directory);
    assert.equal(overflow.exitCode, 1);
    assert.match(overflow.stdout, /Required context uses .* exceeding budget 1/);
  });
});

test("CLI agent prompt uses repo-local apk commands", async () => {
  const result = await runCli(["agent", "prompt", "--platform", "codex"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /pnpm exec apk agent register --id codex-a/);
  assert.match(result.stdout, /pnpm exec apk claim <task-id> --owner <agent-id>/);
  assert.match(result.stdout, /pnpm exec apk prompt codex --task <task-id> --level 2/);
  assert.doesNotMatch(result.stdout, /^apk agent register/m);
  assert.doesNotMatch(result.stdout, /apk prompt <platform>/);
});

test("CLI work refuses unregistered owner", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");

    const result = await runCli(["work", "0001", "--owner", "codex-a", "--target", "codex"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Agent is not registered/) || result.stderr.match(/Agent is not registered/),
      "Expected unregistered owner error",
    );
  });
});

test("CLI work can write a session prompt", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);

    const result = await runCli(["work", "0001", "--owner", "codex-a", "--target", "codex", "--write-session"], directory);
    const sessionMatch = /Session: (.+prompt\.md)/.exec(result.stdout);

    assert.equal(result.exitCode, 0);
    assert.ok(sessionMatch, "Expected session path in output");
    assert.match(await readFile(join(directory, sessionMatch![1]), "utf8"), /Agent: codex/);
  });
});

test("CLI work persists the exact issued worker package and metadata", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({
      schemaVersion: 2,
      projectName: "resource-test",
      defaultMode: "product",
      documentationProfile: "standard",
      agentStyle: "caveman",
      taskDirectory: ".tasks",
      docsDirectory: "docs",
      resources: {
        models: [{ id: "model-a", roles: ["implement"] }],
        harnesses: [{
          id: "harness-a",
          tools: ["git"],
          workspaceModes: ["single-worktree"],
          sessionIsolation: false,
          subagentSupport: false,
          workerProtocols: ["apk-worker-v1"],
        }],
        workers: [{
          id: "worker-a",
          modelId: "model-a",
          harnessId: "harness-a",
          location: "local",
          billingMode: "free",
          costClass: "local-free",
          availability: "available",
          capacity: 1,
          occupied: 0,
          capabilities: {
            roles: ["implement"],
            tools: ["git"],
            workspaceModes: ["single-worktree"],
            workerProtocols: ["apk-worker-v1"],
          },
        }],
      },
    }, null, 2), "utf8");
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);

    const issued = await runCli([
      "work", "0001", "--owner", "codex-a", "--target", "codex", "--resource", "worker-a", "--json",
    ], directory);
    assert.equal(issued.exitCode, 0, `${issued.stdout}${issued.stderr}`);
    const payload = JSON.parse(issued.stdout);
    assert.equal(payload.workerPackage.protocol, "apk-worker-v1");
    assert.equal(payload.workerPackage.role, "implement");
    assert.equal(payload.workerPackage.provenance.resourceId, "worker-a");
    const serializedPackage = JSON.parse(await readFile(join(directory, payload.session.package), "utf8"));
    const metadata = JSON.parse(await readFile(join(directory, payload.session.metadata), "utf8"));
    assert.deepEqual(serializedPackage, payload.workerPackage);
    assert.equal(metadata.taskId, "0001");
    assert.equal(metadata.runId, payload.runId);
    assert.equal(metadata.owner, "codex-a");
    assert.equal(metadata.target, "codex");
    assert.equal(metadata.resourceId, "worker-a");
    assert.equal(metadata.role, "implement");
    assert.equal(typeof metadata.packageHash, "string");
  });
});

test("CLI work warns about unsettled mutable runs in the same worktree", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-first-task.md"), buildTaskMarkdown("0001", "First Task", "todo"), "utf8");
    await writeFile(join(directory, ".tasks", "0002-second-task.md"), buildTaskMarkdown("0002", "Second Task", "todo"), "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    for (const id of ["codex-a", "codex-b"]) {
      await runCli(["agent", "register", "--id", id, "--platform", "codex", "--model", "gpt"], directory);
    }
    assert.equal((await runCli(["work", "0001", "--owner", "codex-a", "--target", "codex"], directory)).exitCode, 0);
    const second = await runCli(["work", "0002", "--owner", "codex-b", "--target", "codex"], directory);
    assert.equal(second.exitCode, 0, `${second.stdout}${second.stderr}`);
    assert.match(second.stdout, /same Git worktree/);
  });
});

test("CLI work ignores unactivated sessions in same-worktree warnings", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-first-task.md"), buildTaskMarkdown("0001", "First Task", "todo"), "utf8");
    await writeFile(join(directory, ".tasks", "0002-second-task.md"), buildTaskMarkdown("0002", "Second Task", "todo"), "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    for (const id of ["codex-a", "codex-b"]) {
      await runCli(["agent", "register", "--id", id, "--platform", "codex", "--model", "gpt"], directory);
    }
    const first = await runCli([
      "work", "0001", "--owner", "codex-a", "--target", "codex", "--json",
    ], directory);
    assert.equal(first.exitCode, 0, `${first.stdout}${first.stderr}`);
    const firstPayload = JSON.parse(first.stdout) as { session: { activation: string } };
    await rm(join(directory, firstPayload.session.activation), { force: true });

    const second = await runCli(["work", "0002", "--owner", "codex-b", "--target", "codex"], directory);
    assert.equal(second.exitCode, 0, `${second.stdout}${second.stderr}`);
    assert.doesNotMatch(second.stdout, /same Git worktree/);
  });
});

test("CLI work coordinates implementation, review, fixer, and gate roles", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    const task = buildTaskMarkdown("0001", "Worker Cycle", "todo")
      .replace("Risk: low", "Risk: medium")
      .replace("Tags: none", "Tags: worker")
      .replace("- .tasks/0001-task.md", "- src/fix.ts")
      .replace("- pnpm test", "- node -e \"process.exit(0)\"")
      .replace(
        '## Verification commands\n\n- node -e "process.exit(0)"',
        '## Verification\n\n- `{"id":"worker-check","type":"automated","required":true,"environment":"local","profile":"report","command":"node -e \\"process.exit(0)\\"","evidence":"worker result"}`',
      );
    await writeFile(join(tasksDir, "0001-worker-cycle.md"), task, "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");

    for (const id of ["codex-owner", "codex-reviewer", "opencode-fixer"]) {
      const registered = await runCli([
        "agent", "register", "--id", id, "--platform", "codex", "--model", "gpt-5",
      ], directory);
      assert.equal(registered.exitCode, 0);
    }

    const workRun = await runCli([
      "work", "0001", "--owner", "codex-owner", "--target", "codex",
    ], directory);
    assert.equal(workRun.exitCode, 0);
    const implementationRunId = workRun.stdout.match(/Run: (work-[^\n]+)/)?.[1];
    assert.ok(implementationRunId);
    assert.match(workRun.stdout, /Next role: verify/);

    const mismatchedRole = await runCli([
      "work", "result", "0001", "--owner", "codex-owner", "--run-id", implementationRunId,
      "--role", "verify", "--status", "completed",
    ], directory);
    assert.equal(mismatchedRole.exitCode, 1);
    assert.match(mismatchedRole.stderr + mismatchedRole.stdout, /does not match issued role/);
    const unknownRun = await runCli([
      "work", "result", "0001", "--owner", "codex-owner", "--run-id", "work-unknown",
      "--role", "implement", "--status", "completed",
    ], directory);
    assert.equal(unknownRun.exitCode, 1);
    assert.match(unknownRun.stderr + unknownRun.stdout, /Issued worker run not found/);
    const wrongOwner = await runCli([
      "work", "result", "0001", "--owner", "codex-reviewer", "--run-id", implementationRunId,
      "--role", "implement", "--status", "completed",
    ], directory);
    assert.equal(wrongOwner.exitCode, 1);
    assert.match(wrongOwner.stderr + wrongOwner.stdout, /belongs to codex-owner/);

    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "fix.ts"), "export const rollbackHandled = false;\n", "utf8");
    const implementationResult = await runCli([
      "work", "result", "0001", "--owner", "codex-owner", "--run-id", implementationRunId,
      "--role", "implement", "--status", "completed", "--json",
    ], directory);
    assert.equal(implementationResult.exitCode, 0);
    const implementationPayload = JSON.parse(implementationResult.stdout);
    assert.equal(implementationPayload.nextRole, "verify");
    assert.equal(implementationPayload.evidence.gateEligible, false);
    assert.equal(implementationPayload.nextPackage, undefined);

    const evidenceLines = (await readFile(join(directory, ".agentic", "evidence.jsonl"), "utf8"))
      .trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as {
        runId: string;
        subject: { candidateId: string };
      });
    const implementationEvidence = evidenceLines.find((record) => record.runId === implementationRunId);
    assert.ok(implementationEvidence);
    const issuedImplementation = JSON.parse(
      await readFile(join(directory, ".agentic", "sessions", "work", "0001", implementationRunId, "package.json"), "utf8"),
    ) as { provenance: { candidateId: string } };
    assert.notEqual(implementationEvidence.subject.candidateId, issuedImplementation.provenance.candidateId);
    const provenanceResult = await runCli(["task", "provenance", "0001", "--json"], directory);
    assert.equal(provenanceResult.exitCode, 0);
    const provenancePayload = JSON.parse(provenanceResult.stdout) as {
      workerRuns: Array<{
        runId: string;
        issuedSubject: { candidateId: string };
        outputSubject?: { candidateId: string };
        status: string;
      }>;
    };
    const implementationWorkerRun = provenancePayload.workerRuns.find((run) => run.runId === implementationRunId);
    assert.ok(implementationWorkerRun);
    assert.equal(implementationWorkerRun.issuedSubject.candidateId, issuedImplementation.provenance.candidateId);
    assert.equal(implementationWorkerRun.outputSubject?.candidateId, implementationEvidence.subject.candidateId);
    assert.equal(implementationWorkerRun.status, "completed");

    const blockedBeforeCanonicalVerification = await runCli(["task", "gate", "0001"], directory);
    assert.equal(blockedBeforeCanonicalVerification.exitCode, 1);
    assert.match(blockedBeforeCanonicalVerification.stdout, /missing verification evidence/);

    const verifyWork = await runCli([
      "work", "0001", "--owner", "codex-owner", "--target", "codex", "--role", "verify",
    ], directory);
    const verifyRunId = verifyWork.stdout.match(/Run: (work-[^\n]+)/)?.[1];
    assert.ok(verifyRunId);
    const verifyResult = await runCli([
      "work", "result", "0001", "--owner", "codex-owner", "--run-id", verifyRunId,
      "--role", "verify", "--status", "completed",
    ], directory);
    assert.equal(verifyResult.exitCode, 0);
    assert.match(verifyResult.stdout, /Next role: verify/);
    assert.match(verifyResult.stdout, /canonical verification/);

    const canonicalVerification = await runCli(["task", "verify", "0001", "--owner", "codex-owner"], directory);
    assert.equal(canonicalVerification.exitCode, 0);

    const reviewPreparationDirectory = join(directory, ".agentic", "reviews", "0001");
    await assert.rejects(
      () => startWork({
        rootDirectory: directory,
        taskId: "0001",
        owner: "codex-reviewer",
        target: "opencode",
        level: "auto",
        role: "review",
        afterReviewPreparation: async () => {
          throw new Error("injected failure after review preparation");
        },
      }),
      /injected failure after review preparation/,
    );
    assert.deepEqual((await readdir(reviewPreparationDirectory)).filter((entry) => entry.endsWith(".json")), []);

    let standaloneReplacementPath: string | undefined;
    await assert.rejects(
      () => startWork({
        rootDirectory: directory,
        taskId: "0001",
        owner: "codex-reviewer",
        target: "opencode",
        level: "auto",
        role: "review",
        afterReviewPreparation: async (preparation) => {
          standaloneReplacementPath = join(reviewPreparationDirectory, `${preparation.reviewRunId}.json`);
          const replacement = JSON.parse(await readFile(standaloneReplacementPath, "utf8")) as Record<string, unknown>;
          replacement.origin = "standalone";
          delete replacement.workerRunId;
          await rm(standaloneReplacementPath);
          await writeFile(standaloneReplacementPath, `${JSON.stringify(replacement)}\n`, "utf8");
          throw new Error("injected standalone replacement");
        },
      }),
      /injected standalone replacement/,
    );
    assert.ok(standaloneReplacementPath);
    assert.match(await readFile(standaloneReplacementPath, "utf8"), /"origin":"standalone"/);

    let successorReplacementPath: string | undefined;
    await assert.rejects(
      () => startWork({
        rootDirectory: directory,
        taskId: "0001",
        owner: "codex-reviewer",
        target: "opencode",
        level: "auto",
        role: "review",
        afterReviewPreparation: async (preparation) => {
          successorReplacementPath = join(reviewPreparationDirectory, `${preparation.reviewRunId}.json`);
          const replacement = JSON.parse(await readFile(successorReplacementPath, "utf8")) as Record<string, unknown>;
          replacement.preparedAt = "2099-01-01T00:00:00.000Z";
          await rm(successorReplacementPath);
          await writeFile(successorReplacementPath, `${JSON.stringify(replacement)}\n`, "utf8");
          throw new Error("injected successor replacement");
        },
      }),
      /injected successor replacement/,
    );
    assert.ok(successorReplacementPath);
    assert.match(await readFile(successorReplacementPath, "utf8"), /2099-01-01T00:00:00.000Z/);

    await writeFile(join(tasksDir, ".apk.lock"), "stale\n", "utf8");
    await assert.rejects(
      () => startWork({
        rootDirectory: directory,
        taskId: "0001",
        owner: "codex-reviewer",
        target: "opencode",
        level: "auto",
        role: "review",
      }),
      /Task lock exists/,
    );
    await rm(join(tasksDir, ".apk.lock"), { force: true });
    const issuedRunDirectory = join(directory, ".agentic", "sessions", "work", "0001");
    const issuedRunIds = (await readdir(issuedRunDirectory)).filter((entry) => entry.startsWith("work-")).sort();
    const failedTransitionRunId = issuedRunIds.at(-1);
    assert.ok(failedTransitionRunId);
    const inactiveTransitionResult = await runCli([
      "work", "result", "0001", "--owner", "codex-reviewer", "--run-id", failedTransitionRunId,
      "--role", "review", "--status", "completed",
    ], directory);
    assert.equal(inactiveTransitionResult.exitCode, 1);
    assert.match(inactiveTransitionResult.stderr + inactiveTransitionResult.stdout, /not activated/);
    const standaloneTransitionResult = await runCli([
      "review", "0001", "--reviewer", "codex-reviewer", "--review-run", failedTransitionRunId,
      "--result", "pass",
    ], directory);
    assert.equal(standaloneTransitionResult.exitCode, 1);
    assert.match(standaloneTransitionResult.stderr + standaloneTransitionResult.stdout, /Prepared review run not found/);
    const inactiveProvenance = await runCli(["task", "provenance", "0001", "--json"], directory);
    assert.equal(inactiveProvenance.exitCode, 0);
    const inactiveWorkerRun = (JSON.parse(inactiveProvenance.stdout) as {
      workerRuns: Array<{ runId: string; activated: boolean; status: string }>;
    }).workerRuns.find((run) => run.runId === failedTransitionRunId);
    assert.ok(inactiveWorkerRun);
    assert.equal(inactiveWorkerRun.activated, false);
    assert.equal(inactiveWorkerRun.status, "unactivated");
    const blockedAfterInactiveReview = await runCli(["task", "gate", "0001"], directory);
    assert.equal(blockedAfterInactiveReview.exitCode, 1);
    assert.match(blockedAfterInactiveReview.stdout, /Missing independent review evidence/);

    await assert.rejects(
      () => startWork({
        rootDirectory: directory,
        taskId: "0001",
        owner: "codex-reviewer",
        target: "opencode",
        level: "auto",
        role: "review",
        beforeReviewActivation: async () => {
          await writeFile(join(directory, "src", "fix.ts"), "export const rollbackHandled = \"race\";\n", "utf8");
        },
      }),
      /candidate changed during issuance/,
    );
    const racedRunId = (await readdir(issuedRunDirectory)).filter((entry) => entry.startsWith("work-")).sort().at(-1);
    assert.ok(racedRunId);
    const inactiveRaceResult = await runCli([
      "work", "result", "0001", "--owner", "codex-reviewer", "--run-id", racedRunId,
      "--role", "review", "--status", "completed",
    ], directory);
    assert.equal(inactiveRaceResult.exitCode, 1);
    assert.match(inactiveRaceResult.stderr + inactiveRaceResult.stdout, /not activated/);
    const standaloneRaceResult = await runCli([
      "review", "0001", "--reviewer", "codex-reviewer", "--review-run", racedRunId,
      "--result", "pass",
    ], directory);
    assert.equal(standaloneRaceResult.exitCode, 1);
    assert.match(standaloneRaceResult.stderr + standaloneRaceResult.stdout, /Prepared review run not found/);
    assert.equal((await runCli(["task", "verify", "0001", "--owner", "codex-owner"], directory)).exitCode, 0);

    let activatedRaceRunId: string | undefined;
    await assert.rejects(
      () => startWork({
        rootDirectory: directory,
        taskId: "0001",
        owner: "codex-reviewer",
        target: "opencode",
        level: "auto",
        role: "review",
        beforeReviewActivation: async () => {
          activatedRaceRunId = (await readdir(issuedRunDirectory))
            .filter((entry) => entry.startsWith("work-"))
            .sort()
            .at(-1);
          assert.ok(activatedRaceRunId);
          const metadata = JSON.parse(await readFile(
            join(issuedRunDirectory, activatedRaceRunId, "metadata.json"),
            "utf8",
          )) as { packageHash: string };
          await writeFile(join(issuedRunDirectory, activatedRaceRunId, "activation.json"), `${JSON.stringify({
            protocol: "apk-worker-v1",
            taskId: "0001",
            runId: activatedRaceRunId,
            packageHash: metadata.packageHash,
            activatedAt: new Date().toISOString(),
          })}\n`, "utf8");
        },
      }),
      /already activated/,
    );
    assert.ok(activatedRaceRunId);
    assert.match(
      await readFile(join(reviewPreparationDirectory, `${activatedRaceRunId}.json`), "utf8"),
      /"origin":"worker"/,
    );

    const selfReviewWork = await runCli([
      "work", "0001", "--owner", "codex-owner", "--target", "codex",
    ], directory);
    assert.equal(selfReviewWork.exitCode, 1);
    assert.match(selfReviewWork.stderr + selfReviewWork.stdout, /Independent review requires a reviewer/);

    const reviewWork = await runCli([
      "work", "0001", "--owner", "codex-reviewer", "--target", "opencode", "--role", "review",
    ], directory);
    assert.match((await readFile(join(tasksDir, "0001-worker-cycle.md"), "utf8")), /State: review/);
    const reviewRunId = reviewWork.stdout.match(/Run: (work-[^\n]+)/)?.[1];
    assert.ok(reviewRunId, `${reviewWork.stdout}${reviewWork.stderr}`);
    const failedReview = await runCli([
      "work", "result", "0001", "--owner", "codex-reviewer", "--run-id", reviewRunId,
      "--role", "review", "--status", "changes_requested", "--finding", "Handle rollback path.",
      "--reason", "Review found an actionable rollback gap.", "--json",
    ], directory);
    assert.equal(failedReview.exitCode, 1);
    const failedReviewPayload = JSON.parse(failedReview.stdout);
    assert.equal(failedReviewPayload.nextRole, "fix");
    assert.equal(failedReviewPayload.nextPackage, undefined);
    assert.match(failedReviewPayload.nextAction, /--owner <fixer>.*--role fix/);
    const afterChangesRequested = await runCli(["status", "--detail"], directory);
    assert.equal(afterChangesRequested.exitCode, 0);
    assert.match(afterChangesRequested.stdout, /Next: run fixer for 0001/);

    const fixerWork = await runCli([
      "work", "0001", "--owner", "opencode-fixer", "--target", "opencode", "--role", "fix",
    ], directory);
    assert.equal(fixerWork.exitCode, 0, `${fixerWork.stdout}${fixerWork.stderr}`);
    assert.match(fixerWork.stdout, /Worker role: fix/);
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "fix.ts"), "export const rollbackHandled = true;\n", "utf8");
    const fixerRunId = fixerWork.stdout.match(/Run: (work-[^\n]+)/)?.[1];
    assert.ok(fixerRunId, `${fixerWork.stdout}${fixerWork.stderr}`);
    const fixerResult = await runCli([
      "work", "result", "0001", "--owner", "opencode-fixer", "--run-id", fixerRunId,
      "--role", "fix", "--status", "completed",
    ], directory);
    assert.equal(fixerResult.exitCode, 0, `${fixerResult.stdout}${fixerResult.stderr}`);
    assert.match(fixerResult.stdout, /Next role: verify/);

    const verification = await runCli(["task", "verify", "0001", "--owner", "codex-owner"], directory);
    assert.equal(verification.exitCode, 0);
    const finalReviewWork = await runCli([
      "work", "0001", "--owner", "codex-reviewer", "--target", "opencode",
    ], directory);
    const finalReviewRunId = finalReviewWork.stdout.match(/Run: (work-[^\n]+)/)?.[1];
    assert.ok(finalReviewRunId);
    const finalReview = await runCli([
      "work", "result", "0001", "--owner", "codex-reviewer", "--run-id", finalReviewRunId,
      "--role", "review", "--status", "completed",
    ], directory);
    assert.equal(finalReview.exitCode, 0);
    const gate = await runCli(["task", "gate", "0001"], directory);
    assert.equal(gate.exitCode, 0, `${gate.stdout}${gate.stderr}`);
    assert.match(gate.stdout, /Gate: pass/);
    const done = await runCli(["done", "0001", "--owner", "codex-owner"], directory);
    assert.equal(done.exitCode, 0);
    assert.match((await runCli(["task", "evidence", "0001"], directory)).stdout, /changes_requested/);
  });
});

test("CLI work explains the lifecycle transition for standalone review findings", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    const task = buildTaskMarkdown("0001", "Standalone Findings", "todo")
      .replace("Risk: low", "Risk: medium");
    const taskPath = join(directory, ".tasks", "0001-standalone-findings.md");
    await writeFile(taskPath, task, "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    for (const id of ["codex-owner", "codex-reviewer", "codex-fixer"]) {
      await runCli(["agent", "register", "--id", id, "--platform", "codex", "--model", "gpt-5"], directory);
    }
    assert.equal((await runCli(["claim", "0001", "--owner", "codex-owner"], directory)).exitCode, 0);
    const prompt = await runCli(["review", "0001", "--reviewer", "codex-reviewer", "--prompt"], directory);
    assert.equal(prompt.exitCode, 0, `${prompt.stdout}${prompt.stderr}`);
    const reviewRunId = prompt.stdout.match(/Review run: (review-[^\n]+)/)?.[1];
    assert.ok(reviewRunId);
    const review = await runCli([
      "review", "0001", "--reviewer", "codex-reviewer", "--review-run", reviewRunId,
      "--result", "changes_requested", "--finding", "Fix the boundary.",
    ], directory);
    assert.equal(review.exitCode, 1);
    assert.match(await readFile(taskPath, "utf8"), /State: doing/);

    const work = await runCli(["work", "0001", "--owner", "codex-fixer", "--target", "codex"], directory);
    assert.equal(work.exitCode, 1);
    assert.match(
      work.stderr + work.stdout,
      /pnpm exec apk review 0001 --owner codex-owner; then retry the fixer worker run/,
    );
    assert.match(await readFile(taskPath, "utf8"), /State: doing/);
  });
});

test("CLI work rejects issued-run collisions without deleting the original session", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-collision.md"), buildTaskMarkdown("0001", "Collision", "todo"), "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await runCli(["agent", "register", "--id", "codex-owner", "--platform", "codex", "--model", "gpt-5"], directory);

    const originalNow = Date.now;
    const originalRandom = Math.random;
    Date.now = () => 1700000000000;
    Math.random = () => 0.123456;
    try {
      const first = await startWork({
        rootDirectory: directory,
        taskId: "0001",
        owner: "codex-owner",
        target: "codex",
        level: "auto",
        role: "implement",
      });
      const packagePath = join(directory, first.packagePath);
      const metadataPath = join(directory, first.metadataPath);
      const originalPackage = await readFile(packagePath, "utf8");
      const originalMetadata = await readFile(metadataPath, "utf8");
      await assert.rejects(
        () => startWork({
          rootDirectory: directory,
          taskId: "0001",
          owner: "codex-owner",
          target: "codex",
          level: "auto",
          role: "implement",
        }),
        /already exists|collision/i,
      );
      assert.equal(await readFile(packagePath, "utf8"), originalPackage);
      assert.equal(await readFile(metadataPath, "utf8"), originalMetadata);
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });
});

test("CLI concurrent worker results append one terminal result", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-concurrent.md"), buildTaskMarkdown("0001", "Concurrent", "todo"), "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await runCli(["agent", "register", "--id", "codex-owner", "--platform", "codex", "--model", "gpt-5"], directory);

    const issued = await runCli(["work", "0001", "--owner", "codex-owner", "--target", "codex", "--json"], directory);
    assert.equal(issued.exitCode, 0, `${issued.stdout}${issued.stderr}`);
    const runId = (JSON.parse(issued.stdout) as { runId: string }).runId;
    const results = await Promise.all([
      runCli([
        "work", "result", "0001", "--owner", "codex-owner", "--run-id", runId,
        "--role", "implement", "--status", "completed",
      ], directory),
      runCli([
        "work", "result", "0001", "--owner", "codex-owner", "--run-id", runId,
        "--role", "implement", "--status", "failed", "--reason", "Concurrent failure.",
      ], directory),
    ]);

    assert.equal(results.filter((result) => /already recorded for run/.test(result.stderr + result.stdout)).length, 1);
    const records = (await readFile(join(directory, ".agentic", "evidence.jsonl"), "utf8"))
      .trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { runId: string });
    assert.equal(records.filter((record) => record.runId === runId).length, 1);
  });
});

test("CLI work never accepts an incomplete issued session", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-incomplete.md"), buildTaskMarkdown("0001", "Incomplete", "doing", "codex-owner"), "utf8");
    await runCli(["agent", "register", "--id", "codex-owner", "--platform", "codex", "--model", "gpt-5"], directory);
    const incomplete = join(directory, ".agentic", "sessions", "work", "0001", "work-incomplete");
    await mkdir(incomplete, { recursive: true });
    await writeFile(join(incomplete, "package.json"), "{}\n", "utf8");

    const result = await runCli([
      "work", "result", "0001", "--owner", "codex-owner", "--run-id", "work-incomplete",
      "--role", "implement", "--status", "completed",
    ], directory);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr + result.stdout, /Issued worker run not found|metadata is malformed|not activated|incomplete/i);
  });
});

test("CLI worker results reject unsafe run ids before filesystem access", async () => {
  await withTempDirectory(async (directory) => {
    const result = await runCli([
      "work", "result", "0001", "--owner", "codex-owner", "--run-id", "../../unsafe",
      "--role", "implement", "--status", "completed",
    ], directory);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr + result.stdout, /compact identifier/);
  });
});

test("CLI review worker rejects an issued candidate after the implementation changes", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    const task = buildTaskMarkdown("0001", "Review Binding", "todo")
      .replace("Risk: low", "Risk: medium")
      .replace("Tags: none", "Tags: worker")
      .replace("- .tasks/0001-task.md", "- src/fix.ts")
      .replace("- pnpm test", "- node -e \"process.exit(0)\"")
      .replace(
        '## Verification commands\n\n- node -e "process.exit(0)"',
        '## Verification\n\n- `{"id":"worker-check","type":"automated","required":true,"environment":"local","profile":"report","command":"node -e \\"process.exit(0)\\"","evidence":"worker result"}`',
      );
    await writeFile(join(directory, ".tasks", "0001-review-binding.md"), task, "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    for (const id of ["codex-owner", "codex-reviewer"]) {
      await runCli(["agent", "register", "--id", id, "--platform", "codex", "--model", "gpt-5"], directory);
    }

    const implementation = await runCli(["work", "0001", "--owner", "codex-owner", "--target", "codex"], directory);
    const implementationRunId = implementation.stdout.match(/Run: (work-[^\n]+)/)?.[1];
    assert.ok(implementationRunId);
    const implementationResult = await runCli([
      "work", "result", "0001", "--owner", "codex-owner", "--run-id", implementationRunId,
      "--role", "implement", "--status", "completed",
    ], directory);
    assert.equal(implementationResult.exitCode, 0);
    assert.equal((await runCli(["task", "verify", "0001", "--owner", "codex-owner"], directory)).exitCode, 0);

    const reviewPackage = await runCli([
      "work", "0001", "--owner", "codex-reviewer", "--target", "opencode", "--role", "review", "--write-session", "--json",
    ], directory);
    assert.equal(reviewPackage.exitCode, 0, `${reviewPackage.stdout}${reviewPackage.stderr}`);
    const reviewPayload = JSON.parse(reviewPackage.stdout);
    const reviewRunId = reviewPayload.runId as string;
    assert.match(reviewRunId, /^work-/);
    assert.equal(reviewPayload.workerPackage.review.reviewRunId, reviewRunId);
    assert.equal(reviewPayload.workerPackage.review.taskId, "0001");
    assert.equal(reviewPayload.workerPackage.review.reviewer, "codex-reviewer");
    assert.equal(reviewPayload.nextRole, "pending review result");
    assert.match(reviewPayload.next[0], /work result 0001/);
    assert.match(reviewPayload.next[1], /After PASS:.*task gate 0001/);
    assert.match(reviewPayload.next[2], /After changes_requested\/fail:.*--role fix/);
    const pendingProvenance = await runCli(["task", "provenance", "0001", "--json"], directory);
    assert.equal(pendingProvenance.exitCode, 0);
    const pendingWorkerRun = (JSON.parse(pendingProvenance.stdout) as {
      workerRuns: Array<{ runId: string; activated: boolean; status: string }>;
    }).workerRuns.find((run) => run.runId === reviewRunId);
    assert.ok(pendingWorkerRun);
    assert.equal(pendingWorkerRun.activated, true);
    assert.equal(pendingWorkerRun.status, "pending");
    assert.match(await readFile(join(directory, reviewPayload.session.prompt), "utf8"), /Review instructions:/);
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "fix.ts"), "export const changedAfterReviewIssue = true;\n", "utf8");
    assert.equal((await runCli(["task", "verify", "0001", "--owner", "codex-owner"], directory)).exitCode, 0);

    const staleResult = await runCli([
      "work", "result", "0001", "--owner", "codex-reviewer", "--run-id", reviewRunId,
      "--role", "review", "--status", "completed", "--json",
    ], directory);
    assert.equal(staleResult.exitCode, 1);
    assert.match(staleResult.stderr + staleResult.stdout, /stale\/mixed-revision|does not match the issued worker review subject/);
    const gate = await runCli(["task", "gate", "0001"], directory);
    assert.equal(gate.exitCode, 1);
    assert.match(gate.stdout, /Missing independent review evidence/);
    assert.doesNotMatch(gate.stdout, /current independent review passed/);
  });
});

test("CLI dogfood starts a reproducible session and records pass or fail", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);

    const start = await runCli([
      "task", "dogfood", "start", "0001",
      "--owner", "codex-a",
      "--tool", "codex",
      "--scenario", "Read the task and report whether the workflow is understandable.",
      "--session", "cli-pass",
      "--started-at", "2026-09-09T10:00:00Z",
    ], directory);
    assert.equal(start.exitCode, 0);
    assert.match(start.stdout, /Protocol: dogfood-v1/);
    assert.match(start.stdout, /Session: cli-pass/);
    const promptMatch = /Prompt: (.+prompt\.md)/.exec(start.stdout);
    assert.ok(promptMatch);
    assert.match(await readFile(join(directory, promptMatch![1]), "utf8"), /Scenario:/);

    const pass = await runCli([
      "task", "dogfood", "result", "0001",
      "--owner", "codex-a",
      "--session", "cli-pass",
      "--outcome", "pass",
      "--ended-at", "2026-09-09T10:00:05Z",
      "--metrics-json", JSON.stringify({ actionCount: 2, contextUnits: 10 }),
    ], directory);
    assert.equal(pass.exitCode, 0, `${pass.stdout}${pass.stderr}`);
    assert.match(pass.stdout, /Outcome: pass/);

    const failStart = await runCli([
      "task", "dogfood", "start", "0001",
      "--owner", "codex-a",
      "--tool", "codex",
      "--scenario", "Repeat the workflow and capture a failure.",
      "--session", "cli-fail",
      "--started-at", "2026-09-09T10:01:00Z",
    ], directory);
    assert.equal(failStart.exitCode, 0);

    const fail = await runCli([
      "task", "dogfood", "result", "0001",
      "--owner", "codex-a",
      "--session", "cli-fail",
      "--outcome", "fail",
      "--ended-at", "2026-09-09T10:01:03Z",
      "--failures", "The handoff was unclear",
      "--issues", "Improve the prompt",
    ], directory);
    assert.equal(fail.exitCode, 1);
    assert.match(fail.stdout, /Outcome: fail/);

    const evidence = await runCli(["task", "evidence", "0001"], directory);
    assert.equal(evidence.exitCode, 0);
    assert.match(evidence.stdout, /dogfood/);
    assert.match(evidence.stdout, /Failures: The handoff was unclear/);
  });
});

test("CLI audit writes reports in a temp repository", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, "src"), { recursive: true });

    const result = await runCli(["audit"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Audit: warnings/);
    assert.match(await readFile(join(directory, "docs/audit-report.md"), "utf8"), /# Audit Report/);
    assert.match(await readFile(join(directory, "docs/project-map.md"), "utf8"), /# Project Map/);
  });
});

test("CLI lint is read-only, supports JSON, and returns drift failures", async () => {
  await withTempDirectory(async (directory) => {
    const init = await runCli(["init"], directory);
    assert.equal(init.exitCode, 0);
    const sync = await runCli(["sync", "--write"], directory);
    assert.equal(sync.exitCode, 0);

    const clean = await runCli(["lint", "--json"], directory);
    assert.equal(clean.exitCode, 0, `${clean.stdout}${clean.stderr}`);
    const parsed = JSON.parse(clean.stdout) as {
      hasErrors: boolean;
      taskCount: number;
      findings: unknown[];
    };
    assert.equal(parsed.hasErrors, false);
    assert.equal(parsed.taskCount, 1);
    assert.deepEqual(parsed.findings, []);

    await writeFile(join(directory, "AGENTS.md"), "stale\n", "utf8");
    const drift = await runCli(["lint"], directory);
    assert.equal(drift.exitCode, 1);
    assert.match(drift.stdout, /generated-file-stale/);
    assert.equal(await readFile(join(directory, "AGENTS.md"), "utf8"), "stale\n");
    assert.equal(
      await readFile(join(directory, "docs", "audit-report.md"), "utf8").catch(() => undefined),
      undefined,
    );
  });
});

test("CLI migrates legacy logs to sharded files", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic/agents.jsonl"),
      `${JSON.stringify({
        id: "codex-a",
        platform: "codex",
        model: "gpt-5.5",
        label: "codex-a",
        created: "2026-05-08T12:00:00Z",
      })}\n`,
      "utf8",
    );
    await writeFile(
      join(directory, ".agentic/runs.jsonl"),
      `${JSON.stringify({
        time: "2026-05-08T12:01:00Z",
        event: "claim",
        task: "0001",
        agent: "codex-a",
        platform: "codex",
        model: "gpt-5.5",
        state: "doing",
        outcome: "ok",
      })}\n`,
      "utf8",
    );

    const result = await runCli(["agent", "migrate-logs", "--remove-legacy"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Agents written: 1/);
    assert.match(
      await readFile(join(directory, ".agentic/agents/codex-a.json"), "utf8"),
      /"developer": "unknown"/,
    );
    assert.match(
      await readFile(join(directory, ".agentic/runs/2026-05-08_unknown_codex-a.jsonl"), "utf8"),
      /"developer":"unknown"/,
    );
  });
});

test("CLI writes analytics summary in a temp repository", async () => {
  await withTempDirectory(async (directory) => {
    const register = await runCli([
      "agent",
      "register",
      "--id",
      "codex-a",
      "--developer",
      "alice",
      "--platform",
      "codex",
      "--model",
      "gpt-5.5",
    ], directory);
    const summary = await runCli(["analytics", "summary", "--month", "2027-05", "--write"], directory);

    assert.equal(register.exitCode, 0);
    assert.equal(summary.exitCode, 0);
    assert.match(summary.stdout, /Wrote docs\/analytics\/agent-summary-2027-05\.md/);
    assert.match(
      await readFile(join(directory, "docs/analytics/agent-summary-2027-05.md"), "utf8"),
      /# Agent Analytics Summary 2027-05/,
    );
  });
});

test("V16: CLI peer cases remain top-level across the sync boundary", async () => {
  const source = await readFile(join(process.cwd(), "src/cli/cli.test.ts"), "utf8");
  const sourceFile = ts.createSourceFile(
    "src/cli/cli.test.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const topLevelTestNames = new Set(sourceFile.statements.flatMap((statement) => {
    if (
      !ts.isExpressionStatement(statement)
      || !ts.isCallExpression(statement.expression)
      || !ts.isIdentifier(statement.expression.expression)
      || statement.expression.expression.text !== "test"
    ) {
      return [];
    }

    const [name] = statement.expression.arguments;
    return name && ts.isStringLiteral(name) ? [name.text] : [];
  }));
  const peerCases = [
    "CLI task deps shows prerequisites and dependents",
    "CLI task deps returns exit code 1 for unknown task",
    "CLI task deps --help shows usage",
    "CLI task verify --help shows usage",
    "CLI task rejects unknown subcommand",
    "CLI task deps shows no prerequisites for independent task",
  ];

  for (const name of peerCases) {
    assert.ok(topLevelTestNames.has(name), `${name} must remain a top-level test declaration`);
  }
});

test("CLI sync checks and writes generated files in a temp repository", async () => {
  await withTempDirectory(async (directory) => {
    const check = await runCli(["sync", "claude"], directory);
    const write = await runCli(["sync", "claude", "--write"], directory);
    const recheck = await runCli(["sync", "claude"], directory);

    assert.equal(check.exitCode, 1);
    assert.match(check.stdout, /Generated files are out of sync/);
    assert.equal(write.exitCode, 0);
    assert.match(write.stdout, /Generated files were updated/);
    assert.equal(recheck.exitCode, 0);
    assert.match(recheck.stdout, /Generated files are in sync/);
    assert.match(await readFile(join(directory, "CLAUDE.md"), "utf8"), /@AGENTS\.md/);
    assert.match(await readFile(join(directory, "AGENTS.md"), "utf8"), /automatically launch a separate read-only reviewer/);
  });
});

test("CLI task deps shows prerequisites and dependents", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-base-task.md"), buildTaskMarkdown("0001", "Base Task", "done", "archive"), "utf8");
    await writeFile(
      join(tasksDir, "0002-target-task.md"),
      buildTaskMarkdown("0002", "Target Task", "todo").replace("Depends on: none", "Depends on: 0001"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0003-child-task.md"),
      buildTaskMarkdown("0003", "Child Task", "todo").replace("Depends on: none", "Depends on: 0002"),
      "utf8",
    );

    const result = await runCli(["task", "deps", "0002"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Task: 0002/);
    assert.match(result.stdout, /Title: Target Task/);
    assert.match(result.stdout, /Prerequisites:/);
    assert.match(result.stdout, /0001/);
    assert.match(result.stdout, /Dependents:/);
    assert.match(result.stdout, /0003/);
  });
});

test("CLI task deps returns exit code 1 for unknown task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });

    const result = await runCli(["task", "deps", "9999"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Task file not found/) || result.stderr.match(/Task file not found/),
      "Expected task not found error",
    );
  });
});

test("CLI task deps --help shows usage", async () => {
  const result = await runCli(["task", "deps", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task deps <task-id>/);
});

test("CLI task verify --help shows usage", async () => {
  const result = await runCli(["task", "verify", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task verify <task-id>/);
  assert.match(result.stdout, /--check-files-only/);
  assert.match(result.stdout, /--profile <profile\|all>/);
  assert.match(result.stdout, /per-check evidence/);
});

test("CLI task rejects unknown subcommand", async () => {
  const result = await runCli(["task", "unknown"]);

  assert.equal(result.exitCode, 1);
  assert.ok(
    result.stdout.match(/Unknown task subcommand/) || result.stderr.match(/Unknown task subcommand/),
    "Expected unknown subcommand error",
  );
});

test("CLI task deps shows no prerequisites for independent task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-standalone-task.md"), buildTaskMarkdown("0001", "Standalone Task", "todo"), "utf8");

    const result = await runCli(["task", "deps", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Prerequisites: none/);
    assert.match(result.stdout, /Dependents: none/);
  });
});

test("CLI task create --help shows usage", async () => {
  const result = await runCli(["task", "create", "--help"]);
  const taskHelp = await runCli(["task", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.equal(taskHelp.exitCode, 0);
    assert.match(taskHelp.stdout, /apk task evidence <task-id>/);
    assert.match(taskHelp.stdout, /apk task lock status/);
    assert.match(taskHelp.stdout, /apk task lock recover/);
  assert.match(taskHelp.stdout, /apk task policy <task-id>/);
  assert.match(taskHelp.stdout, /apk task gate <task-id>/);
  assert.match(taskHelp.stdout, /apk task provenance <task-id>/);
  assert.match(taskHelp.stdout, /apk task dogfood start <task-id>/);
  assert.match(taskHelp.stdout, /apk task dogfood result <task-id>/);
  assert.match(result.stdout, /--title/);
  assert.match(result.stdout, /--goal/);
  assert.match(result.stdout, /--mode/);
  assert.match(result.stdout, /--risk/);
  assert.match(result.stdout, /--verification/);
});

test("CLI task provenance renders bounded human and JSON traces without Git commits", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-provenance-task.md"), buildTaskMarkdown("0001", "Provenance Task", "todo"), "utf8");

    const human = await runCli(["task", "provenance", "0001"], directory);
    const machine = await runCli(["task", "provenance", "0001", "--json"], directory);

    assert.equal(human.exitCode, 0);
    assert.match(human.stdout, /Task: 0001/);
    assert.match(human.stdout, /Baseline: none/);
    assert.match(human.stdout, /Diagnostics:/);
    assert.equal(machine.exitCode, 0);
    const provenance = JSON.parse(machine.stdout) as { taskId: string; commits: unknown[]; diagnostics: string[] };
    assert.equal(provenance.taskId, "0001");
    assert.deepEqual(provenance.commits, []);
    assert.ok(provenance.diagnostics.some((diagnostic) => diagnostic.includes("baseline HEAD")));
  });
});

test("CLI task policy renders effective requirements without mutation", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-policy-task.md"), buildTaskMarkdown("0001", "Policy Task", "todo"), "utf8");

    const result = await runCli(["task", "policy", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Task: 0001/);
    assert.match(result.stdout, /automated verification: required/);
    assert.match(result.stdout, /Legacy compatible: yes/);
    assert.match(result.stdout, /Blockers|Reasons:/);
    assert.match(await readFile(join(tasksDir, "0001-policy-task.md"), "utf8"), /State: todo/);
  });
});

test("CLI task policy --help shows usage", async () => {
  const result = await runCli(["task", "policy", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task policy <task-id>/);
  assert.match(result.stdout, /without changing task state/);
});

test("CLI task gate previews blockers without mutating the task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    const taskPath = join(tasksDir, "0001-gated-task.md");
    await writeFile(taskPath, buildTaskMarkdown("0001", "Gated Task", "doing", "codex-owner"), "utf8");

    const result = await runCli(["task", "gate", "0001"], directory);

    assert.equal(result.exitCode, 1);
    assert.match(result.stdout, /Gate: blocked/);
    assert.match(result.stdout, /missing verification evidence/);
    assert.match(await readFile(taskPath, "utf8"), /State: doing/);
  });
});

test("CLI task gate --help shows usage", async () => {
  const result = await runCli(["task", "gate", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task gate <task-id>/);
  assert.match(result.stdout, /read-only/);
});

test("CLI review supports a separate reviewer prompt and review evidence", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-review-task.md"), buildTaskMarkdown("0001", "Review Task", "todo"), "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");

    for (const [id, developer] of [["codex-owner", "alice"], ["codex-reviewer", "bob"]]) {
      const registered = await runCli([
        "agent", "register", "--id", id, "--developer", developer,
        "--platform", "codex", "--model", "gpt-5",
      ], directory);
      assert.equal(registered.exitCode, 0);
    }
    const claimed = await runCli(["claim", "0001", "--owner", "codex-owner"], directory);
    assert.equal(claimed.exitCode, 0);
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "changed.ts"), "export const changed = true;\n", "utf8");

    const prompt = await runCli(["review", "0001", "--reviewer", "codex-reviewer", "--prompt"], directory);
    assert.equal(prompt.exitCode, 0);
    assert.match(prompt.stdout, /Evaluated HEAD:/);
    assert.match(prompt.stdout, /do not continue implementation work/);
    assert.match(prompt.stdout, /Green tests alone are not correctness proof/);
    const reviewRunId = prompt.stdout.match(/Review run: ([^\n]+)/)?.[1];
    assert.ok(reviewRunId);

    const review = await runCli([
      "review", "0001", "--reviewer", "codex-reviewer", "--review-run", reviewRunId!, "--result", "changes_requested",
      "--finding", "Inspect the failure path.", "--implementation-run", "verify-a",
    ], directory);
    assert.equal(review.exitCode, 1);
    assert.match(review.stdout, /Reviewer: codex-reviewer/);
    assert.match(review.stdout, /Outcome: changes_requested/);
    assert.match(review.stdout, /Inspect the failure path\./);

    const selfReview = await runCli([
      "review", "0001", "--reviewer", "codex-owner", "--review-run", reviewRunId!, "--result", "pass",
    ], directory);
    assert.equal(selfReview.exitCode, 1);
    assert.ok(selfReview.stdout.match(/cannot certify the same task/) || selfReview.stderr.match(/cannot certify the same task/));
  });
});

test("CLI task create writes a valid task file", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "Smoke Test Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli,docs",
      "--risk", "low",
      "--context", "AGENTS.md,docs/task-system.md",
      "--allowed", ".tasks/0001-smoke-test-task.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Created: \.tasks\/0001-smoke-test-task\.md/);

    const content = await readFile(
      join(directory, ".tasks", "0001-smoke-test-task.md"),
      "utf8",
    );
    assert.match(content, /# Task 0001 - Smoke Test Task/);
    assert.match(content, /State: todo/);
    assert.match(content, /Owner: none/);
    assert.match(content, /Scope: cli,docs/);
    assert.match(content, /Risk: low/);
  });
});

test("CLI task create writes structured verification from JSON", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const verification = JSON.stringify([{
      id: "release-smoke",
      type: "manual",
      required: true,
      environment: "live",
      profile: "trusted",
      instruction: "Check the deployed release.",
      evidence: "release URL",
    }]);
    const result = await runCli([
      "task", "create",
      "--title", "Structured Verification Task",
      "--mode", "mvp",
      "--lane", "release",
      "--scope", "release",
      "--risk", "medium",
      "--context", "AGENTS.md",
      "--allowed", "docs/release.md",
      "--verification-json", verification,
      "--assumptions", "Release metadata is complete",
      "--invariants", "Every release has one immutable identifier",
      "--required-evidence", "release URL",
      "--review-questions", "Can rollback happen halfway through deploy?",
      "--counterexample-searches", "Search partial deployment paths",
    ], directory);

    assert.equal(result.exitCode, 0);
    const content = await readFile(join(directory, ".tasks", "0001-structured-verification-task.md"), "utf8");
    assert.match(content, /## Verification/);
    assert.match(content, /"environment":"live"/);
    assert.match(content, /"instruction":"Check the deployed release\."/);
    assert.match(content, /## Correctness assumptions/);
    assert.match(content, /## Counterexample searches/);
    assert.doesNotMatch(content, /## Verification commands/);
  });
});

test("CLI task evidence lists records for one task", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "evidence.jsonl"),
      `${JSON.stringify({
        id: "evidence-a",
        taskId: "0001",
        runId: "run-a",
        agent: "codex-a",
        type: "automated-test",
        result: "pass",
        time: "2026-09-09T10:00:00Z",
        subject: {
          taskId: "0001",
          runId: "run-a",
          repository: "none",
          baselineId: "base-a",
          candidateId: "candidate-a",
          worktreeId: "worktree-a",
        },
        checkId: "unit-tests",
        profile: "deterministic",
        command: "pnpm test",
      })}\n`,
      "utf8",
    );

    const result = await runCli(["task", "evidence", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Task: 0001/);
    assert.match(result.stdout, /Evidence: 1/);
    assert.match(result.stdout, /pass automated-test agent=codex-a check=unit-tests profile=deterministic/);
  });
});

test("CLI task verify --record stores operator manual evidence and unblocks the gate", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    const verification = JSON.stringify([
      {
        id: "unit",
        type: "automated",
        required: true,
        environment: "local",
        profile: "deterministic",
        command: 'node -e "process.exit(0)"',
      },
      {
        id: "live-smoke",
        type: "manual",
        required: true,
        environment: "live",
        profile: "trusted",
        instruction: "Check the hosted run.",
        evidence: "CI run URL/status/SHA",
      },
    ]);
    const created = await runCli([
      "task", "create",
      "--title", "Record Manual Evidence Smoke",
      "--mode", "mvp",
      "--lane", "verification",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", ".tasks/0001-record-manual-evidence-smoke.md",
      "--verification-json", verification,
    ], directory);
    assert.equal(created.exitCode, 0, created.stderr);
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);
    await runCli(["claim", "0001", "--owner", "codex-a"], directory);

    const automatedOnly = await runCli(["task", "verify", "0001", "--owner", "codex-a"], directory);
    assert.equal(automatedOnly.exitCode, 1);
    assert.match(automatedOnly.stdout, /unavailable live-smoke/);

    const rejected = await runCli([
      "task", "verify", "0001", "--record", "--owner", "codex-a",
      "--check", "unit", "--result", "pass", "--evidence", "reference",
    ], directory);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /automated/);

    const recorded = await runCli([
      "task", "verify", "0001", "--record", "--owner", "codex-a",
      "--check", "live-smoke", "--result", "pass",
      "--evidence", "https://ci.example.test/runs/7 status=success",
    ], directory);
    assert.equal(recorded.exitCode, 0, recorded.stderr);
    assert.match(recorded.stdout, /Result: pass/);

    const gate = await runCli(["task", "gate", "0001"], directory);
    assert.equal(gate.exitCode, 0, gate.stdout);
    assert.match(gate.stdout, /Gate: pass/);
  });
});

test("CLI task verify rejects record-only flags without --record", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(
      join(directory, ".tasks", "0001-task.md"),
      buildTaskMarkdown("0001", "Task", "todo"),
      "utf8",
    );
    const result = await runCli([
      "task", "verify", "0001", "--check", "unit", "--result", "pass",
    ], directory);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Unknown option: --check/);
  });
});

test("CLI task create reports malformed structured verification", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCli([
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

    const result = await runCli([
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

    const result = await runCli([
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

    const result = await runCli([
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
    assert.match(content, /"command":"pnpm lint"/);
    assert.match(content, /"command":"pnpm test"/);
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

      const result = await runCli([
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

    const result = await runCli([
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
  const result = await runCli([
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
    const result = await runCli([
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

test("CLI agent register rejects flag values that are missing", async () => {
  await withTempDirectory(async (directory) => {
    const result = await runCli([
      "agent", "register",
      "--id", "--platform", "codex",
      "--model", "gpt",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--id requires a value/) || result.stderr.match(/--id requires a value/),
      "Expected missing value error",
    );
  });
});

test("CLI analytics summary rejects missing month value", async () => {
  const result = await runCli(["analytics", "summary", "--month", "--write"]);

  assert.equal(result.exitCode, 1);
  assert.ok(
    result.stdout.match(/--month requires a value/) || result.stderr.match(/--month requires a value/),
    "Expected missing value error",
  );
});

test("CLI task create rejects missing title", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
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

    const result = await runCli([
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

    const result = await runCli([
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

    const result = await runCli([
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

    await runCli([
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

    const result = await runCli([
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

test("CLI task archive moves a done task to archive", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Archived: 0001 -> .tasks\/archive\/0001-done-task\.md/);
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "archive", "0001-done-task.md")),
    );
    assert.rejects(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
      /ENOENT/,
    );
  });
});

test("CLI task archive refuses non-done task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-todo-task.md"),
      buildTaskMarkdown("0001", "Todo Task", "todo"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "0001"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/only done tasks can be archived/) || result.stderr.match(/only done tasks can be archived/),
      "Expected non-done refusal error",
    );
  });
});

test("CLI task archive --all moves all done tasks", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-one.md"),
      buildTaskMarkdown("0001", "Done One", "done", "archive"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0002-done-two.md"),
      buildTaskMarkdown("0002", "Done Two", "done", "archive"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0003-todo-task.md"),
      buildTaskMarkdown("0003", "Todo Task", "todo"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "--all"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Archived: 0001/);
    assert.match(result.stdout, /Archived: 0002/);
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0003-todo-task.md")),
    );
  });
});

test("CLI task archive --help shows usage", async () => {
  const result = await runCli(["task", "archive", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task archive \[<task-id>\]/);
  assert.match(result.stdout, /archive/);
});

test("CLI task archive reports error for missing task id", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });

    const result = await runCli(["task", "archive", "9999"], directory);

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

    await runCli(["task", "archive", "0001"], directory);

    const result = await runCli(["tasks"], directory);

    assert.equal(result.exitCode, 0);
    assert.doesNotMatch(result.stdout, /0001/);
    assert.match(result.stdout, /0002/);
  });
});

// Regression tests for task 0046 review findings

test("CLI task archive rejects unknown flags before moving task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "0001", "--unknown"], directory);

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

    const result = await runCli(["task", "archive", "--all", "--unknown"], directory);

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

    const result = await runCli(["task", "archive", "--all", "0001"], directory);

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

    const defaultResult = await runCli(["tasks"], directory);
    assert.equal(defaultResult.exitCode, 0);
    assert.doesNotMatch(defaultResult.stdout, /0001/, "Default view should exclude archived tasks");
    assert.match(defaultResult.stdout, /0002/, "Default view should include active tasks");

    const allResult = await runCli(["tasks", "--all"], directory);
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

    const result = await runCli([
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

    const result = await runCli([
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

test("CLI task deps works for archived task without stack trace", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(join(tasksDir, "archive"), { recursive: true });
    await writeFile(
      join(tasksDir, "archive", "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "deps", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Task: 0001/, "Should show archived task deps");
    assert.doesNotMatch(result.stderr, /Error:/, "Should not have stack trace in stderr");
    assert.doesNotMatch(result.stdout, /at\s+\S+:\d+:\d+/, "Should not have stack trace in stdout");
  });
});

test("CLI task archive --all refuses archive path collisions", async () => {
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

    const result = await runCli(["task", "archive", "--all"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Archive path already exists/) || result.stderr.match(/Archive path already exists/),
      "Expected archive collision error",
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
      "Source task should not be moved",
    );
  });
});
