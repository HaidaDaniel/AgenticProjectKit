import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigValidationError,
  DEFAULT_CONFIG,
  parseAgenticConfig,
  parseAgenticConfigJson,
  readAgenticConfigFile,
  serializeAgenticConfig,
} from "./index.js";
import { detectResourceInventory } from "../resources/detect.js";
import {
  applyExecutionCalibration,
  buildCalibrationPackage,
  validateCalibrationRecommendation,
} from "../execution/calibrate.js";

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-calibrate-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

const CALIBRATION_CONFIG = {
  schemaVersion: 2,
  resources: {
    models: [{ id: "local-model", roles: ["implement"] }],
    harnesses: [{ id: "opencode", workerProtocols: ["apk-worker-v1"] }],
    workers: [{
      id: "local-worker",
      modelId: "local-model",
      harnessId: "opencode",
      location: "local",
      billingMode: "free",
      costClass: "local-free",
      availability: "available",
      capacity: 1,
      capabilities: { roles: ["implement"], workerProtocols: ["apk-worker-v1"] },
    }],
  },
};

async function writeCalibrationRepo(directory: string, extra: Record<string, unknown> = {}): Promise<void> {
  await mkdir(join(directory, ".agentic"), { recursive: true });
  await writeFile(
    join(directory, ".agentic", "config.json"),
    JSON.stringify({ ...CALIBRATION_CONFIG, ...extra }),
    "utf8",
  );
}

test("parseAgenticConfig returns defaults for empty config", () => {
  const config = parseAgenticConfig({});

  assert.deepEqual(config, DEFAULT_CONFIG);
  assert.notStrictEqual(config, DEFAULT_CONFIG);
});

test("parseAgenticConfig accepts explicit overrides", () => {
  const config = parseAgenticConfig({
    projectName: "Docs First",
    defaultMode: "production",
    documentationProfile: "standard",
    agentStyle: "normal",
    taskDirectory: "work/tasks",
    docsDirectory: "knowledge",
  });

  assert.deepEqual(config, {
    projectName: "Docs First",
    defaultMode: "production",
    documentationProfile: "standard",
    agentStyle: "normal",
    taskDirectory: "work/tasks",
    docsDirectory: "knowledge",
  });
});

test("parseAgenticConfig reports useful validation errors", () => {
  assert.throws(
    () =>
      parseAgenticConfig({
        projectName: "",
        defaultMode: "legacy",
        documentationProfile: "brief",
        agentStyle: "robot",
        taskDirectory: "",
        docsDirectory: 123,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigValidationError);
      assert.deepEqual(error.issues, [
        "projectName must be a non-empty string.",
        "defaultMode must be one of: discovery, mvp, product, production, maintenance, audit, adopt.",
        "documentationProfile must be one of: minimal, standard, production.",
        "agentStyle must be one of: caveman, normal.",
        "taskDirectory must be a non-empty string.",
        "docsDirectory must be a non-empty string.",
      ]);
      return true;
    },
  );
});

test("parseAgenticConfigJson parses and serializeAgenticConfig emits stable JSON", () => {
  const config = parseAgenticConfigJson(
    "{\"projectName\":\"Kit\",\"agentStyle\":\"normal\"}",
  );

  assert.deepEqual(config, {
    projectName: "Kit",
    defaultMode: "mvp",
    documentationProfile: "minimal",
    agentStyle: "normal",
    taskDirectory: ".tasks",
    docsDirectory: "docs",
  });

  assert.equal(
    serializeAgenticConfig(config),
    [
      "{",
      '  "projectName": "Kit",',
      '  "defaultMode": "mvp",',
      '  "documentationProfile": "minimal",',
      '  "agentStyle": "normal",',
      '  "taskDirectory": ".tasks",',
      '  "docsDirectory": "docs"',
      "}",
      "",
    ].join("\n"),
  );
});

test("config schema markers distinguish legacy and gated formats without rewriting legacy input", () => {
  assert.equal(parseAgenticConfig({ schemaVersion: 1 }).schemaVersion, 1);
  assert.equal(parseAgenticConfig({ schemaVersion: 2 }).schemaVersion, 2);
  assert.throws(
    () => parseAgenticConfig({ schemaVersion: 99 }),
    /schemaVersion must be one of: 1, 2/,
  );
});

test("parseAgenticConfig keeps execution profile separate from project mode", () => {
  const config = parseAgenticConfig({
    defaultMode: "production",
    executionProfile: "balanced",
    executionOverrides: {
      resourceId: "frontier-a",
      preferCostClass: "scarce-frontier",
      allowProfileBypass: true,
    },
  });

  assert.equal(config.defaultMode, "production");
  assert.equal(config.executionProfile, "balanced");
  assert.deepEqual(config.executionOverrides, {
    resourceId: "frontier-a",
    preferCostClass: "scarce-frontier",
    allowProfileBypass: true,
  });
});

