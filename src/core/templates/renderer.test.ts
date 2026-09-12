import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AGENT_POLICY,
  classifyLegacyAgentExports,
  cleanupLegacyAgentExports,
  listAgentExporters,
  parseAgentExportTarget,
  renderAgentExportFiles,
  renderLegacyAgentExportFile,
  writeAgentExportFiles,
  writeAgentExportTarget,
  writeAllAgentExports,
} from "../exporters/index.js";
import {
  listMinimalDocTemplates,
  renderMinimalDoc,
  renderMinimalDocs,
} from "../docs/minimal.js";
import { renderTemplate, renderTemplateFile } from "./index.js";

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

test("renderTemplate renders text from input data", () => {
  const output = renderTemplate("Hello {{name}}", {
    data: {
      name: "Agentic Project Kit",
    },
  });

  assert.equal(output, "Hello Agentic Project Kit");
});

test("renderTemplate supports simple lists", () => {
  const output = renderTemplate("{{#each items}}- {{this}}\n{{/each}}", {
    data: {
      items: ["docs", "tasks"],
    },
  });

  assert.equal(output, "- docs\n- tasks\n");
});

test("renderTemplate fails on missing data", () => {
  assert.throws(
    () => renderTemplate("Hello {{name}}"),
    /"name" not defined/,
  );
});

test("renderTemplateFile loads and renders a template fixture", async () => {
  const output = await renderTemplateFile(
    join(process.cwd(), "src/core/templates/fixtures/project-doc.md.hbs"),
    {
      data: {
        projectName: "Docs First",
        mode: "mvp",
        goals: ["ship small", "keep context in repo"],
      },
    },
  );

  assert.equal(
    normalizeLineEndings(output),
    [
      "# Docs First",
      "",
      "Mode: mvp",
      "",
      "- ship small",
      "- keep context in repo",
      "",
    ].join("\n"),
  );
});

test("minimal doc templates expose expected output files", () => {
  assert.deepEqual(
    listMinimalDocTemplates().map((template) => template.outputPath),
    ["docs/project.md", "docs/scope.md", "docs/architecture.md"],
  );
});

test("renderMinimalDoc renders a project doc from template data", async () => {
  const doc = await renderMinimalDoc("project", {
    projectName: "Agentic Project Kit",
    summary: "Repository-first project context.",
    goals: ["keep context durable", "work one task at a time"],
  });

  assert.equal(doc.outputPath, "docs/project.md");
  assert.equal(
    normalizeLineEndings(doc.content),
    [
      "# Agentic Project Kit",
      "",
      "Repository-first project context.",
      "",
      "## Goals",
      "",
      "- keep context durable",
      "- work one task at a time",
      "",
      "## Source of truth",
      "",
      "Project context lives in this repository.",
      "",
    ].join("\n"),
  );
});

