import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import test from "node:test";

import { initProject } from "../init/index.js";
import { writeAllAgentExports } from "../exporters/index.js";
import {
  renderTaskMarkdown,
  type ProjectTask,
} from "../tasks/index.js";
import { lintRepositoryContracts } from "./lint.js";

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-lint-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

const BASE_TASK: ProjectTask = {
  id: "0002",
  title: "Lint fixture",
  state: "todo",
  owner: "none",
  mode: "mvp",
  lane: "testing",
  scope: ["tasks"],
  risk: "low",
  parallel: false,
  dependsOn: [],
  tags: [],
  goal: "Exercise the task linter.",
  contextFiles: ["AGENTS.md"],
  allowedFiles: ["src/example.ts"],
  forbiddenFiles: ["package.json"],
  steps: ["Run deterministic checks."],
  acceptanceCriteria: ["The contract is valid."],
  verificationCommands: ["pnpm test"],
  documentationUpdates: ["docs/progress.md"],
  notes: ["Fixture."],
};

function task(id: string, overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    ...BASE_TASK,
    id,
    title: `Lint fixture ${id}`,
    ...overrides,
  };
}

async function writeTask(directory: string, fileName: string, value: ProjectTask): Promise<void> {
  await writeFile(join(directory, ".tasks", fileName), renderTaskMarkdown(value), "utf8");
}

test("contract lint is clean for an initialized repository with current exports", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    await writeAllAgentExports(directory, undefined, { force: true });

    const result = await lintRepositoryContracts(directory);

    assert.equal(result.hasErrors, false);
    assert.deepEqual(result.findings, []);
    assert.equal(result.sync.missing.length, 0);
    assert.equal(result.sync.stale.length, 0);
  });
});

test("contract lint reports graph path metadata and policy violations", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    await writeAllAgentExports(directory, undefined, { force: true });

    await writeTask(directory, "0002-first.md", task("0002", {
      allowedFiles: ["docs/**"],
      forbiddenFiles: ["docs/private/**"],
      dependsOn: ["0002"],
    }));
    await writeTask(directory, "0002-second.md", task("0002", {
      allowedFiles: ["../outside"],
      forbiddenFiles: ["docs/**"],
      tags: ["no-verification"],
    }));
    await writeTask(directory, "0003-cycle.md", task("0003", { dependsOn: ["0004"] }));
    await writeTask(directory, "0004-cycle.md", task("0004", { dependsOn: ["0003"] }));
    await writeTask(directory, "0006-archived-prerequisite.md", task("0006", { dependsOn: ["0005"] }));
    await mkdir(join(directory, ".tasks", "archive"), { recursive: true });
    await writeFile(
      join(directory, ".tasks", "archive", "0005-archived.md"),
      renderTaskMarkdown(task("0005", { state: "done", owner: "archive-agent" })),
      "utf8",
    );
    await writeFile(join(directory, ".tasks", "0007-broken.md"), "# Task 0007 - Broken\n\nState: todo\n", "utf8");
    await writeTask(directory, "0008-owner.md", task("0008", { state: "doing", owner: "ghost-agent" }));
    await writeTask(directory, "0009-siblings.md", task("0009", {
      allowedFiles: ["docs/foo/**"],
      forbiddenFiles: ["docs/foobar/**"],
    }));

    const result = await lintRepositoryContracts(directory);
    const codes = new Set(result.findings.map((finding) => finding.code));

    assert.equal(result.hasErrors, true);
    assert.ok(codes.has("duplicate-task-id"));
    assert.ok(codes.has("self-dependency"));
    assert.ok(codes.has("dependency-cycle"));
    assert.ok(codes.has("task-malformed"));
    assert.ok(codes.has("path-pattern-invalid"));
    assert.ok(codes.has("path-contract-contradiction"));
    assert.ok(codes.has("owner-unregistered"));
    assert.ok(codes.has("policy-blocker"));
    assert.ok(!result.findings.some((finding) => (
      finding.code === "dependency-missing" && finding.taskId === "0006"
    )));
    assert.ok(!result.findings.some((finding) => (
      finding.code === "path-contract-contradiction" && finding.taskId === "0009"
    )));
  });
});

test("contract lint detects export drift without writing files", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    await writeAllAgentExports(directory, undefined, { force: true });
    await writeFile(join(directory, "AGENTS.md"), "stale\n", "utf8");

    const result = await lintRepositoryContracts(directory);

    assert.equal(result.hasErrors, true);
    assert.ok(result.findings.some((finding) => finding.code === "generated-file-stale"));
    assert.equal(await readFile(join(directory, "AGENTS.md"), "utf8"), "stale\n");
  });
});

test("contract lint proves glob overlaps instead of using shared prefixes", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    await writeAllAgentExports(directory, undefined, { force: true });
    await writeTask(directory, "0010-exact.md", task("0010", {
      allowedFiles: ["src/a.ts"],
      forbiddenFiles: ["src/a.ts"],
    }));
    await writeTask(directory, "0011-covered.md", task("0011", {
      allowedFiles: ["src/**"],
      forbiddenFiles: ["src/a.ts"],
    }));
    await writeTask(directory, "0012-prefix.md", task("0012", {
      allowedFiles: ["docs/foo/**"],
      forbiddenFiles: ["docs/foobar/**"],
    }));
    await writeTask(directory, "0013-suffix.md", task("0013", {
      allowedFiles: ["src/*/a.ts"],
      forbiddenFiles: ["src/*/b.ts"],
    }));
    await writeTask(directory, "0014-wildcard.md", task("0014", {
      allowedFiles: ["src/*/**"],
      forbiddenFiles: ["src/**/a.ts"],
    }));

    const result = await lintRepositoryContracts(directory);
    const contradictions = result.findings
      .filter((finding) => finding.code === "path-contract-contradiction")
      .map((finding) => finding.taskId);
    assert.deepEqual(contradictions, ["0010", "0011", "0014"]);
    assert.equal(contradictions.includes("0012"), false);
    assert.equal(contradictions.includes("0013"), false);
  });
});
