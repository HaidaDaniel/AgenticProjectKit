import { mkdir, mkdtemp, readFile, readdir, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createProposal,
  findProposal,
  listProposals,
  normalizeProposalSlug,
  parseProposalMarkdown,
  PROPOSAL_LIMITS,
  proposalRelativePath,
  readProposalItem,
  readProposalSnapshot,
  renderProposalMarkdown,
  slugifyProposalTitle,
  validateProposals,
} from "./index.js";

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-proposal-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

async function withOutsideDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-proposal-outside-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

test("creates and reads a bounded proposal under a custom docs directory", async () => {
  await withTempDirectory(async (directory) => {
    const item = await createProposal(directory, "knowledge/nested", {
      title: "ComfyUI ROCm adapter sketch",
      kind: "adapter-design",
      summary: "A possible adapter direction.",
      observations: "ROCm SDPA worked in one local configuration.",
      hypotheses: "The workaround may generalize.",
      related: ["task:0001", "backlog:comfyui-adapter"],
    });

    assert.equal(item.status, "proposed");
    assert.equal(item.path, proposalRelativePath("knowledge/nested", item.slug));
    assert.equal(item.summary, "A possible adapter direction.");
    const read = await readProposalItem(directory, "knowledge/nested", item.slug);
    assert.equal(read.id, item.id);
    assert.equal(read.observations, "ROCm SDPA worked in one local configuration.");
    assert.deepEqual(read.related, ["task:0001", "backlog:comfyui-adapter"]);
    assert.ok((await readdir(join(directory, "knowledge", "nested", "proposals"))).includes(`${item.slug}.md`));
  });
});

test("proposal identity is stable and independent of the filename", async () => {
  await withTempDirectory(async (directory) => {
    const item = await createProposal(directory, "docs", {
      title: "Stable identity",
      summary: "Keep the opaque identity across a rename.",
    });
    const original = await readFile(join(directory, proposalRelativePath("docs", item.slug)), "utf8");
    const renamed = original.replace(/^Proposal-Id: .*$/m, `Proposal-Id: ${item.id}`);
    assert.equal(renamed, original);
    await rm(join(directory, proposalRelativePath("docs", item.slug)));
    await writeFile(join(directory, "docs", "proposals", "renamed-proposal.md"), original, "utf8");
    const found = await findProposal(directory, "docs", item.id);
    assert.equal(found?.proposal.slug, "renamed-proposal");
    assert.equal(found?.proposal.id, item.id);
  });
});

test("detects duplicate ids duplicate slugs and malformed inventories", async () => {
  await withTempDirectory(async (directory) => {
    const item = await createProposal(directory, "docs", { title: "First proposal", summary: "First." });
    await assert.rejects(
      () => createProposal(directory, "docs", { title: "First proposal", summary: "Second." }),
      /already exists/,
    );
    const firstPath = join(directory, proposalRelativePath("docs", item.slug));
    const first = await readFile(firstPath, "utf8");
    await writeFile(join(directory, "docs", "proposals", "second-proposal.md"), first, "utf8");
    const validated = await validateProposals(directory, "docs");
    assert.ok(validated.diagnostics.some((diagnostic) => /duplicated/.test(diagnostic)));
  });
});

test("rejects invalid UTF-8 unsupported schema and unknown metadata without mutation", async () => {
  await withTempDirectory(async (directory) => {
    const item = await createProposal(directory, "docs", { title: "Guarded proposal", summary: "Guard." });
    const path = join(directory, proposalRelativePath("docs", item.slug));
    const valid = await readFile(path, "utf8");

    const invalidUtf8 = Buffer.concat([Buffer.from(valid, "utf8"), Buffer.from([0xff])]);
    await writeFile(path, invalidUtf8);
    await assert.rejects(() => readProposalItem(directory, "docs", item.slug), /not valid UTF-8/);
    assert.deepEqual(await readFile(path), invalidUtf8);

    await writeFile(path, valid.replace("Proposal-Schema: 1", "Proposal-Schema: 2"));
    const unsupported = await readFile(path, "utf8");
    await assert.rejects(() => readProposalItem(directory, "docs", item.slug), /Unsupported proposal schema version/);
    assert.equal(await readFile(path, "utf8"), unsupported);

    await writeFile(path, valid.replace("Kind: idea", "Kind: idea\nUnknown-Field: value"));
    await assert.rejects(() => readProposalItem(directory, "docs", item.slug), /Unsupported proposal metadata/);
  });
});

