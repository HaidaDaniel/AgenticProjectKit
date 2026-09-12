import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import {
  CURRENT_CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  serializeAgenticConfig,
} from "../config/index.js";

const execFileAsync = promisify(execFile);

export const GITIGNORE_PATH = ".gitignore";

/**
 * Canonical APK-owned operational/generated ignore entries. This is an additive
 * contract: it covers only APK runtime state and generated reports, never the
 * host repository's own build output or environment files.
 */
export const APK_OPERATIONAL_IGNORE_ENTRIES = [
  ".tasks/.apk.lock",
  ".agentic/agents.jsonl",
  ".agentic/runs.jsonl",
  ".agentic/agents/*",
  "!.agentic/agents/.gitkeep",
  ".agentic/runs/*",
  "!.agentic/runs/.gitkeep",
  ".agentic/evidence.jsonl",
  ".agentic/task-baselines.jsonl",
  ".agentic/evidence.append.lock",
  ".agentic/reviews/*",
  ".agentic/sessions/*",
  ".agentic/workspaces/*",
  ".apk-workspaces/",
  "docs/audit-report.md",
  "docs/project-map.md",
] as const;

const TRACKED_OPERATIONAL_SPECS = [
  ".tasks/.apk.lock",
  ".agentic/agents.jsonl",
  ".agentic/runs.jsonl",
  ".agentic/agents",
  ".agentic/runs",
  ".agentic/evidence.jsonl",
  ".agentic/task-baselines.jsonl",
  ".agentic/evidence.append.lock",
  ".agentic/reviews",
  ".agentic/sessions",
  ".agentic/workspaces",
  ".apk-workspaces",
  "docs/audit-report.md",
  "docs/project-map.md",
] as const;

export interface GitignoreUpdate {
  content: string;
  changed: boolean;
  added: string[];
  skippedEntries: string[];
}

export interface ApkGitignoreResult {
  path: string;
  action: "created" | "updated" | "unchanged";
  added: string[];
  skippedEntries: string[];
  trackedOperationalPaths: string[];
  diagnostics: string[];
}

function normalizeIgnoreLine(line: string): string {
  return line.replace(/\r$/, "");
}

/**
 * Additively add missing canonical APK ignore entries to existing `.gitignore`
 * content without reformatting, reordering, or removing anything else.
 */
export function renderApkGitignoreUpdate(existing: string | undefined): GitignoreUpdate {
  const entries = [...APK_OPERATIONAL_IGNORE_ENTRIES];
  if (existing === undefined) {
    return {
      content: `${entries.join("\n")}\n`,
      changed: true,
      added: entries,
      skippedEntries: [],
    };
  }

  const existingLines = new Set(existing.split("\n").map(normalizeIgnoreLine));
  const added = entries.filter((entry) => !existingLines.has(entry));
  const skippedEntries = entries.filter((entry) => existingLines.has(entry));
  if (added.length === 0) {
    return { content: existing, changed: false, added: [], skippedEntries };
  }

  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  let content = existing;
  if (content.length > 0 && !content.endsWith("\n")) {
    content += eol;
  }
  content += `${added.join(eol)}${eol}`;
  return { content, changed: true, added, skippedEntries };
}

async function readOptionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

/**
 * Read-only detection of APK-owned operational/generated paths that Git already
 * tracks. Ignore rules cannot untrack them, so this surfaces a bounded
 * diagnostic instead of silently reporting the repository as clean. APK never
 * mutates the index.
 */
export async function detectTrackedApkOperationalPaths(rootDirectory: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--", ...TRACKED_OPERATIONAL_SPECS],
      { cwd: rootDirectory, maxBuffer: 4 * 1024 * 1024 },
    );
    return [...new Set(
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.endsWith(".gitkeep")),
    )].sort();
  } catch {
    return [];
  }
}

