import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export const TASK_STATES = [
  "todo",
  "doing",
  "review",
  "done",
  "blocked",
  "canceled",
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const ACTIVE_TASK_STATES = [
  "todo",
  "doing",
  "review",
  "blocked",
] as const;
export type ActiveTaskState = (typeof ACTIVE_TASK_STATES)[number];

export type DependencyIssueKind = "missing" | "cycle";

export interface DependencyIssue {
  kind: DependencyIssueKind;
  taskId: string;
  message: string;
}

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
  const entries = await readdir(directory).catch(() => []);
  const files: ProjectTaskFile[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    files.push(await loadTaskFile(join(directory, entry)));
  }

  return files.sort((left, right) => {
    const byId = taskSortValue(left.task) - taskSortValue(right.task);
    return byId === 0 ? left.path.localeCompare(right.path) : byId;
  });
}

export async function listArchivedTaskFiles(
  rootDirectory: string,
  taskDirectory = ".tasks",
): Promise<ProjectTaskFile[]> {
  const archiveDirectory = join(rootDirectory, taskDirectory, "archive");
  const entries = await readdir(archiveDirectory).catch(() => []);
  const files: ProjectTaskFile[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    files.push(await loadTaskFile(join(archiveDirectory, entry)));
  }

  return files.sort((left, right) => {
    const byId = taskSortValue(left.task) - taskSortValue(right.task);
    return byId === 0 ? left.path.localeCompare(right.path) : byId;
  });
}

export async function allTaskFiles(
  rootDirectory: string,
  taskDirectory = ".tasks",
): Promise<ProjectTaskFile[]> {
  const [active, archived] = await Promise.all([
    listTaskFiles(rootDirectory, taskDirectory),
    listArchivedTaskFiles(rootDirectory, taskDirectory),
  ]);
  return [...active, ...archived].sort((left, right) => {
    const byId = taskSortValue(left.task) - taskSortValue(right.task);
    return byId === 0 ? left.path.localeCompare(right.path) : byId;
  });
}

export interface TaskArchiveResult {
  taskId: string;
  sourcePath: string;
  archivePath: string;
}

export async function archiveTask(
  rootDirectory: string,
  taskDirectory: string,
  taskId: string,
): Promise<TaskArchiveResult> {
  const activeFiles = await listTaskFiles(rootDirectory, taskDirectory);
  const file = activeFiles.find((f) => f.task.id === taskId);

  if (!file) {
    throw new Error(`Task file not found for id: ${taskId}`);
  }

  if (file.task.state !== "done") {
    throw new Error(`Task ${taskId} is ${file.task.state}; only done tasks can be archived.`);
  }

  const sourcePath = file.path;
  const archiveDirectory = join(rootDirectory, taskDirectory, "archive");
  const fileName = sourcePath.split(/[\\/]/).pop()!;
  const archivePath = join(archiveDirectory, fileName);

  if (await fileExists(archivePath)) {
    throw new Error(`Archived task already exists: ${archivePath}`);
  }

  await mkdir(archiveDirectory, { recursive: true });
  await rename(sourcePath, archivePath);

  return {
    taskId,
    sourcePath: relative(rootDirectory, sourcePath).replace(/\\/g, "/"),
    archivePath: relative(rootDirectory, archivePath).replace(/\\/g, "/"),
  };
}

export interface TaskArchiveAllResult {
  archived: TaskArchiveResult[];
}

export async function archiveAllTasks(
  rootDirectory: string,
  taskDirectory: string,
): Promise<TaskArchiveAllResult> {
  const activeFiles = await listTaskFiles(rootDirectory, taskDirectory);
  const doneFiles = activeFiles.filter((f) => f.task.state === "done");
  const archived: TaskArchiveResult[] = [];

  for (const file of doneFiles) {
    const sourcePath = file.path;
    const archiveDirectory = join(rootDirectory, taskDirectory, "archive");
    const fileName = sourcePath.split(/[\\/]/).pop()!;
    const archivePath = join(archiveDirectory, fileName);

    if (await fileExists(archivePath)) {
      throw new Error(`Archive path already exists: ${relative(rootDirectory, archivePath).replace(/\\/g, "/")}`);
    }

    await mkdir(archiveDirectory, { recursive: true });
    await rename(sourcePath, archivePath);

    archived.push({
      taskId: file.task.id,
      sourcePath: relative(rootDirectory, sourcePath).replace(/\\/g, "/"),
      archivePath: relative(rootDirectory, archivePath).replace(/\\/g, "/"),
    });
  }

  return { archived };
}

export async function findTaskFile(
  rootDirectory: string,
  taskId: string,
  taskDirectory = ".tasks",
): Promise<string> {
  const directory = join(rootDirectory, taskDirectory);
  const entries = await readdir(directory);
  const match = entries.find((entry) => entry.startsWith(`${taskId}-`) && entry.endsWith(".md"));

  if (match) {
    return join(directory, match);
  }

  const archiveDirectory = join(directory, "archive");
  const archiveEntries = await readdir(archiveDirectory).catch(() => []);
  const archiveMatch = archiveEntries.find((entry) =>
    entry.startsWith(`${taskId}-`) && entry.endsWith(".md"),
  );

  if (archiveMatch) {
    return join(archiveDirectory, archiveMatch);
  }

  throw new Error(`Task file not found for id: ${taskId}`);
}

