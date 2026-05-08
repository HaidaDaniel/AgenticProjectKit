import type { RepositoryScan } from "../scanners/index.js";
import type { ProjectTask, TaskMode } from "../tasks/index.js";

export type ContextLevel = 1 | 2 | 3;

export interface TaskContextSelection {
  taskId: string;
  level: ContextLevel;
  files: string[];
  modeGuidance?: string[];
}

export interface TaskContextOptions {
  docsDirectory?: string;
  taskDirectory?: string;
  taskFile?: string;
  availableFiles?: string[];
  includeModeGuidance?: boolean;
  repositoryScan?: Pick<RepositoryScan, "agentExports" | "kitDocs" | "taskFiles">;
}

const DEFAULT_DOCS_DIRECTORY = "docs";
const DEFAULT_TASK_DIRECTORY = ".tasks";

function docsPath(docsDirectory: string, fileName: string): string {
  return `${docsDirectory.replace(/\\/g, "/").replace(/\/$/, "")}/${fileName}`;
}

function level1BaseFiles(docsDirectory: string): string[] {
  return [
    "AGENTS.md",
    docsPath(docsDirectory, "project.md"),
    docsPath(docsDirectory, "scope.md"),
    docsPath(docsDirectory, "architecture.md"),
  ];
}

function level2BaseFiles(docsDirectory: string): string[] {
  return [docsPath(docsDirectory, "decisions.md")];
}

function uniqueFiles(files: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const file of files) {
    if (!seen.has(file)) {
      seen.add(file);
      output.push(file);
    }
  }

  return output;
}

function availableFileSet(options: TaskContextOptions): Set<string> | undefined {
  const files = [
    ...(options.availableFiles ?? []),
    ...(options.repositoryScan?.kitDocs.present ?? []),
    ...(options.repositoryScan?.agentExports.present ?? []),
    ...(options.repositoryScan?.taskFiles ?? []),
  ].map((file) => file.replace(/\\/g, "/"));

  return files.length === 0 ? undefined : new Set(files);
}

function includeIfAvailable(
  files: readonly string[],
  available: Set<string> | undefined,
): string[] {
  return available ? files.filter((file) => available.has(file)) : [];
}

function taskMetadataTokens(task: ProjectTask): Set<string> {
  return new Set([
    task.mode,
    task.lane,
    ...task.scope,
    ...task.tags,
  ].map((token) => token.toLowerCase()));
}

function metadataDocs(task: ProjectTask, docsDirectory: string): string[] {
  const tokens = taskMetadataTokens(task);
  const docs: string[] = [];

  function addWhen(matches: readonly string[], files: readonly string[]): void {
    if (matches.some((match) => tokens.has(match))) {
      docs.push(...files.map((file) => docsPath(docsDirectory, file)));
    }
  }

  addWhen(["product", "requirements"], [
    "product/requirements.md",
    "product/use-cases.md",
    "product/workflows.md",
  ]);
  addWhen(["adopt", "adoption"], ["adoption-flow.md"]);
  addWhen(["audit", "scanner", "context"], [
    "engineering/scanner-system.md",
    "context-system.md",
  ]);
  addWhen(["sync", "exporters"], ["agent-exporters.md"]);
  addWhen(["cli", "tests", "testing"], ["engineering/testing-strategy.md"]);
  addWhen(["load"], ["engineering/load-profile.md"]);
  addWhen(["tech", "architecture"], [
    "engineering/tech-options.md",
    "engineering/tech-stack.md",
  ]);
  addWhen(["delivery", "production"], [
    "delivery/milestones.md",
    "delivery/risks.md",
  ]);

  return uniqueFiles(docs);
}

function isDocsFile(path: string, docsDirectory: string): boolean {
  const normalizedDocsDirectory = docsDirectory.replace(/\\/g, "/").replace(/\/$/, "");
  return path === "AGENTS.md" || path.startsWith(`${normalizedDocsDirectory}/`);
}

function isOperationalFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");

  return (
    normalized === ".tasks/.apk.lock" ||
    normalized === ".agentic/agents.jsonl" ||
    normalized === ".agentic/runs.jsonl" ||
    normalized.startsWith(".agentic/agents/") ||
    normalized.startsWith(".agentic/runs/")
  );
}

function taskPath(task: ProjectTask, taskDirectory: string): string {
  const normalizedTaskDirectory = taskDirectory.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalizedTaskDirectory}/${task.id}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;
}

export function modeGuidanceFor(mode: TaskMode): string[] {
  const guidance: Record<TaskMode, string[]> = {
    discovery: [
      "Clarify requirements before implementation.",
      "Record open risks and constraints.",
    ],
    mvp: [
      "Prefer smallest useful vertical slice.",
      "Avoid premature abstractions.",
    ],
    product: [
      "Improve maintainability and tests.",
      "Preserve validated behavior.",
    ],
    production: [
      "Prefer safer changes and stronger verification.",
      "Document operational risks.",
    ],
    maintenance: [
      "Preserve behavior.",
      "Keep diffs small and regression-focused.",
    ],
    audit: [
      "Inspect repository state without source rewrites.",
      "Report gaps as findings.",
    ],
    adopt: [
      "Preserve existing code and conventions.",
      "Prefer documentation cleanup before code changes.",
    ],
  };

  return guidance[mode];
}

export function selectTaskContext(
  task: ProjectTask,
  level: ContextLevel = 1,
  options: TaskContextOptions = {},
): TaskContextSelection {
  const docsDirectory = options.docsDirectory ?? DEFAULT_DOCS_DIRECTORY;
  const taskDirectory = options.taskDirectory ?? DEFAULT_TASK_DIRECTORY;
  const available = availableFileSet(options);
  const files = [
    ...level1BaseFiles(docsDirectory),
    options.taskFile?.replace(/\\/g, "/") ?? taskPath(task, taskDirectory),
  ];

  if (level >= 2) {
    files.push(...level2BaseFiles(docsDirectory));
    files.push(...includeIfAvailable(metadataDocs(task, docsDirectory), available));
    files.push(...task.contextFiles.filter((file) => isDocsFile(file, docsDirectory)));
  }

  if (level >= 3) {
    files.push(...task.contextFiles.filter((file) => !isDocsFile(file, docsDirectory) && !isOperationalFile(file)));
    files.push(...task.allowedFiles.filter((file) => !isOperationalFile(file)));
  }

  return {
    taskId: task.id,
    level,
    files: uniqueFiles(files),
    ...(options.includeModeGuidance ? { modeGuidance: modeGuidanceFor(task.mode) } : {}),
  };
}

export function renderTaskContext(selection: TaskContextSelection): string {
  return [
    `Task: ${selection.taskId}`,
    `Context level: ${selection.level}`,
    "",
    "Files:",
    ...selection.files.map((file) => `- ${file}`),
    ...(selection.modeGuidance
      ? [
          "",
          "Mode guidance:",
          ...selection.modeGuidance.map((rule) => `- ${rule}`),
        ]
      : []),
    "",
  ].join("\n");
}
