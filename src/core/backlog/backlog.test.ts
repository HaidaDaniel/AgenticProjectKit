import { execFile } from "node:child_process";
import fsPromises, { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
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

test("backlog refuses a symlinked backlog directory without writing outside the store", async () => {
  await withTempDirectory(async (directory) => {
    const outside = await mkdtemp(join(tmpdir(), "apk-backlog-outside-"));
    try {
      await mkdir(join(directory, ".tasks"), { recursive: true });
      await symlink(outside, backlogDirectory(directory));
      await assert.rejects(
        () => createBacklogItem(directory, ".tasks", { title: "Escape" }),
        /symbolic link/,
      );
      await assert.rejects(
        () => listBacklogItems(directory, ".tasks"),
        /symbolic link/,
      );
      assert.equal((await readFile(join(outside, "escape.md"), "utf8").catch(() => "")), "");
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test("renaming a backlog card preserves Backlog-Id while changing the slug", async () => {
  await withTempDirectory(async (directory) => {
    const created = await createBacklogItem(directory, ".tasks", { title: "Rename me" });
    const oldPath = join(backlogDirectory(directory), `${created.slug}.md`);
    const renamedSlug = "renamed-card";
    await rename(oldPath, join(backlogDirectory(directory), `${renamedSlug}.md`));

    const moved = await readBacklogItem(directory, ".tasks", renamedSlug);
    assert.equal(moved.id, created.id);
    assert.equal(moved.slug, renamedSlug);
  });
});

test("manual criterion edits and reordering keep stable criterion ids", async () => {
  await withTempDirectory(async (directory) => {
    const created = await createBacklogItem(directory, ".tasks", {
      title: "Criteria stability",
      status: "deferred",
      criteria: ["MVP is accepted.", "A clean-checkout need exists."],
    });
    const path = join(backlogDirectory(directory), `${created.slug}.md`);
    const source = await readFile(path, "utf8");
    const edited = source
      .replace("criterion-1: MVP is accepted.", "criterion-1: MVP acceptance is recorded.")
      .replace("- criterion-1: MVP acceptance is recorded.\n- criterion-2: A clean-checkout need exists.", "- criterion-2: A clean-checkout need exists.\n- criterion-1: MVP acceptance is recorded.");
    await writeFile(path, edited, "utf8");

    const item = await readBacklogItem(directory, ".tasks", created.slug);
    assert.deepEqual(item.promotionCriteria.map((criterion) => criterion.id), ["criterion-2", "criterion-1"]);
    assert.equal(item.promotionCriteria[1]!.text, "MVP acceptance is recorded.");
  });
});

test("backlog supports a custom task directory and manual prose edits", async () => {
  await withTempDirectory(async (directory) => {
    const created = await createBacklogItem(directory, ".work", { title: "Custom store" });
    const path = join(directory, ".work", "backlog", `${created.slug}.md`);
    const source = await readFile(path, "utf8");
    await writeFile(path, source.replace("Not recorded yet.", "Manual motivation."), "utf8");
    const item = await readBacklogItem(directory, ".work", created.slug);
    assert.equal(item.id, created.id);
    assert.equal(item.motivation, "Manual motivation.");
    assert.equal((await listBacklogItems(directory, ".work")).items.length, 1);
  });
});

test("list reports oversized backlog cards instead of reading them unbounded", async () => {
  await withTempDirectory(async () => {
    const directory = await mkdtemp(join(tmpdir(), "apk-backlog-large-"));
    try {
      await mkdir(backlogDirectory(directory), { recursive: true });
      await writeFile(join(backlogDirectory(directory), "large.md"), "x".repeat(BACKLOG_LIMITS.bytesPerCard + 1), "utf8");
      const listed = await listBacklogItems(directory, ".tasks");
      assert.equal(listed.items.length, 0);
      assert.ok(listed.diagnostics.some((diagnostic) => diagnostic.includes("byte limit")));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
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

test("backlog refuses a custom task directory with a symlinked ancestor", async () => {
  await withTempDirectory(async (directory) => {
    const outside = await mkdtemp(join(tmpdir(), "apk-backlog-taskdir-outside-"));
    try {
      await symlink(outside, join(directory, "linked"));
      await assert.rejects(
        () => createBacklogItem(directory, "linked/.tasks", { title: "Escape" }),
        /symbolic link/,
      );
      await assert.rejects(
        () => listBacklogItems(directory, "linked/.tasks"),
        /symbolic link/,
      );
      await assert.rejects(
        () => createBacklogItem(directory, "../outside", { title: "Escape" }),
        /dot segments/,
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test("ordinary task inventory neither enumerates nor reads backlog content", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks", "backlog"), { recursive: true });
    await writeFile(join(directory, ".tasks", "backlog", "large.md"), "x".repeat(1024), "utf8");
    await writeFile(join(directory, ".tasks", "0001-task.md"), renderTaskMarkdown(sampleTask), "utf8");

    const original = {
      readdir: fsPromises.readdir,
      open: fsPromises.open,
      readFile: fsPromises.readFile,
      opendir: fsPromises.opendir,
    };
    const backlogAccesses: string[] = [];
    const record = (operation: string, path: unknown): void => {
      const text = String(path);
      if (text.includes(".tasks") && /(?:^|[\\/])backlog(?:[\\/]|$)/.test(text)) {
        backlogAccesses.push(`${operation}:${text}`);
      }
    };
    fsPromises.readdir = (async (path: Parameters<typeof fsPromises.readdir>[0], options?: Parameters<typeof fsPromises.readdir>[1]) => {
      record("readdir", path);
      return original.readdir(path, options as never);
    }) as typeof fsPromises.readdir;
    fsPromises.open = (async (...args: Parameters<typeof fsPromises.open>) => {
      record("open", args[0]);
      return original.open(...args);
    }) as typeof fsPromises.open;
    fsPromises.readFile = (async (...args: Parameters<typeof fsPromises.readFile>) => {
      record("readFile", args[0]);
      return original.readFile(...args);
    }) as typeof fsPromises.readFile;
    fsPromises.opendir = (async (...args: Parameters<typeof fsPromises.opendir>) => {
      record("opendir", args[0]);
      return original.opendir(...args);
    }) as typeof fsPromises.opendir;
    syncBuiltinESMExports();

    try {
      const tasks = await listTaskFiles(directory, ".tasks");
      assert.equal(tasks.length, 1);
      assert.equal(selectNextTask(tasks, [])?.task.id, "0001");
      const inventory = await inspectTaskContracts(directory, ".tasks");
      assert.equal(inventory.parsed.length, 1);
    } finally {
      fsPromises.readdir = original.readdir;
      fsPromises.open = original.open;
      fsPromises.readFile = original.readFile;
      fsPromises.opendir = original.opendir;
      syncBuiltinESMExports();
    }

    assert.deepEqual(backlogAccesses, []);
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
