import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { resolveContainedAgenticPath, resolveContainedDeleteBatch, resolveContainedWriteBatch } from "./paths.js";

const EXPECTED_CALL_SITE_FINGERPRINT = "e2d269f4408c7afb6d2b1512f34be08cff913b32cc05be3276133719bc1c3455";

const SITE_BOUNDARIES: Record<string, string> = {
  "src/core/agents/index.ts::migrateAgentLogs::rm": "repository-contained",
  "src/core/agents/index.ts::writeAgentShard::mkdir": "repository-contained",
  "src/core/agents/index.ts::writeAgentShard::writeFile": "repository-contained",
  "src/core/agents/index.ts::writeRunEvent::mkdir": "repository-contained",
  "src/core/agents/index.ts::writeRunEvent::writeFile": "repository-contained",
  "src/core/analytics/index.ts::writeAnalyticsSummary::mkdir": "repository-contained",
  "src/core/analytics/index.ts::writeAnalyticsSummary::writeFile": "repository-contained",
  "src/core/audit/index.ts::auditRepository::mkdir": "repository-contained",
  "src/core/audit/index.ts::auditRepository::writeFile": "repository-contained",
  "src/core/backlog/index.ts::createBacklogItem::mkdir": "repository-contained",
  "src/core/backlog/index.ts::createBacklogItem::writeFile": "repository-contained",
  "src/core/backlog/promote.ts::writeBacklogCardWithRevision::rename": "repository-contained",
  "src/core/backlog/promote.ts::writeBacklogCardWithRevision::rm": "repository-contained",
  "src/core/backlog/promote.ts::writeBacklogCardWithRevision::writeFile": "repository-contained",
  "src/core/config/file.ts::writeAgenticConfigFile::mkdir": "repository-contained",
  "src/core/config/file.ts::writeAgenticConfigFile::writeFile": "repository-contained",
  "src/core/config/local-preferences.ts::resetLocalCommunicationLanguage::rm": "user-local",
  "src/core/config/local-preferences.ts::writeLocalCommunicationLanguage::mkdir": "user-local",
  "src/core/config/local-preferences.ts::writeLocalCommunicationLanguage::writeFile": "user-local",
  "src/core/docs/adopt.ts::adoptRepository::mkdir": "repository-contained",
  "src/core/docs/adopt.ts::adoptRepository::writeFile": "repository-contained",
  "src/core/execution/calibrate.ts::applyExecutionCalibration::mkdir": "repository-contained",
  "src/core/execution/calibrate.ts::applyExecutionCalibration::writeFile": "repository-contained",
  "src/core/exporters/index.ts::cleanupLegacyAgentExports::rm": "repository-contained",
  "src/core/exporters/index.ts::writeAgentExportFiles::mkdir": "repository-contained",
  "src/core/exporters/index.ts::writeAgentExportFiles::writeFile": "repository-contained",
  "src/core/init/index.ts::ensureApkGitignore::writeFile": "repository-contained",
  "src/core/init/index.ts::ensureApkScratchDirectory::mkdir": "repository-contained",
  "src/core/init/index.ts::initProject::mkdir": "repository-contained",
  "src/core/init/index.ts::initProject::writeFile": "repository-contained",
  "src/core/perf/index.ts::ensurePerfGitExclude::mkdir": "repository-contained",
  "src/core/perf/index.ts::ensurePerfGitExclude::writeFile": "repository-contained",
  "src/core/perf/index.ts::ensureRuntimeDirectory::mkdir": "repository-contained",
  "src/core/perf/index.ts::safeAppendRecord::appendFile": "repository-contained",
  "src/core/perf/index.ts::startPerfSession::writeFile": "repository-contained",
  "src/core/perf/index.ts::stopPerfSession::rm": "repository-contained",
  "src/core/perf/index.ts::stopPerfSession::writeFile": "repository-contained",
  "src/core/proposals/git.ts::commitProposal::rm": "external-owned",
  "src/core/proposals/index.ts::assertTransitionAllowed::mkdir": "repository-contained",
  "src/core/proposals/index.ts::createProposalFileExclusive::mkdir": "repository-contained",
  "src/core/proposals/index.ts::createProposalFileExclusive::rm": "repository-contained",
  "src/core/proposals/index.ts::linkProposal::rename": "repository-contained",
  "src/core/proposals/index.ts::linkProposal::rm": "repository-contained",
  "src/core/proposals/index.ts::linkProposal::writeFile": "repository-contained",
  "src/core/proposals/index.ts::transitionProposal::rename": "repository-contained",
  "src/core/proposals/index.ts::transitionProposal::rm": "repository-contained",
  "src/core/proposals/index.ts::transitionProposal::writeFile": "repository-contained",
  "src/core/proposals/index.ts::writeExclusiveProposalTemporary::writeFile": "repository-contained",
  "src/core/skills/index.ts::openDirectoryChild::mkdir": "follow-up-required",
  "src/core/skills/index.ts::resolveSafePathBasedDestination::mkdir": "follow-up-required",
  "src/core/skills/index.ts::writeDescriptorRelativeFile::unlink": "follow-up-required",
  "src/core/skills/index.ts::writeOpenFile::writeFile": "follow-up-required",
  "src/core/skills/index.ts::writePathBasedFile::unlink": "follow-up-required",
  "src/core/sync/index.ts::writeExpectedFile::mkdir": "repository-contained",
  "src/core/sync/index.ts::writeExpectedFile::writeFile": "repository-contained",
  "src/core/tasks/dogfood.ts::recordDogfoodResult::writeFile": "repository-contained",
  "src/core/tasks/dogfood.ts::startDogfoodSession::mkdir": "repository-contained",
  "src/core/tasks/dogfood.ts::startDogfoodSession::writeFile": "repository-contained",
  "src/core/tasks/evidence.ts::appendTaskEvidence::appendFile": "repository-contained",
  "src/core/tasks/evidence.ts::appendTaskEvidence::mkdir": "repository-contained",
  "src/core/tasks/index.ts::applyArchiveTasks::mkdir": "repository-contained",
  "src/core/tasks/index.ts::captureTaskBaseline::appendFile": "repository-contained",
  "src/core/tasks/index.ts::captureTaskBaseline::mkdir": "repository-contained",
  "src/core/tasks/index.ts::createTaskFileExclusive::mkdir": "repository-contained",
  "src/core/tasks/index.ts::createTaskFileExclusive::rm": "repository-contained",
  "src/core/tasks/index.ts::moveArchiveFile::link": "repository-contained",
  "src/core/tasks/index.ts::moveArchiveFile::unlink": "repository-contained",
  "src/core/tasks/index.ts::writeExclusiveTaskTemporary::writeFile": "repository-contained",
  "src/core/tasks/index.ts::writeTaskFile::mkdir": "repository-contained",
  "src/core/tasks/index.ts::writeTaskFile::rename": "repository-contained",
  "src/core/tasks/index.ts::writeTaskFile::rm": "repository-contained",
  "src/core/tasks/index.ts::writeTaskFile::writeFile": "repository-contained",
  "src/core/tasks/lock.ts::recoverDeadLock::rm": "repository-contained",
  "src/core/tasks/lock.ts::recoverLocalLock::rm": "repository-contained",
  "src/core/tasks/lock.ts::removeIfOwned::rm": "repository-contained",
  "src/core/tasks/lock.ts::tryPublishLock::link": "repository-contained",
  "src/core/tasks/lock.ts::tryPublishLock::mkdir": "repository-contained",
  "src/core/tasks/lock.ts::tryPublishLock::rm": "repository-contained",
  "src/core/tasks/lock.ts::tryPublishLock::writeFile": "repository-contained",
  "src/core/tasks/review.ts::cleanupPreparedWorkerReview::rm": "repository-contained",
  "src/core/tasks/review.ts::writePreparedReview::mkdir": "repository-contained",
  "src/core/tasks/review.ts::writePreparedReview::writeFile": "repository-contained",
  "src/core/tasks/workflow.ts::createStaleTaskLock::mkdir": "repository-contained",
  "src/core/tasks/workflow.ts::createStaleTaskLock::writeFile": "repository-contained",
  "src/core/work/index.ts::activateIssuedWorkerRun::writeFile": "repository-contained",
  "src/core/work/index.ts::persistIssuedWorkerRun::mkdir": "repository-contained",
  "src/core/work/index.ts::persistIssuedWorkerRun::rename": "repository-contained",
  "src/core/work/index.ts::persistIssuedWorkerRun::rm": "repository-contained",
  "src/core/work/index.ts::persistIssuedWorkerRun::writeFile": "repository-contained",
  "src/core/work/session.ts::sessionDirectory::mkdir": "repository-contained",
  "src/core/workspaces/index.ts::cleanupCreatedWorktree::mkdir": "external-owned",
  "src/core/workspaces/index.ts::createWorkspaceLocked::mkdir": "external-owned",
  "src/core/workspaces/index.ts::createWorkspaceLocked::writeFile": "external-owned",
  "src/core/workspaces/index.ts::removeWorkspaceLocked::rm": "external-owned",
};

