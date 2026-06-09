import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  appendRunLog,
  registerAgent,
} from "../agents/index.js";
import { writeTaskFile, type ProjectTask } from "../tasks/index.js";
import {
  renderAnalyticsSummary,
  summarizeAnalytics,
  writeAnalyticsSummary,
} from "./index.js";

const TASK: ProjectTask = {
  id: "0100",
  title: "Analytics Task",
  state: "done",
  owner: "codex-a",
  mode: "product",
  lane: "analytics",
  scope: ["analytics"],
  risk: "medium",
  parallel: false,
  dependsOn: [],
  tags: ["analytics"],
  goal: "Exercise analytics summary.",
  contextFiles: ["AGENTS.md"],
  allowedFiles: ["docs/progress.md"],
  forbiddenFiles: ["application source files"],
  steps: ["Run analytics."],
  acceptanceCriteria: ["Summary groups events."],
  verificationCommands: ["pnpm test"],
  documentationUpdates: ["Update docs/progress.md."],
  notes: ["none"],
};

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-analytics-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("summarizeAnalytics groups events by developer agent platform and model", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "0100-analytics-task.md"), TASK);
    const agent = await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5.5",
      created: "2026-05-08T12:00:00Z",
    });

    await appendRunLog(directory, {
      event: "claim",
      agent,
      task: "0100",
      state: "doing",
      outcome: "ok",
      time: "2027-05-08T12:01:00Z",
    });
    await appendRunLog(directory, {
      event: "done",
      agent,
      task: "0100",
      state: "done",
      outcome: "ok",
      time: "2027-05-08T12:03:00Z",
      durationSec: 120,
    });

    const summary = await summarizeAnalytics(directory, { month: "2027-05" });

    assert.equal(summary.groups.length, 1);
    assert.deepEqual(summary.groups[0], {
      developer: "alice",
      agent: "codex-a",
      platform: "codex",
      model: "gpt-5.5",
      transitions: 2,
      tasksDone: 1,
      avgDoneSec: 120,
      blockCancel: 0,
      errors: 0,
      risks: { medium: 1 },
      modes: { product: 1 },
      lanes: { analytics: 1 },
    });
    assert.match(renderAnalyticsSummary(summary), /alice \| codex-a \| codex \| gpt-5\.5/);
  });
});

test("summarizeAnalytics filters by month and writes docs summary", async () => {
  await withTempDirectory(async (directory) => {
    const agent = await registerAgent(directory, {
      id: "cursor-a",
      developer: "bob",
      platform: "cursor",
      model: "claude-4",
    });

    await appendRunLog(directory, {
      event: "block",
      agent,
      task: "0100",
      state: "blocked",
      outcome: "error",
      time: "2027-06-01T08:00:00Z",
      reason: "needs decision",
    });

    const may = await summarizeAnalytics(directory, { month: "2027-05" });
    const june = await summarizeAnalytics(directory, { month: "2027-06" });
    const outputPath = await writeAnalyticsSummary(directory, june);

    assert.equal(may.groups.length, 0);
    assert.equal(june.groups[0].blockCancel, 1);
    assert.equal(june.groups[0].errors, 1);
    assert.equal(outputPath, "docs/analytics/agent-summary-2027-06.md");
    assert.match(
      await readFile(join(directory, outputPath), "utf8"),
      /# Agent Analytics Summary 2027-06/,
    );
  });
});

test("summarizeAnalytics includes archived task metadata", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "archive", "0100-analytics-task.md"), TASK);
    const agent = await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5.5",
    });

    await appendRunLog(directory, {
      event: "done",
      agent,
      task: "0100",
      state: "done",
      outcome: "ok",
      time: "2027-05-08T12:03:00Z",
    });

    const summary = await summarizeAnalytics(directory, { month: "2027-05" });

    assert.deepEqual(summary.groups[0].risks, { medium: 1 });
    assert.deepEqual(summary.groups[0].modes, { product: 1 });
    assert.deepEqual(summary.groups[0].lanes, { analytics: 1 });
  });
});
