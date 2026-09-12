import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import { listAgents } from "../agents/index.js";
import { readAgenticConfigFile } from "../config/index.js";
import { syncAgentExports } from "../sync/index.js";
import {
  parseTaskMarkdown,
  resolveTaskPolicy,
  validateTaskDependencies,
  type ProjectTask,
  type ProjectTaskFile,
  TaskFormatError,
} from "../tasks/index.js";

export type TaskLintFindingLevel = "error" | "warning" | "info";

export interface TaskLintFinding {
  level: TaskLintFindingLevel;
  code: string;
  area: string;
  message: string;
  path?: string;
  taskId?: string;
}

export interface TaskLintSyncSummary {
  checked: string[];
  current: string[];
  missing: string[];
  stale: string[];
}

export interface TaskLintResult {
  taskCount: number;
  checkedTaskFiles: string[];
  findings: TaskLintFinding[];
  sync: TaskLintSyncSummary;
  hasErrors: boolean;
}

interface TaskDocument {
  path: string;
  task?: ProjectTask;
  rawId?: string;
}

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function taskIdFromText(value: string): string | undefined {
  return value.match(/^# Task\s+([^\s-]+)\s+-/m)?.[1];
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT",
  );
}

async function markdownPaths(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((entry) => entry.endsWith(".md"))
      .sort()
      .map((entry) => join(directory, entry));
  } catch (error: unknown) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
}

function addFinding(
  findings: TaskLintFinding[],
  finding: TaskLintFinding,
): void {
  findings.push(finding);
}

async function readTaskDocuments(
  rootDirectory: string,
  taskDirectory: string,
  findings: TaskLintFinding[],
): Promise<{ active: ProjectTaskFile[]; archived: ProjectTaskFile[]; documents: TaskDocument[]; paths: string[] }> {
  const documents: TaskDocument[] = [];
  const directories = [
    join(rootDirectory, taskDirectory),
    join(rootDirectory, taskDirectory, "archive"),
  ];

  for (const directory of directories) {
    for (const path of await markdownPaths(directory)) {
      const relativePath = normalizeRepoPath(relative(rootDirectory, path));
      const content = await readFile(path, "utf8");
      const rawId = taskIdFromText(content);
      try {
        documents.push({ path: relativePath, task: parseTaskMarkdown(content), rawId });
      } catch (error: unknown) {
        const detail = error instanceof TaskFormatError
          ? error.issues.join("; ")
          : error instanceof Error ? error.message : String(error);
        addFinding(findings, {
          level: "error",
          code: "task-malformed",
          area: "tasks",
          message: detail,
          path: relativePath,
          ...(rawId ? { taskId: rawId } : {}),
        });
        documents.push({ path: relativePath, rawId });
      }
    }
  }

  const activePaths = new Set(
    (await markdownPaths(join(rootDirectory, taskDirectory)))
      .map((path) => normalizeRepoPath(relative(rootDirectory, path))),
  );
  const active = documents
    .filter((document): document is TaskDocument & { task: ProjectTask } => (
      document.task !== undefined && activePaths.has(document.path)
    ))
    .map(({ path, task }) => ({ path: join(rootDirectory, path), task }));
  const archived = documents
    .filter((document): document is TaskDocument & { task: ProjectTask } => (
      document.task !== undefined && !activePaths.has(document.path)
    ))
    .map(({ path, task }) => ({ path: join(rootDirectory, path), task }));

  return {
    active,
    archived,
    documents,
    paths: documents.map((document) => document.path).sort(),
  };
}

