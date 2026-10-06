import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { promisify } from "node:util";
import { checkDocumentationConsistency } from "./check-docs-consistency.mjs";
import reporter from "./test-reporter.mjs";

test("fresh source runner refuses missing or escaping test paths", async () => {
  const exec = promisify(execFile);
  for (const args of [[], ["src/../outside.test.ts"], ["dist/cli/cli.test.js"]]) {
    await assert.rejects(
      exec(process.execPath, ["scripts/test-source.mjs", ...args]),
      (error) => error.code === 1 && /Specify repository src/.test(error.stderr),
    );
  }
});

test("quality and release composition execute each full source suite once", async () => {
  const { scripts } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  function calls(script, target, ancestors = []) {
    assert.ok(!ancestors.includes(script), `recursive quality script ${script}`);
    if (script === target) return 1;
    return [...(scripts[script] ?? "").matchAll(/\bpnpm(?: run)? ([\w:-]+)/g)]
      .reduce((sum, match) => sum + calls(match[1], target, [...ancestors, script]), 0);
  }
  for (const script of ["quality", "quality:ci", "release:check"]) {
    assert.equal(calls(script, "test:source"), 1, script);
    assert.equal(calls(script, "test:docs"), 1, script);
  }
  assert.equal(calls("release:check", "build"), 1);
  assert.equal(calls("quality:ci", "test:coverage"), 1);
  const workflow = await readFile(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");
  assert.equal([...workflow.matchAll(/^\s+run: pnpm (quality|test:coverage|release:check|build)\s*$/gm)].length, 1);
  assert.match(workflow, /run: pnpm release:check/);
});

test("compact test reporter preserves failures, diagnostics, and captured output", async () => {
  async function* events() {
    yield { type: "test:pass", data: { name: "quiet passing test" } };
    yield { type: "test:fail", data: { name: "broken boundary", details: { error: new Error("expected refusal") } } };
    yield { type: "test:diagnostic", data: { message: "fail 1" } };
    yield { type: "test:stderr", data: { message: "child process diagnostic\n" } };
  }
  let output = "";
  for await (const chunk of reporter(events())) output += chunk;
  assert.doesNotMatch(output, /quiet passing test/);
  assert.match(output, /FAIL broken boundary/);
  assert.match(output, /expected refusal/);
  assert.match(output, /fail 1/);
  assert.match(output, /child process diagnostic/);
});

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

async function fixture(t, taskRows = [{ id: nextTaskId(), state: "done" }], { version = "0.4.7", validatedVersion = version } = {}) {
  const root = await mkdtemp(join(tmpdir(), "apk-doc-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const install = `pnpm add -D agentic-project-kit@git+https://example.invalid/apk.git#v${validatedVersion}`;
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
    `The current validated installable release is [v${validatedVersion}](docs/releases/v${validatedVersion}.md).`,
    "",
    "```bash",
    install,
    "```",
    "",
    "[Documentation](docs/index.md)",
    "",
    "## Install APK in another repository",
  ].join("\n"));
  await write(root, "CHANGELOG.md", `# Changelog\n\n[v${validatedVersion}](docs/releases/v${validatedVersion}.md) is the latest validated installable release.\n`);
  await write(root, "docs/index.md", `# Documentation\n\n[Latest Release: v${validatedVersion}](releases/v${validatedVersion}.md)\n`);
  await write(root, "docs/roadmap.md", [
    "# Roadmap",
    "",
    ` [v${validatedVersion}](releases/v${validatedVersion}.md) is the latest validated installable release.`,
    "",
    "### Task state rows",
    "",
    "| Workstream | Task | State | Contract |",
    "| --- | --- | --- | --- |",
    ...roadmapRows,
  ].join("\n"));
  await write(root, "docs/progress.md", `# Progress\n\nThe latest validated, installable release is [v${validatedVersion}](releases/v${validatedVersion}.md).\n`);
  await write(root, "docs/scope.md", `# Scope\n\nThe latest validated installable release is [v${validatedVersion}](releases/v${validatedVersion}.md).\n`);
  await write(root, "docs/product/maturity-and-compatibility.md", [
    "# Maturity",
    "",
    `The latest validated, installable release at this policy snapshot is \`v${validatedVersion}\`.`,
    "",
    `| Package release | \`v${validatedVersion}\` is the latest validated Git-tag release. |`,
    "",
    "[Install guidance](../../README.md#install-apk-in-another-repository)",
  ].join("\n"));
  await write(root, "docs/releases/index.md", [
    `<!-- APK_VALIDATED_RELEASE: v${validatedVersion} -->`,
    "",
    `The current package/candidate version is \`${version}\`.`,
    `The latest validated tagged release is [v${validatedVersion}](v${validatedVersion}.md).`,
    "",
    "## Versioned release records",
    "",
    "| Tag | Note |",
    "| --- | --- |",
    "| `v0.1.0` | [historical note](v0.1.0.md) |",
    `| \`v${validatedVersion}\` | [v${validatedVersion} release note](v${validatedVersion}.md) |`,
  ].join("\n"));
  await write(root, `docs/releases/v${validatedVersion}.md`, `# Agentic Project Kit v${validatedVersion}\n`);
  if (version !== validatedVersion) await write(root, `docs/releases/v${version}.md`, `# Agentic Project Kit v${version}\n\nCandidate notes before tag publication.\n`);
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

  return { root, version, validatedVersion, install, taskRows };
}

test("released state passes with reordered rows; historical release content is exempt", async (t) => {
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

test("the release index package/candidate identity must match package metadata", async (t) => {
  const repo = await fixture(t);
  const packageData = JSON.parse(await readFile(join(repo.root, "package.json"), "utf8"));
  packageData.version = "0.5.0";
  await write(repo.root, "package.json", `${JSON.stringify(packageData, null, 2)}\n`);

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.startsWith("docs/releases/index.md:") && issue.includes("current package/candidate version must match package.json version v0.5.0")));
  assert.ok(issues.some((issue) => issue.includes("package candidate release note does not exist: docs/releases/v0.5.0.md")));
});

test("a pre-tag candidate may advance while stable docs stay on the last validated release", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.deepEqual(issues, []);
});

