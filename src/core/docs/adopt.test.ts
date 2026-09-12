import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import { promisify } from "node:util";

import { listAgentExporters } from "../exporters/index.js";
import {
  renderContextSuggestion,
  suggestContext,
} from "../context-suggestions/index.js";
import { APK_OPERATIONAL_IGNORE_ENTRIES } from "../init/index.js";
import { adoptRepository, planAdoption } from "./adopt.js";
import { syncAgentExports } from "../sync/index.js";
import type { ProjectTask } from "../tasks/index.js";

const execFileAsync = promisify(execFile);

async function withTempRepository(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-adopt-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

async function createExistingRepository(directory: string): Promise<void> {
  await mkdir(join(directory, "src"), { recursive: true });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          react: "^19.0.0",
        },
        devDependencies: {
          typescript: "^6.0.0",
          vite: "^7.0.0",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(join(directory, "tsconfig.json"), "{}\n", "utf8");
  await writeFile(join(directory, "src/index.ts"), "console.log('app');\n", "utf8");
}

test("adoptRepository scans repository shape and creates kit files", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);

    const result = await adoptRepository(directory);

    assert.deepEqual(result.scan.detectedStack, [
      "Node.js",
      "React",
      "TypeScript",
      "Vite",
    ]);
    assert.ok(result.created.includes("docs/project-map.md"));
    assert.ok(result.created.includes("docs/adoption-report.md"));
    assert.ok(result.created.includes("docs/project.md"));
    assert.ok(result.created.includes("docs/scope.md"));
    assert.ok(result.created.includes("docs/architecture.md"));
    assert.ok(result.created.includes(".agentic/config.json"));
    assert.ok(result.created.includes(".tasks/0001-document-adopted-repository.md"));
    assert.ok(result.created.includes("AGENTS.md"));
    assert.equal(
      await readFile(join(directory, "src/index.ts"), "utf8"),
      "console.log('app');\n",
    );
    assert.match(
      await readFile(join(directory, "docs/project-map.md"), "utf8"),
      /## Detected Stack\n\n- Node\.js\n- React\n- TypeScript\n- Vite/,
    );
    assert.match(
      await readFile(join(directory, "docs/project.md"), "utf8"),
      /Adopted repository:/,
    );
    assert.match(
      await readFile(join(directory, "docs/adoption-report.md"), "utf8"),
      new RegExp(`## Pre-adoption Gaps\\n\\n- Missing kit docs: 8\\n- Missing agent exports: ${listAgentExporters().length}`),
    );
    const taskSystem = await readFile(join(directory, "docs/task-system.md"), "utf8");
    assert.match(
      taskSystem,
      /pnpm exec apk agent register --id codex-a --platform codex --model gpt-5\.5/,
    );
    assert.doesNotMatch(taskSystem, /^apk agent register/m);
  });
});

test("adoptRepository writes agent exports current for the canonical drift check", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);

    await adoptRepository(directory);

    const sync = await syncAgentExports(directory);
    assert.deepEqual(sync.stale, []);
    assert.deepEqual(sync.missing, []);
    assert.equal(sync.hasDrift, false);
  });
});

test("adoptRepository selects the next free task id when tasks already exist", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(
      join(directory, ".tasks/0001-existing.md"),
      "# Task 0001 - Existing\n\nStatus: todo\nOwner: none\nMode: maintenance\nRisk: low\nDepends on: none\n\n## Goal\n\nExisting task.\n",
      "utf8",
    );
    await writeFile(
      join(directory, ".tasks/0007-other.md"),
      "# Task 0007 - Other\n\nStatus: todo\nOwner: none\nMode: maintenance\nRisk: low\nDepends on: none\n\n## Goal\n\nOther task.\n",
      "utf8",
    );

    const result = await adoptRepository(directory);

    assert.ok(result.created.includes(".tasks/0008-document-adopted-repository.md"));
    assert.ok(!result.created.includes(".tasks/0001-document-adopted-repository.md"));
  });
});

test("adoptRepository skips existing files instead of overwriting them", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);
    await writeFile(join(directory, "AGENTS.md"), "custom instructions\n", "utf8");

    const result = await adoptRepository(directory);

    assert.ok(result.skipped.includes("AGENTS.md"));
    assert.equal(
      await readFile(join(directory, "AGENTS.md"), "utf8"),
      "custom instructions\n",
    );
    assert.ok(result.created.includes("docs/adoption-report.md"));
  });
});

test("adoption preview and explicit migration preserve legacy projects and are idempotent", async () => {
  await withTempRepository(async (directory) => {
    await cp(
      join(process.cwd(), "src/core/tasks/fixtures/v0.3.1"),
      directory,
      { recursive: true },
    );
    const configPath = join(directory, ".agentic/config.json");
    const taskPath = join(directory, ".tasks/0001-legacy-task.md");
    const agentsPath = join(directory, "AGENTS.md");
    const beforeConfig = await readFile(configPath, "utf8");
    const beforeTask = await readFile(taskPath, "utf8");
    const beforeAgents = await readFile(agentsPath, "utf8");

    const preview = await planAdoption(directory, { includeMigration: true });
    assert.equal(preview.compatibility.overall, "legacy");
    assert.equal(preview.compatibility.config.state, "legacy");
    assert.equal(preview.compatibility.tasks.contract, "legacy");
    assert.ok(preview.changes.some((change) => (
      change.action === "update" && change.path === ".agentic/config.json"
    )));
    assert.equal(await readFile(configPath, "utf8"), beforeConfig);
    assert.equal(await readFile(taskPath, "utf8"), beforeTask);
    assert.equal(await readFile(agentsPath, "utf8"), beforeAgents);

    const applied = await adoptRepository(directory, { applyMigration: true });
    assert.deepEqual(applied.updated, [".agentic/config.json"]);
    const migratedConfig = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    assert.equal(migratedConfig.schemaVersion, 2);
    assert.equal(migratedConfig.customSetting, "preserve-me");
    assert.equal(await readFile(taskPath, "utf8"), beforeTask);
    assert.equal(await readFile(agentsPath, "utf8"), beforeAgents);

    const repeated = await adoptRepository(directory, { applyMigration: true });
    assert.deepEqual(repeated.updated, []);
    assert.deepEqual(repeated.created, []);
    assert.equal((await planAdoption(directory, { includeMigration: true })).changes.length, 0);
  });
});