test("renderMinimalDocs renders the minimal documentation set", async () => {
  const docs = await renderMinimalDocs({
    project: {
      projectName: "Kit",
      summary: "Repo-owned context.",
      goals: ["ship v0.1"],
    },
    scope: {
      versionLabel: "v0.1",
      included: ["CLI", "docs"],
      nonGoals: ["web UI"],
    },
    architecture: {
      summary: "Thin CLI, reusable core.",
      layers: ["CLI", "core", "templates"],
      rules: ["keep commands thin"],
    },
  });

  assert.deepEqual(
    docs.map((doc) => doc.id),
    ["project", "scope", "architecture"],
  );
  assert.match(normalizeLineEndings(docs[1].content), /Included:\n\n- CLI\n- docs/);
  assert.match(normalizeLineEndings(docs[2].content), /## Rules\n\n- keep commands thin/);
});

test("agent exporters expose only the canonical file and thin adapters", () => {
  assert.deepEqual(
    listAgentExporters().map((exporter) => exporter.outputPath),
    [
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
    ],
  );
});

test("default agent exports match generated instruction files", async () => {
  const exports = await renderAgentExportFiles();

  for (const file of exports) {
    const actual = await readFile(join(process.cwd(), file.outputPath), "utf8");
    assert.equal(normalizeLineEndings(actual), normalizeLineEndings(file.content));
  }
});

test("canonical AGENTS.md carries the repo-local task workflow and worker contract", async () => {
  const exports = await renderAgentExportFiles();
  const agents = exports.find((file) => file.outputPath === "AGENTS.md");

  assert.ok(agents);
  assert.match(agents.content, /pnpm exec apk agent register/);
  assert.match(agents.content, /pnpm exec apk claim/);
  assert.doesNotMatch(agents.content, /: apk agent register/);
  assert.doesNotMatch(agents.content, /: apk claim/);
  assert.match(agents.content, /apk-worker-v1/);
});

test("canonical agent policy requires safe commit hygiene for successful tasks", async () => {
  const rules = DEFAULT_AGENT_POLICY.taskRules.join("\n");

  assert.match(rules, /must not leave task-owned changes uncommitted/);
  assert.match(rules, /Never run `git add -A` or `git add \.`/);
  assert.match(rules, /do not create an empty commit/);
  assert.match(rules, /Report the resulting commit SHA\(s\)/);
  assert.match(rules, /surface the blocker and do not report a clean successful handoff/);
  assert.match(rules, /Blocked, released unfinished, canceled, or failed tasks do not require a completion commit/);
  assert.match(rules, /APK never runs git commit, add, push, or rm itself/);
  assert.doesNotMatch(rules, /apk (done|task done)[^\n]*git commit/i);

  const exports = await renderAgentExportFiles();
  const agents = exports.find((file) => file.outputPath === "AGENTS.md");

  assert.ok(agents);
  assert.match(agents.content, /must not leave task-owned changes uncommitted/);
  assert.match(agents.content, /Never run `git add -A` or `git add \.`/);
  assert.match(agents.content, /do not create an empty commit/);
  assert.match(agents.content, /Report the resulting commit SHA\(s\)/);
  assert.match(agents.content, /pre-existing dirty changes untouched/);
});

test("Claude and Gemini adapters are thin AGENTS.md imports with no duplicated policy", async () => {
  const exports = await renderAgentExportFiles();
  const claude = exports.find((file) => file.outputPath === "CLAUDE.md");
  const gemini = exports.find((file) => file.outputPath === "GEMINI.md");

  assert.ok(claude);
  assert.ok(gemini);
  assert.match(claude.content, /^@AGENTS\.md$/m);
  assert.match(gemini.content, /^@\.\/AGENTS\.md$/m);
  for (const adapter of [claude, gemini]) {
    assert.doesNotMatch(adapter.content, /pnpm exec apk agent register/);
    assert.doesNotMatch(adapter.content, /apk-worker-v1/);
    assert.ok(adapter.content.length < 400);
  }
});

test("removed Codex, OpenCode and Cursor common-policy exports are not generated", async () => {
  const exports = await renderAgentExportFiles();
  const paths = exports.map((file) => file.outputPath);
  for (const removed of [
    ".codex/instructions.md",
    ".opencode/AGENTS.md",
    ".cursor/rules/project-overview.mdc",
    ".cursor/rules/architecture.mdc",
    ".cursor/rules/task-workflow.mdc",
    ".cursor/rules/local-llm-safe.mdc",
  ]) {
    assert.equal(paths.includes(removed), false, `${removed} must not be generated`);
  }
});

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-export-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

test("writeAllAgentExports writes every supported output", async () => {
  await withTempDirectory(async (directory) => {
    const result = await writeAllAgentExports(directory);

    assert.deepEqual(result.written, [
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
    ]);
    assert.deepEqual(result.skipped, []);
    assert.match(
      await readFile(join(directory, "CLAUDE.md"), "utf8"),
      /@AGENTS\.md/,
    );
  });
});

test("writeAllAgentExports can skip existing files", async () => {
  await withTempDirectory(async (directory) => {
    await writeAllAgentExports(directory);

    const result = await writeAllAgentExports(directory, undefined, {
      force: false,
    });

    assert.deepEqual(result.written, []);
    assert.deepEqual(result.skipped, [
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
    ]);
  });
});

test("writeAgentExportFiles skips existing files by default", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "AGENTS.md"), "existing", "utf8");

    const result = await writeAgentExportFiles(directory, [
      {
        id: "agents",
        outputPath: "AGENTS.md",
        content: "new",
      },
    ]);

    assert.deepEqual(result.written, []);
    assert.deepEqual(result.skipped, ["AGENTS.md"]);
    assert.equal(await readFile(join(directory, "AGENTS.md"), "utf8"), "existing");
  });
});

