import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIG_PATH,
  writeAgenticConfigFile,
} from "../config/index.js";
import {
  getProjectMode,
  ModeValidationError,
  setProjectMode,
} from "./index.js";

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-mode-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("getProjectMode returns default mode when config is missing", async () => {
  await withTempDirectory(async (directory) => {
    assert.equal(await getProjectMode(directory), "mvp");
  });
});

test("setProjectMode writes config and preserves existing fields", async () => {
  await withTempDirectory(async (directory) => {
    await writeAgenticConfigFile(directory, {
      projectName: "Adopted Repo",
      defaultMode: "adopt",
      documentationProfile: "standard",
      agentStyle: "normal",
      taskDirectory: "work/tasks",
      docsDirectory: "knowledge",
    });

    assert.equal(await setProjectMode(directory, "production"), "production");

    assert.equal(
      await readFile(join(directory, CONFIG_PATH), "utf8"),
      [
        "{",
        '  "projectName": "Adopted Repo",',
        '  "defaultMode": "production",',
        '  "documentationProfile": "standard",',
        '  "agentStyle": "normal",',
        '  "taskDirectory": "work/tasks",',
        '  "docsDirectory": "knowledge"',
        "}",
        "",
      ].join("\n"),
    );
  });
});

test("setProjectMode rejects invalid modes", async () => {
  await withTempDirectory(async (directory) => {
    await assert.rejects(
      () => setProjectMode(directory, "legacy"),
      (error: unknown) => {
        assert.ok(error instanceof ModeValidationError);
        assert.equal(
          error.message,
          "Invalid mode: legacy. Expected one of: discovery, mvp, product, production, maintenance, audit, adopt.",
        );
        return true;
      },
    );
  });
});
