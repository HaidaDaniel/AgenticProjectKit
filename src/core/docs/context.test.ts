import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { promisify } from "node:util";

import type { ProjectTask } from "../tasks/index.js";
import { buildTaskContextPack } from "./context.js";

const execFileAsync = promisify(execFile);

const CONTEXT_TASK: ProjectTask = {
  id: "0007",
  title: "Context Task",
  state: "todo",
  owner: "none",
  mode: "mvp",
  lane: "implementation",
  scope: ["context"],
  risk: "low",
  parallel: false,
  dependsOn: [],
  tags: [],
  goal: "Exercise context discovery.",
  contextFiles: [],
  allowedFiles: ["src/**"],
  forbiddenFiles: [],
  steps: [],
  acceptanceCriteria: [],
  verificationCommands: [],
  documentationUpdates: [],
  notes: [],
};

async function withTempRepo(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-context-"));
  try {
    await execFileAsync("git", ["init", "--quiet"], { cwd: directory });
    await execFileAsync("git", ["config", "user.email", "codex@example.test"], { cwd: directory });
    await execFileAsync("git", ["config", "user.name", "Codex"], { cwd: directory });
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

async function writeFiles(directory: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(directory, path);
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, content, "utf8");
  }
}

function discover(
  directory: string,
  task: ProjectTask,
  options: Record<string, unknown> = {},
) {
  return buildTaskContextPack(directory, task, 3, { budget: 100_000, ...options });
}

test("context discovery honors a root .gitignore directory rule", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      ".gitignore": "ignored/\n",
      "ignored/secret.ts": "secret\n",
      "src/visible.ts": "visible\n",
    });

    const selection = await discover(directory, CONTEXT_TASK);
    assert.ok(selection.files.includes("src/visible.ts"));
    assert.equal(selection.files.some((file) => file.startsWith("ignored/")), false);
  });
});

test("context discovery honors nested .gitignore files", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      "nested/.gitignore": "skip.md\n",
      "nested/skip.md": "skip\n",
      "nested/keep.md": "keep\n",
    });

    const selection = await discover(directory, CONTEXT_TASK);
    assert.ok(selection.files.includes("nested/keep.md"));
    assert.equal(selection.files.includes("nested/skip.md"), false);
  });
});

test("context discovery honors a .gitignore negation rule", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      ".gitignore": "*.md\n!keep.md\n",
      "keep.md": "keep\n",
      "other.md": "other\n",
    });

    const selection = await discover(directory, CONTEXT_TASK);
    assert.ok(selection.files.includes("keep.md"));
    assert.equal(selection.files.includes("other.md"), false);
  });
});

test("context discovery still works without a .gitignore", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      "src/one.ts": "one\n",
      "src/two.ts": "two\n",
    });

    const selection = await discover(directory, CONTEXT_TASK);
    assert.ok(selection.files.includes("src/one.ts"));
    assert.ok(selection.files.includes("src/two.ts"));
  });
});

test("context discovery honors CRLF .gitignore line endings", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      ".gitignore": "ignored/\r\n",
      "ignored/secret.ts": "secret\n",
      "src/visible.ts": "visible\n",
    });

    const selection = await discover(directory, CONTEXT_TASK);
    assert.ok(selection.files.includes("src/visible.ts"));
    assert.equal(selection.files.some((file) => file.startsWith("ignored/")), false);
  });
});

test("context discovery skips a large ignored directory without walking it", async () => {
  await withTempRepo(async (directory) => {
    const files: Record<string, string> = { ".gitignore": "huge-ignored/\n" };
    for (let index = 0; index < 300; index += 1) {
      files[`huge-ignored/file-${index}.ts`] = "x\n";
    }
    files["src/visible.ts"] = "visible\n";
    await writeFiles(directory, files);

    const selection = await discover(directory, CONTEXT_TASK);
    assert.ok(selection.files.includes("src/visible.ts"));
    assert.equal(selection.files.some((file) => file.startsWith("huge-ignored/")), false);
  });
});

test("explicitly required context wins over an ignore rule", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      ".gitignore": "ignored/\n",
      "ignored/required.md": "required\n",
      "src/visible.ts": "visible\n",
    });

    const task: ProjectTask = { ...CONTEXT_TASK, contextFiles: ["ignored/required.md"] };
    const selection = await discover(directory, task);
    assert.ok(selection.files.includes("ignored/required.md"));
  });
});

test("configured contextExcludes remove additive candidates", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      ".agentic/config.json": JSON.stringify({ projectName: "Test", contextExcludes: ["src/generated"] }, null, 2),
      "src/generated/code.ts": "generated\n",
      "src/keep.ts": "keep\n",
    });

    const selection = await discover(directory, CONTEXT_TASK);
    assert.ok(selection.files.includes("src/keep.ts"));
    assert.equal(selection.files.includes("src/generated/code.ts"), false);
  });
});

test("configured context exclusions never drop explicitly required context", async () => {
  await withTempRepo(async (directory) => {
    await writeFiles(directory, {
      ".agentic/config.json": JSON.stringify({ projectName: "Test", contextExcludes: ["src/required.ts"] }, null, 2),
      "src/required.ts": "required\n",
    });

    const task: ProjectTask = { ...CONTEXT_TASK, contextFiles: ["src/required.ts"] };
    const selection = await discover(directory, task);
    assert.ok(selection.files.includes("src/required.ts"));
    assert.equal(selection.entries?.find((entry) => entry.path === "src/required.ts")?.tier, "required");
  });
});
