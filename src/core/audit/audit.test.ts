import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import "./lint.test.js";
import "../quality/quality.test.js";
import { initProject } from "../init/index.js";
import { runDoctor } from "../doctor/index.js";
import { scanRepository } from "../scanners/index.js";
import { auditRepository } from "./index.js";

const execFileAsync = promisify(execFile);

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-audit-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

test("auditRepository writes reports and lists documentation gaps", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src/index.ts"), "console.log('app');\n", "utf8");

    const result = await auditRepository(directory);

    assert.equal(result.hasErrors, false);
    assert.ok(result.findings.some((finding) => finding.message === "Missing docs/project.md."));
    assert.match(
      await readFile(join(directory, "docs/audit-report.md"), "utf8"),
      /Missing kit docs:/,
    );
    assert.match(
      await readFile(join(directory, "docs/project-map.md"), "utf8"),
      /## Top-level Directories\n\n- src/,
    );
    assert.equal(
      await readFile(join(directory, "src/index.ts"), "utf8"),
      "console.log('app');\n",
    );
  });
});

test("auditRepository accepts initialized kit without critical errors", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);

    const result = await auditRepository(directory);

    assert.equal(result.hasErrors, false);
    assert.ok(result.taskCount >= 1);
    assert.ok(result.findings.every((finding) => finding.level !== "error"));
  });
});

test("auditRepository reports lightweight repo readiness findings", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        scripts: {
          test: "node --test",
          lint: "tsc --noEmit",
        },
        devDependencies: {
          typescript: "^6.0.0",
        },
      }, null, 2),
      "utf8",
    );
    await writeFile(join(directory, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
    await writeFile(
      join(directory, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: false } }, null, 2),
      "utf8",
    );

    const result = await auditRepository(directory);
    const report = await readFile(join(directory, "docs/audit-report.md"), "utf8");
    const map = await readFile(join(directory, "docs/project-map.md"), "utf8");

    assert.equal(result.hasErrors, false);
    assert.ok(result.findings.some((finding) => finding.message === "Missing package script: typecheck."));
    assert.ok(result.findings.some((finding) => finding.message === "TypeScript strict mode is disabled."));
    assert.match(report, /Package manager: pnpm/);
    assert.match(map, /## Repository Readiness/);
    assert.match(map, /TypeScript strict: no/);
  });
});

test("quality CI detection is directory-safe and shared across scanner, audit, and doctor", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".github", "workflows"), { recursive: true });
    await writeFile(join(directory, ".github", "workflows", "quality.yml"), "name: quality\n", "utf8");

    const scan = await scanRepository(directory);
    const audit = await auditRepository(directory);
    const doctor = await runDoctor(directory);

    assert.equal(scan.readiness.hasCi, true);
    assert.equal(audit.quality.capabilities.find((capability) => capability.id === "ci")?.status, "detected");
    assert.ok(!audit.findings.some((finding) => finding.message.includes("GitHub Actions workflow not detected")));
    assert.ok(!doctor.checks.some((check) => /GitHub Actions|CI missing/i.test(check.message)));
  });
});

test("old directory read reproducer is isolated while scanner, audit, and doctor stay safe", async () => {
  await withTempDirectory(async (directory) => {
    const workflowsDirectory = join(directory, ".github", "workflows");
    await mkdir(workflowsDirectory, { recursive: true });
    await writeFile(join(workflowsDirectory, "quality.yml"), "name: quality\n", "utf8");

    await assert.rejects(
      () => readFile(workflowsDirectory),
      (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "EISDIR"),
    );
    await assert.doesNotReject(async () => {
      await scanRepository(directory);
      await auditRepository(directory);
      await runDoctor(directory);
    });
  });
});

test("GitLab-only CI is projected as the shared quality capability", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".github", "workflows"), { recursive: true });
    await writeFile(join(directory, ".gitlab-ci.yml"), "test: {}\n", "utf8");

    const audit = await auditRepository(directory);
    const doctor = await runDoctor(directory);
    const report = await readFile(join(directory, "docs/audit-report.md"), "utf8");
    const map = await readFile(join(directory, "docs/project-map.md"), "utf8");

    assert.equal(audit.quality.capabilities.find((capability) => capability.id === "ci")?.status, "detected");
    assert.equal(audit.scan.readiness.hasCi, true);
    assert.ok(!audit.findings.some((finding) => finding.message.includes("GitHub Actions workflow not detected")));
    assert.ok(!doctor.checks.some((check) => /CI missing|GitHub Actions/i.test(check.message)));
    assert.match(report, /- CI present: yes/);
    assert.match(map, /- CI: yes/);
  });
});

