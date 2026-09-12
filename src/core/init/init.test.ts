import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import { promisify } from "node:util";

import { parseAgenticConfigJson } from "../config/index.js";
import { parseTaskMarkdown } from "../tasks/index.js";
import {
  APK_OPERATIONAL_IGNORE_ENTRIES,
  detectTrackedApkOperationalPaths,
  getInitStarterFiles,
  initProject,
  renderApkGitignoreUpdate,
} from "./index.js";

const execFileAsync = promisify(execFile);

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-init-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

test("initProject creates starter kit files", async () => {
  await withTempDirectory(async (directory) => {
    const result = await initProject(directory);

    assert.deepEqual(
      result.created,
      [...getInitStarterFiles().map((file) => file.path), ".gitignore"],
    );
    assert.deepEqual(result.skipped, []);

    const configText = await readFile(
      join(directory, ".agentic/config.json"),
      "utf8",
    );

    assert.equal(parseAgenticConfigJson(configText).agentStyle, "caveman");
    assert.equal(parseAgenticConfigJson(configText).schemaVersion, 2);
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

test("renderApkGitignoreUpdate is additive, byte-preserving, and idempotent", () => {
  const existing = "node_modules/\ncustom-tool/\n";
  const first = renderApkGitignoreUpdate(existing);

  assert.equal(first.changed, true);
  assert.ok(first.content.startsWith(existing));
  assert.ok(first.added.includes(".tasks/.apk.lock"));
  assert.ok(first.added.includes(".apk-workspaces/"));

  const second = renderApkGitignoreUpdate(first.content);
  assert.equal(second.changed, false);
  assert.deepEqual(second.added, []);
  assert.equal(second.content, first.content);
});

test("renderApkGitignoreUpdate handles missing trailing newline and CRLF", () => {
  const noNewline = renderApkGitignoreUpdate("custom");
  assert.ok(noNewline.content.startsWith("custom\n"));
  assert.ok(noNewline.content.includes(".apk-workspaces/"));

  const crlf = renderApkGitignoreUpdate("custom\r\n");
  assert.ok(crlf.content.startsWith("custom\r\n"));
  assert.ok(crlf.content.includes(".apk-workspaces/\r\n"));
  assert.equal(/[^\r]\n/.test(crlf.content), false, "appended entries must keep CRLF endings");
});

test("renderApkGitignoreUpdate preserves already-present APK entries and never emits .apk-worktrees", () => {
  const existing = "node_modules/\n.apk-workspaces/\n.agentic/runs/*\n";
  const update = renderApkGitignoreUpdate(existing);

  assert.ok(!update.added.includes(".apk-workspaces/"));
  assert.ok(!update.added.includes(".agentic/runs/*"));
  assert.deepEqual(update.skippedEntries.filter((entry) => entry === ".apk-workspaces/"), [".apk-workspaces/"]);
  assert.ok(update.added.includes(".agentic/evidence.jsonl"));
  assert.ok(!update.content.includes(".apk-worktrees/"));
  assert.ok(APK_OPERATIONAL_IGNORE_ENTRIES.every((entry) => !entry.includes(".apk-worktrees")));
});

test("initProject creates the canonical ignore block idempotently", async () => {
  await withTempDirectory(async (directory) => {
    const first = await initProject(directory);
    const gitignore = await readFile(join(directory, ".gitignore"), "utf8");
    for (const entry of APK_OPERATIONAL_IGNORE_ENTRIES) {
      assert.ok(gitignore.split("\n").includes(entry), `missing ${entry}`);
    }
    assert.equal(gitignore.includes(".apk-worktrees/"), false);
    assert.equal(first.gitignore.action, "created");

    const second = await initProject(directory);
    assert.equal(second.gitignore.action, "unchanged");
    assert.equal(second.created.includes(".gitignore"), false);
    assert.equal(await readFile(join(directory, ".gitignore"), "utf8"), gitignore);
  });
});

test("initProject preserves custom .gitignore content while adding APK entries", async () => {
  await withTempDirectory(async (directory) => {
    const custom = "# keep me\nnode_modules/\n.env\n";
    await writeFile(join(directory, ".gitignore"), custom, "utf8");

    const result = await initProject(directory);
    const gitignore = await readFile(join(directory, ".gitignore"), "utf8");

    assert.equal(result.gitignore.action, "updated");
    assert.ok(gitignore.startsWith(custom));
    assert.ok(gitignore.includes(".apk-workspaces/"));
    assert.ok(result.updated.includes(".gitignore"));
  });
});

test("initProject surfaces tracked APK operational state without mutating the index", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".agentic", "runs"), { recursive: true });
    await writeFile(join(directory, ".agentic", "runs", "foo.jsonl"), "{}\n", "utf8");
    await git("add", ".agentic/runs/foo.jsonl");
    await git("commit", "--quiet", "-m", "track runtime state");

    const tracked = await detectTrackedApkOperationalPaths(directory);
    assert.deepEqual(tracked, [".agentic/runs/foo.jsonl"]);

    const result = await initProject(directory);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.includes(".agentic/runs/foo.jsonl")));

    const { stdout } = await execFileAsync("git", ["ls-files", ".agentic/runs/foo.jsonl"], { cwd: directory });
    assert.equal(stdout.trim(), ".agentic/runs/foo.jsonl");
    assert.equal(await readFile(join(directory, ".agentic", "runs", "foo.jsonl"), "utf8"), "{}\n");
  });
});

test("detectTrackedApkOperationalPaths keeps intentional .gitkeep files out of the diagnostic", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".agentic", "agents"), { recursive: true });
    await mkdir(join(directory, ".agentic", "runs"), { recursive: true });
    await writeFile(join(directory, ".agentic", "agents", ".gitkeep"), "", "utf8");
    await writeFile(join(directory, ".agentic", "runs", ".gitkeep"), "", "utf8");
    await git("add", ".agentic");
    await git("commit", "--quiet", "-m", "keep");

    assert.deepEqual(await detectTrackedApkOperationalPaths(directory), []);
  });
});
