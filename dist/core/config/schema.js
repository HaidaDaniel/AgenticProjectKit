import { DEFAULT_CONFIG } from "./defaults.js";
import { ConfigValidationError } from "./errors.js";
import { parseResourceRegistry, ResourceRegistryValidationError } from "../resources/index.js";
import { parseExecutionOverride, parseExecutionProfile, ExecutionValidationError } from "../execution/index.js";
import { QUALITY_CAPABILITY_IDS } from "../quality/index.js";
import { AGENT_STYLES, DOCUMENTATION_PROFILES, OPERATING_MODES, } from "./types.js";
export const LEGACY_CONFIG_SCHEMA_VERSION = 1;
export const CURRENT_CONFIG_SCHEMA_VERSION = 2;
export const CONFIG_SCHEMA_VERSIONS = [
    LEGACY_CONFIG_SCHEMA_VERSION,
    CURRENT_CONFIG_SCHEMA_VERSION,
];
function isPlainRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
function asOneOf(value, allowed) {
    const text = asString(value);
    return text && allowed.includes(text) ? text : undefined;
}
function readString(value, fallback, issues, issue) {
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
function readOneOf(value, allowed, fallback, issues, issue) {
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
function readSchemaVersion(value, issues) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "number"
        || !Number.isInteger(value)
        || !CONFIG_SCHEMA_VERSIONS.includes(value)) {
        issues.push(`schemaVersion must be one of: ${CONFIG_SCHEMA_VERSIONS.join(", ")}.`);
        return undefined;
    }
    return value;
}
function readQualityPolicy(value, issues) {
    if (value === undefined)
        return undefined;
    if (!isPlainRecord(value)) {
        issues.push("quality must be an object.");
        return undefined;
    }
    const readIds = (field) => {
        const raw = value[field];
        if (raw === undefined)
            return [];
        if (!Array.isArray(raw)) {
            issues.push(`quality.${field} must be an array of capability IDs.`);
            return [];
        }
        const result = [];
        for (const item of raw) {
            if (typeof item !== "string" || !QUALITY_CAPABILITY_IDS.includes(item)) {
                issues.push(`quality.${field} contains an unknown capability ID: ${String(item)}.`);
                continue;
            }
            if (!result.includes(item))
                result.push(item);
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
// Same canonical assurance vocabulary as the execution policy; duplicated here
// only to keep the config parser free of a runtime cycle with calibrate.ts.
const CALIBRATION_ASSURANCE_LEVELS = ["none", "self-check", "fresh-context", "independent", "diverse"];
function readExecutionCalibration(value, issues) {
    if (value === undefined) {
        return undefined;
    }
    if (!isPlainRecord(value)) {
        issues.push("executionCalibration must be an object.");
        return undefined;
    }
    let profile;
    try {
        profile = parseExecutionProfile(value.profile);
    }
    catch (error) {
        if (error instanceof ExecutionValidationError)
            issues.push(...error.issues);
        else
            issues.push("executionCalibration.profile is invalid.");
    }
    const inventoryFingerprint = asString(value.inventoryFingerprint);
    if (!inventoryFingerprint)
        issues.push("executionCalibration.inventoryFingerprint must be a non-empty string.");
    const generatedAt = asString(value.generatedAt);
    if (!generatedAt)
        issues.push("executionCalibration.generatedAt must be a non-empty string.");
    const planner = asString(value.planner);
    if (!planner)
        issues.push("executionCalibration.planner must be a non-empty string.");
    const routes = {};
    if (value.routes !== undefined) {
        if (!isPlainRecord(value.routes)) {
            issues.push("executionCalibration.routes must be an object.");
        }
        else {
            for (const [key, entry] of Object.entries(value.routes)) {
                const text = asString(entry);
                if (!text)
                    issues.push(`executionCalibration.routes.${key} must be a non-empty string.`);
                else
                    routes[key] = text;
            }
        }
    }
    let assuranceMinimum;
    if (value.assuranceMinimum !== undefined) {
        const level = asString(value.assuranceMinimum);
        if (!level || !CALIBRATION_ASSURANCE_LEVELS.includes(level)) {
            issues.push(`executionCalibration.assuranceMinimum must be one of: ${CALIBRATION_ASSURANCE_LEVELS.join(", ")}.`);
        }
        else {
            assuranceMinimum = level;
        }
    }
    let budget;
    if (value.budget !== undefined) {
        if (!isPlainRecord(value.budget)) {
            issues.push("executionCalibration.budget must be an object.");
        }
        else {
            const parsed = {};
            for (const field of ["maxReviewPasses", "maxFrontierRuns"]) {
                const raw = value.budget[field];
                if (raw === undefined)
                    continue;
                if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
                    issues.push(`executionCalibration.budget.${field} must be a non-negative integer.`);
                }
                else if (field === "maxReviewPasses" && raw < 1) {
                    issues.push("executionCalibration.budget.maxReviewPasses must be at least 1.");
                }
                else {
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
function readContextExcludes(value, issues) {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        issues.push("contextExcludes must be an array of non-empty path strings.");
        return undefined;
    }
    const result = [];
    for (const item of value) {
        const text = asString(item);
        if (!text) {
            issues.push("contextExcludes must contain only non-empty path strings.");
            continue;
        }
        if (!result.includes(text))
            result.push(text);
    }
    return result;
}
export function parseAgenticConfig(raw) {
    if (raw === undefined || raw === null) {
        return { ...DEFAULT_CONFIG };
    }
    if (!isPlainRecord(raw)) {
        throw new ConfigValidationError(["Config must be a JSON object."]);
    }
    const issues = [];
    const schemaVersion = readSchemaVersion(raw.schemaVersion, issues);
    const projectName = readString(raw.projectName, DEFAULT_CONFIG.projectName, issues, "projectName must be a non-empty string.");
    const defaultMode = readOneOf(raw.defaultMode, OPERATING_MODES, DEFAULT_CONFIG.defaultMode, issues, `defaultMode must be one of: ${OPERATING_MODES.join(", ")}.`);
    const documentationProfile = readOneOf(raw.documentationProfile, DOCUMENTATION_PROFILES, DEFAULT_CONFIG.documentationProfile, issues, `documentationProfile must be one of: ${DOCUMENTATION_PROFILES.join(", ")}.`);
    const agentStyle = readOneOf(raw.agentStyle, AGENT_STYLES, DEFAULT_CONFIG.agentStyle, issues, `agentStyle must be one of: ${AGENT_STYLES.join(", ")}.`);
    const taskDirectory = readString(raw.taskDirectory, DEFAULT_CONFIG.taskDirectory, issues, "taskDirectory must be a non-empty string.");
    const docsDirectory = readString(raw.docsDirectory, DEFAULT_CONFIG.docsDirectory, issues, "docsDirectory must be a non-empty string.");
    const quality = readQualityPolicy(raw.quality, issues);
    let resources;
    if (raw.resources !== undefined) {
        try {
            resources = parseResourceRegistry(raw.resources);
        }
        catch (error) {
            if (error instanceof ResourceRegistryValidationError) {
                issues.push(...error.issues);
            }
            else {
                issues.push(`resources is invalid: ${error instanceof Error ? error.message : String(error)}.`);
            }
        }
    }
    let executionProfile;
    if (raw.executionProfile !== undefined) {
        try {
            executionProfile = parseExecutionProfile(raw.executionProfile);
        }
        catch (error) {
            if (error instanceof ExecutionValidationError)
                issues.push(...error.issues);
            else
                issues.push(`executionProfile is invalid: ${error instanceof Error ? error.message : String(error)}.`);
        }
    }
    let executionOverrides;
    if (raw.executionOverrides !== undefined) {
        try {
            executionOverrides = parseExecutionOverride(raw.executionOverrides);
        }
        catch (error) {
            if (error instanceof ExecutionValidationError)
                issues.push(...error.issues);
            else
                issues.push(`executionOverrides is invalid: ${error instanceof Error ? error.message : String(error)}.`);
        }
    }
    const executionCalibration = readExecutionCalibration(raw.executionCalibration, issues);
    const contextExcludes = readContextExcludes(raw.contextExcludes, issues);
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
        ...(contextExcludes === undefined ? {} : { contextExcludes }),
    };
}
export function parseAgenticConfigJson(text) {
    const parsed = JSON.parse(text);
    return parseAgenticConfig(parsed);
}
export function serializeAgenticConfig(config) {
    return `${JSON.stringify(config, null, 2)}\n`;
}
