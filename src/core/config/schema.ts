import { DEFAULT_CONFIG } from "./defaults.js";
import { ConfigValidationError } from "./errors.js";
import { parseResourceRegistry, ResourceRegistryValidationError } from "../resources/index.js";
import { parseExecutionOverride, parseExecutionProfile, ExecutionValidationError } from "../execution/index.js";
import { QUALITY_CAPABILITY_IDS, type QualityCapabilityId, type QualityPolicy } from "../quality/index.js";
import {
  AGENT_STYLES,
  DOCUMENTATION_PROFILES,
  OPERATING_MODES,
  type AgenticConfig,
  type ExecutionCalibration,
} from "./types.js";

export const LEGACY_CONFIG_SCHEMA_VERSION = 1 as const;
export const CURRENT_CONFIG_SCHEMA_VERSION = 2 as const;
export const CONFIG_SCHEMA_VERSIONS = [
  LEGACY_CONFIG_SCHEMA_VERSION,
  CURRENT_CONFIG_SCHEMA_VERSION,
] as const;

type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  const text = asString(value);
  return text && (allowed as readonly string[]).includes(text) ? (text as T) : undefined;
}

function readString(
  value: unknown,
  fallback: string,
  issues: string[],
  issue: string,
): string {
  if (value === undefined) {
    return fallback;
  }

  const text = asString(value);
  if (!text) {
    issues.push(issue);
    return fallback;
  }

  return text;
}

function readOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  issues: string[],
  issue: string,
): T {
  if (value === undefined) {
    return fallback;
  }

  const text = asOneOf(value, allowed);
  if (!text) {
    issues.push(issue);
    return fallback;
  }

  return text;
}

function readSchemaVersion(value: unknown, issues: string[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || !(CONFIG_SCHEMA_VERSIONS as readonly number[]).includes(value)
  ) {
    issues.push(`schemaVersion must be one of: ${CONFIG_SCHEMA_VERSIONS.join(", ")}.`);
    return undefined;
  }

  return value;
}

function readQualityPolicy(value: unknown, issues: string[]): QualityPolicy | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value)) {
    issues.push("quality must be an object.");
    return undefined;
  }

  const readIds = (field: "required" | "recommended"): QualityCapabilityId[] => {
    const raw = value[field];
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      issues.push(`quality.${field} must be an array of capability IDs.`);
      return [];
    }
    const result: QualityCapabilityId[] = [];
    for (const item of raw) {
      if (typeof item !== "string" || !(QUALITY_CAPABILITY_IDS as readonly string[]).includes(item)) {
        issues.push(`quality.${field} contains an unknown capability ID: ${String(item)}.`);
        continue;
      }
      if (!result.includes(item as QualityCapabilityId)) result.push(item as QualityCapabilityId);
    }
    return result.sort();
  };

  const required = readIds("required");
  const requiredSet = new Set(required);
  return {
    required,
    recommended: readIds("recommended").filter((id) => !requiredSet.has(id)),
  };
}

function readExecutionCalibration(
  value: unknown,
  issues: string[],
): ExecutionCalibration | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainRecord(value)) {
    issues.push("executionCalibration must be an object.");
    return undefined;
  }

  let profile: ExecutionCalibration["profile"] | undefined;
  try {
    profile = parseExecutionProfile(value.profile);
  } catch (error: unknown) {
    if (error instanceof ExecutionValidationError) issues.push(...error.issues);
    else issues.push("executionCalibration.profile is invalid.");
  }
  const inventoryFingerprint = asString(value.inventoryFingerprint);
  if (!inventoryFingerprint) issues.push("executionCalibration.inventoryFingerprint must be a non-empty string.");
  const generatedAt = asString(value.generatedAt);
  if (!generatedAt) issues.push("executionCalibration.generatedAt must be a non-empty string.");
  const planner = asString(value.planner);
  if (!planner) issues.push("executionCalibration.planner must be a non-empty string.");

  const routes: Record<string, string> = {};
  if (value.routes !== undefined) {
    if (!isPlainRecord(value.routes)) {
      issues.push("executionCalibration.routes must be an object.");
    } else {
      for (const [key, entry] of Object.entries(value.routes)) {
        const text = asString(entry);
        if (!text) issues.push(`executionCalibration.routes.${key} must be a non-empty string.`);
        else routes[key] = text;
      }
    }
  }

  let assuranceMinimum: string | undefined;
  if (value.assuranceMinimum !== undefined) {
    const level = asString(value.assuranceMinimum);
    if (!level) issues.push("executionCalibration.assuranceMinimum must be a non-empty string.");
    else assuranceMinimum = level;
  }

  let budget: ExecutionCalibration["budget"];
  if (value.budget !== undefined) {
    if (!isPlainRecord(value.budget)) {
      issues.push("executionCalibration.budget must be an object.");
    } else {
      const parsed: NonNullable<ExecutionCalibration["budget"]> = {};
      for (const field of ["maxReviewPasses", "maxFrontierRuns"] as const) {
        const raw = value.budget[field];
        if (raw === undefined) continue;
        if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
          issues.push(`executionCalibration.budget.${field} must be a non-negative integer.`);
        } else {
          parsed[field] = raw;
        }
      }
      budget = parsed;
    }
  }

  if (!profile || !inventoryFingerprint || !generatedAt || !planner) {
    return undefined;
  }
  return {
    profile,
    inventoryFingerprint,
    generatedAt,
    planner,
    routes,
    ...(assuranceMinimum ? { assuranceMinimum } : {}),
    ...(budget ? { budget } : {}),
  };
}

