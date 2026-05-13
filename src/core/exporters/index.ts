import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTemplateFile, type TemplateData } from "../templates/index.js";

export const AGENT_EXPORTER_IDS = [
  "agents",
  "claude",
  "codex",
  "gemini",
  "opencode",
  "cursor-project-overview",
  "cursor-architecture",
  "cursor-task-workflow",
  "cursor-local-llm-safe",
] as const;

export type AgentExporterId = (typeof AGENT_EXPORTER_IDS)[number];

export const AGENT_EXPORT_TARGETS = [
  "agents",
  "claude",
  "codex",
  "gemini",
  "opencode",
  "cursor",
] as const;

export type AgentExportTarget = (typeof AGENT_EXPORT_TARGETS)[number];

export interface NeutralAgentPolicy extends TemplateData {
  projectName: string;
  summary: string;
  defaultStyle: string;
  contextFiles: string[];
  coreRules: string[];
  taskRules: string[];
  architectureRules: string[];
  localModelRules: string[];
}

export interface AgentExporter {
  id: AgentExporterId;
  outputPath: string;
  templatePath: string;
}

export interface AgentExportFile {
  id: AgentExporterId;
  outputPath: string;
  content: string;
}

export interface WriteAgentExportsResult {
  written: string[];
  skipped: string[];
}

export interface WriteAgentExportsOptions {
  force?: boolean;
}

const exporterDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = dirname(exporterDirectory);
const templateDirectory = join(sourceDirectory, "templates", "exporters");

const EXPORTERS: readonly AgentExporter[] = [
  {
    id: "agents",
    outputPath: "AGENTS.md",
    templatePath: join(templateDirectory, "agents.md.hbs"),
  },
  {
    id: "claude",
    outputPath: "CLAUDE.md",
    templatePath: join(templateDirectory, "claude.md.hbs"),
  },
  {
    id: "codex",
    outputPath: ".codex/instructions.md",
    templatePath: join(templateDirectory, "codex.md.hbs"),
  },
  {
    id: "gemini",
    outputPath: "GEMINI.md",
    templatePath: join(templateDirectory, "gemini.md.hbs"),
  },
  {
    id: "opencode",
    outputPath: ".opencode/AGENTS.md",
    templatePath: join(templateDirectory, "opencode.md.hbs"),
  },
  {
    id: "cursor-project-overview",
    outputPath: ".cursor/rules/project-overview.mdc",
    templatePath: join(templateDirectory, "cursor-project-overview.mdc.hbs"),
  },
  {
    id: "cursor-architecture",
    outputPath: ".cursor/rules/architecture.mdc",
    templatePath: join(templateDirectory, "cursor-architecture.mdc.hbs"),
  },
  {
    id: "cursor-task-workflow",
    outputPath: ".cursor/rules/task-workflow.mdc",
    templatePath: join(templateDirectory, "cursor-task-workflow.mdc.hbs"),
  },
  {
    id: "cursor-local-llm-safe",
    outputPath: ".cursor/rules/local-llm-safe.mdc",
    templatePath: join(templateDirectory, "cursor-local-llm-safe.mdc.hbs"),
  },
];

export const DEFAULT_AGENT_POLICY: NeutralAgentPolicy = {
  projectName: "Agentic Project Kit",
  summary: "Repository docs and task files are the source of truth.",
  defaultStyle: "caveman",
  contextFiles: [
    "AGENTS.md",
    "docs/project.md",
    "docs/scope.md",
    "docs/architecture.md",
    "docs/task-system.md",
    "docs/context-system.md",
    "docs/decisions.md",
  ],
  coreRules: [
    "Read relevant docs before coding.",
    "Work on one task at a time.",
    "Keep changes small and reviewable.",
    "Stay inside the task allowed files.",
    "Do not add dependencies without updating docs/decisions.md.",
    "Update docs/progress.md when task status changes.",
  ],
  taskRules: [
    "Register agent before task work: apk agent register --id <id> --platform <platform> --model <model>.",
    "Claim tasks with registered owner: apk claim <task-id> --owner <agent-id>.",
    "Tasks in `doing` and `review` states require a registered owner.",
    "Use apk release, apk block, apk review, apk done, apk cancel with --owner.",
    "Task state changes are protected by .tasks/.apk.lock.",
    "Use the current task file as the execution contract.",
    "Read listed context files before editing.",
    "Do not touch forbidden files.",
    "Run verification commands before marking work done.",
    "Update the task if scope must expand.",
  ],
  architectureRules: [
    "Keep source of truth in repository docs and config.",
    "Generate exported agent files from neutral policy content.",
    "Keep CLI commands thin and task-driven.",
    "Avoid tool lock-in.",
    "Document architecture changes in docs/decisions.md.",
  ],
  localModelRules: [
    "Provide exact context files.",
    "Keep allowed files narrow.",
    "Avoid architectural inference.",
    "Avoid unrelated refactors.",
    "Prefer explicit steps and acceptance criteria.",
  ],
};