test("a missing candidate note fails with an actionable diagnostic", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
  await rm(join(repo.root, "docs/releases/v0.5.0.md"));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("package candidate release note does not exist: docs/releases/v0.5.0.md")));
});

test("a candidate note must use the package candidate heading", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
  await write(repo.root, "docs/releases/v0.5.0.md", "# Agentic Project Kit v0.4.7\n");

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("candidate release note heading must name v0.5.0")));
});

test("the README quickstart install remains pinned to the validated release", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
  await write(repo.root, "README.md", (await readFile(join(repo.root, "README.md"), "utf8")).replace(repo.install, repo.install.replace("v0.4.7", "v0.4.6")));

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.startsWith("README.md:") && issue.includes("quickstart install command")));
});

test("a package candidate below the validated release fails", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.4.7", validatedVersion: "0.5.0" });

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("package version 0.4.7 is below the latest validated release v0.5.0")));
});

test("the validated release sentinel rejects malformed and duplicate values", async (t) => {
  const malformed = await fixture(t);
  const malformedIndex = await readFile(join(malformed.root, "docs/releases/index.md"), "utf8");
  await write(malformed.root, "docs/releases/index.md", malformedIndex.replace("<!-- APK_VALIDATED_RELEASE: v0.4.7 -->", "<!-- APK_VALIDATED_RELEASE: v00.4.7 -->"));
  let issues = await checkDocumentationConsistency(malformed.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("validated-release sentinel version must be a numeric major.minor.patch")));

  const duplicate = await fixture(t);
  const duplicateIndex = await readFile(join(duplicate.root, "docs/releases/index.md"), "utf8");
  await write(duplicate.root, "docs/releases/index.md", `${duplicateIndex}\n<!-- APK_VALIDATED_RELEASE: v0.4.7 -->\n`);
  issues = await checkDocumentationConsistency(duplicate.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("validated-release sentinel must appear exactly once; found 2")));

  const missing = await fixture(t);
  const missingIndex = await readFile(join(missing.root, "docs/releases/index.md"), "utf8");
  await write(missing.root, "docs/releases/index.md", missingIndex.replace("<!-- APK_VALIDATED_RELEASE: v0.4.7 -->\n", ""));
  issues = await checkDocumentationConsistency(missing.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("validated-release sentinel must appear exactly once; missing")));
});

