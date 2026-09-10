import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { detectQualityCapabilities } from "./index.js";

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-quality-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
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
