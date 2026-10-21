import { constants } from "node:fs";
import { open, opendir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { parseTaskMarkdown, TaskFormatError, type ProjectTask } from "../tasks/index.js";

import { CONFIG_PATH } from "./file.js";
import {
  CURRENT_CONFIG_SCHEMA_VERSION,
  LEGACY_CONFIG_SCHEMA_VERSION,
  parseAgenticConfigJson,
} from "./schema.js";

export type CompatibilityConfigState = "missing" | "legacy" | "gated" | "invalid" | "unsupported";
export type CompatibilityTaskContract = "none" | "legacy" | "gated" | "mixed" | "unknown";
export type CompatibilityOverallState = "unconfigured" | "legacy" | "gated" | "mixed" | "unsupported";

export interface CompatibilityReport {
  config: {
    path: string;
    state: CompatibilityConfigState;
    schemaVersion?: number;
  };
  tasks: {
    directory: string;
    total: number;
    legacy: number;
    gated: number;
    unknown: number;
    contract: CompatibilityTaskContract;
    inspection: TaskContractInspection;
  };
  overall: CompatibilityOverallState;
  migrationRequired: boolean;
  taskRepairRequired: boolean;
  manualMigration: readonly string[];
  diagnostics: string[];
}

interface RawConfig {
  taskDirectory?: unknown;
  schemaVersion?: unknown;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT",
  );
}

