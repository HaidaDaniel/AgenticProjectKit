import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
  inspectApkGitignore,
  inspectTrackedApkOperationalArtifacts,
  renderTrackedApkOperationalReport,
  TRACKED_OPERATIONAL_LIMITS,
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
    const taskGuide = await readFile(join(directory, "docs/task-system.md"), "utf8");
    assert.match(taskGuide, /non-overlapping final verification set/);
    assert.match(taskGuide, /Documentation-only tasks/);
    assert.match(taskGuide, /stale, failed, missing, or insufficient/);

    const configText = await readFile(
      join(directory, ".agentic/config.json"),
      "utf8",
    );

    assert.equal(parseAgenticConfigJson(configText).agentStyle, "normal");
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

test("initProject uses a generic requirements starter separate from APK requirements", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);

    const initializedRequirements = await readFile(
      join(directory, "docs/product/requirements.md"),
      "utf8",
    );
    const starterTemplate = await readFile(
      join(
        process.cwd(),
        "src/core/templates/minimal-docs/product-requirements.md.hbs",
      ),
      "utf8",
    );
    const apkRequirements = await readFile(
      join(process.cwd(), "docs/product/requirements.md"),
      "utf8",
    );

    assert.equal(
      starterTemplate,
      [
        "# Product Requirements",
        "",
        "## Users",
        "",
        "- Describe target users here.",
        "",
        "## Goals",
        "",
        "- Define product goals.",
        "",
        "## Non-goals",
        "",
        "- Explicit exclusions.",
        "",
      ].join("\n"),
    );
    assert.equal(initializedRequirements, starterTemplate);
    assert.match(initializedRequirements, /Describe target users here\./);
    assert.doesNotMatch(initializedRequirements, /Agentic Project Kit/);
    assert.match(apkRequirements, /repository-local semantic workflow control plane/);
    assert.notEqual(initializedRequirements, apkRequirements);
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

test("fresh init requires no caveman skill setup and generates normal default style", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    const config = parseAgenticConfigJson(await readFile(join(directory, ".agentic/config.json"), "utf8"));
    assert.equal(config.agentStyle, "normal");
    for (const doc of ["docs/project.md", "docs/scope.md", "docs/architecture.md"]) {
      assert.doesNotMatch(await readFile(join(directory, doc), "utf8"), /caveman/i);
    }
  });
});


test("operational index report preserves unusual paths, category sizes and worktree bytes", async () => {
  await withTempDirectory(async (directory) => {
    const git = (...args: string[]) => execFileAsync("git", args, { cwd: directory });
    await git("init", "-q");
    const values = new Map([
      [".agentic/agents/a.json", "agent"], [".agentic/runs/space \n名.jsonl", "run"],
      [".agentic/evidence.jsonl", "proof"], [".agentic/task-baselines.jsonl", "base"],
      [".agentic/reviews/r.json", "review"], [".agentic/sessions/s.json", "session"],
      ["docs/audit-report.md", "report"], [".agentic/perf/p.json", "perf"],
      [".agentic/runs/.gitkeep", "keep"], [".agentic/runs/real.gitkeep", "real"],
    ]);
    for (const [path, value] of values) {
      await mkdir(join(directory, path, ".."), { recursive: true });
      await writeFile(join(directory, path), value);
    }
    await symlink("/outside/never-read", join(directory, ".agentic/runs/link"));
    await git("add", "--", ".agentic", "docs/audit-report.md");
    await writeFile(join(directory, ".gitignore"), APK_OPERATIONAL_IGNORE_ENTRIES.join("\n") + "\n");
    await writeFile(join(directory, ".agentic/runs/ignored.jsonl"), "ignored");
    await writeFile(join(directory, ".agentic/agents/a.json"), "worktree differs from indexed blob");
    const beforeIndex = (await git("ls-files", "--stage", "-z")).stdout;
    const beforeStatus = (await git("status", "--porcelain=v1", "-z", "--untracked-files=all")).stdout;
    const result = await inspectTrackedApkOperationalArtifacts(directory);
    assert.equal(result.status, "complete");
    assert.equal(result.count, 10);
    const expectedBytes = [...values].filter(([path]) => !path.endsWith("/.gitkeep")).reduce((sum, [, value]) => sum + Buffer.byteLength(value), Buffer.byteLength("/outside/never-read"));
    assert.equal(result.indexedBytes, expectedBytes);
    assert.equal(result.groups.find((group) => group.category === "agents")?.indexedBytes, 5);
    assert.equal(result.groups.find((group) => group.category === "runs")?.count, 3);
    assert.equal(result.groups.find((group) => group.category === "generated-docs")?.count, 1);
    assert.ok(result.paths.includes(".agentic/runs/space \n名.jsonl"));
    assert.ok(!result.paths.some((path) => path.endsWith("/.gitkeep") || path.endsWith("ignored.jsonl")));
    const preview = await inspectApkGitignore(directory);
    assert.deepEqual(preview.trackedOperational, result);
    assert.match(renderTrackedApkOperationalReport(result).join(" "), /not worktree bytes/);
    assert.equal((await git("ls-files", "--stage", "-z")).stdout, beforeIndex);
    assert.equal((await git("status", "--porcelain=v1", "-z", "--untracked-files=all")).stdout, beforeStatus);
    assert.equal(await readFile(join(directory, ".agentic/agents/a.json"), "utf8"), "worktree differs from indexed blob");
    await git("update-index", "--force-remove", "--", ".agentic/evidence.jsonl");
    const removed = await inspectTrackedApkOperationalArtifacts(directory);
    assert.equal(removed.count, 9);
    assert.ok(!removed.groups.some((group) => group.category === "evidence"));
    assert.equal(await readFile(join(directory, ".agentic/evidence.jsonl"), "utf8"), "proof");
  });
});

