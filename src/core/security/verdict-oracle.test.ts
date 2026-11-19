import { execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import test from "node:test";

import { cleanupLegacyAgentExports, DEFAULT_AGENT_POLICY, renderLegacyAgentExportFile } from "../exporters/index.js";
import { auditRepository } from "../audit/index.js";
import { runDoctor } from "../doctor/index.js";
import { APK_OPERATIONAL_IGNORE_ENTRIES } from "../init/index.js";

/**
 * Ground-truth oracle. It deliberately uses only Node fs and direct git
 * commands; it never imports APK policy, gate, review, family tables, or
 * blocker text. APK therefore cannot validate itself using its own assumptions.
 */

type BoundaryVerdict = "contained" | "escapes";

async function oracleFsBoundary(root: string, relativePath: string): Promise<BoundaryVerdict> {
  const rootReal = await realpath(root);
  const absolute = resolve(rootReal, relativePath);
  const relation = relative(rootReal, absolute);
  if (relation === ".." || relation.startsWith(`..${sep}`) || relation === "") return "escapes";
  let current = rootReal;
  for (const segment of relation.split(sep)) {
    current = join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch {
      return "contained";
    }
    if (info.isSymbolicLink()) return "escapes";
  }
  return "contained";
}

function oracleProbePath(entry: string): string {
  if (entry.startsWith("!")) return entry.substring(1);
  const trimmed = entry.replace(/^\//, "");
  if (trimmed.endsWith("/*")) return `${trimmed.slice(0, -2)}/oracle-file`;
  if (trimmed.endsWith("/")) return `${trimmed}oracle-file`;
  return trimmed;
}

interface OracleIgnoreVerdict {
  entry: string;
  proven: boolean;
  assertion: "ignored" | "re-included";
}

function oracleIgnoreVerdicts(root: string): OracleIgnoreVerdict[] {
  return APK_OPERATIONAL_IGNORE_ENTRIES.map((entry) => {
    const probe = oracleProbePath(entry);
    let pattern = "";
    try {
      const output = execFileSync("git", ["check-ignore", "-v", "--no-index", probe], {
        cwd: root,
        encoding: "utf8",
      });
      pattern = (output.trim().split(/\s+/)[0] ?? "").split(":").slice(2).join(":");
    } catch {
      pattern = "";
    }
    const reinclude = entry.startsWith("!");
    return {
      entry,
      proven: reinclude ? pattern.startsWith("!") : Boolean(pattern) && !pattern.startsWith("!"),
      assertion: reinclude ? "re-included" : "ignored",
    };
  });
}

async function withFixture(run: (root: string, repo: string, outside: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "apk-verdict-oracle-"));
  const repo = join(root, "repo");
  const outside = join(root, "outside");
  try {
    await mkdir(repo, { recursive: true });
    await mkdir(outside, { recursive: true });
    await run(root, repo, outside);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("oracle detects the legacy deletion-escape pattern independently of APK", async () => {
  await withFixture(async (_root, repo, outside) => {
    const generated = await renderLegacyAgentExportFile("codex", DEFAULT_AGENT_POLICY);
    const marker = join(outside, "instructions.md");
    await writeFile(marker, generated, "utf8");
    await symlink(outside, join(repo, ".codex"), "dir");

    assert.equal(await oracleFsBoundary(repo, ".codex/instructions.md"), "escapes");
    await assert.rejects(cleanupLegacyAgentExports(repo, { apply: true }), /symbolic link/);
    assert.equal(await readFile(marker, "utf8"), generated);
  });
});

test("oracle detects the audit report write-escape pattern independently of APK", async () => {
  await withFixture(async (_root, repo, outside) => {
    const marker = join(outside, "audit-report.md");
    await writeFile(marker, "DO-NOT-TOUCH\n", "utf8");
    await symlink(outside, join(repo, "docs"), "dir");

    assert.equal(await oracleFsBoundary(repo, "docs/audit-report.md"), "escapes");
    await assert.rejects(auditRepository(repo), /symbolic link/);
    assert.equal(await readFile(marker, "utf8"), "DO-NOT-TOUCH\n");
  });
});

test("oracle-based ignore verdicts agree with doctor and reject family inference", async () => {
  await withFixture(async (_root, repo) => {
    execFileSync("git", ["init", "-q"], { cwd: repo });
    const present = APK_OPERATIONAL_IGNORE_ENTRIES.filter((entry) => entry !== ".agentic/perf/*");
    await writeFile(join(repo, ".gitignore"), `${present.join("\n")}\n`);

    const oracle = oracleIgnoreVerdicts(repo);
    const unproven = oracle.filter((item) => !item.proven).map((item) => item.entry);
    assert.deepEqual(unproven, [".agentic/perf/*"]);

    const doctor = (await runDoctor(repo)).checks.find((check) => check.label === "ignore-entries");
    assert.ok(doctor);
    assert.equal(doctor.level, "warn");
    assert.match(doctor.message, /\.agentic\/perf\/\*/);
    for (const item of oracle.filter((entry) => entry.proven)) {
      const asserted = `${item.entry}: ${item.assertion}`;
      assert.ok(!doctor.message.includes(asserted), `proven entry must not be warned: ${item.entry}`);
    }
  });
});

test("negative controls prove the oracle rejects the original defect assumptions", async () => {
  await withFixture(async (_root, repo) => {
    execFileSync("git", ["init", "-q"], { cwd: repo });
    const present = APK_OPERATIONAL_IGNORE_ENTRIES.filter((entry) => entry !== ".agentic/perf/*");
    await writeFile(join(repo, ".gitignore"), `${present.join("\n")}\n`);

    const perEntry = oracleIgnoreVerdicts(repo).find((item) => item.entry === ".agentic/perf/*");
    const legacyFamilyInference = oracleIgnoreVerdicts(repo).find((item) => item.entry === ".agentic/agents/*");
    assert.equal(perEntry?.proven, false);
    assert.equal(legacyFamilyInference?.proven, true);
    assert.notEqual(
      perEntry?.proven,
      legacyFamilyInference?.proven,
      "family inference would have certified the exact entry the oracle rejects",
    );
  });

  const source = await readFile(new URL(import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["'][^"']*(?:tasks\/(?:policy|gate|review)|status\/(?:index|attention))/,
    "the oracle must not import APK policy, gate, review or status projections",
  );
});

test("negative control rejects APK self-certification evidence as authority", async () => {
  await withFixture(async (_root, repo, outside) => {
    const generated = await renderLegacyAgentExportFile("codex", DEFAULT_AGENT_POLICY);
    const marker = join(outside, "instructions.md");
    await writeFile(marker, generated, "utf8");
    await symlink(outside, join(repo, ".codex"), "dir");

    const oracleBefore = await oracleFsBoundary(repo, ".codex/instructions.md");
    assert.equal(oracleBefore, "escapes");

    const evidencePath = join(repo, ".agentic");
    await mkdir(evidencePath, { recursive: true });
    const selfCertified = {
      id: "evidence-self-certified", taskId: "0999", runId: "review-self",
      agent: "implementation-owner", gateEligible: true, type: "review", result: "pass",
      reviewer: "implementation-owner", time: "2026-01-01T00:00:00.000Z",
    };
    await writeFile(join(evidencePath, "evidence.jsonl"), `${JSON.stringify(selfCertified)}\n`, "utf8");
    await writeFile(join(evidencePath, "evidence.jsonl"), `${JSON.stringify(selfCertified)}\n${JSON.stringify({ ...selfCertified, id: "evidence-second", type: "automated-test", checkId: "cleanup" })}\n`, "utf8");

    assert.equal(await oracleFsBoundary(repo, ".codex/instructions.md"), oracleBefore);
    await assert.rejects(cleanupLegacyAgentExports(repo, { apply: true }), /symbolic link/);
    assert.equal(await readFile(marker, "utf8"), generated);
  });
});