export function listAgentExporters(): readonly AgentExporter[] {
  return EXPORTERS;
}

export function parseAgentExportTarget(target: string): AgentExportTarget {
  if ((AGENT_EXPORT_TARGETS as readonly string[]).includes(target)) {
    return target as AgentExportTarget;
  }

  throw new Error(`Unsupported agent export target: ${target}. Expected one of: ${AGENT_EXPORT_TARGETS.join(", ")}.`);
}

export function exporterIdsForTarget(
  target: AgentExportTarget,
): readonly AgentExporterId[] {
  if (target === "cursor") {
    return [
      "cursor-project-overview",
      "cursor-architecture",
      "cursor-task-workflow",
      "cursor-local-llm-safe",
    ];
  }

  return [target];
}

export async function renderAgentExportFile(
  id: AgentExporterId,
  policy: NeutralAgentPolicy,
): Promise<AgentExportFile> {
  const exporter = EXPORTERS.find((entry) => entry.id === id);

  if (!exporter) {
    throw new Error(`Unknown agent exporter: ${id}`);
  }

  return {
    id: exporter.id,
    outputPath: exporter.outputPath,
    content: await renderTemplateFile(exporter.templatePath, {
      data: policy,
    }),
  };
}

export async function renderAgentExportFiles(
  policy: NeutralAgentPolicy = DEFAULT_AGENT_POLICY,
): Promise<AgentExportFile[]> {
  const files: AgentExportFile[] = [];

  for (const exporter of EXPORTERS) {
    files.push(await renderAgentExportFile(exporter.id, policy));
  }

  return files;
}

export async function renderAgentExportTarget(
  target: AgentExportTarget,
  policy: NeutralAgentPolicy = DEFAULT_AGENT_POLICY,
): Promise<AgentExportFile[]> {
  const files: AgentExportFile[] = [];

  for (const id of exporterIdsForTarget(target)) {
    files.push(await renderAgentExportFile(id, policy));
  }

  return files;
}

export async function writeAgentExportFiles(
  rootDirectory: string,
  files: readonly AgentExportFile[],
  options: WriteAgentExportsOptions = {},
): Promise<WriteAgentExportsResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  const force = options.force ?? true;

  for (const file of files) {
    const outputPath = join(rootDirectory, file.outputPath);

    if (!force) {
      try {
        await readFile(outputPath);
        skipped.push(file.outputPath);
        continue;
      } catch (error: unknown) {
        if (
          !(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          )
        ) {
          throw error;
        }
      }
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, file.content, "utf8");
    written.push(file.outputPath);
  }

  return { written, skipped };
}

export async function writeAllAgentExports(
  rootDirectory: string,
  policy: NeutralAgentPolicy = DEFAULT_AGENT_POLICY,
  options: WriteAgentExportsOptions = {},
): Promise<WriteAgentExportsResult> {
  return writeAgentExportFiles(rootDirectory, await renderAgentExportFiles(policy), options);
}

export async function writeAgentExportTarget(
  rootDirectory: string,
  target: AgentExportTarget,
  policy: NeutralAgentPolicy = DEFAULT_AGENT_POLICY,
  options: WriteAgentExportsOptions = {},
): Promise<WriteAgentExportsResult> {
  return writeAgentExportFiles(
    rootDirectory,
    await renderAgentExportTarget(target, policy),
    options,
  );
}