test("auditRepository reports invalid task files as errors", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    await writeFile(
      join(directory, ".tasks/0002-broken.md"),
      [
        "# Task 0002 - Broken",
        "",
        "State: done",
        "Owner: none",
        "Mode: mvp",
        "Lane: bugfix",
        "Scope: docs",
        "Risk: low",
        "Parallel: false",
        "Depends on: none",
        "Tags: broken",
        "",
        "## Goal",
        "",
        "Break validation.",
        "",
        "## Context files",
        "",
        "- AGENTS.md",
        "",
        "## Files allowed to edit",
        "",
        "- docs/progress.md",
        "",
        "## Files forbidden to edit",
        "",
        "- application source files",
        "",
        "## Steps",
        "",
        "1. Do work.",
        "",
        "## Acceptance criteria",
        "",
        "- Done.",
        "",
        "## Verification commands",
        "",
        "- echo ok",
        "",
        "## Documentation updates",
        "",
        "- Update docs/progress.md.",
        "",
        "## Notes",
        "",
        "- none",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await auditRepository(directory);

    assert.equal(result.hasErrors, true);
    assert.ok(
      result.findings.some((finding) => (
        finding.level === "error" &&
        finding.message.includes("Owner none is only allowed")
      )),
    );
  });
});

test("auditRepository reports invalid config files as errors", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);
    await writeFile(
      join(directory, ".agentic/config.json"),
      JSON.stringify({ defaultMode: "legacy" }, null, 2),
      "utf8",
    );

    const result = await auditRepository(directory);

    assert.equal(result.hasErrors, true);
    assert.ok(
      result.findings.some((finding) => (
        finding.level === "error" &&
        finding.area === "config" &&
        finding.message.includes("defaultMode must be one of")
      )),
    );
  });
});

// Regression test for task 0046 review findings

test("auditRepository accepts active task depending on archived done task", async () => {
  await withTempDirectory(async (directory) => {
    await initProject(directory);

    const archivedDir = join(directory, ".tasks", "archive");
    await mkdir(archivedDir, { recursive: true });

    await writeFile(
      join(archivedDir, "0001-done-task.md"),
      [
        "# Task 0001 - Done Task",
        "",
        "State: done",
        "Owner: archive",
        "Mode: mvp",
        "Lane: implementation",
        "Scope: tasks",
        "Risk: low",
        "Parallel: false",
        "Depends on: none",
        "Tags: none",
        "",
        "## Goal",
        "",
        "A done task.",
        "",
        "## Context files",
        "",
        "- AGENTS.md",
        "",
        "## Files allowed to edit",
        "",
        "- .tasks/0001-done-task.md",
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
        "- None.",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      join(directory, ".tasks/0003-waiting-task.md"),
      [
        "# Task 0003 - Waiting Task",
        "",
        "State: todo",
        "Owner: none",
        "Mode: mvp",
        "Lane: implementation",
        "Scope: tasks",
        "Risk: low",
        "Parallel: false",
        "Depends on: 0001",
        "Tags: none",
        "",
        "## Goal",
        "",
        "Depends on archived done task.",
        "",
        "## Context files",
        "",
        "- AGENTS.md",
        "",
        "## Files allowed to edit",
        "",
        "- .tasks/0003-waiting-task.md",
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
        "- None.",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await auditRepository(directory);

    assert.ok(
      !result.findings.some((finding) => (
        finding.area === "dependencies" &&
        finding.message.includes("0001")
      )),
      "Should not report archived done task as missing dependency",
    );
  });
});

test("auditRepository reports Python and Go stacks from canonical markers", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "pyproject.toml"), "[project]\n", "utf8");
    await writeFile(join(directory, "go.mod"), "module example\n", "utf8");

    await auditRepository(directory);

    const projectMap = await readFile(join(directory, "docs/project-map.md"), "utf8");
    assert.match(projectMap, /## Detected Stack\n\n- Go\n- Python/);
  });
});


