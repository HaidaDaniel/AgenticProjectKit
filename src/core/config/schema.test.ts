import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigValidationError,
  DEFAULT_CONFIG,
  parseAgenticConfig,
  parseAgenticConfigJson,
  serializeAgenticConfig,
} from "./index.js";

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
