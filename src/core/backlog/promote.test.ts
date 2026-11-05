import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveTask,
  buildTaskDeps,
  createTask,
  listTaskFiles,
  loadTaskFile,
  previewArchiveTask,
  writeTaskFile,
  type TaskCreateInput,
} from "../tasks/index.js";
import { backlogDirectory, createBacklogItem, readBacklogCardSnapshot, readBacklogItem, type BacklogItem } from "./index.js";
import {
  BacklogPromotionError,
  criteriaFingerprint,
  previewBacklogPromotion,
  promoteBacklogItem,
  writeBacklogCardWithRevision,
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
    goal: "Test task.",
    contextFiles: ["AGENTS.md"],
    allowedFiles: ["src/**"],
    forbiddenFiles: [],
    steps: ["Implement the future feature."],
    acceptanceCriteria: ["The future feature is implemented and tested."],
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

function request(item: BacklogItem, confirmations: string[] = ["criterion-1"], reason = "Operator confirmed the MVP criterion."): BacklogPromotionRequest {
  return {
    task: taskInput(),
    confirmations,
    reason,
    expectedCriteriaFingerprint: criteriaFingerprint(item),
  };
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

    const missing = await previewBacklogPromotion(directory, ".tasks", card.slug, request(card, []));
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

test("promotion criteria are not reused as implementation steps or acceptance criteria", async () => {
  await withTempDirectory(async (directory) => {
    const card = await createBacklogItem(directory, ".tasks", {
      title: "Add CI after MVP",
      status: "deferred",
      criteria: ["MVP accepted"],
      proposedOutcome: "Add minimal CI.",
    });
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));

    assert.deepEqual(promoted.task.task.steps, ["Implement the future feature."]);
    assert.deepEqual(promoted.task.task.acceptanceCriteria, ["The future feature is implemented and tested."]);
    assert.ok(!promoted.task.task.steps.includes("MVP accepted"));
    assert.ok(!promoted.task.task.acceptanceCriteria.includes("MVP accepted"));
  });
});

test("promotion refuses missing implementation steps and acceptance before creating a task", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const incomplete = {
      ...request(card),
      task: taskInput({ steps: [], acceptanceCriteria: [] }),
    };

    const preview = await previewBacklogPromotion(directory, ".tasks", card.slug, incomplete);
    assert.equal(preview.valid, false);
    assert.ok(preview.missingFields.includes("steps"));
    assert.ok(preview.missingFields.includes("acceptance"));
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, incomplete),
      /Missing required task field: steps/,
    );
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 0);
    assert.equal((await readBacklogItem(directory, ".tasks", card.slug)).status, "deferred");
  });
});

test("promotion rejects a stale criteria confirmation revision", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const preview = await previewBacklogPromotion(directory, ".tasks", card.slug, request(card));
    const cardPath = join(backlogDirectory(directory), `${card.slug}.md`);
    const source = await readFile(cardPath, "utf8");
    await writeFile(cardPath, source.replace("MVP acceptance is recorded.", "Production security audit completed."), "utf8");

    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, {
        ...request(card),
        expectedCriteriaFingerprint: preview.criteriaFingerprint,
      }),
      /criteria changed since preview/,
    );
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 0);
    assert.equal((await readBacklogItem(directory, ".tasks", card.slug)).status, "deferred");
  });
});

test("concurrent card edits are detected before replacement and are preserved", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const snapshot = await readBacklogCardSnapshot(directory, ".tasks", card.slug);
    const cardPath = join(backlogDirectory(directory), `${card.slug}.md`);
    const edited = (await readFile(cardPath, "utf8")).replace("A future feature is needed.", "A manually edited motivation.");
    await writeFile(cardPath, edited, "utf8");

    await assert.rejects(
      () => writeBacklogCardWithRevision(directory, ".tasks", { ...snapshot.item, status: "promoted", promotedTask: "9999" }, snapshot.revision),
      /changed during promotion/,
    );
    assert.equal(await readFile(cardPath, "utf8"), edited);
  });
});

test("promotion requires explicit operator confirmations and does not treat apply as approval", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);

    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, request(card, [])),
      BacklogPromotionError,
    );
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, { task: taskInput(), confirmations: ["criterion-1"] }),
      /explicit --reason/,
    );
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, request(card, ["criterion-1", "criterion-1"])),
      /Duplicate confirmation/,
    );
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, request(card, ["criterion-9"])),
      /Unknown promotion criteria/,
    );
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 0);
    assert.equal((await readBacklogItem(directory, ".tasks", card.slug)).status, "deferred");
  });
});

test("promotion creates one canonical task and records the card backlink", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));

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

    const repeated = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));
    assert.equal(repeated.outcome, "already-promoted");
    assert.equal(repeated.task.id, promoted.task.id);
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
  });
});

