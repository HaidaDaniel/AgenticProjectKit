import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { parseAgenticConfigJson } from "../config/index.js";
import { parseTaskMarkdown } from "../tasks/index.js";
import { getInitStarterFiles, initProject } from "./index.js";

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-init-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("initProject creates starter kit files", async () => {
  await withTempDirectory(async (directory) => {
    const result = await initProject(directory);

    assert.deepEqual(
      result.created,
      getInitStarterFiles().map((file) => file.path),
    );
    assert.deepEqual(result.skipped, []);

    const configText = await readFile(
      join(directory, ".agentic/config.json"),
      "utf8",
    );

    assert.equal(parseAgenticConfigJson(configText).agentStyle, "caveman");
    assert.equal(
      await readFile(join(directory, "docs/project.md"), "utf8"),
      "# Project\n\nDescribe the project, users, goals, and durable context here.\n",
    );

    const task = parseTaskMarkdown(
      await readFile(join(directory, ".tasks/0001-start.md"), "utf8"),
    );
    assert.equal(task.id, "0001");
    assert.deepEqual(task.forbiddenFiles, ["application source files"]);
  });
});

test("initProject does not overwrite existing files", async () => {
  await withTempDirectory(async (directory) => {
    const projectDocPath = join(directory, "docs/project.md");
    await mkdir(join(directory, "docs"), { recursive: true });
    await writeFile(projectDocPath, "custom project doc\n", "utf8");

    const result = await initProject(directory);

    assert.ok(result.skipped.includes("docs/project.md"));
    assert.equal(await readFile(projectDocPath, "utf8"), "custom project doc\n");
    assert.ok(result.created.includes(".agentic/config.json"));
  });
});
