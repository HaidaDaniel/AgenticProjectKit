import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import test from "node:test";

const execFileAsync = promisify(execFile);
const CLI_PATH = join(process.cwd(), "src/cli/index.ts");
const TSX_LOADER = pathToFileURL(join(process.cwd(), "node_modules/tsx/dist/loader.mjs")).href;

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: readonly string[], cwd = process.cwd()): Promise<CliResult> {
  try {
    const result = await execFileAsync(process.execPath, ["--import", TSX_LOADER, CLI_PATH, ...args], {
      cwd,
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      "stdout" in error &&
      "stderr" in error
    ) {
      return {
        exitCode: typeof error.code === "number" ? error.code : 1,
        stdout: String(error.stdout),
        stderr: String(error.stderr),
      };
    }

    throw error;
  }
}

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-cli-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("CLI help lists implemented commands", async () => {
  const result = await runCli(["--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk audit \[directory\]/);
  assert.match(result.stdout, /apk analytics summary \[--month YYYY-MM\] \[--write\]/);
  assert.match(result.stdout, /apk sync \[agent\] \[--write\]/);
  assert.match(result.stdout, /apk status/);
  assert.match(result.stdout, /apk doctor/);
  assert.match(result.stdout, /apk suggest-context/);
  assert.match(result.stdout, /apk work <task-id>/);
  assert.match(result.stdout, /apk task deps <task-id>/);
  assert.match(result.stdout, /apk tasks \[--all\] \[--state <state>\] \[--owner <agent-id>\]/);
});

function buildTaskMarkdown(id: string, title: string, state: string, owner = "none"): string {
  return [
    `# Task ${id} - ${title}`,
    "",
    `State: ${state}`,
    `Owner: ${owner}`,
    "Mode: mvp",
    "Lane: implementation",
    "Scope: none",
    "Risk: low",
    "Parallel: false",
    "Depends on: none",
    "Tags: none",
    "",
    "## Goal",
    "",
    "A task.",
    "",
    "## Context files",
    "",
    "- AGENTS.md",
    "",
    "## Files allowed to edit",
    "",
    `- .tasks/${id}-task.md`,
    "",
    "## Files forbidden to edit",
    "",
    "- package.json",
    "",
    "## Steps",
    "",
    "1. Do something.",
    "",
    "## Acceptance criteria",
    "",
    "- It works.",
    "",
    "## Verification commands",
    "",
    "- pnpm test",
    "",
    "## Documentation updates",
    "",
    "- docs/progress.md",
    "",
    "## Notes",
    "",
    "None.",
    "",
  ].join("\n");
}

test("CLI tasks hides done and canceled tasks by default", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await writeFile(join(tasksDir, "0002-done-task.md"), buildTaskMarkdown("0002", "Done Task", "done", "archive"), "utf8");
    await writeFile(join(tasksDir, "0003-canceled-task.md"), buildTaskMarkdown("0003", "Canceled Task", "canceled"), "utf8");

    const defaultResult = await runCli(["tasks"], directory);
    assert.equal(defaultResult.exitCode, 0);
    assert.match(defaultResult.stdout, /0001/);
    assert.doesNotMatch(defaultResult.stdout, /0002/);
    assert.doesNotMatch(defaultResult.stdout, /0003/);
  });
});

test("CLI tasks --all shows every parsed task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await writeFile(join(tasksDir, "0002-done-task.md"), buildTaskMarkdown("0002", "Done Task", "done", "archive"), "utf8");

    const allResult = await runCli(["tasks", "--all"], directory);
    assert.equal(allResult.exitCode, 0);
    assert.match(allResult.stdout, /0001/);
    assert.match(allResult.stdout, /0002/);
  });
});

test("CLI tasks --state done shows done tasks", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await writeFile(join(tasksDir, "0002-done-task.md"), buildTaskMarkdown("0002", "Done Task", "done", "archive"), "utf8");

    const stateResult = await runCli(["tasks", "--state", "done"], directory);
    assert.equal(stateResult.exitCode, 0);
    assert.doesNotMatch(stateResult.stdout, /0001/);
    assert.match(stateResult.stdout, /0002/);
  });
});