function projectMapInventory(map: string): boolean {
  return /## Repository Readiness/.test(map);
}

test("audits keep tests readiness findings consistent with detected test capability", async () => {
  await withTempDirectory(async (directory) => {
    // Node repository with conventional tests/: no contradictory findings.
    await mkdir(join(directory, "tests"), { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
    const nodeResult = await auditRepository(directory);
    assert.ok(!nodeResult.findings.some((finding) => finding.message === "Top-level test directory not detected."));

    // Node with a test script but no tests/ directory: capability is still detected via the
    // test script, so the layout note alone stays an inventory fact (absence of a contradiction).
    await withTempDirectory(async (nested) => {
      await writeFile(join(nested, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }), "utf8");
      const result = await auditRepository(nested);
      assert.ok(!result.findings.some((finding) => finding.message === "Top-level test directory not detected."));
      assert.ok(projectMapInventory(await readFile(join(nested, "docs/project-map.md"), "utf8")));
    });

    // Mixed Go plus APK tooling: tracked package-local Go tests are detected, package.json
    // exists without test scripts, and there no misleading readiness finding is emitted.
    await withTempDirectory(async (mixed) => {
      await writeFile(join(mixed, "go.mod"), "module example.com/app\n\ngo 1.22\n", "utf8");
      await writeFile(join(mixed, "package.json"), JSON.stringify({ devDependencies: { "agentic-project-kit": "0.4.3" } }), "utf8");
      await writeFile(join(mixed, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
      await mkdir(join(mixed, "internal", "db"), { recursive: true });
      await writeFile(join(mixed, "internal", "db", "db_test.go"), "package db\n", "utf8");
      const git = async (...args: string[]) => {
        for (const arg of args) {
          await execFileAsync("git", arg.split(" "), { cwd: mixed });
        }
      };
      await git("init --quiet", "config user.email codex@example.test", "config user.name Codex", "add .", "commit --quiet -m initial");
      const result = await auditRepository(mixed);
      assert.equal(result.hasErrors, false);
      assert.ok(result.quality.capabilities.find((capability) => capability.id === "tests")?.status === "detected");
      assert.ok(!result.findings.some((finding) => finding.message === "Top-level test directory not detected."));
    });

    // Repository with package.json but no credible tests evidence still reports the readiness info.
    await withTempDirectory(async (empty) => {
      await writeFile(join(empty, "package.json"), JSON.stringify({ devDependencies: { typescript: "5.0.0" } }), "utf8");
      const result = await auditRepository(empty);
      assert.ok(result.findings.some((finding) => finding.message === "Top-level test directory not detected."));
    });
  });
});

test("audits and quality detection never contradict each other about tests", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".github", "workflows"), { recursive: true });
    await writeFile(join(directory, "makefile"), "test:\n\tpython -m pytest tests/\n", "utf8");
    const result = await auditRepository(directory);
    const tests = result.quality.capabilities.find((capability) => capability.id === "tests");
    const readinessConflict = result.findings.some((finding) => (
      finding.message === "Top-level test directory not detected." && tests?.status === "detected"
    ));
    assert.ok(!readinessConflict);
  });
});

test("audit does not detect tests from gitignored Go test files", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "go.mod"), "module example.com/app\n\ngo 1.22\n", "utf8");
    await mkdir(join(directory, "internal", "db"), { recursive: true });
    await writeFile(join(directory, "internal", "db", "db_test.go"), "package db\n", "utf8");
    await writeFile(join(directory, ".gitignore"), "internal/db/db_test.go\n", "utf8");
    const git = async (...args: string[]) => {
      for (const arg of args) {
        await execFileAsync("git", arg.split(" "), { cwd: directory });
      }
    };
    await git("init --quiet", "config user.email codex@example.test", "config user.name Codex", "add .", "commit --quiet -m initial");

    const result = await auditRepository(directory);
    const tests = result.quality.capabilities.find((capability) => capability.id === "tests");
    assert.notEqual(tests?.status, "detected");
  });
});
