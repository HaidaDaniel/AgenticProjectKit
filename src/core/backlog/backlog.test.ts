import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { promisify } from "node:util";

import { inspectTaskContracts } from "../config/compatibility.js";
import { listTaskFiles, renderTaskMarkdown, selectNextTask, type ProjectTask } from "../tasks/index.js";
import {
  BACKLOG_LIMITS,
  BacklogFormatError,
  backlogDirectory,
  createBacklogItem,
  listBacklogItems,
  normalizeBacklogSlug,
  parseBacklogMarkdown,
  readBacklogItem,
  renderBacklogMarkdown,
  slugifyBacklogTitle,
  validateBacklogItems,
} from "./index.js";

const execFileAsync = promisify(execFile);

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-backlog-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

const sampleTask: ProjectTask = {
  id: "0001",
  title: "Task inventory",
  state: "todo",
  owner: "none",
  mode: "mvp",
  lane: "implementation",
  scope: ["test"],
  risk: "low",
  parallel: false,
  dependsOn: [],
  tags: [],
  goal: "Inventory test.",
  contextFiles: ["AGENTS.md"],
  allowedFiles: ["src/**"],
  forbiddenFiles: [],
  steps: ["Do work."],
  acceptanceCriteria: ["Work is done."],
  verificationCommands: ["true"],
  documentationUpdates: [],
  notes: [],
};

test("backlog cards round-trip with a stable identity and criterion ids", async () => {
  await withTempDirectory(async (directory) => {
    const created = await createBacklogItem(directory, ".tasks", {
      title: "Add CI after MVP",
      status: "deferred",
      motivation: "A clean-checkout signal would help.",
      whyNotNow: "No accepted MVP exists yet.",
      criteria: ["MVP acceptance is recorded.", "A clean-checkout need exists."],
      proposedOutcome: "One small CI workflow.",
      references: ["docs/roadmap.md"],
    });

    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(created.promotionCriteria.map((criterion) => criterion.id), ["criterion-1", "criterion-2"]);
    const shown = await readBacklogItem(directory, ".tasks", created.slug);
    assert.deepEqual(shown, created);
    assert.equal(
      await readFile(join(backlogDirectory(directory), `${created.slug}.md`), "utf8"),
      renderBacklogMarkdown(created),
    );

    const listed = await listBacklogItems(directory, ".tasks");
    assert.equal(listed.diagnostics.length, 0);
    assert.deepEqual(listed.items, [created]);
  });
});

test("backlog slugs are validated and numeric task-like names are refused", async () => {
  await withTempDirectory(async (directory) => {
    assert.equal(slugifyBacklogTitle("Add CI after MVP"), "add-ci-after-mvp");
    assert.equal(slugifyBacklogTitle("2026 ideas"), "item-2026-ideas");
    assert.throws(() => normalizeBacklogSlug("0001-task"), BacklogFormatError);
    assert.throws(() => normalizeBacklogSlug("../escape"), BacklogFormatError);
    assert.throws(() => normalizeBacklogSlug("Bad Slug"), BacklogFormatError);

    await createBacklogItem(directory, ".tasks", { title: "First" });
    await assert.rejects(
      () => createBacklogItem(directory, ".tasks", { title: "First" }),
      /already exists/,
    );
  });
});

test("backlog parser rejects malformed metadata sections criteria ids and duplicate fields", () => {
  assert.throws(
    () => parseBacklogMarkdown("# Card\n\nStatus: idea\n", "card"),
    /Missing required section|Backlog-Id/,
  );
  assert.throws(
    () => parseBacklogMarkdown("# Card\n\nBacklog-Id: abc\nStatus: idea\n## Motivation\n\nx\n## Why not now\n\nx\n## Promotion criteria\n\n- nope\n## Proposed outcome\n\nx\n", "card"),
    /Promotion criteria entry/,
  );
  assert.throws(
    () => parseBacklogMarkdown("# Card\n\nBacklog-Id: 1234\nStatus: idea\n## Motivation\n\nx\n## Why not now\n\nx\n## Promotion criteria\n\n## Proposed outcome\n\nx\n", "card"),
    /non-numeric/,
  );
});

test("backlog parser enforces the bounded card size", async () => {
  const huge = `# Card\n\nBacklog-Id: abc\nStatus: idea\n\n## Motivation\n\n${"x".repeat(BACKLOG_LIMITS.bytesPerCard)}`;
  assert.throws(() => parseBacklogMarkdown(huge, "card"), /byte limit/);
});

test("backlog filesystem reads reject symlinked cards", async () => {
  await withTempDirectory(async (directory) => {
    const target = join(directory, "outside.md");
    await writeFile(target, "# Outside\n", "utf8");
    await mkdir(backlogDirectory(directory), { recursive: true });
    await symlink(target, join(backlogDirectory(directory), "linked.md"));

    await assert.rejects(
      () => readBacklogItem(directory, ".tasks", "linked"),
      /symbolic link/,
    );
    const listed = await listBacklogItems(directory, ".tasks");
    assert.equal(listed.items.length, 0);
    assert.ok(listed.diagnostics.some((diagnostic) => diagnostic.includes("symbolic link")));
  });
});

test("duplicate Backlog-Ids and malformed cards appear in validation diagnostics", async () => {
  await withTempDirectory(async (directory) => {
    const first = await createBacklogItem(directory, ".tasks", { title: "First" });
    const second = await createBacklogItem(directory, ".tasks", { title: "Second" });
    const secondPath = join(backlogDirectory(directory), `${second.slug}.md`);
    await writeFile(secondPath, (await readFile(secondPath, "utf8")).replace(second.id, first.id), "utf8");
    await writeFile(join(backlogDirectory(directory), "broken.md"), "# Broken\n", "utf8");

    const result = await validateBacklogItems(directory, ".tasks");
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.includes("duplicated")));
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.includes("broken.md")));
  });
});

test("backlog cards are not executable task inventory", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks", "backlog"), { recursive: true });
    await writeFile(join(directory, ".tasks", "backlog", "future.md"), "# Future\n\nnot a task\n", "utf8");
    await writeFile(join(directory, ".tasks", "0001-task.md"), renderTaskMarkdown(sampleTask), "utf8");

    const tasks = await listTaskFiles(directory, ".tasks");
    assert.deepEqual(tasks.map(({ task }) => task.id), ["0001"]);
    assert.equal(selectNextTask(tasks, [])?.task.id, "0001");
    const inventory = await inspectTaskContracts(directory, ".tasks");
    assert.deepEqual(inventory.parsed.map(({ task }) => task.id), ["0001"]);
  });
});

test("backlog cards stay Git-tracked rather than ignored", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => execFileAsync("git", args, { cwd: directory });
    await git("init", "--quiet");
    const item = await createBacklogItem(directory, ".tasks", { title: "Tracked idea" });
    await git("add", ".tasks/backlog", `.tasks/backlog/${item.slug}.md`);
    const status = await git("status", "--porcelain", "--", `.tasks/backlog/${item.slug}.md`);
    assert.equal(status.stdout.trim(), `A  .tasks/backlog/${item.slug}.md`);
    await assert.rejects(
      () => git("check-ignore", "--quiet", `.tasks/backlog/${item.slug}.md`),
    );
  });
});