function completedTaskIds(files: readonly ProjectTaskFile[]): Set<string> {
  return new Set(files.filter((file) => file.task.state === "done").map((file) => file.task.id));
}

export function selectNextTask(
  files: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[] = [],
): NextTaskSelection | undefined {
  const completed = new Set([
    ...completedTaskIds(files),
    ...completedTaskIds(archivedFiles),
  ]);
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

export function validateTaskDependencies(
  files: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[] = [],
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const allIds = new Set([
    ...files.map((file) => file.task.id),
    ...archivedFiles.map((file) => file.task.id),
  ]);

  for (const file of files) {
    for (const depId of file.task.dependsOn) {
      if (!allIds.has(depId)) {
        issues.push({
          kind: "missing",
          taskId: file.task.id,
          message: `Task ${file.task.id} depends on ${depId}, which does not exist.`,
        });
      }
    }
  }

  const adjList = new Map<string, string[]>();
  for (const file of files) {
    adjList.set(file.task.id, file.task.dependsOn);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function detectCycle(nodeId: string, path: string[]): boolean {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cyclePath = path.slice(cycleStart);
      issues.push({
        kind: "cycle",
        taskId: nodeId,
        message: `Dependency cycle detected: ${[...cyclePath, nodeId].join(" -> ")}.`,
      });
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const deps = adjList.get(nodeId) ?? [];
    for (const depId of deps) {
      if (allIds.has(depId)) {
        detectCycle(depId, path);
      }
    }

    inStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const file of files) {
    detectCycle(file.task.id, []);
  }

  return issues.sort((a, b) => {
    const byTaskId = a.taskId.localeCompare(b.taskId);
    if (byTaskId !== 0) return byTaskId;
    const kindOrder: Record<string, number> = { cycle: 0, missing: 1 };
    const byKind = (kindOrder[a.kind] ?? 0) - (kindOrder[b.kind] ?? 0);
    if (byKind !== 0) return byKind;
    return a.message.localeCompare(b.message);
  });
}

export interface DepEdge {
  id: string;
  title: string;
  state: TaskState;
  archived: boolean;
}

export interface TaskDepsResult {
  id: string;
  title: string;
  state: TaskState;
  path: string;
  prerequisites: DepEdge[];
  dependents: DepEdge[];
  missingDeps: string[];
  cycleIssues: string[];
}

export function findTaskDependents(
  files: readonly ProjectTaskFile[],
  taskId: string,
  archivedFiles: readonly ProjectTaskFile[] = [],
): DepEdge[] {
  return [...files, ...archivedFiles]
    .filter((file) => file.task.dependsOn.includes(taskId))
    .map((file) => ({
      id: file.task.id,
      title: file.task.title,
      state: file.task.state,
      archived: archivedFiles.some((a) => a.task.id === file.task.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildTaskDeps(
  files: readonly ProjectTaskFile[],
  taskId: string,
  filePath: string,
  archivedFiles: readonly ProjectTaskFile[] = [],
): TaskDepsResult | undefined {
  const file = files.find((f) => f.task.id === taskId)
    ?? archivedFiles.find((f) => f.task.id === taskId);
  if (!file) {
    return undefined;
  }

  const allIds = new Set([
    ...files.map((f) => f.task.id),
    ...archivedFiles.map((f) => f.task.id),
  ]);
  const prerequisites: DepEdge[] = file.task.dependsOn.map((depId) => {
    const depFile = files.find((f) => f.task.id === depId);
    const archivedDep = archivedFiles.find((f) => f.task.id === depId);
    const isArchived = depFile === undefined && archivedDep !== undefined;
    return {
      id: depId,
      title: (depFile ?? archivedDep)?.task.title ?? "(unknown)",
      state: (depFile ?? archivedDep)?.task.state ?? ("done" as TaskState),
      archived: isArchived,
    };
  });

  const missingDeps = file.task.dependsOn.filter((depId) => !allIds.has(depId));
  const dependents = findTaskDependents(files, taskId, archivedFiles);

  const depIssues = validateTaskDependencies(files, archivedFiles).filter(
    (issue) => issue.taskId === taskId || issue.message.includes(taskId),
  );
  const cycleIssues = depIssues
    .filter((issue) => issue.kind === "cycle")
    .map((issue) => issue.message);

  return {
    id: file.task.id,
    title: file.task.title,
    state: file.task.state,
    path: filePath,
    prerequisites,
    dependents,
    missingDeps,
    cycleIssues,
  };
}

export interface TaskCreateInput {
  title: string;
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

export interface TaskCreateResult {
  id: string;
  path: string;
  task: ProjectTask;
}

export interface TaskCreateError extends Error {
  name: "TaskCreateError";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "-")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function nextTaskId(
  files: readonly ProjectTaskFile[],
  archivedFiles: readonly ProjectTaskFile[] = [],
): string {
  const all = [...files, ...archivedFiles];
  const maxId = all.reduce((max, file) => {
    const num = Number.parseInt(file.task.id, 10);
    return !Number.isNaN(num) && num > max ? num : max;
  }, 0);
  return String(maxId + 1).padStart(4, "0");
}

export function buildTaskFileName(id: string, title: string): string {
  return `${id}-${slugify(title)}.md`;
}

export async function createTask(
  rootDirectory: string,
  taskDirectory: string,
  input: TaskCreateInput,
): Promise<TaskCreateResult> {
  const files = await listTaskFiles(rootDirectory, taskDirectory);
  const archived = await listArchivedTaskFiles(rootDirectory, taskDirectory);
  const id = nextTaskId(files, archived);
  const fileName = buildTaskFileName(id, input.title);
  const taskPath = join(rootDirectory, taskDirectory, fileName);

  if (await fileExists(taskPath)) {
    const err = new Error(`Task file already exists: ${fileName}`) as TaskCreateError;
    err.name = "TaskCreateError";
    throw err;
  }

  const newSlug = slugify(input.title);
  const existingSlug = files.find((file) => {
    const existingFile = file.path.split(/[\\/]/).pop()?.replace(/\.md$/, "");
    if (!existingFile) return false;
    const dashIndex = existingFile.indexOf("-");
    if (dashIndex === -1) return false;
    return existingFile.slice(dashIndex + 1) === newSlug;
  });
  if (existingSlug) {
    const err = new Error(`Task file already exists: ${existingSlug.path.split("/").pop()}`) as TaskCreateError;
    err.name = "TaskCreateError";
    throw err;
  }

  const task: ProjectTask = {
    id,
    title: input.title,
    state: "todo",
    owner: "none",
    mode: input.mode,
    lane: input.lane,
    scope: input.scope,
    risk: input.risk,
    parallel: input.parallel,
    dependsOn: input.dependsOn,
    tags: input.tags,
    goal: input.goal,
    contextFiles: input.contextFiles,
    allowedFiles: input.allowedFiles,
    forbiddenFiles: input.forbiddenFiles,
    steps: input.steps,
    acceptanceCriteria: input.acceptanceCriteria,
    verificationCommands: input.verificationCommands,
    documentationUpdates: input.documentationUpdates,
    notes: input.notes,
  };

  try {
    renderTaskMarkdown(task);
  } catch (error: unknown) {
    const err = new Error(`Failed to render task: ${error instanceof Error ? error.message : String(error)}`) as TaskCreateError;
    err.name = "TaskCreateError";
    throw err;
  }

  try {
    parseTaskMarkdown(renderTaskMarkdown(task));
  } catch (error: unknown) {
    if (error instanceof TaskFormatError) {
      const err = new Error(`Rendered task validation failed:\n- ${error.issues.join("\n- ")}`) as TaskCreateError;
      err.name = "TaskCreateError";
      throw err;
    }
    throw error;
  }

  const candidateFiles = [...files, { path: taskPath, task }];
  const depIssues = validateTaskDependencies(candidateFiles, archived).filter(
    (issue) => issue.taskId === id,
  );

  if (depIssues.length > 0) {
    const messages = depIssues.map((issue) => issue.message).join("\n- ");
    const err = new Error(`Dependency validation failed:\n- ${messages}`) as TaskCreateError;
    err.name = "TaskCreateError";
    throw err;
  }

  await writeTaskFile(taskPath, task);

  return {
    id,
    path: relative(rootDirectory, taskPath).replace(/\\/g, "/"),
    task,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

export function renderTaskDeps(result: TaskDepsResult): string {
  const lines: string[] = [];

  lines.push(`Task: ${result.id}`);
  lines.push(`Title: ${result.title}`);
  lines.push(`State: ${result.state}`);
  lines.push(`Path: ${result.path}`);
  lines.push("");

  if (result.prerequisites.length === 0) {
    lines.push("Prerequisites: none");
  } else {
    lines.push("Prerequisites:");
    for (const prereq of result.prerequisites) {
      const archiveTag = prereq.archived ? " (archived)" : "";
      const status = prereq.state === "done" ? "[done]"
        : prereq.state === "canceled" || prereq.state === "blocked" ? `[${prereq.state}]`
        : `[${prereq.state}]`;
      lines.push(`  - ${prereq.id} ${status}${archiveTag} ${prereq.title}`);
    }
  }
  lines.push("");

  if (result.dependents.length === 0) {
    lines.push("Dependents: none");
  } else {
    lines.push("Dependents:");
    for (const dep of result.dependents) {
      const archiveTag = dep.archived ? " (archived)" : "";
      lines.push(`  - ${dep.id} [${dep.state}]${archiveTag} ${dep.title}`);
    }
  }
  lines.push("");

  if (result.missingDeps.length > 0) {
    lines.push("Missing dependencies:");
    for (const m of result.missingDeps) {
      lines.push(`  - ${m}`);
    }
    lines.push("");
  }

  if (result.cycleIssues.length > 0) {
    lines.push("Cycle issues:");
    for (const c of result.cycleIssues) {
      lines.push(`  - ${c}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
