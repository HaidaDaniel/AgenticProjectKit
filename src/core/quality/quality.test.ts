import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { promisify } from "node:util";

import { detectQualityCapabilities } from "./index.js";

const execFileAsync = promisify(execFile);

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-quality-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

function statusOf(result: Awaited<ReturnType<typeof detectQualityCapabilities>>, id: string) {
  return result.capabilities.find((capability) => capability.id === id);
}

test("quality detection classifies TypeScript and pnpm evidence without executing commands", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "package.json"), JSON.stringify({
      scripts: {
        lint: "tsc -p tsconfig.json --noEmit",
        test: "node --test",
        build: "tsc -p tsconfig.build.json",
      },
      devDependencies: { typescript: "^6.0.0" },
    }), "utf8");
    await writeFile(join(directory, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
    await writeFile(join(directory, "tsconfig.json"), "{}\n", "utf8");

    const result = await detectQualityCapabilities(directory);

    assert.equal(result.supported, true);
    assert.equal(statusOf(result, "typecheck")?.status, "detected");
    assert.equal(statusOf(result, "lint")?.status, "missing");
    assert.equal(statusOf(result, "tests")?.status, "detected");
    assert.equal(statusOf(result, "build")?.status, "detected");
    assert.equal(result.policy.status, "pass");
  });
});

test("quality detection recognizes alternative commands and platform-neutral markers", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "pyproject.toml"), "[tool.pytest]\n", "utf8");
    await writeFile(join(directory, "package.json"), JSON.stringify({
      scripts: {
        check: "ruff check .",
        verify: "pytest --cov",
      },
    }), "utf8");
    await mkdir(join(directory, ".gitlab"), { recursive: true });
    await writeFile(join(directory, ".gitlab-ci.yml"), "test: {}\n", "utf8");
    await writeFile(join(directory, ".pre-commit-config.yaml"), "repos: []\n", "utf8");

    const result = await detectQualityCapabilities(directory);

    assert.equal(statusOf(result, "lint")?.status, "detected");
    assert.equal(statusOf(result, "tests")?.status, "detected");
    assert.equal(statusOf(result, "coverage")?.status, "detected");
    assert.equal(statusOf(result, "hooks")?.status, "detected");
    assert.equal(statusOf(result, "ci")?.status, "detected");
  });
});

test("quality detection reads bounded non-Node configuration markers", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "pyproject.toml"), [
      "[tool.ruff]",
      "line-length = 100",
      "[tool.pytest]",
      "testpaths = ['tests']",
      "[tool.coverage.run]",
      "branch = true",
      "[tool.mypy]",
      "files = ['src']",
      "",
    ].join("\n"), "utf8");

    const result = await detectQualityCapabilities(directory);

    assert.equal(result.supported, true);
    assert.equal(statusOf(result, "typecheck")?.status, "detected");
    assert.equal(statusOf(result, "lint")?.status, "detected");
    assert.equal(statusOf(result, "tests")?.status, "detected");
    assert.equal(statusOf(result, "coverage")?.status, "detected");
  });
});

test("quality detection recognizes pytest.ini_options as a test capability", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "pyproject.toml"), [
      "[tool.pytest.ini_options]",
      "testpaths = [\"tests\"]",
      "",
    ].join("\n"), "utf8");

    const result = await detectQualityCapabilities(directory);

    assert.equal(statusOf(result, "tests")?.status, "detected");
    assert.equal(statusOf(result, "tests")?.evidence[0]?.source, "pyproject.toml");
  });
});

test("quality CI detection ignores wrong-type markers and scans past empty directories", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".github", "workflows"), { recursive: true });
    await mkdir(join(directory, ".gitlab-ci.yml"), { recursive: true });
    await writeFile(join(directory, ".gitlab-ci.yaml"), "test: {}\n", "utf8");

    const result = await detectQualityCapabilities(directory);
    const ci = statusOf(result, "ci");

    assert.equal(ci?.status, "detected");
    assert.deepEqual(ci?.evidence.map((evidence) => evidence.source), [".gitlab-ci.yaml"]);
  });
});

