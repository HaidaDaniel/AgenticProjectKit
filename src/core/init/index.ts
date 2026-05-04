import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { DEFAULT_CONFIG, serializeAgenticConfig } from "../config/index.js";

export interface InitResult {
  created: string[];
  skipped: string[];
}

interface StarterFile {
  path: string;
  content: string;
}

const STARTER_FILES: StarterFile[] = [
  {
    path: ".agentic/config.json",
    content: serializeAgenticConfig(DEFAULT_CONFIG),
  },
  {
    path: ".agentic/modes/README.md",
    content: [
      "# Modes",
      "",
      "Mode policy lives here.",
      "",
      "Start with `mvp` unless the project task says otherwise.",
      "",
    ].join("\n"),
  },
  {
    path: ".agentic/policies/base.md",
    content: [
      "# Base Policy",
      "",
      "- Read repository docs before coding.",
      "- Work one task at a time.",
      "- Keep changes small and verifiable.",
      "",
    ].join("\n"),
  },
  {
    path: ".agentic/templates/README.md",
    content: [
      "# Templates",
      "",
      "Reusable project and agent templates live here.",
      "",
    ].join("\n"),
  },
  {
    path: ".agentic/exporters/README.md",
    content: [
      "# Exporters",
      "",
      "Agent-specific export templates live here.",
      "",
    ].join("\n"),
  },
  {
    path: "AGENTS.md",
    content: [
      "# Agent Instructions",
      "",
      "- Treat repository docs and task files as source of truth.",
      "- Read the current task before editing.",
      "- Do not overwrite user work.",
      "- Update progress when task status changes.",
      "",
    ].join("\n"),
  },
  {
    path: "docs/project.md",
    content: [
      "# Project",
      "",
      "Describe the project, users, goals, and durable context here.",
      "",
    ].join("\n"),
  },
  {
    path: "docs/scope.md",
    content: [
      "# Scope",
      "",
      "## Current version",
      "",
      "- Define the smallest useful scope.",
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
      "Document the main layers, data flow, and important constraints here.",
      "",
    ].join("\n"),
  },
  {
    path: "docs/task-system.md",
    content: [
      "# Task System",
      "",
      "- One task file per unit of work.",
      "- Each task must list context files, allowed files, acceptance criteria, and verification commands.",
      "",
    ].join("\n"),
  },
  {
    path: "docs/context-system.md",
    content: [
      "# Context System",
      "",
      "List the minimum files an agent needs before starting each task.",
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
    ].join("\n"),
  },
  {
    path: "docs/progress.md",
    content: [
      "# Progress",
      "",
      "## Current status",
      "",
      "Project kit initialized.",
      "",
      "## Next step",
      "",
      "Create the first task in `.tasks`.",
      "",
    ].join("\n"),
  },
  {
    path: ".tasks/0001-start.md",
    content: [
      "# Task 0001 - Start Project",
      "",
      "Status: todo",
      "Mode: mvp",
      "Risk: low",
      "Depends on: none",
      "",
      "## Goal",
      "",
      "Define the first useful implementation task.",
      "",
      "## Context files",
      "",
      "- AGENTS.md",
      "- docs/project.md",
      "- docs/scope.md",
      "- docs/architecture.md",
      "",
      "## Files allowed to edit",
      "",
      "- docs/progress.md",
      "",
      "## Files forbidden to edit",
      "",
      "- application source files",
      "",
      "## Steps",
      "",
      "1. Read the project docs.",
      "2. Define the next implementation task.",
      "3. Update progress when the task is clear.",
      "",
      "## Acceptance criteria",
      "",
      "- The next task is explicit and verifiable.",
      "",
      "## Verification commands",
      "",
      "- echo \"No verification yet\"",
      "",
      "## Documentation updates",
      "",
      "- Update docs/progress.md.",
      "",
      "## Notes",
      "",
      "- Keep the first task small.",
      "",
    ].join("\n"),
  },
];

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

export function getInitStarterFiles(): readonly StarterFile[] {
  return STARTER_FILES;
}

export async function initProject(rootDirectory: string): Promise<InitResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const file of STARTER_FILES) {
    const absolutePath = join(rootDirectory, file.path);

    if (await fileExists(absolutePath)) {
      skipped.push(file.path);
      continue;
    }

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
    created.push(file.path);
  }

  return { created, skipped };
}
