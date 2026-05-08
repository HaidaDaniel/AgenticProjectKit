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
  assert.match(result.stdout, /apk tasks \[--state <state>\] \[--owner <agent-id>\]/);
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
});