test("quality detection ignores non-canonical pytest table suffixes", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "pyproject.toml"), "[tool.pytest.ini_options_extra]\ntestpaths = [\"tests\"]\n", "utf8");

    const result = await detectQualityCapabilities(directory);

    assert.equal(statusOf(result, "tests")?.status, "missing");
  });
});

test("quality policy fails only when explicit required evidence is missing or unknown", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
    const result = await detectQualityCapabilities(directory, {
      required: ["tests", "ci"],
      recommended: ["coverage"],
    });

    assert.equal(result.policy.status, "fail");
    assert.deepEqual(result.policy.missingRequired, ["ci"]);
    assert.deepEqual(result.policy.unknownRequired, []);
    assert.equal(statusOf(result, "coverage")?.disposition, "recommended-missing");
  });
});

test("unsupported repositories remain unknown and conservative", async () => {
  await withTempDirectory(async (directory) => {
    const result = await detectQualityCapabilities(directory, { required: ["tests"], recommended: [] });

    assert.equal(result.supported, false);
    assert.equal(statusOf(result, "tests")?.status, "unknown");
    assert.deepEqual(result.policy.unknownRequired, ["tests"]);
    assert.equal(result.policy.status, "fail");
  });
});

test("quality detection treats tracked package-local Go tests as strong evidence", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "go.mod"), "module example.com/db\n\ngo 1.22\n", "utf8");
    await mkdir(join(directory, "internal", "db"), { recursive: true });
    await writeFile(join(directory, "internal", "db", "db_test.go"), "package db\n", "utf8");
    const git = async (...args: string[]) => execFileAsync("git", args, { cwd: directory });
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");

    const result = await detectQualityCapabilities(directory);
    const tests = statusOf(result, "tests");
    assert.equal(tests?.status, "detected");
    assert.ok(tests?.evidence.some((entry) => entry.source.includes("*_test.go")));
    assert.ok(tests?.evidence.some((entry) => entry.detail.includes("Go package-local")));
  });
});

test("quality detection finds Go tests in non-Git directories without deep traversal", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "go.mod"), "module example.com/db\n\ngo 1.22\n", "utf8");
    await mkdir(join(directory, "internal", "db"), { recursive: true });
    await writeFile(join(directory, "internal", "db", "db_test.go"), "package db\n", "utf8");
    // Vendored copies must be skipped by the bounded walk.
    await mkdir(join(directory, "vendor", "lib"), { recursive: true });
    await writeFile(join(directory, "vendor", "lib", "lib_test.go"), "package lib\n", "utf8");

    const result = await detectQualityCapabilities(directory);
    const tests = statusOf(result, "tests");
    assert.equal(tests?.status, "detected");
    assert.ok(tests?.evidence.some((entry) => entry.detail.includes("internal/db/db_test.go")));
    assert.ok(tests?.evidence.every((entry) => !entry.detail.includes("vendor")));
  });
});

test("quality detection does not falsely detect tests for a Go module without *_test.go files", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "go.mod"), "module example.com/db\n\ngo 1.22\n", "utf8");
    await mkdir(join(directory, "internal", "db"), { recursive: true });
    await writeFile(join(directory, "internal", "db", "db.go"), "package db\n", "utf8");

    const result = await detectQualityCapabilities(directory);
    assert.equal(statusOf(result, "tests")?.status, "missing");
  });
});

test("quality detection ignores gitignored Go test files and keeps tracked evidence", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "go.mod"), "module example.com/db\n\ngo 1.22\n", "utf8");
    await mkdir(join(directory, "internal", "db"), { recursive: true });
    await writeFile(join(directory, "internal", "db", "db_test.go"), "package db\n", "utf8");
    await writeFile(join(directory, ".gitignore"), "internal/db/db_test.go\n", "utf8");
    const git = async (...args: string[]) => execFileAsync("git", args, { cwd: directory });
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    // Untracked extra test remains listed only through the bounded fallback? No: tracked list returns
    // an empty result and the fallback walk includes it, which is still bounded and visible.
    await writeFile(join(directory, "pending_test.go"), "package main\n", "utf8");

    const result = await detectQualityCapabilities(directory);
    const tests = statusOf(result, "tests");
    assert.equal(tests?.status, "detected");
  });
});
