import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const TASK_STATUSES = ["todo", "in-progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_MODES = [
  "discovery",
  "mvp",
  "product",
  "production",
  "maintenance",
  "audit",
  "adopt",
] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export const TASK_RISKS = ["low", "medium", "high"] as const;
export type TaskRisk = (typeof TASK_RISKS)[number];

export interface ProjectTask {
  id: string;
  title: string;
  status: TaskStatus;
  mode: TaskMode;
  risk: TaskRisk;
  dependsOn: string[];
  goal: string;
  contextFiles: string[];
  allowedFiles: string[];
  forbiddenFiles: string[];
  steps: string[];
  acceptanceCriteria: string[];
  verificationCommands: string[];
  documentationUpdates: string[];
  notes: string[];
}

export interface ProjectTaskFile {
  path: string;
  task: ProjectTask;
}

export interface NextTaskSelection {
  path: string;
  task: ProjectTask;
  contextCommand: string;
}

export class TaskFormatError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid task file:\n- ${issues.join("\n- ")}`);
    this.name = "TaskFormatError";
    this.issues = issues;
  }
}

type SectionKey =
  | "goal"
  | "contextFiles"
  | "allowedFiles"
  | "forbiddenFiles"
  | "steps"
  | "acceptanceCriteria"
  | "verificationCommands"
  | "documentationUpdates"
  | "notes";

const SECTION_TITLES: Record<string, SectionKey> = {
  Goal: "goal",
  "Context files": "contextFiles",
  "Files allowed to edit": "allowedFiles",
  "Files forbidden to edit": "forbiddenFiles",
  Steps: "steps",
  "Acceptance criteria": "acceptanceCriteria",
  "Verification commands": "verificationCommands",
  "Documentation updates": "documentationUpdates",
  Notes: "notes",
};

const SECTION_ORDER: readonly [SectionKey, string][] = [
  ["goal", "Goal"],
  ["contextFiles", "Context files"],
  ["allowedFiles", "Files allowed to edit"],
  ["forbiddenFiles", "Files forbidden to edit"],
  ["steps", "Steps"],
  ["acceptanceCriteria", "Acceptance criteria"],
  ["verificationCommands", "Verification commands"],
  ["documentationUpdates", "Documentation updates"],
  ["notes", "Notes"],
];

function requireOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
  issues: string[],
): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  issues.push(`${label} must be one of: ${allowed.join(", ")}.`);
  return allowed[0];
}

function parseList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .map((line) => line.replace(/^`(.+)`$/, "$1"))
    .filter((line) => line.length > 0);
}

function parseSteps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^\d+\.\s+/, ""))
    .filter((line) => line.length > 0);
}

function renderList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderSteps(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function readRequiredMetadata(
  lines: readonly string[],
  label: string,
  issues: string[],
): string {
  const prefix = `${label}:`;
  const line = lines.find((entry) => entry.startsWith(prefix));

  if (!line) {
    issues.push(`${label} is required.`);
    return "";
  }

  const value = line.slice(prefix.length).trim();
  if (value.length === 0) {
    issues.push(`${label} must not be empty.`);
  }

  return value;
}

function parseSections(lines: readonly string[]): Partial<Record<SectionKey, string>> {
  const sections: Partial<Record<SectionKey, string>> = {};
  let current: SectionKey | undefined;
  let buffer: string[] = [];

  function flush(): void {
    if (current) {
      sections[current] = buffer.join("\n").trim();
    }
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      current = SECTION_TITLES[line.slice(3).trim()];
      buffer = [];
      continue;
    }

    if (current) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function requireSection(
  sections: Partial<Record<SectionKey, string>>,
  key: SectionKey,
  title: string,
  issues: string[],
): string {
  const section = sections[key];

  if (section === undefined) {
    issues.push(`Section "${title}" is required.`);
    return "";
  }

  return section;
}

export function parseTaskMarkdown(markdown: string): ProjectTask {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const issues: string[] = [];
  const heading = lines[0]?.trim() ?? "";
  const headingMatch = /^# Task ([^\s]+) - (.+)$/.exec(heading);

  if (!headingMatch) {
    issues.push('Heading must match "# Task <id> - <title>".');
  }

  const statusValue = readRequiredMetadata(lines, "Status", issues);
  const modeValue = readRequiredMetadata(lines, "Mode", issues);
  const riskValue = readRequiredMetadata(lines, "Risk", issues);
  const dependsOnValue = readRequiredMetadata(lines, "Depends on", issues);
  const sections = parseSections(lines);

  const task: ProjectTask = {
    id: headingMatch?.[1] ?? "",
    title: headingMatch?.[2] ?? "",
    status: requireOneOf(statusValue, TASK_STATUSES, "Status", issues),
    mode: requireOneOf(modeValue, TASK_MODES, "Mode", issues),
    risk: requireOneOf(riskValue, TASK_RISKS, "Risk", issues),
    dependsOn:
      dependsOnValue === "none"
        ? []
        : dependsOnValue
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
    goal: requireSection(sections, "goal", "Goal", issues).trim(),
    contextFiles: parseList(
      requireSection(sections, "contextFiles", "Context files", issues),
    ),
    allowedFiles: parseList(
      requireSection(sections, "allowedFiles", "Files allowed to edit", issues),
    ),
    forbiddenFiles: parseList(
      requireSection(
        sections,
        "forbiddenFiles",
        "Files forbidden to edit",
        issues,
      ),
    ),
    steps: parseSteps(requireSection(sections, "steps", "Steps", issues)),
    acceptanceCriteria: parseList(
      requireSection(sections, "acceptanceCriteria", "Acceptance criteria", issues),
    ),
    verificationCommands: parseList(
      requireSection(
        sections,
        "verificationCommands",
        "Verification commands",
        issues,
      ),
    ),
    documentationUpdates: parseList(
      requireSection(
        sections,
        "documentationUpdates",
        "Documentation updates",
        issues,
      ),
    ),
    notes: parseList(requireSection(sections, "notes", "Notes", issues)),
  };

  if (task.dependsOn.length === 0 && dependsOnValue !== "none") {
    issues.push('Depends on must be "none" or a comma-separated task id list.');
  }

  if (task.goal.length === 0) {
    issues.push("Goal must not be empty.");
  }

  if (task.contextFiles.length === 0) {
    issues.push("Context files must include at least one item.");
  }

  if (task.verificationCommands.length === 0) {
    issues.push("Verification commands must include at least one item.");
  }

  if (issues.length > 0) {
    throw new TaskFormatError(issues);
  }

  return task;
}

export function renderTaskMarkdown(task: ProjectTask): string {
  const sections = SECTION_ORDER.map(([key, title]) => {
    const value = task[key];
    const content = key === "goal"
      ? task.goal
      : key === "steps"
        ? renderSteps(value as string[])
        : renderList(value as string[]);

    return [`## ${title}`, "", content].join("\n");
  });

  return [
    `# Task ${task.id} - ${task.title}`,
    "",
    `Status: ${task.status}`,
    `Mode: ${task.mode}`,
    `Risk: ${task.risk}`,
    `Depends on: ${task.dependsOn.length > 0 ? task.dependsOn.join(", ") : "none"}`,
    "",
    sections.join("\n\n"),
    "",
  ].join("\n");
}