const MUTATION_CALL = /\b(rm|unlink|rename|rmdir|writeFile|appendFile|mkdir|copyFile|symlink|link)\s*\(/g;

interface MutationDecision {
  category: "repository-contained" | "external-owned" | "user-local" | "follow-up-required";
  reason: string;
}

/**
 * Every shipped source file that performs a filesystem mutation must appear
 * here with an explicit boundary decision. New mutation sites are detected by
 * the inventory test below and must be reviewed before they can be added.
 */
const MUTATION_DECISIONS: Record<string, MutationDecision> = {
  "src/core/agents/index.ts": { category: "repository-contained", reason: "Agent shards are written under the contained .agentic runtime directory." },
  "src/core/analytics/index.ts": { category: "repository-contained", reason: "Summary output path is resolved with the contained repository-path guard." },
  "src/core/audit/index.ts": { category: "repository-contained", reason: "Both report outputs are preflighted as one contained write batch before any write." },
  "src/core/backlog/index.ts": { category: "repository-contained", reason: "Backlog directory safety is asserted before creating or writing a card." },
  "src/core/backlog/promote.ts": { category: "repository-contained", reason: "Promotion writes a temporary file inside the contained task directory and renames it." },
  "src/core/config/file.ts": { category: "repository-contained", reason: "Config writes are resolved through the contained .agentic path guard." },
  "src/core/config/local-preferences.ts": { category: "user-local", reason: "Communication-language preferences are intentionally stored outside the repository in a developer-local path." },
  "src/core/docs/adopt.ts": { category: "repository-contained", reason: "Adoption writes use guard-then-write containment for configured repository paths." },
  "src/core/execution/calibrate.ts": { category: "repository-contained", reason: "Calibration config writes go through the contained config writer." },
  "src/core/exporters/index.ts": { category: "repository-contained", reason: "Generated exports and legacy deletions are preflighted as contained batches." },
  "src/core/init/index.ts": { category: "repository-contained", reason: "Starters and gitignore writes are preflighted as one contained batch." },
  "src/core/perf/index.ts": { category: "repository-contained", reason: "Perf state and trace files stay under the contained .agentic runtime directory." },
  "src/core/proposals/git.ts": { category: "external-owned", reason: "Temporary Git clones/worktrees are owned by an explicit temporary directory with cleanup." },
  "src/core/proposals/index.ts": { category: "repository-contained", reason: "Proposal storage uses exclusive contained publication under .agentic." },
  "src/core/skills/index.ts": { category: "follow-up-required", reason: "Destination directory mkdir currently precedes ancestor validation in resolveSafePathBasedDestination; a dedicated containment fix is required." },
  "src/core/sync/index.ts": { category: "repository-contained", reason: "Generated writes are preflighted as one contained batch." },
  "src/core/tasks/dogfood.ts": { category: "repository-contained", reason: "Dogfood session files are written under the contained .agentic runtime directory." },
  "src/core/tasks/evidence.ts": { category: "repository-contained", reason: "Append-only evidence store uses the contained evidence path and lock." },
  "src/core/tasks/index.ts": { category: "repository-contained", reason: "Task files use contained, exclusive publication and the task mutation lock." },
  "src/core/tasks/lock.ts": { category: "repository-contained", reason: "Lock files are published under the contained task directory with exclusive linking." },
  "src/core/tasks/review.ts": { category: "repository-contained", reason: "Review sessions are written under the contained .agentic/reviews directory." },
  "src/core/tasks/workflow.ts": { category: "repository-contained", reason: "Stale-lock markers are written under the contained task directory." },
  "src/core/work/index.ts": { category: "repository-contained", reason: "Worker packages are staged in a temporary directory and published into the contained session directory." },
  "src/core/work/session.ts": { category: "repository-contained", reason: "Work session locks live under the contained .agentic runtime directory." },
  "src/core/workspaces/index.ts": { category: "external-owned", reason: "Git worktrees are created outside the repository only with ownership marker, path containment and clean-state proof before destructive cleanup." },
};

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(join(root, "src"), { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))
    .map((entry) => relative(root, join(entry.parentPath ?? (entry as unknown as { path: string }).path, entry.name)).replace(/\\/g, "/"))
    .filter((path) => /^src\/(core|cli)\//.test(path))
    .sort();
}

async function mutationSites(root: string): Promise<Map<string, Record<string, number>>> {
  const sites = new Map<string, Record<string, number>>();
  for (const file of await sourceFiles(root)) {
    const raw = await readFile(join(root, file), "utf8");
    const calls: Record<string, number> = {};
    for (const match of raw.matchAll(MUTATION_CALL)) {
      const preceding = raw.slice(0, match.index);
      const declarations = [...preceding.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g)];
      const owner = declarations.at(-1)?.[1] ?? "<module>";
      const key = `${owner}::${match[1]}`;
      calls[key] = (calls[key] ?? 0) + 1;
    }
    if (Object.keys(calls).length > 0) sites.set(file, calls);
  }
  return sites;
}

