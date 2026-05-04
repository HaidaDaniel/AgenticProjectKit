import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const TASK_STATES = [
  "todo",
  "doing",
  "review",
  "done",
  "blocked",
  "canceled",
] as const;
export type TaskState = (typeof TASK_STATES)[number];

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
  state: TaskState;
  owner: string;
  mode: TaskMode;
  lane: string;
  scope: string[];
  risk: TaskRisk;
  parallel: boolean;
  dependsOn: string[];
  tags: string[];
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

function parseCsv(text: string): string[] {
  if (text === "none") {
    return [];
  }

  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function renderCsv(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.join(",");
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

function parseBoolean(value: string, issues: string[]): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  issues.push("Parallel must be true or false.");
  return false;
}

function defaultLane(mode: TaskMode): string {
  if (mode === "adopt") {
    return "adoption";
  }

  if (mode === "discovery") {
    return "planning";
  }

  return "implementation";
}

function normalizeLegacyState(value: string): string {
  return value === "in-progress" ? "doing" : value;
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

  const stateValue = lines.some((line) => line.startsWith("State:"))
    ? readRequiredMetadata(lines, "State", issues)
    : normalizeLegacyState(readRequiredMetadata(lines, "Status", issues));
  const ownerValue = lines.some((line) => line.startsWith("Owner:"))
    ? readRequiredMetadata(lines, "Owner", issues)
    : "none";
  const modeValue = readRequiredMetadata(lines, "Mode", issues);
  const riskValue = readRequiredMetadata(lines, "Risk", issues);
  const dependsOnValue = readRequiredMetadata(lines, "Depends on", issues);
  const state = requireOneOf(stateValue, TASK_STATES, "State", issues);
  const mode = requireOneOf(modeValue, TASK_MODES, "Mode", issues);
  const sections = parseSections(lines);
  const scope = lines.some((line) => line.startsWith("Scope:"))
    ? parseCsv(readRequiredMetadata(lines, "Scope", issues))
    : [];
  const tags = lines.some((line) => line.startsWith("Tags:"))
    ? parseCsv(readRequiredMetadata(lines, "Tags", issues))
    : [];

  const task: ProjectTask = {
    id: headingMatch?.[1] ?? "",
    title: headingMatch?.[2] ?? "",
    state,
    owner: ownerValue,
    mode,
    lane: lines.some((line) => line.startsWith("Lane:"))
      ? readRequiredMetadata(lines, "Lane", issues)
      : defaultLane(mode),
    scope,
    risk: requireOneOf(riskValue, TASK_RISKS, "Risk", issues),
    parallel: lines.some((line) => line.startsWith("Parallel:"))
      ? parseBoolean(readRequiredMetadata(lines, "Parallel", issues), issues)
      : false,
    dependsOn: parseCsv(dependsOnValue),
    tags,
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

  if (task.owner.length === 0) {
    issues.push("Owner must not be empty.");
  }

  if ((task.state === "doing" || task.state === "review") && task.owner === "none") {
    issues.push("Owner must be registered agent id for doing or review tasks.");
  }

  if (task.owner === "none" && !["todo", "blocked", "canceled"].includes(task.state)) {
    issues.push("Owner none is only allowed for todo, blocked, or canceled tasks.");
  }

  if (task.goal.length === 0) {
    issues.push("Goal must not be empty.");
  }

  if (task.lane.length === 0) {
    issues.push("Lane must not be empty.");
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
    `State: ${task.state}`,
    `Owner: ${task.owner}`,
    `Mode: ${task.mode}`,
    `Lane: ${task.lane}`,
    `Scope: ${renderCsv(task.scope)}`,
    `Risk: ${task.risk}`,
    `Parallel: ${task.parallel ? "true" : "false"}`,
    `Depends on: ${renderCsv(task.dependsOn)}`,
    `Tags: ${renderCsv(task.tags)}`,
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

export async function writeTaskFile(path: string, task: ProjectTask): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderTaskMarkdown(task), "utf8");
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

function completedTaskIds(files: readonly ProjectTaskFile[]): Set<string> {
  return new Set(files.filter((file) => file.task.state === "done").map((file) => file.task.id));
}

export function selectNextTask(
  files: readonly ProjectTaskFile[],
): NextTaskSelection | undefined {
  const completed = completedTaskIds(files);
  const next = [...files]
    .sort((left, right) => {
      const byId = taskSortValue(left.task) - taskSortValue(right.task);
      return byId === 0 ? left.path.localeCompare(right.path) : byId;
    })
    .find((file) => (
      file.task.state === "todo" &&
      file.task.dependsOn.every((dependency) => completed.has(dependency))
    ));

  if (!next) {
    return undefined;
  }

  return {
    ...next,
    contextCommand: `apk context ${next.task.id} --level 2`,
  };
}

export function renderTasksTable(files: readonly ProjectTaskFile[]): string {
  const rows = [
    "id    state     owner       lane            risk    par  title",
    ...files.map(({ task }) => [
      task.id.padEnd(5),
      task.state.padEnd(9),
      task.owner.padEnd(11),
      task.lane.padEnd(15),
      task.risk.padEnd(7),
      (task.parallel ? "yes" : "no").padEnd(4),
      task.title,
    ].join(" ")),
  ];

  return `${rows.join("\n")}\n`;
}

export function renderNextTask(selection: NextTaskSelection | undefined): string {
  if (!selection) {
    return "No actionable todo tasks found.\n";
  }

  return [
    `Task: ${selection.task.id}`,
    `Title: ${selection.task.title}`,
    `State: ${selection.task.state}`,
    `Owner: ${selection.task.owner}`,
    `Mode: ${selection.task.mode}`,
    `Lane: ${selection.task.lane}`,
    `Risk: ${selection.task.risk}`,
    `Path: ${selection.path}`,
    `Context: ${selection.contextCommand}`,
    "",
  ].join("\n");
}
