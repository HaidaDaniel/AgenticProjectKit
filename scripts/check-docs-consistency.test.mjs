import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { checkDocumentationConsistency } from "./check-docs-consistency.mjs";

const { register } = await import("tsx/esm/api");
register();
const { renderCliReferenceSection } = await import("../src/cli/command-registry.ts");
const cliReference = renderCliReferenceSection();

function nextTaskId() {
  return String(1000 + (randomBytes(2).readUInt16BE(0) % 8999));
}

async function write(root, path, content) {
  const absolute = join(root, path);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, content);
}

async function fixture(t, taskRows = [{ id: nextTaskId(), state: "done" }]) {
  const root = await mkdtemp(join(tmpdir(), "apk-doc-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const version = "3.4.5";
  const install = `pnpm add -D agentic-project-kit@git+https://example.invalid/apk.git#v${version}`;
  const roadmapRows = taskRows.map(({ id, state }) => {
    const filename = `${id}-sample.md`;
    return `| Readiness | ${id} | ${state} | [${id}](../.tasks/${filename}) |`;
  });

  await write(root, "package.json", `${JSON.stringify({
    name: "agentic-project-kit",
    version,
    repository: { type: "git", url: "git+https://example.invalid/apk.git" },
    scripts: { quality: "pnpm typecheck && pnpm lint && pnpm test && node scripts/check-docs-consistency.mjs" },
  }, null, 2)}\n`);
  await write(root, ".github/workflows/quality.yml", "jobs:\n  quality:\n    steps:\n      - name: Run fast quality\n        run: pnpm quality\n");
  await write(root, "README.md", [
    "# Agentic Project Kit",
    "",
    "Install the validated release.",
    "",
    `The current validated installable release is [v${version}](docs/releases/v${version}.md).`,
    "",
    "```bash",
    install,
    "```",
    "",
    "[Documentation](docs/index.md)",
    "",
    "## Install APK in another repository",
  ].join("\n"));
  await write(root, "docs/index.md", `# Documentation\n\n[Latest Release: v${version}](releases/v${version}.md)\n`);
  await write(root, "docs/roadmap.md", [
    "# Roadmap",
    "",
    ` [v${version}](releases/v${version}.md) is the latest validated installable release.`,
    "",
    "### Task state rows",
    "",
    "| Workstream | Task | State | Contract |",
    "| --- | --- | --- | --- |",
    ...roadmapRows,
  ].join("\n"));
  await write(root, "docs/progress.md", "# Progress\n");
  await write(root, "docs/product/maturity-and-compatibility.md", [
    "# Maturity",
    "",
    `The latest validated, installable release at this policy snapshot is \`v${version}\`.`,
    "",
    "[Install guidance](../../README.md#install-apk-in-another-repository)",
  ].join("\n"));
  await write(root, "docs/releases/index.md", [
    `The current package version is \`${version}\`, matching the latest validated tagged release`,
    "[`v" + version + "`](https://example.invalid/apk/tree/v" + version + ").",
    "",
    "## Versioned release records",
    "",
    "| Tag | Note |",
    "| --- | --- |",
    "| `v0.1.0` | [historical note](v0.1.0.md) |",
    `| \`v${version}\` | [v${version} release note](v${version}.md) |`,
  ].join("\n"));
  await write(root, `docs/releases/v${version}.md`, `# Agentic Project Kit v${version}\n`);
  await write(root, "docs/releases/v0.1.0.md", "# Obsolete release data\n\n[Unresolved historical link](missing.md#old-anchor)\n");
  await write(root, "docs/cli-commands.md", [
    "# CLI Commands",
    "",
    cliReference,
    "",
    "```sh",
    "pnpm exec apkit task create --context \"AGENTS.md,docs/task-system.md\" --allowed docs/note.md",
    "```",
  ].join("\n"));
  await write(root, "AGENTS.md", "# Agent instructions\n");
  await write(root, "docs/task-system.md", "# Task system\n");
  for (const { id, state } of taskRows) {
    await write(root, `.tasks/${id}-sample.md`, `# Task ${id} - Sample\n\nState: ${state}\nOwner: none\n`);
  }

  return { root, version, install, taskRows };
}

test("current docs pass with reordered task and release rows; historical release content is exempt", async (t) => {
  const first = { id: nextTaskId(), state: "done" };
  let secondId = nextTaskId();
  while (secondId === first.id) secondId = nextTaskId();
  const second = { id: secondId, state: "doing" };
  const repo = await fixture(t, [first, second]);
  const roadmapPath = join(repo.root, "docs/roadmap.md");
  const source = await readFile(roadmapPath, "utf8");
  const rows = source.split("\n");
  const rowIndexes = rows.flatMap((line, index) => line.startsWith("| Readiness |") ? [index] : []);
  [rows[rowIndexes[0]], rows[rowIndexes[1]]] = [rows[rowIndexes[1]], rows[rowIndexes[0]]];
  await write(repo.root, "docs/roadmap.md", rows.join("\n"));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.deepEqual(issues, []);
});

test("release version drift names the stale source", async (t) => {
  const repo = await fixture(t);
  const packageData = JSON.parse(await readFile(join(repo.root, "package.json"), "utf8"));
  packageData.version = "3.4.6";
  await write(repo.root, "package.json", `${JSON.stringify(packageData, null, 2)}\n`);

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.startsWith("README.md:") && issue.includes("package.json version 3.4.6")));
  assert.ok(issues.some((issue) => issue.startsWith("docs/releases/index.md:") && issue.includes("package.json version 3.4.6")));
});