async function readConfig(
  rootDirectory: string,
): Promise<{ state: CompatibilityConfigState; raw?: RawConfig; schemaVersion?: number; diagnostic?: string }> {
  let text: string;
  try {
    text = await readFile(join(rootDirectory, CONFIG_PATH), "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return { state: "missing" };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error: unknown) {
    return {
      state: "invalid",
      diagnostic: `Invalid ${CONFIG_PATH}: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { state: "invalid", diagnostic: `${CONFIG_PATH} must contain a JSON object.` };
  }

  const raw = parsed as RawConfig;
  if (typeof raw.schemaVersion === "number" && raw.schemaVersion > CURRENT_CONFIG_SCHEMA_VERSION) {
    return {
      state: "unsupported",
      raw,
      diagnostic: `Unsupported ${CONFIG_PATH} schemaVersion: ${String(raw.schemaVersion)}.`,
    };
  }
  try {
    parseAgenticConfigJson(text);
  } catch (error: unknown) {
    return {
      state: "invalid",
      raw,
      diagnostic: `Invalid ${CONFIG_PATH}: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }

  if (raw.schemaVersion === undefined) {
    return { state: "legacy", raw, schemaVersion: LEGACY_CONFIG_SCHEMA_VERSION };
  }

  if (raw.schemaVersion === CURRENT_CONFIG_SCHEMA_VERSION) {
    return { state: "gated", raw, schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION };
  }

  if (raw.schemaVersion === LEGACY_CONFIG_SCHEMA_VERSION) {
    return { state: "legacy", raw, schemaVersion: LEGACY_CONFIG_SCHEMA_VERSION };
  }

  return {
    state: "unsupported",
    raw,
    diagnostic: `Unsupported ${CONFIG_PATH} schemaVersion: ${String(raw.schemaVersion)}.`,
  };
}

export const TASK_INSPECTION_LIMITS = { directoryEntries: 4096, files: 1024, bytesPerFile: 256 * 1024, issuesPerFile: 32, issueCharacters: 512 } as const;

export const TASK_MANUAL_MIGRATION = [
  "Preserve original task bytes and Git history; back up needed local evidence and baselines before editing.",
  "Classify each reported active/archive file. Supported legacy Verification commands need no format repair; schemaVersion migration does not repair task content.",
  "Obtain explicit owner, state and project-mode decisions for incompatible contracts; do not assume in_progress means doing or bugfix is a Mode.",
  "Prepare scoped, reviewable edits in a separate branch; preserve original references and historical completion claims without inventing evidence.",
  "Rerun apk lint and adoption preview until all files are inspected and incompatibilities are resolved; separately review dependencies and duplicate IDs.",
  "Independently revalidate affected candidate/baseline-bound provenance and verification/review evidence. Editing a contract can invalidate prior proof; never copy PASS records to restore trust.",
] as const;

export interface InspectedTaskContract {
  path: string;
  archived: boolean;
  rawId?: string;
  rawState?: string;
  rawMode?: string;
  status: "parseable" | "incompatible" | "unreadable" | "not-inspected";
  verification: "legacy" | "gated" | "unknown";
  issues: string[];
  omittedIssues: number;
}

export interface TaskContractInspection {
  entries: InspectedTaskContract[];
  coverage: {
    discovered: number;
    inspected: number;
    parseable: number;
    incompatible: number;
    unreadable: number;
    notInspected: number;
    enumerationComplete: boolean;
    complete: boolean;
    limits: typeof TASK_INSPECTION_LIMITS;
  };
  diagnostics: string[];
}

function boundedText(value: string): string {
  return value.length > TASK_INSPECTION_LIMITS.issueCharacters
    ? `${value.slice(0, TASK_INSPECTION_LIMITS.issueCharacters - 1)}…` : value;
}

/** Shared bounded read-only parser inventory for compatibility and lint. */
export async function inspectTaskContracts(rootDirectory: string, taskDirectory: string): Promise<{
  inspection: TaskContractInspection;
  parsed: { path: string; archived: boolean; task: ProjectTask }[];
}> {
  const paths: { path: string; archived: boolean }[] = [];
  const diagnostics: string[] = [];
  let enumerationComplete = true;
  for (const archived of [false, true]) {
    const directory = join(rootDirectory, taskDirectory, ...(archived ? ["archive"] : []));
    try {
      let visited = 0;
      for await (const entry of await opendir(directory)) {
        if (++visited > TASK_INSPECTION_LIMITS.directoryEntries) {
          enumerationComplete = false;
          diagnostics.push(`Task inspection incomplete: ${boundedText(relative(rootDirectory, directory))} exceeds directory entry limit ${TASK_INSPECTION_LIMITS.directoryEntries}; additional paths/count unknown.`);
          break;
        }
        if (entry.name.endsWith(".md")) paths.push({ path: relative(rootDirectory, join(directory, entry.name)).replace(/\\/g, "/"), archived });
      }
    } catch (error: unknown) {
      if (!isMissingFileError(error)) {
        enumerationComplete = false;
        diagnostics.push(`Task inspection directory unavailable: ${boundedText(relative(rootDirectory, directory))}: ${boundedText(error instanceof Error ? error.message : String(error))}`);
      }
    }
  }
  paths.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const entries: InspectedTaskContract[] = [];
  const parsed: { path: string; archived: boolean; task: ProjectTask }[] = [];
  for (const [index, file] of paths.entries()) {
    const entry: InspectedTaskContract = { ...file, status: "not-inspected", verification: "unknown", issues: [], omittedIssues: 0 };
    entries.push(entry);
    if (index >= TASK_INSPECTION_LIMITS.files) {
      entry.issues = ["Not inspected: task-file budget exceeded."];
      continue;
    }
    let markdown: string;
    try {
      // No symlink/FIFO traversal or content-sized allocation.
      const handle = await open(join(rootDirectory, file.path), constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      try {
        const info = await handle.stat();
        if (!info.isFile()) throw new Error("Not a regular task file.");
        if (info.size > TASK_INSPECTION_LIMITS.bytesPerFile) {
          entry.issues = ["Not inspected: task exceeds byte limit."];
          continue;
        }
        const buffer = Buffer.alloc(TASK_INSPECTION_LIMITS.bytesPerFile + 1);
        let size = 0;
        while (size < buffer.length) {
          const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
          if (bytesRead === 0) break;
          size += bytesRead;
        }
        if (size > TASK_INSPECTION_LIMITS.bytesPerFile) {
          entry.issues = ["Not inspected: task exceeds byte limit."];
          continue;
        }
        markdown = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
      } finally {
        await handle.close();
      }
    } catch (error: unknown) {
      entry.status = "unreadable";
      entry.issues = [boundedText(error instanceof Error ? error.message : String(error))];
      continue;
    }
    entry.rawId = markdown.match(/^# Task\s+([^\s]+)\s+-/m)?.[1]?.slice(0, 128);
    entry.rawState = markdown.match(/^(?:State|Status):([^\r\n]*)/m)?.[1]?.trim().slice(0, 128);
    entry.rawMode = markdown.match(/^Mode:([^\r\n]*)/m)?.[1]?.trim().slice(0, 128);
    entry.verification = taskContract(markdown);
    try {
      const task = parseTaskMarkdown(markdown);
      entry.status = "parseable";
      parsed.push({ ...file, task });
    } catch (error: unknown) {
      entry.status = "incompatible";
      const issues = error instanceof TaskFormatError ? error.issues : [error instanceof Error ? error.message : String(error)];
      entry.issues = issues.slice(0, TASK_INSPECTION_LIMITS.issuesPerFile).map(boundedText);
      entry.omittedIssues = Math.max(0, issues.length - entry.issues.length);
    }
  }
  const count = (status: InspectedTaskContract["status"]) => entries.filter((entry) => entry.status === status).length;
  const parseable = count("parseable"), incompatible = count("incompatible"), unreadable = count("unreadable"), notInspected = count("not-inspected");
  const coverage = {
    discovered: entries.length, inspected: parseable + incompatible, parseable, incompatible, unreadable, notInspected,
    enumerationComplete, complete: enumerationComplete && unreadable === 0 && notInspected === 0,
    limits: TASK_INSPECTION_LIMITS,
  };
  if (!coverage.complete) diagnostics.push(`Task inspection incomplete: unreadable=${unreadable}; not-inspected=${notInspected}; discovered=${entries.length}${enumerationComplete ? "" : " (lower bound)"}. No clean compatibility claim is available.`);
  return { inspection: { entries, coverage, diagnostics }, parsed };
}

export function renderTaskContractInspection(inspection: TaskContractInspection): string[] {
  const { coverage } = inspection;
  return [
    `Task parseability: parseable=${coverage.parseable}; incompatible=${coverage.incompatible}; unreadable=${coverage.unreadable}; not-inspected=${coverage.notInspected}; coverage=${coverage.complete ? "complete" : "incomplete"}. Verification heading families alone do not prove parseability.`,
    `Task inspection limits: ${coverage.limits.directoryEntries} entries/directory; ${coverage.limits.files} files; ${coverage.limits.bytesPerFile} bytes/file; ${coverage.limits.issuesPerFile} issues/file; ${coverage.limits.issueCharacters} characters/issue (long text ends with …).`,
    ...inspection.entries.filter((entry) => entry.status !== "parseable").map((entry) =>
      `${JSON.stringify(entry.path)}${entry.rawId ? ` (raw id=${JSON.stringify(entry.rawId)})` : ""}: ${entry.status}: ${entry.issues.join("; ")}${entry.omittedIssues > 0 ? `; ${entry.omittedIssues} more issues omitted` : ""}`),
    ...inspection.diagnostics,
  ];
}

function taskContract(markdown: string): "legacy" | "gated" | "unknown" {
  const hasGatedVerification = /^## Verification\s*$/m.test(markdown);
  const hasLegacyVerification = /^## Verification commands\s*$/m.test(markdown);
  if (hasGatedVerification && !hasLegacyVerification) return "gated";
  if (hasLegacyVerification && !hasGatedVerification) return "legacy";
  return "unknown";
}

function overallState(
  configState: CompatibilityConfigState,
  taskContractValue: CompatibilityTaskContract,
  totalTasks: number,
): CompatibilityOverallState {
  if (configState === "invalid" || configState === "unsupported") return "unsupported";
  if (configState === "gated" && taskContractValue === "legacy") return "mixed";
  if (configState === "gated") return "gated";
  if (configState === "missing" && totalTasks === 0) return "unconfigured";
  return "legacy";
}

export async function detectCompatibility(rootDirectory: string): Promise<CompatibilityReport> {
  const config = await readConfig(rootDirectory);
  const taskDirectory = typeof config.raw?.taskDirectory === "string" && config.raw.taskDirectory.trim().length > 0
    ? config.raw.taskDirectory
    : ".tasks";
  const { inspection } = await inspectTaskContracts(rootDirectory, taskDirectory);
  const legacy = inspection.entries.filter((entry) => entry.verification === "legacy").length;
  const gated = inspection.entries.filter((entry) => entry.verification === "gated").length;
  const unknown = inspection.entries.length - legacy - gated;
  const taskRepairRequired = inspection.coverage.incompatible > 0;
  const diagnostics: string[] = [
    ...(config.diagnostic ? [config.diagnostic] : []),
    ...renderTaskContractInspection(inspection).slice(2),
    ...(taskRepairRequired || !inspection.coverage.complete ? TASK_MANUAL_MIGRATION.map((step, index) => `Manual task migration ${index + 1}: ${step}`) : []),
  ];

  const contract: CompatibilityTaskContract = legacy > 0 && gated > 0
    ? "mixed"
    : legacy > 0
      ? "legacy"
      : gated > 0
        ? "gated"
        : unknown > 0
          ? "unknown"
          : "none";

  return {
    config: {
      path: CONFIG_PATH,
      state: config.state,
      ...(config.schemaVersion === undefined ? {} : { schemaVersion: config.schemaVersion }),
    },
    tasks: {
      directory: taskDirectory,
      total: inspection.entries.length,
      legacy,
      gated,
      unknown,
      contract,
      inspection,
    },
    overall: overallState(config.state, contract, inspection.entries.length),
    migrationRequired: config.state === "legacy" || config.state === "missing",
    taskRepairRequired,
    manualMigration: TASK_MANUAL_MIGRATION,
    diagnostics,
  };
}