test("rejects oversized truncated and unsupported-section proposals", async () => {
  await withTempDirectory(async (directory) => {
    const item = await createProposal(directory, "docs", { title: "Size proposal", summary: "Size." });
    const path = join(directory, proposalRelativePath("docs", item.slug));
    const valid = await readFile(path, "utf8");

    await writeFile(path, `${valid}\n${"x".repeat(PROPOSAL_LIMITS.bytesPerProposal)}`);
    await assert.rejects(() => readProposalItem(directory, "docs", item.slug), /byte limit/);

    await writeFile(path, "# Truncated\n\nProposal-Id: abc\n");
    await assert.rejects(() => readProposalItem(directory, "docs", item.slug), /Invalid document proposal/);

    await writeFile(path, valid.replace("## Summary", "## Unknown section"));
    await assert.rejects(() => readProposalItem(directory, "docs", item.slug), /Unsupported proposal section/);

    await writeFile(path, valid);
    await truncate(path, 10);
    await assert.rejects(() => readProposalItem(directory, "docs", item.slug), /Invalid document proposal/);
  });
});

test("refuses symlinked proposal files and directories", async () => {
  await withTempDirectory(async (directory) => {
    await withOutsideDirectory(async (outside) => {
      await mkdir(join(directory, "docs"), { recursive: true });
      await symlink(outside, join(directory, "docs", "proposals"));
      await assert.rejects(
        () => createProposal(directory, "docs", { title: "Symlinked directory", summary: "Refuse." }),
        /symbolic link/i,
      );
      assert.deepEqual(await readdir(outside), []);

      await rm(join(directory, "docs", "proposals"));
      await mkdir(join(directory, "docs", "proposals"), { recursive: true });
      const external = join(outside, "proposal.md");
      await writeFile(external, "# External\n", "utf8");
      await symlink(external, join(directory, "docs", "proposals", "linked-proposal.md"));
      await assert.rejects(() => readProposalItem(directory, "docs", "linked-proposal"), /symbolic link/i);
      assert.equal(await readFile(external, "utf8"), "# External\n");
    });
  });
});

test("concurrent edits change the revision and unrelated data is preserved", async () => {
  await withTempDirectory(async (directory) => {
    const item = await createProposal(directory, "docs", { title: "Revision proposal", summary: "Revision." });
    const first = await readProposalSnapshot(directory, "docs", item.slug);
    const path = join(directory, proposalRelativePath("docs", item.slug));
    await writeFile(path, first.content.replace("Revision.", "Revision.\n\nAn added note."), "utf8");
    const second = await readProposalSnapshot(directory, "docs", item.slug);
    assert.notEqual(first.revision, second.revision);

    await writeFile(join(directory, "docs", "proposals", "unrelated.txt"), "keep me\n", "utf8");
    const listed = await listProposals(directory, "docs");
    assert.equal(listed.items.length, 1);
    assert.equal(await readFile(join(directory, "docs", "proposals", "unrelated.txt"), "utf8"), "keep me\n");
  });
});

test("renders deterministic Markdown and safe Unicode slugs", () => {
  const item = parseProposalMarkdown(`# Тестовая идея\n\nProposal-Schema: 1\nProposal-Id: abc-123\nKind: idea\nStatus: proposed\nCreated: 2026-11-08T00:00:00.000Z\n\n## Summary\n\nКраткая идея.\n`, "testovaya-ideya");
  const rendered = renderProposalMarkdown({ ...item, title: "Тестовая идея" });
  assert.match(rendered, /^# Тестовая идея/m);
  assert.equal(parseProposalMarkdown(rendered, "testovaya-ideya").id, "abc-123");
  assert.equal(slugifyProposalTitle("Тестовая идея"), "testovaya-ideya");
  assert.equal(slugifyProposalTitle("RigOps / ComfyUI adapter"), "rigops-comfyui-adapter");
  assert.equal(normalizeProposalSlug("safe-slug"), "safe-slug");
  assert.throws(() => normalizeProposalSlug("0001-task-like"), /lowercase hyphenated/);
});