test("the README quickstart install must match package metadata", async (t) => {
  const repo = await fixture(t);
  await write(repo.root, "README.md", (await readFile(join(repo.root, "README.md"), "utf8")).replace(repo.install, repo.install.replace("v3.4.5", "v3.4.4")));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.startsWith("README.md:") && issue.includes("quickstart install command")));
});

test("a missing README anchor referenced by the maturity policy is reported", async (t) => {
  const repo = await fixture(t);
  const file = join(repo.root, "docs/product/maturity-and-compatibility.md");
  const source = await readFile(file, "utf8");
  await write(repo.root, "docs/product/maturity-and-compatibility.md", source.replace("#install-apk-in-another-repository", "#using-it-in-other-repositories"));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("README.md: #using-it-in-other-repositories")));
});

test("missing relative targets and missing documented context paths are actionable", async (t) => {
  const repo = await fixture(t);
  await write(repo.root, "docs/index.md", `# Documentation\n\n[Missing](missing.md)\n[Latest Release: v${repo.version}](releases/v${repo.version}.md)\n`);
  const readme = await readFile(join(repo.root, "README.md"), "utf8");
  await write(repo.root, "README.md", `${readme}\n[Missing section](#missing-section)\n`);
  const cliPath = join(repo.root, "docs/cli-commands.md");
  const source = await readFile(cliPath, "utf8");
  await write(repo.root, "docs/cli-commands.md", source.replace("docs/task-system.md", "docs/missing-context.md"));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("relative link target does not exist: missing.md")));
  assert.ok(issues.some((issue) => issue.includes("Markdown anchor does not exist in README.md: #missing-section")));
  assert.ok(issues.some((issue) => issue.includes("documented --context path does not exist: docs/missing-context.md")));
});

test("completed task rows cannot be labeled planned or todo", async (t) => {
  const task = { id: nextTaskId(), state: "done" };
  const repo = await fixture(t, [task]);
  const file = join(repo.root, "docs/roadmap.md");
  const source = await readFile(file, "utf8");
  await write(repo.root, "docs/roadmap.md", source.replace(`| Readiness | ${task.id} | done |`, `| Readiness | ${task.id} | planned |`));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes(`completed task ${task.id} is labeled 'planned'`)));
});

test("CLI reference drift is compared with the imported command registry output", async (t) => {
  const repo = await fixture(t);
  const file = join(repo.root, "docs/cli-commands.md");
  const source = await readFile(file, "utf8");
  await write(repo.root, "docs/cli-commands.md", source.replace(cliReference, cliReference.replace("register an agent in the repository-local registry.", "register a stale agent in the repository-local registry.")));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("CLI reference is stale; regenerate it from src/cli/command-registry.ts")));
});

test("SECURITY.md remains optional until present, then in-scope links are checked", async (t) => {
  const repo = await fixture(t);
  const readmePath = join(repo.root, "README.md");
  const readme = await readFile(readmePath, "utf8");
  await write(repo.root, "README.md", `${readme}\n[Security policy](SECURITY.md#reporting)\n`);

  assert.deepEqual(await checkDocumentationConsistency(repo.root, cliReference), []);
  await write(repo.root, "SECURITY.md", "# Security policy\n");
  let issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("SECURITY.md: #reporting")));

  await write(repo.root, "SECURITY.md", "# Security policy\n\n## Reporting\n");
  issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.deepEqual(issues, []);
});

test("malformed task metadata is reported without guessing", async (t) => {
  const task = { id: nextTaskId(), state: "done" };
  const repo = await fixture(t, [task]);
  await write(repo.root, `.tasks/${task.id}-sample.md`, `# Task ${task.id} - Sample\n\nOwner: none\n`);

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("task State metadata is missing")));
  assert.ok(issues.some((issue) => issue.includes(`task ${task.id} is listed but no matching task file was discovered`)));
});