test("writeAgentExportTarget writes the canonical file plus the selected adapter", async () => {
  await withTempDirectory(async (directory) => {
    const result = await writeAgentExportTarget(directory, "claude");

    assert.deepEqual(result.written, [
      "AGENTS.md",
      "CLAUDE.md",
    ]);
    assert.match(
      await readFile(join(directory, "CLAUDE.md"), "utf8"),
      /@AGENTS\.md/,
    );
  });
});

test("legacy exporter aliases resolve to the canonical AGENTS.md", async () => {
  await withTempDirectory(async (directory) => {
    for (const target of ["codex", "opencode", "cursor"] as const) {
      const result = await writeAgentExportTarget(directory, target, undefined, { force: true });
      assert.deepEqual(result.written, ["AGENTS.md"], `${target} should map to AGENTS.md`);
    }
  });
});

test("classifyLegacyAgentExports distinguishes generated from customized files", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".codex"), { recursive: true });
    await mkdir(join(directory, ".opencode"), { recursive: true });
    const generated = await renderLegacyAgentExportFile("codex", DEFAULT_AGENT_POLICY);
    await writeFile(join(directory, ".codex/instructions.md"), generated, "utf8");
    await writeFile(join(directory, ".opencode/AGENTS.md"), "customized by a human\n", "utf8");

    const findings = await classifyLegacyAgentExports(directory);
    const codex = findings.find((finding) => finding.outputPath === ".codex/instructions.md");
    const opencode = findings.find((finding) => finding.outputPath === ".opencode/AGENTS.md");

    assert.equal(codex?.status, "generated");
    assert.equal(opencode?.status, "customized");
  });
});

test("cleanupLegacyAgentExports is a no-write preview by default and preserves customized files on apply", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".codex"), { recursive: true });
    await mkdir(join(directory, ".opencode"), { recursive: true });
    const generated = await renderLegacyAgentExportFile("codex", DEFAULT_AGENT_POLICY);
    await writeFile(join(directory, ".codex/instructions.md"), generated, "utf8");
    await writeFile(join(directory, ".opencode/AGENTS.md"), "customized\n", "utf8");

    const preview = await cleanupLegacyAgentExports(directory);
    assert.equal(preview.applied, false);
    assert.deepEqual(preview.removed, []);
    assert.equal(await readFile(join(directory, ".codex/instructions.md"), "utf8"), generated);

    const applied = await cleanupLegacyAgentExports(directory, { apply: true });
    assert.deepEqual(applied.removed, [".codex/instructions.md"]);
    assert.deepEqual(applied.preserved, [".opencode/AGENTS.md"]);
    await assert.rejects(readFile(join(directory, ".codex/instructions.md"), "utf8"));
    assert.equal(await readFile(join(directory, ".opencode/AGENTS.md"), "utf8"), "customized\n");
  });
});

test("parseAgentExportTarget rejects unsupported targets", () => {
  assert.throws(
    () => parseAgentExportTarget("legacy"),
    /Unsupported agent export target: legacy/,
  );
});
