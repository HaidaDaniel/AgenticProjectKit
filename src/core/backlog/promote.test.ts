import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { listTaskFiles, type TaskCreateInput } from "../tasks/index.js";
import { backlogDirectory, createBacklogItem, readBacklogItem } from "./index.js";
import {
  BacklogPromotionError,
  previewBacklogPromotion,
  promoteBacklogItem,
  type BacklogPromotionRequest,
} from "./promote.js";

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-backlog-promote-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

function taskInput(overrides: Partial<TaskCreateInput> = {}): TaskCreateInput {
  return {
    title: "placeholder",
    mode: "mvp",
    lane: "implementation",
    scope: ["backlog"],
    risk: "low",
    parallel: false,
    dependsOn: [],
    tags: ["backlog"],
    goal: "",
    contextFiles: ["AGENTS.md"],
    allowedFiles: ["src/**"],
    forbiddenFiles: [],
    steps: [],
    acceptanceCriteria: [],
    verification: [{
      id: "focused",
      type: "automated",
      required: true,
      environment: "local",
      profile: "deterministic",
      command: "true",
    }],
    documentationUpdates: [],
    notes: [],
    ...overrides,
  };
}

function request(confirmations: string[] = ["criterion-1"], reason = "Operator confirmed the MVP criterion."): BacklogPromotionRequest {
  return { task: taskInput(), confirmations, reason };
}

async function deferredCard(directory: string) {
  return createBacklogItem(directory, ".tasks", {
    title: "Promote me",
    status: "deferred",
    motivation: "A future feature is needed.",
    whyNotNow: "The MVP is not accepted yet.",
    criteria: ["MVP acceptance is recorded."],
    proposedOutcome: "Add the future feature.",
    references: ["docs/roadmap.md"],
  });
}

test("promotion preview is read-only and reports missing fields and confirmations", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const before = await readFile(join(backlogDirectory(directory), `${card.slug}.md`), "utf8");

    const missing = await previewBacklogPromotion(directory, ".tasks", card.slug, request([]));
    assert.equal(missing.valid, false);
    assert.ok(missing.diagnostics.some((diagnostic) => diagnostic.includes("Unconfirmed promotion criteria")));
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 0);
    assert.equal(await readFile(join(backlogDirectory(directory), `${card.slug}.md`), "utf8"), before);

    const noFields = await previewBacklogPromotion(directory, ".tasks", card.slug, {
      task: taskInput({ contextFiles: [], allowedFiles: [] }),
      confirmations: ["criterion-1"],
      reason: "Operator confirmed.",
    });
    assert.equal(noFields.valid, false);
    assert.ok(noFields.missingFields.includes("context"));
    assert.ok(noFields.missingFields.includes("allowed"));
  });
});

test("promotion requires explicit operator confirmations and does not treat apply as approval", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);

    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, request([])),
      BacklogPromotionError,
    );
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, { task: taskInput(), confirmations: ["criterion-1"] }),
      /explicit --reason/,
    );
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, request(["criterion-1", "criterion-1"])),
      /Duplicate confirmation/,
    );
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, request(["criterion-9"])),
      /Unknown promotion criteria/,
    );
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 0);
    assert.equal((await readBacklogItem(directory, ".tasks", card.slug)).status, "deferred");
  });
});

test("promotion creates one canonical task and records the card backlink", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request());

    assert.equal(promoted.outcome, "promoted");
    assert.equal(promoted.task.task.state, "todo");
    assert.deepEqual(promoted.task.task.notes.filter((note) => note.startsWith("Source backlog:")), [
      `Source backlog: ${card.path} (Backlog-Id: ${card.id})`,
    ]);
    assert.ok(promoted.task.task.notes.some((note) => note.includes("operator-asserted criteria criterion-1")));
    const stored = await readBacklogItem(directory, ".tasks", card.slug);
    assert.equal(stored.status, "promoted");
    assert.equal(stored.promotedTask, promoted.task.id);
    const markdown = await readFile(join(backlogDirectory(directory), `${card.slug}.md`), "utf8");
    assert.doesNotMatch(markdown, /\.tasks\/\d{4}-/);
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);

    const repeated = await promoteBacklogItem(directory, ".tasks", card.slug, request());
    assert.equal(repeated.outcome, "already-promoted");
    assert.equal(repeated.task.id, promoted.task.id);
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
  });
});

test("promotion recovers a task created before the card marker was written", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request());
    const cardPath = join(backlogDirectory(directory), `${card.slug}.md`);
    const promotedMarkdown = await readFile(cardPath, "utf8");
    await readFile(cardPath, "utf8");
    const deferredMarkdown = promotedMarkdown
      .replace("Status: promoted", "Status: deferred")
      .replace(/Promoted-Task: \d{4}\n/, "");
    await writeFile(cardPath, deferredMarkdown, "utf8");

    const recovered = await promoteBacklogItem(directory, ".tasks", card.slug, request());
    assert.equal(recovered.outcome, "recovered");
    assert.equal(recovered.task.id, promoted.task.id);
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
    assert.equal((await readBacklogItem(directory, ".tasks", card.slug)).promotedTask, promoted.task.id);
  });
});

test("a renamed promoted card remains idempotent by Backlog-Id", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request());
    const oldPath = join(backlogDirectory(directory), `${card.slug}.md`);
    const renamedSlug = "renamed-promotion";
    await rename(oldPath, join(backlogDirectory(directory), `${renamedSlug}.md`));

    const repeated = await promoteBacklogItem(directory, ".tasks", renamedSlug, request());
    assert.equal(repeated.outcome, "already-promoted");
    assert.equal(repeated.task.id, promoted.task.id);
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
  });
});

test("concurrent promotion creates exactly one task", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const results = await Promise.all([
      promoteBacklogItem(directory, ".tasks", card.slug, request()),
      promoteBacklogItem(directory, ".tasks", card.slug, request()),
    ]);
    assert.equal(new Set(results.map((result) => result.task.id)).size, 1);
    assert.ok(results.some((result) => result.outcome === "promoted"));
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
  });
});

test("missing dependencies and discarded cards fail before mutation", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, { ...request(), task: taskInput({ dependsOn: ["9999"] }) }),
      /Dependency validation failed|missing dependency/i,
    );
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 0);
    assert.equal((await readBacklogItem(directory, ".tasks", card.slug)).status, "deferred");

    const discarded = await createBacklogItem(directory, ".tasks", { title: "Discard me", status: "discarded" });
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", discarded.slug, { task: taskInput(), confirmations: [], reason: "No." }),
      /discarded/,
    );
  });
});
