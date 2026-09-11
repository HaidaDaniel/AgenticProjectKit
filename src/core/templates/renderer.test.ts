import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  listAgentExporters,
  parseAgentExportTarget,
  renderAgentExportFiles,
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

test("agent exporters expose expected output files", () => {
  assert.deepEqual(
    listAgentExporters().map((exporter) => exporter.outputPath),
    [
      "AGENTS.md",
      "CLAUDE.md",
      ".codex/instructions.md",
      "GEMINI.md",
      ".opencode/AGENTS.md",
      ".cursor/rules/project-overview.mdc",
      ".cursor/rules/architecture.mdc",
      ".cursor/rules/task-workflow.mdc",
      ".cursor/rules/local-llm-safe.mdc",
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

test("default agent exports use repo-local apk commands for task workflow", async () => {
  const exports = await renderAgentExportFiles();
  const workflowExports = exports.filter((file) => [
    "AGENTS.md",
    "CLAUDE.md",
    ".codex/instructions.md",
    "GEMINI.md",
    ".opencode/AGENTS.md",
    ".cursor/rules/task-workflow.mdc",
  ].includes(file.outputPath));

  for (const file of workflowExports) {
    assert.match(file.content, /pnpm exec apk agent register/);
    assert.match(file.content, /pnpm exec apk claim/);
    assert.doesNotMatch(file.content, /: apk agent register/);
    assert.doesNotMatch(file.content, /: apk claim/);
  }
});

test("Codex and OpenCode exports expose the shared worker contract", async () => {
  const exports = await renderAgentExportFiles();
  const codex = exports.find((file) => file.outputPath === ".codex/instructions.md");
  const opencode = exports.find((file) => file.outputPath === ".opencode/AGENTS.md");

  assert.ok(codex);
  assert.ok(opencode);
  assert.match(codex.content, /apk-worker-v1/);
  assert.match(codex.content, /role is implement, review, fix, or verify/);
  assert.match(opencode.content, /Return a JSON-compatible result/);
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
      ".codex/instructions.md",
      "GEMINI.md",
      ".opencode/AGENTS.md",
      ".cursor/rules/project-overview.mdc",
      ".cursor/rules/architecture.mdc",
      ".cursor/rules/task-workflow.mdc",
      ".cursor/rules/local-llm-safe.mdc",
    ]);
    assert.deepEqual(result.skipped, []);
    assert.match(
      await readFile(join(directory, ".codex/instructions.md"), "utf8"),
      /# Codex Instructions/,
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
      ".codex/instructions.md",
      "GEMINI.md",
      ".opencode/AGENTS.md",
      ".cursor/rules/project-overview.mdc",
      ".cursor/rules/architecture.mdc",
      ".cursor/rules/task-workflow.mdc",
      ".cursor/rules/local-llm-safe.mdc",
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

test("writeAgentExportTarget writes only selected target group", async () => {
  await withTempDirectory(async (directory) => {
    const result = await writeAgentExportTarget(directory, "cursor");

    assert.deepEqual(result.written, [
      ".cursor/rules/project-overview.mdc",
      ".cursor/rules/architecture.mdc",
      ".cursor/rules/task-workflow.mdc",
      ".cursor/rules/local-llm-safe.mdc",
    ]);
    assert.match(
      await readFile(join(directory, ".cursor/rules/task-workflow.mdc"), "utf8"),
      /Task files define the implementation contract\./,
    );
  });
});

test("parseAgentExportTarget rejects unsupported targets", () => {
  assert.throws(
    () => parseAgentExportTarget("legacy"),
    /Unsupported agent export target: legacy/,
  );
});