test("a candidate note cannot claim its unpublished version as the latest validated tag", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
  const notePath = join(repo.root, "docs/releases/v0.5.0.md");
  const note = await readFile(notePath, "utf8");
  await write(repo.root, "docs/releases/v0.5.0.md", `${note}\nThe latest validated tagged release = v0.5.0.\n`);

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.ok(issues.some((issue) => issue.includes("candidate note claims latest validated tagged release v0.5.0; canonical validated release is v0.4.7")));
});

test("a candidate note cannot directly claim that its release is already published or available", async (t) => {
  for (const claim of [
    "The v0.5.0 release is available now.",
    "v0.5.0 has been published.",
    "v0.5.0 has shipped.",
    "The release v0.5.0 is now available.",
  ]) {
    const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
    const notePath = join(repo.root, "docs/releases/v0.5.0.md");
    const note = await readFile(notePath, "utf8");
    await write(repo.root, "docs/releases/v0.5.0.md", `${note}\n${claim}\n`);

    const issues = await checkDocumentationConsistency(repo.root, cliReference);
    assert.ok(issues.some((issue) => issue.includes("candidate note claims release v0.5.0 is already published or available; qualify the statement until validation (canonical validated release is v0.4.7)")), claim);
  }
});

test("a candidate note may describe future or not-yet-published availability", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
  const notePath = join(repo.root, "docs/releases/v0.5.0.md");
  const note = await readFile(notePath, "utf8");
  await write(repo.root, "docs/releases/v0.5.0.md", `${note}\nThe v0.5.0 release will be available after publication. The v0.5.0 release is not yet published. It will ship after validation.\n`);

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.deepEqual(issues, []);
});

test("candidate publication predicates preserve conditional and separate stable-release prose", async (t) => {
  for (const prose of [
    "Once v0.5.0 is published, consumers can install its tag.",
    "When the v0.5.0 release is available, use that version.",
    "If the release v0.5.0 has shipped, consumers can upgrade.",
    "After v0.5.0 has been published, use the immutable tag.",
    "The release v0.5.0 is not yet published; v0.4.7 is available now.",
  ]) {
    const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
    await write(repo.root, "docs/releases/v0.5.0.md", `# Agentic Project Kit v0.5.0\n\n${prose}\n`);
    assert.deepEqual(await checkDocumentationConsistency(repo.root, cliReference), [], prose);
  }
});

test("candidate version markup cannot bypass affirmative publication or validation checks", async (t) => {
  for (const version of ["`v0.5.0`", "[v0.5.0](v0.5.0.md)", "[`v0.5.0`](v0.5.0.md)", "0.5.0", "`0.5.0`", "[0.5.0](v0.5.0.md)", "[`0.5.0`](v0.5.0.md)"]) {
    for (const claim of [
      `The latest validated tagged release is ${version}.`,
      `The ${version} release is available now.`,
      `${version} has shipped.`,
    ]) {
      const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
      await write(repo.root, "docs/releases/v0.5.0.md", `# Agentic Project Kit v0.5.0\n\n${claim}\n`);
      const issues = await checkDocumentationConsistency(repo.root, cliReference);
      assert.ok(issues.some((issue) => issue.startsWith("docs/releases/v0.5.0.md:3:") && issue.includes("candidate note claims")), claim);
    }

    const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
    await write(repo.root, "docs/releases/v0.5.0.md", `# Agentic Project Kit v0.5.0\n\nOnce ${version} is published, consumers can upgrade. The latest validated tagged release is [v0.4.7](v0.4.7.md).\n`);
    assert.deepEqual(await checkDocumentationConsistency(repo.root, cliReference), [], version);
  }
});

test("a conditional publication subject may wrap across Markdown lines", async (t) => {
  for (const prose of ["Once\nv0.5.0 is published, use its tag.", "When the\n[0.5.0](v0.5.0.md) release is available, consumers can upgrade."]) {
    const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.4.7" });
    await write(repo.root, "docs/releases/v0.5.0.md", `# Agentic Project Kit v0.5.0\n\n${prose}\n`);
    assert.deepEqual(await checkDocumentationConsistency(repo.root, cliReference), [], prose);
  }
});

test("a post-publication promotion with matching package and validated versions passes", async (t) => {
  const repo = await fixture(t, undefined, { version: "0.5.0", validatedVersion: "0.5.0" });

  const issues = await checkDocumentationConsistency(repo.root, cliReference);
  assert.deepEqual(issues, []);
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