function taskSortValue(task: ProjectTask): number {
  const numeric = Number.parseInt(task.id, 10);
  return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : numeric;
}

export async function loadTaskFile(path: string): Promise<ProjectTaskFile> {
  return {
    path,
    task: parseTaskMarkdown(await readFile(path, "utf8")),
  };
}

export async function listTaskFiles(
  rootDirectory: string,
  taskDirectory = ".tasks",
): Promise<ProjectTaskFile[]> {
  const directory = join(rootDirectory, taskDirectory);
  const entries = await readdir(directory);
  const files: ProjectTaskFile[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    files.push(await loadTaskFile(join(directory, entry)));
  }

  return files.sort((left, right) => {
    const byId = taskSortValue(left.task) - taskSortValue(right.task);
    return byId === 0 ? left.path.localeCompare(right.path) : byId;
  });
}

export async function findTaskFile(
  rootDirectory: string,
  taskId: string,
  taskDirectory = ".tasks",
): Promise<string> {
  const directory = join(rootDirectory, taskDirectory);
  const entries = await readdir(directory);
  const match = entries.find((entry) => entry.startsWith(`${taskId}-`) && entry.endsWith(".md"));

  if (!match) {
    throw new Error(`Task file not found for id: ${taskId}`);
  }

  return join(directory, match);
}

export function selectNextTask(
  files: readonly ProjectTaskFile[],
): NextTaskSelection | undefined {
  const next = [...files]
    .sort((left, right) => {
      const byId = taskSortValue(left.task) - taskSortValue(right.task);
      return byId === 0 ? left.path.localeCompare(right.path) : byId;
    })
    .find((file) => file.task.status === "todo");

  if (!next) {
    return undefined;
  }

  return {
    ...next,
    contextCommand: `apk context ${next.task.id} --level 2`,
  };
}

export function renderNextTask(selection: NextTaskSelection | undefined): string {
  if (!selection) {
    return "No actionable todo tasks found.\n";
  }

  return [
    `Task: ${selection.task.id}`,
    `Title: ${selection.task.title}`,
    `Mode: ${selection.task.mode}`,
    `Risk: ${selection.task.risk}`,
    `Path: ${selection.path}`,
    `Context: ${selection.contextCommand}`,
    "",
  ].join("\n");
}