function duplicateIds(documents: readonly TaskDocument[]): string[] {
  const counts = new Map<string, number>();
  for (const document of documents) {
    const id = document.task?.id ?? document.rawId;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
}

function globRegex(pattern: string): RegExp {
  let source = "";
  const normalized = normalizeRepoPath(pattern);
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function pathMatchesPattern(path: string, pattern: string): boolean {
  const normalizedPath = normalizeRepoPath(path);
  const normalizedPattern = normalizeRepoPath(pattern);
  return normalizedPattern.includes("*")
    ? globRegex(normalizedPattern).test(normalizedPath)
    : normalizedPath === normalizedPattern;
}

function pathPatternIssue(pattern: string): string | undefined {
  const normalized = normalizeRepoPath(pattern);
  if (normalized.length === 0) return "path pattern must not be empty";
  if (normalized.includes("\n") || normalized.includes("\r")) return "path pattern must be single-line";
  if (isAbsolute(pattern) || /^[A-Za-z]:\//.test(normalized) || normalized.startsWith("/")) {
    return "absolute paths are not allowed";
  }
  if (normalized.split("/").includes("..")) return "parent traversal is not allowed";
  if (/[?\[\]{}]/.test(normalized)) return "only * and ** glob operators are supported";
  if (normalized.includes("//")) return "empty path segments are not allowed";
  return undefined;
}

function patternsMayOverlap(left: string, right: string): boolean {
  const leftNormalized = normalizeRepoPath(left);
  const rightNormalized = normalizeRepoPath(right);
  const leftGlob = leftNormalized.includes("*");
  const rightGlob = rightNormalized.includes("*");
  if (!leftGlob && !rightGlob) return leftNormalized === rightNormalized;
  if (!leftGlob) return pathMatchesPattern(leftNormalized, rightNormalized);
  if (!rightGlob) return pathMatchesPattern(rightNormalized, leftNormalized);

  type GlobToken = { kind: "literal"; value: string }
    | { kind: "star" | "globstar" };
  const tokenize = (pattern: string): GlobToken[] => {
    const tokens: GlobToken[] = [];
    for (let index = 0; index < pattern.length; index += 1) {
      if (pattern[index] === "*" && pattern[index + 1] === "*") {
        tokens.push({ kind: "globstar" });
        index += 1;
      } else if (pattern[index] === "*") {
        tokens.push({ kind: "star" });
      } else {
        tokens.push({ kind: "literal", value: pattern[index] });
      }
    }
    return tokens;
  };
  const leftTokens = tokenize(leftNormalized);
  const rightTokens = tokenize(rightNormalized);
  const queue: Array<[number, number]> = [[0, 0]];
  const visited = new Set<string>();
  const enqueue = (leftIndex: number, rightIndex: number): void => {
    const key = `${leftIndex}:${rightIndex}`;
    if (!visited.has(key)) {
      visited.add(key);
      queue.push([leftIndex, rightIndex]);
    }
  };
  const closure = (leftIndex: number, rightIndex: number): void => {
    const leftToken = leftTokens[leftIndex];
    const rightToken = rightTokens[rightIndex];
    if (leftToken && (leftToken.kind === "star" || leftToken.kind === "globstar")) {
      enqueue(leftIndex + 1, rightIndex);
    }
    if (rightToken && (rightToken.kind === "star" || rightToken.kind === "globstar")) {
      enqueue(leftIndex, rightIndex + 1);
    }
  };
  const choices = (tokens: GlobToken[], index: number): Array<{ next: number; kind: "literal" | "non-slash" | "any"; value?: string }> => {
    const token = tokens[index];
    if (!token) return [];
    if (token.kind === "literal") return [{ next: index + 1, kind: "literal", value: token.value }];
    return [{ next: index, kind: token.kind === "star" ? "non-slash" : "any" }];
  };
  const intersects = (
    leftChoice: ReturnType<typeof choices>[number],
    rightChoice: ReturnType<typeof choices>[number],
  ): boolean => {
    if (leftChoice.kind === "literal" && rightChoice.kind === "literal") {
      return leftChoice.value === rightChoice.value;
    }
    if (leftChoice.kind === "literal") return rightChoice.kind === "any" || leftChoice.value !== "/";
    if (rightChoice.kind === "literal") return leftChoice.kind === "any" || rightChoice.value !== "/";
    return true;
  };

  while (queue.length > 0) {
    const [leftIndex, rightIndex] = queue.shift()!;
    if (leftIndex === leftTokens.length && rightIndex === rightTokens.length) return true;
    closure(leftIndex, rightIndex);
    for (const leftChoice of choices(leftTokens, leftIndex)) {
      for (const rightChoice of choices(rightTokens, rightIndex)) {
        if (intersects(leftChoice, rightChoice)) {
          enqueue(leftChoice.next, rightChoice.next);
        }
      }
    }
  }
  return false;
}

function lintPathContracts(
  task: ProjectTask,
  findings: TaskLintFinding[],
  path: string,
): void {
  const patterns = [
    ...task.allowedFiles.map((pattern) => ({ pattern, kind: "allowed" })),
    ...task.forbiddenFiles.map((pattern) => ({ pattern, kind: "forbidden" })),
  ];
  for (const { pattern, kind } of patterns) {
    const issue = pathPatternIssue(pattern);
    if (issue) {
      addFinding(findings, {
        level: "error",
        code: "path-pattern-invalid",
        area: "paths",
        message: `${kind} pattern ${JSON.stringify(pattern)}: ${issue}.`,
        path,
        taskId: task.id,
      });
    }
  }

  for (const allowed of task.allowedFiles) {
    for (const forbidden of task.forbiddenFiles) {
      if (!pathPatternIssue(allowed) && !pathPatternIssue(forbidden) && patternsMayOverlap(allowed, forbidden)) {
        addFinding(findings, {
          level: "error",
          code: "path-contract-contradiction",
          area: "paths",
          message: `Allowed pattern ${JSON.stringify(allowed)} overlaps forbidden pattern ${JSON.stringify(forbidden)}.`,
          path,
          taskId: task.id,
        });
      }
    }
  }
}

function lintTaskPolicy(
  task: ProjectTask,
  findings: TaskLintFinding[],
  path: string,
): void {
  const policy = resolveTaskPolicy(task);
  for (const blocker of policy.blockers) {
    const hard = blocker.includes("conflicting policy rules")
      || blocker.includes("no-verification")
      || blocker.includes("no-review")
      || blocker.includes("local-only");
    addFinding(findings, {
      level: hard ? "error" : "warning",
      code: "policy-blocker",
      area: "policy",
      message: blocker,
      path,
      taskId: task.id,
    });
  }
  for (const diagnostic of policy.diagnostics) {
    addFinding(findings, {
      level: diagnostic.includes("Conflicting") ? "error" : "warning",
      code: "policy-diagnostic",
      area: "policy",
      message: diagnostic,
      path,
      taskId: task.id,
    });
  }
}

function lintTaskStateOwner(
  task: ProjectTask,
  registeredAgents: ReadonlySet<string>,
  agentRegistryAvailable: boolean,
  findings: TaskLintFinding[],
  path: string,
): void {
  if (["todo", "blocked", "canceled"].includes(task.state) && task.owner !== "none") {
    addFinding(findings, {
      level: "error",
      code: "state-owner-mismatch",
      area: "workflow",
      message: `${task.state} task must have Owner: none; found ${task.owner}.`,
      path,
      taskId: task.id,
    });
  }
  if (["doing", "review"].includes(task.state) && !registeredAgents.has(task.owner)) {
    // Agent registry state is intentionally untracked runtime state. A clean
    // checkout has no local registry, so ownership cannot be verified there;
    // only treat a missing owner as a hard error when a local registry exists.
    addFinding(findings, {
      level: agentRegistryAvailable ? "error" : "warning",
      code: agentRegistryAvailable ? "owner-unregistered" : "owner-unverified",
      area: "workflow",
      message: agentRegistryAvailable
        ? `Owner ${task.owner} is not registered for ${task.state} task.`
        : `Owner ${task.owner} cannot be verified locally because no agent registry is present for ${task.state} task.`,
      path,
      taskId: task.id,
    });
  }
}

function sortFindings(findings: readonly TaskLintFinding[]): TaskLintFinding[] {
  const levelOrder: Record<TaskLintFindingLevel, number> = { error: 0, warning: 1, info: 2 };
  return [...findings].sort((left, right) => (
    levelOrder[left.level] - levelOrder[right.level]
    || left.area.localeCompare(right.area)
    || left.code.localeCompare(right.code)
    || (left.taskId ?? "").localeCompare(right.taskId ?? "")
    || (left.path ?? "").localeCompare(right.path ?? "")
    || left.message.localeCompare(right.message)
  ));
}

export async function lintRepositoryContracts(rootDirectory: string): Promise<TaskLintResult> {
  const findings: TaskLintFinding[] = [];
  let taskDirectory = ".tasks";
  try {
    taskDirectory = (await readAgenticConfigFile(rootDirectory)).taskDirectory;
  } catch (error: unknown) {
    addFinding(findings, {
      level: "error",
      code: "config-invalid",
      area: "config",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const documents = await readTaskDocuments(rootDirectory, taskDirectory, findings);
  const ids = duplicateIds(documents.documents);
  for (const id of ids) {
    addFinding(findings, {
      level: "error",
      code: "duplicate-task-id",
      area: "tasks",
      message: `Task id ${id} is used by multiple task files.`,
      taskId: id,
    });
  }

  const dependencyIssues = validateTaskDependencies(documents.active, documents.archived);
  for (const issue of dependencyIssues) {
    addFinding(findings, {
      level: "error",
      code: issue.kind === "cycle" ? "dependency-cycle" : "dependency-missing",
      area: "dependencies",
      message: issue.message,
      taskId: issue.taskId,
    });
  }

  const registeredAgents = new Set((await listAgents(rootDirectory)).map((agent) => agent.id));
  for (const file of [...documents.active, ...documents.archived]) {
    const path = normalizeRepoPath(relative(rootDirectory, file.path));
    if (file.task.dependsOn.includes(file.task.id)) {
      addFinding(findings, {
        level: "error",
        code: "self-dependency",
        area: "dependencies",
        message: `Task ${file.task.id} depends on itself.`,
        path,
        taskId: file.task.id,
      });
    }
    lintPathContracts(file.task, findings, path);
    lintTaskPolicy(file.task, findings, path);
    lintTaskStateOwner(file.task, registeredAgents, registeredAgents.size > 0, findings, path);
  }

  let sync: TaskLintSyncSummary = { checked: [], current: [], missing: [], stale: [] };
  try {
    const syncResult = await syncAgentExports(rootDirectory);
    sync = {
      checked: syncResult.checked,
      current: syncResult.current,
      missing: syncResult.missing,
      stale: syncResult.stale,
    };
    for (const path of sync.missing) {
      addFinding(findings, {
        level: "error",
        code: "generated-file-missing",
        area: "exports",
        message: `Generated file ${path} is missing.`,
        path,
      });
    }
    for (const path of sync.stale) {
      addFinding(findings, {
        level: "error",
        code: "generated-file-stale",
        area: "exports",
        message: `Generated file ${path} is stale.`,
        path,
      });
    }
  } catch (error: unknown) {
    addFinding(findings, {
      level: "error",
      code: "exports-check-failed",
      area: "exports",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const sortedFindings = sortFindings(findings);
  return {
    taskCount: documents.paths.length,
    checkedTaskFiles: documents.paths,
    findings: sortedFindings,
    sync,
    hasErrors: sortedFindings.some((finding) => finding.level === "error"),
  };
}

export function renderTaskLintResult(
  result: TaskLintResult,
  json = false,
): string {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  return [
    `Task lint: ${result.hasErrors ? "fail" : result.findings.length > 0 ? "warning" : "pass"}`,
    `Task files checked: ${result.taskCount}`,
    `Generated files checked: ${result.sync.checked.length}`,
    `Findings: ${result.findings.length}`,
    ...(result.findings.length > 0
      ? result.findings.map((finding) => [
        `- ${finding.level.toUpperCase()} ${finding.code} ${finding.area}: ${finding.message}`,
        finding.taskId ? `  task: ${finding.taskId}` : undefined,
        finding.path ? `  path: ${finding.path}` : undefined,
      ].filter((line): line is string => line !== undefined).join("\n"))
      : ["- none"]),
    "",
  ].join("\n");
}
