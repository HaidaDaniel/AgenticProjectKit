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
  ].join("\n");
}

function createDocumentationCleanupTask(): ProjectTask {
  return {
    id: "0001",
    title: "Document Adopted Repository",
    status: "todo",
    mode: "adopt",
    risk: "low",
    dependsOn: [],
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
