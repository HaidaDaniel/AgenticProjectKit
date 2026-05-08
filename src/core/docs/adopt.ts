import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { DEFAULT_CONFIG, serializeAgenticConfig } from "../config/index.js";
import {
  DEFAULT_AGENT_POLICY,
  renderAgentExportFiles,
} from "../exporters/index.js";
import { scanRepository, type RepositoryScan } from "../scanners/index.js";
import { renderTaskMarkdown, type ProjectTask } from "../tasks/index.js";

export interface AdoptResult {
  scan: RepositoryScan;
  created: string[];
  skipped: string[];
}

interface AdoptFile {
  path: string;
  content: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

function renderProjectMap(scan: RepositoryScan): string {
  return [
    "# Project Map",
    "",
    `Repository: ${scan.rootName}`,
    "",
    "## Detected Stack",
    "",
    ...(scan.detectedStack.length > 0
      ? scan.detectedStack.map((item) => `- ${item}`)
      : ["- unknown"]),
    "",
    "## Top-level Directories",
    "",
    ...(scan.topLevelDirectories.length > 0
      ? scan.topLevelDirectories.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "## Top-level Files",
    "",
    ...(scan.topLevelFiles.length > 0
      ? scan.topLevelFiles.map((item) => `- ${item}`)
      : ["- none"]),
    "",
  ].join("\n");
}

function renderAdoptionReport(scan: RepositoryScan): string {
  return [
    "# Adoption Report",
    "",
    "Agentic Project Kit was added in adopt mode.",
    "",
    "## Guardrails",
    "",
    "- Existing files were not overwritten.",
    "- Application source files were not rewritten.",
    "- Follow-up work should happen through task files.",
    "",
    "## Observed Repository",
    "",
    `- Name: ${scan.rootName}`,
    `- Stack: ${scan.detectedStack.length > 0 ? scan.detectedStack.join(", ") : "unknown"}`,
    "",
    "## Pre-adoption Gaps",
    "",
    `- Missing kit docs: ${scan.kitDocs.missing.length}`,
    `- Missing agent exports: ${scan.agentExports.missing.length}`,
    `- Agentic config present: ${scan.hasAgenticConfig ? "yes" : "no"}`,
    `- Existing task files: ${scan.taskFiles.length}`,
    "",
    "## Missing Kit Docs",
    "",
    ...(scan.kitDocs.missing.length > 0
      ? scan.kitDocs.missing.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "## Missing Agent Exports",
    "",
    ...(scan.agentExports.missing.length > 0
      ? scan.agentExports.missing.map((item) => `- ${item}`)
      : ["- none"]),
    "",
  ].join("\n");
}

function createDocumentationCleanupTask(): ProjectTask {
  return {
    id: "0001",
    title: "Document Adopted Repository",
    state: "todo",
    owner: "none",
    mode: "adopt",
    lane: "adoption",
    scope: ["docs", "adoption"],
    risk: "low",
    parallel: false,
    dependsOn: [],
    tags: ["adopt", "docs"],
    goal: "Review generated adoption docs and fill in project-specific details.",
    contextFiles: [
      "AGENTS.md",
      "docs/project-map.md",
      "docs/adoption-report.md",
      "docs/project.md",
      "docs/scope.md",
      "docs/architecture.md",
    ],
    allowedFiles: [
      "docs/project.md",
      "docs/scope.md",
      "docs/architecture.md",
      "docs/progress.md",
      ".tasks/0001-document-adopted-repository.md",
    ],
    forbiddenFiles: ["application source files"],
    steps: [
      "Read the generated project map.",
      "Replace placeholder documentation with observed project facts.",
      "Update progress after documentation cleanup.",
    ],
    acceptanceCriteria: [
      "Project docs describe the adopted repository.",
      "No application source files are changed.",
    ],
    verificationCommands: ["echo \"Documentation-only task\""],
    documentationUpdates: ["Update docs/progress.md."],
    notes: ["Keep adoption conservative."],
  };
}

async function writeAdoptFile(
  rootDirectory: string,
  file: AdoptFile,
  created: string[],
  skipped: string[],
): Promise<void> {
  const path = join(rootDirectory, file.path);

  if (await fileExists(path)) {
    skipped.push(file.path);
    return;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.content, "utf8");
  created.push(file.path);
}

export async function adoptRepository(rootDirectory: string): Promise<AdoptResult> {
  const scan = await scanRepository(rootDirectory);
  const created: string[] = [];
  const skipped: string[] = [];
  const exportFiles = await renderAgentExportFiles({
    ...DEFAULT_AGENT_POLICY,
    summary: "Repository docs and task files are the source of truth for this adopted project.",
  });
  const files: AdoptFile[] = [
    {
      path: ".agentic/config.json",
      content: serializeAgenticConfig({
        ...DEFAULT_CONFIG,
        projectName: scan.rootName,
        defaultMode: "adopt",
      }),
    },
    {
      path: ".agentic/agents/.gitkeep",
      content: "",
    },
    {
      path: ".agentic/runs/.gitkeep",
      content: "",
    },
    {
      path: "docs/project-map.md",
      content: renderProjectMap(scan),
    },
    {
      path: "docs/adoption-report.md",
      content: renderAdoptionReport(scan),
    },
    {
      path: "docs/project.md",
      content: [
        "# Project",
        "",
        `Adopted repository: ${scan.rootName}.`,
        "",
        "Fill in users, goals, and durable project context here.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/scope.md",
      content: [
        "# Scope",
        "",
        "## Current scope",
        "",
        "- Describe the useful current behavior of the adopted repository.",
        "",
        "## Non-goals",
        "",
        "- Keep explicit exclusions here.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/architecture.md",
      content: [
        "# Architecture",
        "",
        "Document the main layers, data flow, and important constraints of the adopted repository.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/progress.md",
      content: [
        "# Progress",
        "",
        "## Current status",
        "",
        "Agentic Project Kit adopted into this repository.",
        "",
        "## Next step",
        "",
        "Complete `.tasks/0001-document-adopted-repository.md`.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/task-system.md",
      content: [
        "# Task System",
        "",
        "The task system is the unit of execution for Agentic Project Kit.",
        "",
        "Tasks use compact metadata so agents can coordinate without spending much context.",
        "",
        "## States",
        "",
        "- `todo` - ready to claim.",
        "- `doing` - claimed by one registered agent.",
        "- `review` - implementation done, waiting for review.",
        "- `done` - verified and complete.",
        "- `blocked` - waiting on a decision or dependency.",
        "- `canceled` - no longer planned.",
        "",
        "## Owner rules",
        "",
        "- `Owner` is a compact registered agent id.",
        "- `Owner: none` is allowed for `todo`, `blocked`, and `canceled`.",
        "- `doing` and `review` require a registered owner.",
        "- `claim`, `release`, `block`, `review`, `done`, and `cancel` require `--owner`.",
        "- Task state changes are protected by transient `.tasks/.apk.lock`.",
        "",
        "## Agent registry",
        "",
        "Agents register before task work:",
        "",
        "```bash",
        "apk agent register --id codex-a --platform codex --model gpt-5.5",
        "```",
        "",
        "Registry path:",
        "",
        "```txt",
        ".agentic/agents/<agent-id>.json",
        "```",
        "",
        "Run log path:",
        "",
        "```txt",
        ".agentic/runs/YYYY-MM-DD_<developer-id>_<agent-id>.jsonl",
        "```",
        "",
        "Legacy `.agentic/agents.jsonl` and `.agentic/runs.jsonl` are migration inputs only.",
        "",
        "## Task rules",
        "",
        "- Use one task file per unit of work.",
        "- Keep allowed files narrow.",
        "- Keep forbidden files explicit.",
        "- Include exact context files.",
        "- Include concrete verification commands.",
        "- Do not mark a task done until verification passes.",
        "- Update `docs/progress.md` when task status changes.",
        "- Use `Lane`, `Scope`, `Tags`, and `Parallel` to split work across agents.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/context-system.md",
      content: [
        "# Context System",
        "",
        "The context system tells an agent exactly which files to read before working on a task.",
        "",
        "## Context levels",
        "",
        "### Level 1",
        "",
        "Minimum context:",
        "",
        "- `AGENTS.md`",
        "- the current task file",
        "- `docs/project.md`",
        "- `docs/scope.md`",
        "- `docs/architecture.md`",
        "",
        "### Level 2",
        "",
        "Add the relevant design docs:",
        "",
        "- `docs/decisions.md`",
        "- engineering docs related to the task;",
        "- product docs related to the task;",
        "- delivery docs related to the task.",
        "",
        "### Level 3",
        "",
        "Add source files and supporting repository files:",
        "",
        "- likely affected modules;",
        "- tests;",
        "- configuration;",
        "- migrations;",
        "- generated files if relevant.",
        "",
        "## Exclusions",
        "",
        "The following operational files are not prompt context by default:",
        "",
        "- `.tasks/.apk.lock`;",
        "- `.agentic/agents.jsonl`;",
        "- `.agentic/runs.jsonl`;",
        "- `.agentic/agents/**`;",
        "- `.agentic/runs/**`.",
        "",
        "## Selection rules",
        "",
        "- Prefer the smallest context set that still makes the task safe.",
        "- Do not dump the entire repository into the prompt unless the task truly needs it.",
        "- For local models, be stricter about exact file lists and allowed edits.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/decisions.md",
      content: [
        "# Decisions",
        "",
        "Record architecture and dependency decisions here.",
        "",
        "## Format",
        "",
        "Each decision:",
        "",
        "- **Date**: YYYY-MM-DD",
        "- **Status**: proposed | accepted | deprecated | superseded",
        "- **Title**: brief description",
        "- **Context**: what problem are we solving?",
        "- **Decision**: what we decided to do",
        "- **Consequences**: what happens as a result?",
        "",
        "## Decisions",
        "",
        "- none yet",
        "",
      ].join("\n"),
    },
    {
      path: ".tasks/0001-document-adopted-repository.md",
      content: renderTaskMarkdown(createDocumentationCleanupTask()),
    },
    ...exportFiles.map((file) => ({
      path: file.outputPath,
      content: file.content,
    })),
  ];

  for (const file of files) {
    await writeAdoptFile(rootDirectory, file, created, skipped);
  }

  return {
    scan,
    created,
    skipped,
  };
}