test("parseAgenticConfig normalizes an optional vendor-neutral resource registry", () => {
  const config = parseAgenticConfig({
    schemaVersion: 2,
    resources: {
      models: [
        { id: "local-model", family: "27b-q4", roles: ["implement"], contextLimit: 32768 },
      ],
      harnesses: [
        { id: "opencode", workerProtocols: ["apk-worker-v1"], workspaceModes: ["single-worktree"] },
      ],
      workers: [
        {
          id: "local-worker",
          modelId: "local-model",
          harnessId: "opencode",
          location: "local",
          billingMode: "free",
          costClass: "local-free",
          availability: "available",
          capacity: 1,
          capabilities: { roles: ["implement"], workerProtocols: ["apk-worker-v1"] },
        },
      ],
    },
  });

  assert.equal(config.schemaVersion, 2);
  assert.equal(config.resources?.workers[0]?.id, "local-worker");
  assert.equal(config.resources?.workers[0]?.occupied, 0);
  assert.equal(parseAgenticConfig({}).resources, undefined);
});

test("resource registry rejects duplicates, dangling references, invalid capacity, and secrets", () => {
  assert.throws(
    () => parseAgenticConfig({
      resources: {
        models: [{ id: "same", roles: [] }, { id: "same", roles: [] }],
        harnesses: [{ id: "harness", workerProtocols: ["apk-worker-v1"] }],
        workers: [{
          id: "worker",
          modelId: "missing",
          harnessId: "harness",
          capacity: 0,
          apiKey: "never-store-me",
        }],
      },
    }),
    /duplicate id|missing model|capacity|apiKey/,
  );
});

test("parseAgenticConfig accepts an explicit vendor-neutral quality policy", () => {
  const config = parseAgenticConfig({
    quality: {
      required: ["tests", "typecheck"],
      recommended: ["ci", "tests", "coverage"],
    },
  });

  assert.deepEqual(config.quality, {
    required: ["tests", "typecheck"],
    recommended: ["ci", "coverage"],
  });
});

test("parseAgenticConfig rejects unknown quality capability IDs", () => {
  assert.throws(
    () => parseAgenticConfig({ quality: { required: ["eslint"] } }),
    /unknown capability ID: eslint/,
  );
});

test("parseAgenticConfig accepts an optional generated execution calibration", () => {
  const config = parseAgenticConfig({
    executionCalibration: {
      profile: "balanced",
      inventoryFingerprint: "abc123",
      generatedAt: "2026-01-01T00:00:00Z",
      planner: "codex",
      routes: { implementation: "local-worker" },
    },
  });
  assert.equal(config.executionCalibration?.profile, "balanced");
  assert.equal(config.executionCalibration?.inventoryFingerprint, "abc123");
  assert.deepEqual(config.executionCalibration?.routes, { implementation: "local-worker" });
  assert.throws(
    () => parseAgenticConfig({
      executionCalibration: {
        profile: "nope",
        inventoryFingerprint: "abc",
        generatedAt: "x",
        planner: "p",
        routes: {},
      },
    }),
    /executionProfile must be one of/,
  );
});

test("detectResourceInventory is deterministic, marker-aware, and secret-free", async () => {
  await withTempDirectory(async (directory) => {
    await writeCalibrationRepo(directory);
    await writeFile(join(directory, "CLAUDE.md"), "@AGENTS.md\n", "utf8");

    const first = await detectResourceInventory(directory);
    const second = await detectResourceInventory(directory);

    assert.equal(first.fingerprint, second.fingerprint);
    assert.ok(first.resources.some((resource) => (
      resource.id === "local-worker" && resource.kind === "worker" && resource.available === true
    )));
    assert.ok(first.resources.some((resource) => (
      resource.id === "claude" && resource.kind === "harness" && resource.availability === "detected"
    )));
    assert.doesNotMatch(JSON.stringify(first), /apiKey|secret|password|credential/i);
  });
});