test("operational index report distinguishes non-Git, damaged metadata and unavailable Git", async () => {
  await withTempDirectory(async (directory) => {
    assert.equal((await inspectTrackedApkOperationalArtifacts(directory)).status, "not-applicable");
    await mkdir(join(directory, ".git"));
    const damaged = await inspectTrackedApkOperationalArtifacts(directory);
    assert.equal(damaged.status, "unknown");
    assert.equal(damaged.count, null);
    await rm(join(directory, ".git"), { recursive: true });
    const previousPath = process.env.PATH;
    try {
      process.env.PATH = directory;
      const absent = await inspectTrackedApkOperationalArtifacts(directory);
      assert.equal(absent.status, "unknown");
      assert.equal(absent.indexedBytes, null);
    } finally { process.env.PATH = previousPath; }
  });
});

test("operational index report keeps exact counts but unknown missing-object sizes", async () => {
  await withTempDirectory(async (directory) => {
    const git = (...args: string[]) => execFileAsync("git", args, { cwd: directory });
    await git("init", "-q");
    const missing = "1".repeat(40);
    await git("update-index", "--add", "--cacheinfo", `100644,${missing},.agentic/runs/missing.jsonl`);
    const index = (await git("ls-files", "--stage", "-z")).stdout;
    const result = await inspectTrackedApkOperationalArtifacts(directory);
    assert.equal(result.status, "incomplete");
    assert.equal(result.count, 1);
    assert.equal(result.indexedBytes, null);
    assert.equal(result.groups[0]?.indexedBytes, null);
    assert.equal((await git("ls-files", "--stage", "-z")).stdout, index);
  });
});

test("operational index report bounds inventories and samples without clean-zero claims", async () => {
  await withTempDirectory(async (directory) => {
    const git = (...args: string[]) => execFileAsync("git", args, { cwd: directory });
    await git("init", "-q");
    await mkdir(join(directory, ".agentic/runs"), { recursive: true });
    await Promise.all(Array.from({ length: 12 }, (_, index) => writeFile(join(directory, ".agentic/runs", `${index}.jsonl`), "run")));
    await git("add", "--", ".agentic/runs");
    const small = await inspectTrackedApkOperationalArtifacts(directory);
    assert.equal(small.groups[0]?.sample.length, TRACKED_OPERATIONAL_LIMITS.samplePaths);
    assert.equal(small.groups[0]?.omittedPaths, 4);
    await Promise.all(Array.from({ length: TRACKED_OPERATIONAL_LIMITS.entries }, (_, index) => writeFile(join(directory, ".agentic/runs", `extra-${index}.jsonl`), "run")));
    await git("add", "--", ".agentic/runs");
    const bounded = await inspectTrackedApkOperationalArtifacts(directory);
    assert.equal(bounded.status, "incomplete");
    assert.equal(bounded.count, null);
    assert.match(bounded.diagnostics.join(" "), /entry limit/);
  });
});

test("operational index report works in linked worktrees and rejects ambiguous merge stages", async () => {
  await withTempDirectory(async (directory) => {
    const root = join(directory, "main"), linked = join(directory, "linked");
    await mkdir(root);
    const git = (...args: string[]) => execFileAsync("git", args, { cwd: root });
    await git("init", "-q");
    await git("config", "user.name", "Fixture"); await git("config", "user.email", "fixture@example.invalid");
    await mkdir(join(root, ".agentic/runs"), { recursive: true });
    await writeFile(join(root, ".agentic/runs/run.jsonl"), "abc");
    await git("add", "--", ".agentic/runs/run.jsonl"); await git("commit", "-qm", "fixture");
    await git("worktree", "add", "-q", "--detach", linked, "HEAD");
    const report = await inspectTrackedApkOperationalArtifacts(linked);
    assert.equal(report.count, 1); assert.equal(report.indexedBytes, 3);
    const oid = (await git("rev-parse", "HEAD:.agentic/runs/run.jsonl")).stdout.trim();
    await git("update-index", "--force-remove", "--", ".agentic/runs/run.jsonl");
    await new Promise<void>((resolveResult, reject) => {
      const child = execFile("git", ["update-index", "--index-info"], { cwd: root }, (error) => error ? reject(error) : resolveResult());
      child.stdin!.end(`100644 ${oid} 1\t.agentic/runs/run.jsonl\n100644 ${oid} 2\t.agentic/runs/run.jsonl\n`);
    });
    const conflicted = await inspectTrackedApkOperationalArtifacts(root);
    assert.equal(conflicted.count, 1); assert.equal(conflicted.indexedBytes, null); assert.equal(conflicted.status, "incomplete");
  });
});