export function parseAgenticConfig(raw: unknown): AgenticConfig {
  if (raw === undefined || raw === null) {
    return { ...DEFAULT_CONFIG };
  }

  if (!isPlainRecord(raw)) {
    throw new ConfigValidationError(["Config must be a JSON object."]);
  }

  const issues: string[] = [];
  const schemaVersion = readSchemaVersion(raw.schemaVersion, issues);

  const projectName = readString(
    raw.projectName,
    DEFAULT_CONFIG.projectName,
    issues,
    "projectName must be a non-empty string.",
  );

  const defaultMode = readOneOf(
    raw.defaultMode,
    OPERATING_MODES,
    DEFAULT_CONFIG.defaultMode,
    issues,
    `defaultMode must be one of: ${OPERATING_MODES.join(", ")}.`,
  );

  const documentationProfile = readOneOf(
    raw.documentationProfile,
    DOCUMENTATION_PROFILES,
    DEFAULT_CONFIG.documentationProfile,
    issues,
    `documentationProfile must be one of: ${DOCUMENTATION_PROFILES.join(", ")}.`,
  );

  const agentStyle = readOneOf(
    raw.agentStyle,
    AGENT_STYLES,
    DEFAULT_CONFIG.agentStyle,
    issues,
    `agentStyle must be one of: ${AGENT_STYLES.join(", ")}.`,
  );

  const taskDirectory = readString(
    raw.taskDirectory,
    DEFAULT_CONFIG.taskDirectory,
    issues,
    "taskDirectory must be a non-empty string.",
  );

  const docsDirectory = readString(
    raw.docsDirectory,
    DEFAULT_CONFIG.docsDirectory,
    issues,
    "docsDirectory must be a non-empty string.",
  );

  const quality = readQualityPolicy(raw.quality, issues);

  let resources: AgenticConfig["resources"];
  if (raw.resources !== undefined) {
    try {
      resources = parseResourceRegistry(raw.resources);
    } catch (error: unknown) {
      if (error instanceof ResourceRegistryValidationError) {
        issues.push(...error.issues);
      } else {
        issues.push(`resources is invalid: ${error instanceof Error ? error.message : String(error)}.`);
      }
    }
  }

  let executionProfile: AgenticConfig["executionProfile"];
  if (raw.executionProfile !== undefined) {
    try {
      executionProfile = parseExecutionProfile(raw.executionProfile);
    } catch (error: unknown) {
      if (error instanceof ExecutionValidationError) issues.push(...error.issues);
      else issues.push(`executionProfile is invalid: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }

  let executionOverrides: AgenticConfig["executionOverrides"];
  if (raw.executionOverrides !== undefined) {
    try {
      executionOverrides = parseExecutionOverride(raw.executionOverrides);
    } catch (error: unknown) {
      if (error instanceof ExecutionValidationError) issues.push(...error.issues);
      else issues.push(`executionOverrides is invalid: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }

  const executionCalibration = readExecutionCalibration(raw.executionCalibration, issues);

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    projectName,
    defaultMode,
    documentationProfile,
    agentStyle,
    taskDirectory,
    docsDirectory,
    ...(resources === undefined ? {} : { resources }),
    ...(executionProfile === undefined ? {} : { executionProfile }),
    ...(executionOverrides === undefined ? {} : { executionOverrides }),
    ...(executionCalibration === undefined ? {} : { executionCalibration }),
    ...(quality === undefined ? {} : { quality }),
  };
}

export function parseAgenticConfigJson(text: string): AgenticConfig {
  const parsed = JSON.parse(text) as unknown;
  return parseAgenticConfig(parsed);
}

export function serializeAgenticConfig(config: AgenticConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