test("validateCalibrationRecommendation rejects unknown, secret-shaped, and malformed input", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    const worker = (id: string, overrides: Record<string, unknown> = {}) => ({
      id,
      modelId: "local-model",
      harnessId: "opencode",
      location: "local",
      billingMode: "free",
      costClass: "local-free",
      availability: "available",
      capacity: 1,
      occupied: 0,
      capabilities: { roles: ["implementation"], workerProtocols: ["apk-worker-v1"] },
      ...overrides,
    });
    await writeFile(join(directory, ".agentic/config.json"), JSON.stringify({
      schemaVersion: 2,
      resources: {
        models: [{ id: "local-model", roles: ["implementation"] }],
        harnesses: [{ id: "opencode", workerProtocols: ["apk-worker-v1"] }],
        workers: [
          worker("local-worker"),
          worker("busy-worker", { occupied: 1 }),
          worker("remote-worker", { location: "remote" }),
          worker("planner-worker", {
            costClass: "scarce-frontier",
            capabilities: { roles: ["planning"], workerProtocols: ["apk-worker-v1"] },
          }),
        ],
      },
    }), "utf8");
    const inventory = await detectResourceInventory(directory);
    const pkg = buildCalibrationPackage(inventory);
    assert.equal(pkg.protocol, "apk-calibration-v1");
    assert.equal(pkg.workerProtocol, "apk-worker-v1");
    assert.equal(pkg.recommendedPlanningWorker, "planner-worker");
    assert.ok(pkg.resources.some((resource) => resource.id === "local-worker"));

    const good = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "local-worker", review: "needs-human" },
      planner: "codex",
    }, inventory);
    assert.equal(good.ok, true, good.issues.join("; "));
    assert.equal(good.recommendation?.routes.implementation, "local-worker");

    const unknown = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "ghost-worker" },
      planner: "codex",
    }, inventory);
    assert.equal(unknown.ok, false);
    assert.ok(unknown.issues.some((issue) => /unknown worker/.test(issue)));

    const secret = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "api-key-123" },
      planner: "codex",
    }, inventory);
    assert.equal(secret.ok, false);

    const badProfile = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "nope",
      routes: {},
      planner: "codex",
    }, inventory);
    assert.equal(badProfile.ok, false);

    const badProtocol = validateCalibrationRecommendation({
      protocol: "other",
      profile: "constrained",
      routes: {},
      planner: "codex",
    }, inventory);
    assert.equal(badProtocol.ok, false);

    const busy = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "busy-worker" },
      planner: "codex",
    }, inventory);
    assert.equal(busy.ok, false);
    assert.ok(busy.issues.some((issue) => /capacity\/availability/.test(issue)));

    const wrongCapability = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { review: "local-worker" },
      planner: "codex",
    }, inventory);
    assert.equal(wrongCapability.ok, false);
    assert.ok(wrongCapability.issues.some((issue) => /role capability/.test(issue)));

    const localToRemote = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "local",
      routes: { implementation: "remote-worker" },
      planner: "codex",
    }, inventory);
    assert.equal(localToRemote.ok, false);
    assert.ok(localToRemote.issues.some((issue) => /local profile to a remote worker/.test(issue)));

    const unsafeDowngrade = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: {},
      assuranceMinimum: "none",
      planner: "codex",
    }, inventory);
    assert.equal(unsafeDowngrade.ok, false);
    assert.ok(unsafeDowngrade.issues.some((issue) => /unsafe downgrade/.test(issue)));

    const invalidBudget = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: {},
      budget: { maxReviewPasses: 0 },
      planner: "codex",
    }, inventory);
    assert.equal(invalidBudget.ok, false);
    assert.ok(invalidBudget.issues.some((issue) => /at least 1/.test(issue)));

    const withBudgetAndFloor = validateCalibrationRecommendation({
      protocol: "apk-calibration-v1-result",
      profile: "constrained",
      routes: { implementation: "local-worker" },
      assuranceMinimum: "fresh-context",
      budget: { maxReviewPasses: 2, maxFrontierRuns: 1 },
      planner: "codex",
    }, inventory);
    assert.equal(withBudgetAndFloor.ok, true, withBudgetAndFloor.issues.join("; "));
  });
});

test("applyExecutionCalibration preserves user overrides and is idempotent", async () => {
  await withTempDirectory(async (directory) => {
    await writeCalibrationRepo(directory, {
      executionOverrides: { resourceId: "local-worker", allowProfileBypass: true },
    });
    const inventory = await detectResourceInventory(directory);
    const recommendation = {
      protocol: "apk-calibration-v1-result" as const,
      profile: "constrained" as const,
      routes: { implementation: "local-worker" },
      planner: "codex",
    };

    const first = await applyExecutionCalibration(directory, recommendation, inventory);
    assert.equal(first.written, true);
    const reread = await readAgenticConfigFile(directory);
    assert.equal(reread.executionOverrides?.resourceId, "local-worker");
    assert.equal(reread.executionOverrides?.allowProfileBypass, true);
    assert.equal(reread.executionCalibration?.inventoryFingerprint, inventory.fingerprint);
    assert.equal(reread.resources?.workers[0]?.id, "local-worker");

    const second = await applyExecutionCalibration(directory, recommendation, inventory);
    assert.equal(second.written, false);
  });
});