test("CLI tasks rejects unknown options", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });

    const result = await runCli(["tasks", "--unknown"], directory);
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Unknown option: --unknown/) || result.stderr.match(/Unknown option: --unknown/),
      "Expected error about unknown option",
    );
  });
});

test("CLI tasks help shows active filtering info", async () => {
  const result = await runCli(["tasks", "--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /--all/);
  assert.match(result.stdout, /active tasks/);
});

test("CLI status shows compact workflow state", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");

    const result = await runCli(["status"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Mode:/);
    assert.match(result.stdout, /Tasks:/);
    assert.match(result.stdout, /todo:1/);
    assert.match(result.stdout, /Next task: 0001 Todo Task/);
    assert.match(result.stdout, /Generated instructions:/);
    assert.match(result.stdout, /Latest run:/);
    assert.match(result.stdout, /Warnings:/);
  });
});

test("CLI status help shows usage", async () => {
  const result = await runCli(["status", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk status/);
});

test("CLI status reports broken task files as warnings", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-broken.md"), "# Broken\n", "utf8");

    const result = await runCli(["status"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /task parse warning/);
  });
});

test("CLI doctor help shows usage", async () => {
  const result = await runCli(["doctor", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk doctor/);
});

test("CLI doctor reports warnings without failing", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");

    const result = await runCli(["doctor"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Doctor:/);
    assert.match(result.stdout, /warn:/);
    assert.match(result.stdout, /Result: pass/);
  });
});

test("CLI doctor fails on broken task files", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-broken.md"), "# Broken\n", "utf8");

    const result = await runCli(["doctor"], directory);

    assert.equal(result.exitCode, 1);
    assert.match(result.stdout, /tasks:/);
    assert.match(result.stdout, /Result: fail/);
  });
});

test("CLI suggest-context returns deterministic local candidates", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, "src", "auth"), { recursive: true });
    await mkdir(join(directory, "src", "auth", "__tests__"), { recursive: true });
    await writeFile(join(directory, "src", "auth", "middleware.ts"), "export {}\n", "utf8");
    await writeFile(join(directory, "src", "auth", "__tests__", "middleware.test.ts"), "test('x', () => {});\n", "utf8");
    await writeFile(join(directory, "package.json"), JSON.stringify({}), "utf8");

    const result = await runCli(["suggest-context", "Add auth middleware", "--limit", "4"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Context files/);
    assert.match(result.stdout, /Files allowed to edit/);
    assert.match(result.stdout, /src\/auth\/middleware\.ts/);
    assert.doesNotMatch(result.stdout, /node_modules/);
  });
});

test("CLI suggest-context help shows usage", async () => {
  const result = await runCli(["suggest-context", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk suggest-context/);
});

test("CLI work claims todo task and prints prompt", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);

    const result = await runCli(["work", "0001", "--owner", "codex-a", "--target", "codex", "--level", "2"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Agent: codex/);
    assert.match(result.stdout, /Claimed: yes/);
    assert.match(result.stdout, /apk task verify 0001 --owner codex-a/);
    assert.match(await readFile(join(directory, ".tasks", "0001-todo-task.md"), "utf8"), /State: doing/);
  });
});

test("CLI work refuses unregistered owner", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");

    const result = await runCli(["work", "0001", "--owner", "codex-a", "--target", "codex"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Agent is not registered/) || result.stderr.match(/Agent is not registered/),
      "Expected unregistered owner error",
    );
  });
});

test("CLI work can write a session prompt", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(join(directory, ".tasks", "0001-todo-task.md"), buildTaskMarkdown("0001", "Todo Task", "todo"), "utf8");
    await runCli(["agent", "register", "--id", "codex-a", "--platform", "codex", "--model", "gpt"], directory);

    const result = await runCli(["work", "0001", "--owner", "codex-a", "--target", "codex", "--write-session"], directory);
    const sessionMatch = /Session: (.+prompt\.md)/.exec(result.stdout);

    assert.equal(result.exitCode, 0);
    assert.ok(sessionMatch, "Expected session path in output");
    assert.match(await readFile(join(directory, sessionMatch![1]), "utf8"), /Agent: codex/);
  });
});