test("adoption refuses to migrate an unsupported future config schema", async () => {
  await withTempRepository(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic/config.json"),
      JSON.stringify({ schemaVersion: 99, projectName: "Future" }, null, 2),
      "utf8",
    );

    await assert.rejects(
      () => planAdoption(directory, { includeMigration: true }),
      /Unsupported .*schemaVersion: 99/,
    );
    assert.equal(
      await readFile(join(directory, ".agentic/config.json"), "utf8"),
      JSON.stringify({ schemaVersion: 99, projectName: "Future" }, null, 2),
    );
  });
});

test("suggestContext ranks dependencies and related tests with reasons", async () => {
  await withTempRepository(async (directory) => {
    await mkdir(join(directory, "src"), { recursive: true });
    await mkdir(join(directory, "docs"), { recursive: true });
    await writeFile(join(directory, "src/feature.ts"), "import { dependency } from './dependency';\nexport const feature = dependency;\n", "utf8");
    await writeFile(join(directory, "src/dependency.ts"), "export const dependency = true;\n", "utf8");
    await writeFile(join(directory, "src/feature.test.ts"), "import { feature } from './feature';\ntest('feature', () => feature);\n", "utf8");
    await writeFile(join(directory, "src/forbidden.ts"), "export const secret = true;\n", "utf8");
    await writeFile(join(directory, "docs/unrelated.md"), "Unrelated notes.\n", "utf8");

    const task: ProjectTask = {
      id: "0090",
      title: "Feature change",
      state: "todo",
      owner: "none",
      mode: "product",
      lane: "implementation",
      scope: ["feature"],
      risk: "low",
      parallel: false,
      dependsOn: [],
      tags: ["feature"],
      goal: "Change feature behavior.",
      contextFiles: ["AGENTS.md"],
      allowedFiles: ["src/**"],
      forbiddenFiles: ["src/forbidden.ts"],
      steps: ["Change feature."],
      acceptanceCriteria: ["Feature works."],
      verificationCommands: ["pnpm test"],
      documentationUpdates: [],
      notes: [],
    };
    const availableFiles = [
      "AGENTS.md",
      "src/feature.ts",
      "src/dependency.ts",
      "src/feature.test.ts",
      "src/forbidden.ts",
      "docs/unrelated.md",
    ];
    const options = {
      task,
      availableFiles,
      changedFiles: ["src/feature.ts"],
      limit: 6,
    };
    const result = await suggestContext(directory, "feature", options);
    const repeated = await suggestContext(directory, "feature", options);

    assert.deepEqual(result, repeated);
    assert.ok(result.suggestions.some((entry) => entry.path === "src/feature.ts"));
    assert.equal(result.suggestions.some((entry) => entry.path === "docs/unrelated.md"), false);
    assert.ok(result.suggestions.some((entry) => entry.path === "src/dependency.ts" && entry.reason.includes("changed file dependency")));
    assert.ok(result.suggestions.some((entry) => entry.path === "src/feature.test.ts" && entry.reason.includes("related test")));
    assert.ok(result.suggestions.every((entry) => entry.reason.length > 0));
    assert.equal(result.allowedFiles.includes("src/forbidden.ts"), false);
    assert.equal(result.suggestions.find((entry) => entry.path === "src/forbidden.ts")?.role, "context");
    assert.match(renderContextSuggestion(result), /src\/dependency\.ts .*changed file dependency/);
  });
});

test("adoptRepository adds the canonical APK ignore block additively and idempotently", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);
    const custom = "# user rules\nnode_modules/\n";
    await writeFile(join(directory, ".gitignore"), custom, "utf8");

    const result = await adoptRepository(directory);
    assert.ok(result.created.includes(".gitignore") || result.updated.includes(".gitignore"));

    const gitignore = await readFile(join(directory, ".gitignore"), "utf8");
    assert.ok(gitignore.startsWith(custom));
    for (const entry of APK_OPERATIONAL_IGNORE_ENTRIES) {
      assert.ok(gitignore.split("\n").includes(entry), `missing ${entry}`);
    }
    assert.equal(gitignore.includes(".apk-worktrees/"), false);

    const repeated = await adoptRepository(directory);
    assert.equal(repeated.created.includes(".gitignore"), false);
    assert.equal(repeated.updated.includes(".gitignore"), false);
    assert.equal(await readFile(join(directory, ".gitignore"), "utf8"), gitignore);
  });
});

test("adoptRepository surfaces tracked APK operational state without deleting or untracking it", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);
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

    const result = await adoptRepository(directory);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.includes(".agentic/runs/foo.jsonl")));

    const { stdout } = await execFileAsync("git", ["ls-files", ".agentic/runs/foo.jsonl"], { cwd: directory });
    assert.equal(stdout.trim(), ".agentic/runs/foo.jsonl");
    assert.equal(await readFile(join(directory, ".agentic", "runs", "foo.jsonl"), "utf8"), "{}\n");
  });
});