function callSiteFingerprint(sites: Map<string, Record<string, number>>): string {
  const canonical = JSON.stringify(Object.fromEntries(
    [...sites.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([file, calls]) => [
      file,
      Object.fromEntries(Object.entries(calls).sort(([a], [b]) => a.localeCompare(b))),
    ]),
  ));
  return createHash("sha256").update(canonical).digest("hex");
}

test("every shipped filesystem mutation site has an explicit boundary decision", async () => {
  const root = process.cwd();
  const sites = await mutationSites(root);

  assert.deepEqual(
    [...sites.keys()].sort(),
    Object.keys(MUTATION_DECISIONS).sort(),
    "new mutation sites require an explicit containment decision before they ship",
  );
  for (const [file, calls] of sites) {
    assert.ok(MUTATION_DECISIONS[file]?.reason, `missing decision for ${file} (${Object.keys(calls).join(",")})`);
  }
  const discoveredSites = [...sites.entries()].flatMap(([file, calls]) =>
    Object.keys(calls).map((call) => `${file}::${call}`)).sort();
  assert.deepEqual(
    discoveredSites,
    Object.keys(SITE_BOUNDARIES).sort(),
    "every call site needs an explicit per-site boundary entry with its exact call path and trust boundary",
  );
  for (const site of discoveredSites) {
    assert.ok(SITE_BOUNDARIES[site], `missing per-site boundary for ${site}`);
  }
  assert.equal(
    callSiteFingerprint(sites),
    EXPECTED_CALL_SITE_FINGERPRINT,
    "a new or moved mutation call site requires an inventory review and fingerprint update",
  );
});

