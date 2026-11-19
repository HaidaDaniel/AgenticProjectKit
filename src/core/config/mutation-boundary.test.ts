import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { resolveContainedDeleteBatch, resolveContainedWriteBatch } from "./paths.js";

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

async function mutationSites(root: string): Promise<Map<string, string[]>> {
  const sites = new Map<string, string[]>();
  for (const file of await sourceFiles(root)) {
    const raw = await readFile(join(root, file), "utf8");
    const callees = [...new Set([...raw.matchAll(MUTATION_CALL)].map((match) => match[1]))].sort();
    if (callees.length > 0) sites.set(file, callees);
  }
  return sites;
}

test("every shipped filesystem mutation site has an explicit boundary decision", async () => {
  const root = process.cwd();
  const sites = await mutationSites(root);

  assert.deepEqual(
    [...sites.keys()].sort(),
    Object.keys(MUTATION_DECISIONS).sort(),
    "new mutation sites require an explicit containment decision before they ship",
  );
  for (const [file, callees] of sites) {
    assert.ok(MUTATION_DECISIONS[file]?.reason, `missing decision for ${file} (${callees.join(",")})`);
  }
});

test("the inventory detects a deliberately introduced uncontained mutation", async () => {
  const root = process.cwd();
  await withTempSource(async (fixture) => {
    await writeFile(join(fixture, "src/core/example.ts"), "export async function run() { await rm('outside.txt'); }\n", "utf8");
    const sites = await mutationSites(fixture);
    assert.deepEqual([...sites.keys()], ["src/core/example.ts"]);
    assert.deepEqual(sites.get("src/core/example.ts"), ["rm"]);
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

async function withTempSource(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "apk-mutation-fixture-"));
  try {
    await mkdir(join(root, "src/core"), { recursive: true });
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