test("CLI audit writes reports in a temp repository", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, "src"), { recursive: true });

    const result = await runCli(["audit"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Audit: warnings/);
    assert.match(await readFile(join(directory, "docs/audit-report.md"), "utf8"), /# Audit Report/);
    assert.match(await readFile(join(directory, "docs/project-map.md"), "utf8"), /# Project Map/);
  });
});

test("CLI migrates legacy logs to sharded files", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic/agents.jsonl"),
      `${JSON.stringify({
        id: "codex-a",
        platform: "codex",
        model: "gpt-5.5",
        label: "codex-a",
        created: "2026-05-08T12:00:00Z",
      })}\n`,
      "utf8",
    );
    await writeFile(
      join(directory, ".agentic/runs.jsonl"),
      `${JSON.stringify({
        time: "2026-05-08T12:01:00Z",
        event: "claim",
        task: "0001",
        agent: "codex-a",
        platform: "codex",
        model: "gpt-5.5",
        state: "doing",
        outcome: "ok",
      })}\n`,
      "utf8",
    );

    const result = await runCli(["agent", "migrate-logs", "--remove-legacy"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Agents written: 1/);
    assert.match(
      await readFile(join(directory, ".agentic/agents/codex-a.json"), "utf8"),
      /"developer": "unknown"/,
    );
    assert.match(
      await readFile(join(directory, ".agentic/runs/2026-05-08_unknown_codex-a.jsonl"), "utf8"),
      /"developer":"unknown"/,
    );
  });
});

test("CLI writes analytics summary in a temp repository", async () => {
  await withTempDirectory(async (directory) => {
    const register = await runCli([
      "agent",
      "register",
      "--id",
      "codex-a",
      "--developer",
      "alice",
      "--platform",
      "codex",
      "--model",
      "gpt-5.5",
    ], directory);
    const summary = await runCli(["analytics", "summary", "--month", "2027-05", "--write"], directory);

    assert.equal(register.exitCode, 0);
    assert.equal(summary.exitCode, 0);
    assert.match(summary.stdout, /Wrote docs\/analytics\/agent-summary-2027-05\.md/);
    assert.match(
      await readFile(join(directory, "docs/analytics/agent-summary-2027-05.md"), "utf8"),
      /# Agent Analytics Summary 2027-05/,
    );
  });
});

test("CLI sync checks and writes generated files in a temp repository", async () => {
  await withTempDirectory(async (directory) => {
    const check = await runCli(["sync", "codex"], directory);
    const write = await runCli(["sync", "codex", "--write"], directory);
    const recheck = await runCli(["sync", "codex"], directory);

    assert.equal(check.exitCode, 1);
    assert.match(check.stdout, /Generated files are out of sync/);
    assert.equal(write.exitCode, 0);
    assert.match(write.stdout, /Generated files were updated/);
    assert.equal(recheck.exitCode, 0);
    assert.match(recheck.stdout, /Generated files are in sync/);
    assert.match(await readFile(join(directory, ".codex/instructions.md"), "utf8"), /# Codex Instructions/);
});

test("CLI task deps shows prerequisites and dependents", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-base-task.md"), buildTaskMarkdown("0001", "Base Task", "done", "archive"), "utf8");
    await writeFile(
      join(tasksDir, "0002-target-task.md"),
      buildTaskMarkdown("0002", "Target Task", "todo").replace("Depends on: none", "Depends on: 0001"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0003-child-task.md"),
      buildTaskMarkdown("0003", "Child Task", "todo").replace("Depends on: none", "Depends on: 0002"),
      "utf8",
    );

    const result = await runCli(["task", "deps", "0002"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Task: 0002/);
    assert.match(result.stdout, /Title: Target Task/);
    assert.match(result.stdout, /Prerequisites:/);
    assert.match(result.stdout, /0001/);
    assert.match(result.stdout, /Dependents:/);
    assert.match(result.stdout, /0003/);
  });
});

test("CLI task deps returns exit code 1 for unknown task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });

    const result = await runCli(["task", "deps", "9999"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Task file not found/) || result.stderr.match(/Task file not found/),
      "Expected task not found error",
    );
  });
});

