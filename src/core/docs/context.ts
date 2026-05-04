import type { ProjectTask } from "../tasks/index.js";

export type ContextLevel = 1 | 2 | 3;

export interface TaskContextSelection {
  taskId: string;
  level: ContextLevel;
  files: string[];
}

export interface TaskContextOptions {
  docsDirectory?: string;
  taskDirectory?: string;
  taskFile?: string;
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

function isDocsFile(path: string, docsDirectory: string): boolean {
  const normalizedDocsDirectory = docsDirectory.replace(/\\/g, "/").replace(/\/$/, "");
  return path === "AGENTS.md" || path.startsWith(`${normalizedDocsDirectory}/`);
}

function taskPath(task: ProjectTask, taskDirectory: string): string {
  const normalizedTaskDirectory = taskDirectory.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalizedTaskDirectory}/${task.id}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;
}

export function selectTaskContext(
  task: ProjectTask,
  level: ContextLevel = 1,
  options: TaskContextOptions = {},
): TaskContextSelection {
  const docsDirectory = options.docsDirectory ?? DEFAULT_DOCS_DIRECTORY;
  const taskDirectory = options.taskDirectory ?? DEFAULT_TASK_DIRECTORY;
  const files = [
    ...level1BaseFiles(docsDirectory),
    options.taskFile?.replace(/\\/g, "/") ?? taskPath(task, taskDirectory),
  ];

  if (level >= 2) {
    files.push(...level2BaseFiles(docsDirectory));
    files.push(...task.contextFiles.filter((file) => isDocsFile(file, docsDirectory)));
  }

  if (level >= 3) {
    files.push(...task.contextFiles.filter((file) => !isDocsFile(file, docsDirectory)));
    files.push(...task.allowedFiles);
  }

  return {
    taskId: task.id,
    level,
    files: uniqueFiles(files),
  };
}

export function renderTaskContext(selection: TaskContextSelection): string {
  return [
    `Task: ${selection.taskId}`,
    `Context level: ${selection.level}`,
    "",
    "Files:",
    ...selection.files.map((file) => `- ${file}`),
    "",
  ].join("\n");
}
