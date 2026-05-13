import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { writeAllAgentExports } from "../exporters/index.js";
import { syncAgentExports } from "./index.js";

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-sync-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("syncAgentExports passes when generated files are current", async () => {
  await withTempDirectory(async (directory) => {
    await writeAllAgentExports(directory);

    const result = await syncAgentExports(directory);

    assert.equal(result.hasDrift, false);
    assert.equal(result.checked.length, 9);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.stale, []);
  });
});

test("syncAgentExports reports stale files without writing by default", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "AGENTS.md"), "stale\n", "utf8");

    const result = await syncAgentExports(directory, { target: "agents" });

    assert.equal(result.hasDrift, true);
    assert.deepEqual(result.stale, ["AGENTS.md"]);
    assert.deepEqual(result.written, []);
    assert.equal(await readFile(join(directory, "AGENTS.md"), "utf8"), "stale\n");
  });
});

test("syncAgentExports writes missing and stale target files when requested", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".codex"), { recursive: true });
    await writeFile(join(directory, ".codex/instructions.md"), "stale\n", "utf8");

    const writeResult = await syncAgentExports(directory, {
      target: "codex",
      write: true,
    });
    const checkResult = await syncAgentExports(directory, { target: "codex" });

    assert.deepEqual(writeResult.stale, [".codex/instructions.md"]);
    assert.deepEqual(writeResult.written, [".codex/instructions.md"]);
    assert.equal(checkResult.hasDrift, false);
    assert.match(
      await readFile(join(directory, ".codex/instructions.md"), "utf8"),
      /# Codex Instructions/,
    );
  });
});

test("syncAgentExports supports every export target", async () => {
  await withTempDirectory(async (directory) => {
    assert.equal((await syncAgentExports(directory, { target: "agents" })).checked.length, 1);
    assert.equal((await syncAgentExports(directory, { target: "claude" })).checked.length, 1);
    assert.equal((await syncAgentExports(directory, { target: "codex" })).checked.length, 1);
    assert.equal((await syncAgentExports(directory, { target: "gemini" })).checked.length, 1);
    assert.equal((await syncAgentExports(directory, { target: "opencode" })).checked.length, 1);
    assert.equal((await syncAgentExports(directory, { target: "cursor" })).checked.length, 4);
  });
});