test("CLI task deps --help shows usage", async () => {
  const result = await runCli(["task", "deps", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task deps <task-id>/);
});

test("CLI task verify --help shows usage", async () => {
  const result = await runCli(["task", "verify", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task verify <task-id>/);
  assert.match(result.stdout, /--check-files-only/);
});

test("CLI task rejects unknown subcommand", async () => {
  const result = await runCli(["task", "unknown"]);

  assert.equal(result.exitCode, 1);
  assert.ok(
    result.stdout.match(/Unknown task subcommand/) || result.stderr.match(/Unknown task subcommand/),
    "Expected unknown subcommand error",
  );
});

test("CLI task deps shows no prerequisites for independent task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, "0001-standalone-task.md"), buildTaskMarkdown("0001", "Standalone Task", "todo"), "utf8");

    const result = await runCli(["task", "deps", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Prerequisites: none/);
    assert.match(result.stdout, /Dependents: none/);
  });
  });
});

test("CLI task create --help shows usage", async () => {
  const result = await runCli(["task", "create", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /--title/);
  assert.match(result.stdout, /--goal/);
  assert.match(result.stdout, /--mode/);
  assert.match(result.stdout, /--risk/);
  assert.match(result.stdout, /--verification/);
});

test("CLI task create writes a valid task file", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "Smoke Test Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli,docs",
      "--risk", "low",
      "--context", "AGENTS.md,docs/task-system.md",
      "--allowed", ".tasks/0001-smoke-test-task.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Created: \.tasks\/0001-smoke-test-task\.md/);

    const content = await readFile(
      join(directory, ".tasks", "0001-smoke-test-task.md"),
      "utf8",
    );
    assert.match(content, /# Task 0001 - Smoke Test Task/);
    assert.match(content, /State: todo/);
    assert.match(content, /Owner: none/);
    assert.match(content, /Scope: cli,docs/);
    assert.match(content, /Risk: low/);
  });
});

test("CLI task create supports explicit --goal", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "Goal Task",
      "--goal", "Use this detailed goal.",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "src/cli/index.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 0);
    assert.match(
      await readFile(join(directory, ".tasks", "0001-goal-task.md"), "utf8"),
      /Use this detailed goal\./,
    );
  });
});

test("CLI task create supports bugfix template defaults", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCli([
      "task", "create",
      "--template", "bugfix",
      "--title", "Fix Parser",
      "--scope", "cli",
      "--allowed", "src/cli/index.ts",
    ], directory);

    assert.equal(result.exitCode, 0);
    const content = await readFile(join(directory, ".tasks", "0001-fix-parser.md"), "utf8");
    assert.match(content, /Lane: bugfix/);
    assert.match(content, /Risk: medium/);
    assert.match(content, /Tags: bugfix/);
    assert.match(content, /- pnpm test/);
  });
});

test("CLI task create template allows explicit overrides", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    const result = await runCli([
      "task", "create",
      "--template", "docs",
      "--title", "Document CLI",
      "--mode", "maintenance",
      "--risk", "medium",
      "--tags", "docs,cli",
      "--scope", "docs",
      "--allowed", "README.md",
    ], directory);

    assert.equal(result.exitCode, 0);
    const content = await readFile(join(directory, ".tasks", "0001-document-cli.md"), "utf8");
    assert.match(content, /Mode: maintenance/);
    assert.match(content, /Risk: medium/);
    assert.match(content, /Tags: docs,cli/);
  });
});

