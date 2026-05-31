import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  CONFIG_PATH,
  parseAgenticConfigJson,
} from "../config/index.js";
import { scanRepository, type RepositoryScan } from "../scanners/index.js";
import { loadTaskFile, listArchivedTaskFiles, parseTaskMarkdown, TaskFormatError, validateTaskDependencies, type ProjectTaskFile } from "../tasks/index.js";

export type AuditFindingLevel = "error" | "warning" | "info";

export interface AuditFinding {
  level: AuditFindingLevel;
  area: string;
  message: string;
}

export interface AuditResult {
  scan: RepositoryScan;
  findings: AuditFinding[];
  taskCount: number;
  reportPath: string;
  projectMapPath: string;
  hasErrors: boolean;
}

const AUDIT_REPORT_PATH = "docs/audit-report.md";
const PROJECT_MAP_PATH = "docs/project-map.md";

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
}

function renderBulletList(items: readonly string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}

function renderProjectMap(scan: RepositoryScan): string {
  return [
    "# Project Map",
    "",
    `Repository: ${scan.rootName}`,
    "",
    "## Detected Stack",
    "",
    ...renderBulletList(scan.detectedStack),
    "",
    "## Top-level Directories",
    "",
    ...renderBulletList(scan.topLevelDirectories),
    "",
    "## Top-level Files",
    "",
    ...renderBulletList(scan.topLevelFiles),
    "",
    "## Kit Docs Present",
    "",
    ...renderBulletList(scan.kitDocs.present),
    "",
    "## Kit Docs Missing",
    "",
    ...renderBulletList(scan.kitDocs.missing),
    "",
    "## Agent Exports Present",
    "",
    ...renderBulletList(scan.agentExports.present),
    "",
    "## Agent Exports Missing",
    "",
    ...renderBulletList(scan.agentExports.missing),
    "",
    "## Task Files",
    "",
    ...renderBulletList(scan.taskFiles),
    "",
  ].join("\n");
}

function renderAuditReport(result: Omit<AuditResult, "reportPath" | "projectMapPath">): string {
  const status = result.hasErrors ? "error" : result.findings.length > 0 ? "warning" : "pass";

  return [
    "# Audit Report",
    "",
    `Repository: ${result.scan.rootName}`,
    `Status: ${status}`,
    `Task files checked: ${result.taskCount}`,
    "",
    "## Findings",
    "",
    ...(result.findings.length > 0
      ? result.findings.map((finding) => `- ${finding.level.toUpperCase()} ${finding.area}: ${finding.message}`)
      : ["- none"]),
    "",
    "## Summary",
    "",
    `- Missing kit docs: ${result.scan.kitDocs.missing.length}`,
    `- Missing agent exports: ${result.scan.agentExports.missing.length}`,
    `- Agentic config present: ${result.scan.hasAgenticConfig ? "yes" : "no"}`,
    "",
  ].join("\n");
}

function addMissingFindings(
  findings: AuditFinding[],
  area: string,
  files: readonly string[],
): void {
  for (const file of files) {
    findings.push({
      level: "warning",
      area,
      message: `Missing ${file}.`,
    });
  }
}

async function auditConfig(rootDirectory: string, findings: AuditFinding[]): Promise<void> {
  const configText = await readOptionalFile(join(rootDirectory, CONFIG_PATH));

  if (configText === undefined) {
    findings.push({
      level: "warning",
      area: "config",
      message: `Missing ${CONFIG_PATH}.`,
    });
    return;
  }

  try {
    parseAgenticConfigJson(configText);
  } catch (error: unknown) {
    findings.push({
      level: "error",
      area: "config",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function auditTasks(
  rootDirectory: string,
  scan: RepositoryScan,
  findings: AuditFinding[],
): Promise<number> {
  if (scan.taskFiles.length === 0) {
    findings.push({
      level: "warning",
      area: "tasks",
      message: "No task files found in .tasks.",
    });
    return 0;
  }

  const validTaskFiles: ProjectTaskFile[] = [];

  for (const taskPath of scan.taskFiles) {
    try {
      const loaded = await loadTaskFile(join(rootDirectory, taskPath));
      validTaskFiles.push(loaded);
    } catch (error: unknown) {
      const detail = error instanceof TaskFormatError
        ? error.issues.join("; ")
        : error instanceof Error
          ? error.message
          : String(error);
      findings.push({
        level: "error",
        area: "tasks",
        message: `${taskPath}: ${detail}`,
      });
    }
  }

  const archivedFiles = await listArchivedTaskFiles(rootDirectory);

  const depIssues = validateTaskDependencies(validTaskFiles, archivedFiles);
  for (const issue of depIssues) {
    findings.push({
      level: issue.kind === "cycle" ? "error" : "warning",
      area: "dependencies",
      message: issue.message,
    });
  }

  return scan.taskFiles.length;
}

export async function auditRepository(rootDirectory: string): Promise<AuditResult> {
  const scan = await scanRepository(rootDirectory);
  const findings: AuditFinding[] = [];

  addMissingFindings(findings, "docs", scan.kitDocs.missing);
  addMissingFindings(findings, "exports", scan.agentExports.missing);
  await auditConfig(rootDirectory, findings);
  const taskCount = await auditTasks(rootDirectory, scan, findings);
  const hasErrors = findings.some((finding) => finding.level === "error");
  const result = {
    scan,
    findings,
    taskCount,
    hasErrors,
  };
  const reportPath = join(rootDirectory, AUDIT_REPORT_PATH);
  const projectMapPath = join(rootDirectory, PROJECT_MAP_PATH);

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, renderAuditReport(result), "utf8");
  await writeFile(projectMapPath, renderProjectMap(scan), "utf8");

  return {
    ...result,
    reportPath: AUDIT_REPORT_PATH,
    projectMapPath: PROJECT_MAP_PATH,
  };
}

export function renderAuditSummary(result: AuditResult): string {
  return [
    `Audit: ${result.hasErrors ? "errors" : result.findings.length > 0 ? "warnings" : "pass"}`,
    `Report: ${result.reportPath}`,
    `Project map: ${result.projectMapPath}`,
    `Findings: ${result.findings.length}`,
    "",
  ].join("\n");
}
