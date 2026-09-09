import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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
  };
  overall: CompatibilityOverallState;
  migrationRequired: boolean;
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

async function taskFiles(
  rootDirectory: string,
  taskDirectory: string,
): Promise<string[]> {
  const directories = [
    join(rootDirectory, taskDirectory),
    join(rootDirectory, taskDirectory, "archive"),
  ];
  const paths: string[] = [];

  for (const directory of directories) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error: unknown) {
      if (isMissingFileError(error)) continue;
      throw error;
    }

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        paths.push(join(directory, entry.name));
      }
    }
  }

  return paths.sort();
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
  const paths = await taskFiles(rootDirectory, taskDirectory);
  let legacy = 0;
  let gated = 0;
  let unknown = 0;
  const diagnostics: string[] = config.diagnostic ? [config.diagnostic] : [];

  for (const path of paths) {
    try {
      const contract = taskContract(await readFile(path, "utf8"));
      if (contract === "legacy") legacy += 1;
      else if (contract === "gated") gated += 1;
      else unknown += 1;
    } catch (error: unknown) {
      unknown += 1;
      diagnostics.push(`Unable to inspect task ${path}: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }

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
      total: paths.length,
      legacy,
      gated,
      unknown,
      contract,
    },
    overall: overallState(config.state, contract, paths.length),
    migrationRequired: config.state === "legacy" || config.state === "missing",
    diagnostics,
  };
}