test("CLI task create rejects unknown template", async () => {
  const result = await runCli([
    "task", "create",
    "--template", "unknown",
    "--title", "Bad Template",
    "--scope", "cli",
    "--allowed", "src/cli/index.ts",
  ]);

  assert.equal(result.exitCode, 1);
  assert.ok(
    result.stdout.match(/--template must be one of/) || result.stderr.match(/--template must be one of/),
    "Expected unknown template error",
  );
});

test("CLI task create rejects flag values that are missing", async () => {
  await withTempDirectory(async (directory) => {
    const result = await runCli([
      "task", "create",
      "--title", "--mode",
      "mvp",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--title requires a value/) || result.stderr.match(/--title requires a value/),
      "Expected missing value error",
    );
  });
});

test("CLI agent register rejects flag values that are missing", async () => {
  await withTempDirectory(async (directory) => {
    const result = await runCli([
      "agent", "register",
      "--id", "--platform", "codex",
      "--model", "gpt",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--id requires a value/) || result.stderr.match(/--id requires a value/),
      "Expected missing value error",
    );
  });
});

test("CLI analytics summary rejects missing month value", async () => {
  const result = await runCli(["analytics", "summary", "--month", "--write"]);

  assert.equal(result.exitCode, 1);
  assert.ok(
    result.stdout.match(/--month requires a value/) || result.stderr.match(/--month requires a value/),
    "Expected missing value error",
  );
});

test("CLI task create rejects missing title", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--title is required/) || result.stderr.match(/--title is required/),
      "Expected missing title error",
    );
  });
});

test("CLI task create rejects invalid mode", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "Bad Mode",
      "--mode", "invalid",
      "--lane", "implementation",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--mode must be one of/) || result.stderr.match(/--mode must be one of/),
      "Expected invalid mode error",
    );
  });
});

test("CLI task create rejects missing dependency", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "Missing Dep",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
      "--depends", "9999",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Dependency validation failed/) || result.stderr.match(/Dependency validation failed/),
      "Expected dependency validation error",
    );
  });
});

test("CLI task create increments id after existing task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0005-existing-task.md"),
      buildTaskMarkdown("0005", "Existing Task", "done", "archive"),
      "utf8",
    );
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "Next Task",
      "--mode", "product",
      "--lane", "tasks",
      "--scope", "cli",
      "--risk", "medium",
      "--context", "AGENTS.md",
      "--allowed", ".tasks/0006-next-task.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Created: \.tasks\/0006-next-task\.md/);
  });
});

test("CLI task create rejects duplicate file path", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    await runCli([
      "task", "create",
      "--title", "Example Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", ".tasks/0001-example-task.md",
      "--verification", "pnpm test",
    ], directory);

    const result = await runCli([
      "task", "create",
      "--title", "Example Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", ".tasks/0001-example-task.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Task file already exists/) || result.stderr.match(/Task file already exists/),
      "Expected duplicate file error",
    );
  });
});

test("CLI task archive moves a done task to archive", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Archived: 0001 -> .tasks\/archive\/0001-done-task\.md/);
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "archive", "0001-done-task.md")),
    );
    assert.rejects(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
      /ENOENT/,
    );
  });
});

test("CLI task archive refuses non-done task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-todo-task.md"),
      buildTaskMarkdown("0001", "Todo Task", "todo"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "0001"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/only done tasks can be archived/) || result.stderr.match(/only done tasks can be archived/),
      "Expected non-done refusal error",
    );
  });
});

test("CLI task archive --all moves all done tasks", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-one.md"),
      buildTaskMarkdown("0001", "Done One", "done", "archive"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0002-done-two.md"),
      buildTaskMarkdown("0002", "Done Two", "done", "archive"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0003-todo-task.md"),
      buildTaskMarkdown("0003", "Todo Task", "todo"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "--all"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Archived: 0001/);
    assert.match(result.stdout, /Archived: 0002/);
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0003-todo-task.md")),
    );
  });
});

test("CLI task archive --help shows usage", async () => {
  const result = await runCli(["task", "archive", "--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /apk task archive \[<task-id>\]/);
  assert.match(result.stdout, /archive/);
});

test("CLI task archive reports error for missing task id", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });

    const result = await runCli(["task", "archive", "9999"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Task file not found/) || result.stderr.match(/Task file not found/),
      "Expected task not found error",
    );
  });
});

