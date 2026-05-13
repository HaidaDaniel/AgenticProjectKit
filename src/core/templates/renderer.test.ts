import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  listAgentExporters,
  parseAgentExportTarget,
  renderAgentExportFiles,
  writeAgentExportTarget,
  writeAllAgentExports,
} from "../exporters/index.js";
import {
  listMinimalDocTemplates,
  renderMinimalDoc,
  renderMinimalDocs,
} from "../docs/minimal.js";
import { renderTemplate, renderTemplateFile } from "./index.js";

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
    output,
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
    doc.content,
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
  assert.match(docs[1].content, /Included:\n\n- CLI\n- docs/);
  assert.match(docs[2].content, /## Rules\n\n- keep commands thin/);
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
    assert.equal(actual, file.content);
  }
});

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-export-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
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
