import { execFile } from "node:child_process";
import fsPromises, { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { format, promisify } from "node:util";

import { createBacklogItem } from "../core/backlog/index.js";
import { dispatchPublicCommand } from "./command-registry.js";

const execFileAsync = promisify(execFile);

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCommand(args: readonly string[], cwd: string): Promise<CommandResult> {
  const previousCwd = process.cwd();
  const previousLog = console.log;
  const previousError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];
  try {
    process.chdir(cwd);
    console.log = (...values: unknown[]) => { stdout.push(`${format(...values)}\n`); };
    console.error = (...values: unknown[]) => { stderr.push(`${format(...values)}\n`); };
    const result = await dispatchPublicCommand(args[0]!, args.slice(1));
    assert.notEqual(result, undefined, `Unknown command: ${args[0]}`);
    return { exitCode: result!, stdout: stdout.join(""), stderr: stderr.join("") };
  } finally {
    process.chdir(previousCwd);
    console.log = previousLog;
    console.error = previousError;
  }
}

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-integration-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

async function git(directory: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: directory });
}

async function initializeGitRepository(directory: string): Promise<void> {
  await git(directory, "init", "--quiet");
  await git(directory, "config", "user.email", "integration@example.test");
  await git(directory, "config", "user.name", "Integration");
}

async function commitAll(directory: string, message: string): Promise<void> {
  await git(directory, "add", "-A");
  await git(directory, "commit", "--quiet", "-m", message);
}

test("integrated greenfield flow initializes, promotes, verifies, completes, and archives", async () => {
  await withTempDirectory(async (directory) => {
    await initializeGitRepository(directory);
    assert.equal((await runCommand(["init"], directory)).exitCode, 0);
    await commitAll(directory, "initialize");

    const add = await runCommand([
      "backlog", "add", "--title", "Integrated future idea", "--status", "deferred",
      "--criteria", "MVP acceptance is recorded", "--json",
    ], directory);
    assert.equal(add.exitCode, 0, add.stderr);
    const card = JSON.parse(add.stdout) as { slug: string };

    const promote = await runCommand([
      "backlog", "promote", card.slug, "--apply",
      "--scope", "integration", "--context", "AGENTS.md", "--allowed", "src/**",
      "--verification", "true", "--confirm", "criterion-1", "--reason", "Operator confirmed the MVP criterion.",
      "--json",
    ], directory);
    assert.equal(promote.exitCode, 0, promote.stderr);
    const promoted = JSON.parse(promote.stdout) as { task: { id: string; path: string } };
    assert.match(promoted.task.path, /^\.tasks\/0002-/);
    await commitAll(directory, "promote integrated backlog card");

    assert.equal((await runCommand(["agent", "register", "--id", "integration-agent", "--platform", "fixture", "--model", "fixture"], directory)).exitCode, 0);
    assert.equal((await runCommand(["claim", promoted.task.id, "--owner", "integration-agent"], directory)).exitCode, 0);
    const verify = await runCommand(["task", "verify", promoted.task.id, "--owner", "integration-agent"], directory);
    assert.equal(verify.exitCode, 0, verify.stderr);
    assert.match(verify.stdout, /Result: pass/);
    const done = await runCommand(["done", promoted.task.id, "--owner", "integration-agent"], directory);
    assert.equal(done.exitCode, 0, done.stderr);
    assert.match(done.stdout, /State: done/);

    const archive = await runCommand(["task", "archive", promoted.task.id, "--apply"], directory);
    assert.equal(archive.exitCode, 0, archive.stderr);
    const provenance = await runCommand(["task", "provenance", promoted.task.id, "--json"], directory);
    assert.equal(provenance.exitCode, 0, provenance.stderr);
    assert.match(provenance.stdout, new RegExp(promoted.task.id));

    const repeated = await runCommand([
      "backlog", "promote", card.slug, "--apply",
      "--scope", "integration", "--context", "AGENTS.md", "--allowed", "src/**",
      "--verification", "true", "--confirm", "criterion-1", "--reason", "Operator confirmed the MVP criterion.",
      "--json",
    ], directory);
    assert.equal(repeated.exitCode, 0, repeated.stderr);
    assert.equal((JSON.parse(repeated.stdout) as { outcome: string }).outcome, "already-promoted");
  });
});

