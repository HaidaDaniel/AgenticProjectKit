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