test("promotion recovers a task created before the card marker was written", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));
    const cardPath = join(backlogDirectory(directory), `${card.slug}.md`);
    const promotedMarkdown = await readFile(cardPath, "utf8");
    await readFile(cardPath, "utf8");
    const deferredMarkdown = promotedMarkdown
      .replace("Status: promoted", "Status: deferred")
      .replace(/Promoted-Task: \d{4}\n/, "");
    await writeFile(cardPath, deferredMarkdown, "utf8");

    const recovered = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));
    assert.equal(recovered.outcome, "recovered");
    assert.equal(recovered.task.id, promoted.task.id);
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
    assert.equal((await readBacklogItem(directory, ".tasks", card.slug)).promotedTask, promoted.task.id);
  });
});

test("a renamed promoted card remains idempotent by Backlog-Id", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));
    const oldPath = join(backlogDirectory(directory), `${card.slug}.md`);
    const renamedSlug = "renamed-promotion";
    await rename(oldPath, join(backlogDirectory(directory), `${renamedSlug}.md`));

    const repeated = await promoteBacklogItem(directory, ".tasks", renamedSlug, request(card));
    assert.equal(repeated.outcome, "already-promoted");
    assert.equal(repeated.task.id, promoted.task.id);
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
  });
});

test("concurrent promotion creates exactly one task", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const results = await Promise.all([
      promoteBacklogItem(directory, ".tasks", card.slug, request(card)),
      promoteBacklogItem(directory, ".tasks", card.slug, request(card)),
    ]);
    assert.equal(new Set(results.map((result) => result.task.id)).size, 1);
    assert.ok(results.some((result) => result.outcome === "promoted"));
    assert.equal((await listTaskFiles(directory, ".tasks")).length, 1);
  });
});

test("promotion refuses unbounded reasons and ambiguous Backlog-Id inventories", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, { ...request(card), reason: "x".repeat(2049) }),
      /character limit/,
    );

    const second = await createBacklogItem(directory, ".tasks", {
      title: "Second card",
      status: "idea",
    });
    const secondPath = join(backlogDirectory(directory), `${second.slug}.md`);
    await writeFile(
      secondPath,
      (await readFile(secondPath, "utf8")).replace(second.id, card.id),
      "utf8",
    );
    const duplicate = await previewBacklogPromotion(directory, ".tasks", card.slug, request(card));
    assert.equal(duplicate.valid, false);
    assert.ok(duplicate.diagnostics.some((diagnostic) => diagnostic.includes("also used by")));

    await writeFile(join(backlogDirectory(directory), "broken.md"), "# Broken\n", "utf8");
    const broken = await previewBacklogPromotion(directory, ".tasks", card.slug, request(card));
    assert.equal(broken.valid, false);
    assert.ok(broken.diagnostics.some((diagnostic) => diagnostic.includes("inventory is not healthy")));
  });
});

test("multiple tasks with the same Backlog-Id backlink are ambiguous", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const first = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));
    await createTask(directory, ".tasks", taskInput({
      title: "Duplicate backlink",
      notes: [`Source backlog: ${card.path} (Backlog-Id: ${card.id})`],
    }));

    const preview = await previewBacklogPromotion(directory, ".tasks", card.slug, request(card));
    assert.equal(preview.valid, false);
    assert.ok(preview.diagnostics.some((diagnostic) => diagnostic.includes("Multiple tasks carry the same Backlog-Id")));
    assert.equal(first.task.id, (await readBacklogItem(directory, ".tasks", card.slug)).promotedTask);
  });
});

test("promoted task archive remains safe and archived promotion stays idempotent", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));
    const taskPath = join(directory, promoted.task.path);
    const loaded = await loadTaskFile(taskPath);
    await writeTaskFile(taskPath, { ...loaded.task, state: "done", owner: "fixture-owner" });

    const plan = await previewArchiveTask(directory, ".tasks", promoted.task.id);
    assert.deepEqual(plan.blockers, []);
    await archiveTask(directory, ".tasks", promoted.task.id);

    const repeated = await promoteBacklogItem(directory, ".tasks", card.slug, request(card));
    assert.equal(repeated.outcome, "already-promoted");
    assert.equal(repeated.task.id, promoted.task.id);
    assert.match(repeated.task.path, /^\.tasks\/archive\//);
  });
});

test("promotion preserves the resulting dependency graph", async () => {
  await withTempDirectory(async (directory) => {
    const dependency = await createTask(directory, ".tasks", taskInput({ title: "Dependency task" }));
    const card = await deferredCard(directory);
    const promoted = await promoteBacklogItem(directory, ".tasks", card.slug, {
      ...request(card),
      task: taskInput({ dependsOn: [dependency.id] }),
    });

    assert.deepEqual(promoted.task.task.dependsOn, [dependency.id]);
    const deps = buildTaskDeps(await listTaskFiles(directory, ".tasks"), promoted.task.id, promoted.task.path);
    assert.ok(deps);
    assert.deepEqual(deps.prerequisites.map((task) => task.id), [dependency.id]);
  });
});

test("missing dependencies and discarded cards fail before mutation", async () => {
  await withTempDirectory(async (directory) => {
    const card = await deferredCard(directory);
    await assert.rejects(
      () => promoteBacklogItem(directory, ".tasks", card.slug, { ...request(card), task: taskInput({ dependsOn: ["9999"] }) }),
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
