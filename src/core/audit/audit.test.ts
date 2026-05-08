import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { initProject } from "../init/index.js";
import { auditRepository } from "./index.js";

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-audit-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
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