test("the inventory detects a deliberately introduced uncontained mutation", async () => {
  const root = process.cwd();
  await withTempSource(async (fixture) => {
    await writeFile(join(fixture, "src/core/example.ts"), "export async function run() { await rm('outside.txt'); }\n", "utf8");
    const sites = await mutationSites(fixture);
    assert.deepEqual([...sites.keys()], ["src/core/example.ts"]);
    assert.deepEqual(sites.get("src/core/example.ts"), { "run::rm": 1 });
    assert.equal(MUTATION_DECISIONS["src/core/example.ts"], undefined);
  });
  assert.ok((await mutationSites(root)).size > 0);
});

test("contained write and delete batches refuse symlink ancestors and final components", async () => {
  const root = await mkdtemp(join(tmpdir(), "apk-mutation-boundary-"));
  const repo = join(root, "repo");
  const outside = join(root, "outside");
  try {
    await mkdir(repo, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "marker.txt"), "DO-NOT-TOUCH\n", "utf8");
    await symlink("../outside", join(repo, "docs"), "dir");

    await assert.rejects(resolveContainedWriteBatch(repo, ["docs/audit-report.md"]), /symbolic link/);
    await assert.rejects(resolveContainedDeleteBatch(repo, ["docs/audit-report.md"]), /symbolic link/);
    assert.equal(await readFile(join(outside, "marker.txt"), "utf8"), "DO-NOT-TOUCH\n");

    await rm(join(repo, "docs"), { force: true });
    await mkdir(join(repo, "docs"), { recursive: true });
    await writeFile(join(outside, "marker.txt"), "DO-NOT-TOUCH\n", "utf8");
    await symlink(join(outside, "marker.txt"), join(repo, "docs/audit-report.md"));
    await assert.rejects(resolveContainedWriteBatch(repo, ["docs/audit-report.md"]), /symbolic link/);
    await assert.rejects(resolveContainedDeleteBatch(repo, ["docs/audit-report.md"]), /symbolic link/);
    assert.equal(await readFile(join(outside, "marker.txt"), "utf8"), "DO-NOT-TOUCH\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("contained .agentic runtime path refuses a symlinked runtime directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "apk-agentic-boundary-"));
  const repo = join(root, "repo");
  const outside = join(root, "outside");
  try {
    await mkdir(repo, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "evidence.jsonl"), "DO-NOT-TOUCH\n", "utf8");
    await symlink("../outside", join(repo, ".agentic"), "dir");

    await assert.rejects(resolveContainedAgenticPath(repo, ".agentic/evidence.jsonl", "file"), /symbolic link/);
    assert.equal(await readFile(join(outside, "evidence.jsonl"), "utf8"), "DO-NOT-TOUCH\n");

    await rm(join(repo, ".agentic"), { force: true });
    await mkdir(join(repo, ".agentic"), { recursive: true });
    await writeFile(join(outside, "evidence.jsonl"), "DO-NOT-TOUCH\n", "utf8");
    await symlink(join(outside, "evidence.jsonl"), join(repo, ".agentic/evidence.jsonl"));
    await assert.rejects(resolveContainedAgenticPath(repo, ".agentic/evidence.jsonl", "file"), /symbolic link/);
    assert.equal(await readFile(join(outside, "evidence.jsonl"), "utf8"), "DO-NOT-TOUCH\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function withTempSource(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "apk-mutation-fixture-"));
  try {
    await mkdir(join(root, "src/core"), { recursive: true });
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