test("integrated existing-repository adoption previews then applies scratch support", async () => {
  await withTempDirectory(async (directory) => {
    await initializeGitRepository(directory);
    await writeFile(join(directory, "package.json"), JSON.stringify({ devDependencies: { typescript: "^6.0.0" } }), "utf8");
    await writeFile(join(directory, "index.ts"), "console.log('app');\n", "utf8");

    const preview = await runCommand(["adopt", "--preview"], directory);
    assert.equal(preview.exitCode, 0, preview.stderr);
    assert.match(preview.stdout, /create tmp\/apk\//);
    await assert.rejects(() => stat(join(directory, "tmp", "apk")));

    const applied = await runCommand(["adopt", "--apply"], directory);
    assert.equal(applied.exitCode, 0, applied.stderr);
    assert.ok((await stat(join(directory, "tmp", "apk"))).isDirectory());
    assert.match(await readFile(join(directory, ".gitignore"), "utf8"), /^\/tmp\/apk\/$/m);
  });
});

test("integrated backlog stays outside tasks while blocked tasks remain executable", async () => {
  await withTempDirectory(async (directory) => {
    await initializeGitRepository(directory);
    assert.equal((await runCommand(["init"], directory)).exitCode, 0);
    await commitAll(directory, "initialize");

    assert.equal((await runCommand(["agent", "register", "--id", "integration-agent", "--platform", "fixture", "--model", "fixture"], directory)).exitCode, 0);
    assert.equal((await runCommand(["claim", "0001", "--owner", "integration-agent"], directory)).exitCode, 0);
    assert.equal((await runCommand(["block", "0001", "--owner", "integration-agent", "--reason", "Waiting on a decision."], directory)).exitCode, 0);

    const add = await runCommand([
      "backlog", "add", "--title", "Deferred integration idea", "--status", "deferred",
      "--criteria", "A later decision is recorded", "--json",
    ], directory);
    assert.equal(add.exitCode, 0, add.stderr);
    const card = JSON.parse(add.stdout) as { slug: string };

    const list = await runCommand(["backlog", "list", "--json"], directory);
    assert.equal(list.exitCode, 0, list.stderr);
    assert.deepEqual((JSON.parse(list.stdout) as { items: Array<{ slug: string }> }).items.map((item) => item.slug), [card.slug]);
    const tasks = await runCommand(["tasks", "--all"], directory);
    assert.match(tasks.stdout, /0001/);
    assert.doesNotMatch(tasks.stdout, /Deferred integration idea/);

    const preview = await runCommand([
      "backlog", "promote", card.slug, "--preview",
      "--scope", "integration", "--context", "AGENTS.md", "--allowed", "src/**",
      "--verification", "true", "--json",
    ], directory);
    assert.equal(preview.exitCode, 1);
    assert.equal((JSON.parse(preview.stdout) as { valid: boolean }).valid, false);
    const apply = await runCommand([
      "backlog", "promote", card.slug, "--apply",
      "--scope", "integration", "--context", "AGENTS.md", "--allowed", "src/**",
      "--verification", "true", "--json",
    ], directory);
    assert.equal(apply.exitCode, 1);
    assert.match(apply.stderr, /Unconfirmed promotion criteria/);
  });
});

test("integrated scratch is ignored, generated instructions are current, and CI policy is visible", async () => {
  await withTempDirectory(async (directory) => {
    await initializeGitRepository(directory);
    assert.equal((await runCommand(["init"], directory)).exitCode, 0);
    await mkdir(join(directory, "tmp", "apk"), { recursive: true });
    await writeFile(join(directory, "tmp", "apk", "note.md"), "scratch\n", "utf8");

    const ignored = await execFileAsync("git", ["check-ignore", "tmp/apk/note.md"], { cwd: directory });
    assert.equal(ignored.stdout.trim(), "tmp/apk/note.md");
    const status = await runCommand(["status"], directory);
    assert.equal(status.exitCode, 0, status.stderr);
    assert.doesNotMatch(status.stdout, /tmp\/apk/);

    assert.equal((await runCommand(["sync", "--write"], directory)).exitCode, 0);
    const sync = await runCommand(["sync"], directory);
    assert.equal(sync.exitCode, 0, sync.stderr);
    assert.match(sync.stdout, /Current: 3/);
    const agents = await readFile(join(directory, "AGENTS.md"), "utf8");
    assert.match(agents, /Match CI to project stage/);
    assert.match(agents, /Use the backlog for durable future ideas/);
  });
});

test("hot read-only commands do not add backlog I/O relative to the baseline", async () => {
  await withTempDirectory(async (directory) => {
    const base = join(directory, "base");
    const withBacklog = join(directory, "with-backlog");
    await mkdir(base, { recursive: true });
    assert.equal((await runCommand(["init"], base)).exitCode, 0);
    await cp(base, withBacklog, { recursive: true });
    await createBacklogItem(withBacklog, ".tasks", {
      title: "Deferred performance fixture",
      status: "deferred",
      criteria: ["A later decision is recorded"],
    });

    const commands = [
      ["status", "--detail"],
      ["attention", "--json"],
      ["workers", "--json"],
      ["next-task"],
    ] as const;

    const measure = async (cwd: string): Promise<{ operations: number; backlogAccesses: string[]; backlogContentReads: string[] }> => {
      const original = {
        readdir: fsPromises.readdir,
        open: fsPromises.open,
        readFile: fsPromises.readFile,
        opendir: fsPromises.opendir,
      };
      let operations = 0;
      const backlogAccesses: string[] = [];
      const backlogContentReads: string[] = [];
      const record = (operation: string, path: unknown): void => {
        operations += 1;
        const text = String(path);
        if (text.includes(".tasks") && /(?:^|[\\/])backlog(?:[\\/]|$)/.test(text)) {
          backlogAccesses.push(`${operation}:${text}`);
          if (operation === "open" || operation === "readFile") backlogContentReads.push(`${operation}:${text}`);
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
        for (const command of commands) {
          const result = await runCommand(command, cwd);
          assert.equal(result.exitCode, 0, `${command.join(" ")}: ${result.stderr}`);
        }
      } finally {
        fsPromises.readdir = original.readdir;
        fsPromises.open = original.open;
        fsPromises.readFile = original.readFile;
        fsPromises.opendir = original.opendir;
        syncBuiltinESMExports();
      }
      return { operations, backlogAccesses, backlogContentReads };
    };

    const baseline = await measure(base);
    const withCard = await measure(withBacklog);
    assert.deepEqual(withCard.backlogContentReads, []);
    assert.ok(withCard.backlogAccesses.every((access) => access.startsWith("readdir:")));
    assert.ok(
      withCard.operations - baseline.operations <= commands.length,
      `expected at most one backlog directory enumeration per command; baseline=${baseline.operations} withCard=${withCard.operations}`,
    );
  });
});

test("integrated downstream-shaped fixtures keep Go, Python, and Node stacks visible to doctor", async () => {
  await withTempDirectory(async (directory) => {
    const shapes = [
      { name: "go", files: { "go.mod": "module fixture\n\ngo 1.24\n" }, expected: /Go/ },
      {
        name: "python",
        files: {
          "pyproject.toml": "[project]\nname='fixture'\n[build-system]\nrequires=['setuptools']\nbuild-backend='setuptools.build_meta'\n",
        },
        expected: /Python/,
      },
      { name: "node", files: { "package.json": JSON.stringify({ main: "index.js", scripts: { test: "node --test" } }), "index.js": "console.log('app');\n" }, expected: /Node\.js/ },
    ];
    for (const shape of shapes) {
      const root = join(directory, shape.name);
      await mkdir(root, { recursive: true });
      for (const [path, content] of Object.entries(shape.files)) await writeFile(join(root, path), content, "utf8");
      const result = await runCommand(["doctor"], root);
      assert.equal(result.exitCode, 0, `${shape.name}: ${result.stderr}`);
      assert.match(result.stdout, shape.expected, shape.name);
    }
  });
});