test("CLI tasks shows only active tasks after archive", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );
    await writeFile(
      join(tasksDir, "0002-todo-task.md"),
      buildTaskMarkdown("0002", "Todo Task", "todo"),
      "utf8",
    );

    await runCli(["task", "archive", "0001"], directory);

    const result = await runCli(["tasks"], directory);

    assert.equal(result.exitCode, 0);
    assert.doesNotMatch(result.stdout, /0001/);
    assert.match(result.stdout, /0002/);
  });
});

// Regression tests for task 0046 review findings

test("CLI task archive rejects unknown flags before moving task", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "0001", "--unknown"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Unknown option: --unknown/) || result.stderr.match(/Unknown option: --unknown/),
      "Expected unknown option error",
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
      "Task should not be moved",
    );
  });
});

test("CLI task archive --all rejects unknown flags", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "--all", "--unknown"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Unknown option: --unknown/) || result.stderr.match(/Unknown option: --unknown/),
      "Expected unknown option error",
    );
  });
});

test("CLI task archive --all rejects extra positional args", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "archive", "--all", "0001"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/no positional args/) || result.stderr.match(/no positional args/),
      "Expected positional args error",
    );
  });
});

test("CLI tasks --all includes archived task files", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0002-todo-task.md"),
      buildTaskMarkdown("0002", "Todo Task", "todo"),
      "utf8",
    );
    await mkdir(join(tasksDir, "archive"), { recursive: true });
    await writeFile(
      join(tasksDir, "archive", "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const defaultResult = await runCli(["tasks"], directory);
    assert.equal(defaultResult.exitCode, 0);
    assert.doesNotMatch(defaultResult.stdout, /0001/, "Default view should exclude archived tasks");
    assert.match(defaultResult.stdout, /0002/, "Default view should include active tasks");

    const allResult = await runCli(["tasks", "--all"], directory);
    assert.equal(allResult.exitCode, 0);
    assert.match(allResult.stdout, /0001/, "--all should include archived tasks");
    assert.match(allResult.stdout, /0002/, "--all should include active tasks");
  });
});

test("CLI task create rejects missing --scope", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "No Scope Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--allowed", "test.ts",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--scope must include/) || result.stderr.match(/--scope must include/),
      "Expected missing scope error",
    );
  });
});

test("CLI task create rejects missing --allowed", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await runCli([
      "task", "create",
      "--title", "No Allowed Task",
      "--mode", "mvp",
      "--lane", "implementation",
      "--scope", "cli",
      "--risk", "low",
      "--context", "AGENTS.md",
      "--verification", "pnpm test",
    ], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/--allowed must include/) || result.stderr.match(/--allowed must include/),
      "Expected missing allowed error",
    );
  });
});

test("CLI task deps works for archived task without stack trace", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(join(tasksDir, "archive"), { recursive: true });
    await writeFile(
      join(tasksDir, "archive", "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );

    const result = await runCli(["task", "deps", "0001"], directory);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Task: 0001/, "Should show archived task deps");
    assert.doesNotMatch(result.stderr, /Error:/, "Should not have stack trace in stderr");
    assert.doesNotMatch(result.stdout, /at\s+\S+:\d+:\d+/, "Should not have stack trace in stdout");
  });
});

test("CLI task archive --all refuses archive path collisions", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDir = join(directory, ".tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "0001-done-task.md"),
      buildTaskMarkdown("0001", "Done Task", "done", "archive"),
      "utf8",
    );
    await mkdir(join(tasksDir, "archive"), { recursive: true });
    await writeFile(
      join(tasksDir, "archive", "0001-done-task.md"),
      "existing",
      "utf8",
    );

    const result = await runCli(["task", "archive", "--all"], directory);

    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stdout.match(/Archive path already exists/) || result.stderr.match(/Archive path already exists/),
      "Expected archive collision error",
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
      "Source task should not be moved",
    );
  });
});