function trackedOperationalDiagnostic(paths: readonly string[]): string[] {
  if (paths.length === 0) {
    return [];
  }
  const sample = paths.slice(0, 8).join(", ");
  const extra = paths.length > 8 ? ` (+${paths.length - 8} more)` : "";
  return [
    `Tracked APK operational state remains in Git and ignore rules do not untrack it: ${sample}${extra}. Decide manually whether to untrack with 'git rm --cached'; APK never mutates the index or deletes files.`,
  ];
}

export async function ensureApkGitignore(rootDirectory: string): Promise<ApkGitignoreResult> {
  const { result, content } = await planApkGitignore(rootDirectory);
  if (content !== undefined) {
    await writeFile(join(rootDirectory, GITIGNORE_PATH), content, "utf8");
  }
  return result;
}

/** Read-only preview of the canonical APK ignore state and tracked-state warning. */
export async function inspectApkGitignore(rootDirectory: string): Promise<ApkGitignoreResult> {
  return (await planApkGitignore(rootDirectory)).result;
}

export async function planApkGitignore(
  rootDirectory: string,
): Promise<{ result: ApkGitignoreResult; content?: string }> {
  const existing = await readOptionalText(join(rootDirectory, GITIGNORE_PATH));
  const update = renderApkGitignoreUpdate(existing);
  const action = existing === undefined ? "created" : update.changed ? "updated" : "unchanged";
  const trackedOperationalPaths = await detectTrackedApkOperationalPaths(rootDirectory);
  return {
    result: {
      path: GITIGNORE_PATH,
      action,
      added: update.added,
      skippedEntries: update.skippedEntries,
      trackedOperationalPaths,
      diagnostics: trackedOperationalDiagnostic(trackedOperationalPaths),
    },
    ...(update.changed ? { content: update.content } : {}),
  };
}

export interface InitResult {
  created: string[];
  skipped: string[];
  updated: string[];
  gitignore: ApkGitignoreResult;
  diagnostics: string[];
}

interface StarterFile {
  path: string;
  content: string;
}

const STARTER_FILES: StarterFile[] = [
  {
    path: ".agentic/config.json",
    content: serializeAgenticConfig({
      ...DEFAULT_CONFIG,
      schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
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
      path: "docs/product/requirements.md",
      content: [
        "# Product Requirements",
        "",
        "## Users",
        "",
        "- Describe target users here.",
        "",
        "## Goals",
        "",
        "- Define product goals.",
        "",
        "## Non-goals",
        "",
        "- Explicit exclusions.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/engineering/load-profile.md",
      content: [
        "# Load Profile",
        "",
        "## Expected usage",
        "",
        "- Describe expected load patterns.",
        "",
        "## Data growth",
        "",
        "- Estimate data volumes.",
        "",
        "## Performance targets",
        "",
        "- Define latency and throughput goals.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/engineering/tech-options.md",
      content: [
        "# Technology Options",
        "",
        "## Stack decisions",
        "",
        "- Document chosen technologies.",
        "",
        "## Alternatives considered",
        "",
        "- List rejected options and why.",
        "",
      ].join("\n"),
    },
    {
      path: "docs/engineering/risk-register.md",
      content: [
        "# Risk Register",
        "",
        "## Technical risks",
        "",
        "- Identify potential technical issues.",
        "",
        "## Mitigation strategies",
        "",
        "- Describe how to address each risk.",
        "",
      ].join("\n"),
    },
    {
      path: ".tasks/0001-start.md",
      content: [
        "# Task 0001 - Start Project",
        "",
        "State: todo",
        "Owner: none",
        "Mode: mvp",
        "Lane: planning",
        "Scope: product,architecture",
        "Risk: low",
        "Parallel: false",
        "Depends on: none",
        "Tags: start,planning",
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
  const updated: string[] = [];

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

  const gitignore = await ensureApkGitignore(rootDirectory);
  if (gitignore.action === "created") {
    created.push(gitignore.path);
  } else if (gitignore.action === "updated") {
    updated.push(gitignore.path);
  }

  return {
    created,
    skipped,
    updated,
    gitignore,
    diagnostics: gitignore.diagnostics,
  };
}
