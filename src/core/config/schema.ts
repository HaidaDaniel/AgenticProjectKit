import { DEFAULT_CONFIG } from "./defaults.js";
import { ConfigValidationError } from "./errors.js";
import {
  AGENT_STYLES,
  DOCUMENTATION_PROFILES,
  OPERATING_MODES,
  type AgenticConfig,
  type AgentStyle,
  type DocumentationProfile,
  type OperatingMode,
} from "./types.js";

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

export function parseAgenticConfig(raw: unknown): AgenticConfig {
  if (raw === undefined || raw === null) {
    return { ...DEFAULT_CONFIG };
  }

  if (!isPlainRecord(raw)) {
    throw new ConfigValidationError(["Config must be a JSON object."]);
  }

  const issues: string[] = [];

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

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    projectName,
    defaultMode,
    documentationProfile,
    agentStyle,
    taskDirectory,
    docsDirectory,
  };
}

export function parseAgenticConfigJson(text: string): AgenticConfig {
  const parsed = JSON.parse(text) as unknown;
  return parseAgenticConfig(parsed);
}

export function serializeAgenticConfig(config: AgenticConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
