import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CONFIG_PATH } from "../config/file.js";
import { parseAgenticConfig } from "../config/index.js";
import { WORKER_PROTOCOL } from "../work/contract.js";
import { EXECUTION_PROFILES, EXECUTION_ROLES, ExecutionValidationError, parseExecutionProfile, } from "./index.js";
export const CALIBRATION_PACKAGE_PROTOCOL = "apk-calibration-v1";
export const CALIBRATION_RESULT_PROTOCOL = "apk-calibration-v1-result";
export const ASSURANCE_LEVELS = ["none", "self-check", "fresh-context", "independent", "diverse"];
// Calibration assurance is an advisory preference only. The canonical task
// policy/gate stays authoritative, so calibration must never impose a global
// floor stronger than a low/medium task policy. Effective assurance is clamped
// per task by `resolveTaskPolicy`, which raises but never lowers the baseline.
const ROUTE_SENTINELS = ["deterministic", "wait", "needs-human"];
const COST_STRENGTH = {
    "scarce-frontier": 4,
    standard: 3,
    cheap: 2,
    "local-free": 1,
};
/** Strongest eligible planning worker by cost class, with stable ID tie-break. */
export function selectPlanningWorker(inventory) {
    const candidates = inventory.resources
        .filter((resource) => resource.kind === "worker" && workerEligible(resource))
        .filter((resource) => resource.capabilities.length === 0 || resource.capabilities.includes("planning"))
        .sort((left, right) => ((COST_STRENGTH[right.costClass ?? ""] ?? 0) - (COST_STRENGTH[left.costClass ?? ""] ?? 0)
        || left.id.localeCompare(right.id)));
    return candidates[0]?.id;
}
const SECRET_SHAPE = /(api[_-]?key|secret|token|password|credential|bearer|private[_-]?key)/i;
function isPlainRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function containsSecretShape(value) {
    return SECRET_SHAPE.test(value);
}
function workerEligible(resource) {
    if (resource.availability === "unknown" || resource.available === false)
        return false;
    return (resource.capacity ?? 1) - (resource.occupied ?? 0) >= 1;
}
/**
 * Bounded vendor-neutral package handed to an external planner harness. It
 * carries the deterministic inventory identity, eligible resources, the allowed
 * IDs/profiles, and the constraints a recommendation must satisfy. It never
 * contains secrets and is not a second authoritative configuration.
 */
export function buildCalibrationPackage(inventory) {
    const recommendedPlanningWorker = selectPlanningWorker(inventory);
    return {
        protocol: CALIBRATION_PACKAGE_PROTOCOL,
        workerProtocol: WORKER_PROTOCOL,
        inventoryFingerprint: inventory.fingerprint,
        profiles: [...EXECUTION_PROFILES],
        roles: [...EXECUTION_ROLES],
        assuranceLevels: [...ASSURANCE_LEVELS],
        ...(recommendedPlanningWorker ? { recommendedPlanningWorker } : {}),
        resources: inventory.resources
            .filter((resource) => resource.kind === "worker" || resource.kind === "harness" || resource.kind === "model")
            .map((resource) => ({
            id: resource.id,
            kind: resource.kind,
            availability: resource.availability,
            capabilities: [...resource.capabilities].sort(),
            ...(resource.costClass ? { costClass: resource.costClass } : {}),
            ...(resource.capacity !== undefined ? { capacity: resource.capacity } : {}),
            ...(resource.occupied !== undefined ? { occupied: resource.occupied } : {}),
            ...(resource.location ? { location: resource.location } : {}),
            ...(resource.endpoint ? { endpoint: resource.endpoint } : {}),
        })),
        constraints: [
            "Recommendation is advisory until deterministic validation succeeds.",
            "Calibration assurance is an advisory preference; the canonical task policy/gate clamps effective assurance and is never lowered by calibration.",
            "Only eligible worker IDs with free capacity may be routed.",
            "A worker must declare the requested role capability.",
            "A local profile may not route to a remote worker.",
            "Secret-shaped values are rejected.",
            "User-authored configuration is never rewritten.",
        ],
    };
}
export function validateCalibrationRecommendation(value, inventory) {
    const issues = [];
    if (!isPlainRecord(value)) {
        return { ok: false, issues: ["Calibration recommendation must be an object."] };
    }
    if (value.protocol !== CALIBRATION_RESULT_PROTOCOL) {
        issues.push(`Calibration recommendation.protocol must be ${CALIBRATION_RESULT_PROTOCOL}.`);
    }
    let profile;
    try {
        profile = parseExecutionProfile(value.profile);
    }
    catch (error) {
        if (error instanceof ExecutionValidationError)
            issues.push(...error.issues);
        else
            issues.push("Calibration recommendation.profile is invalid.");
    }
    const workers = new Map(inventory.resources
        .filter((resource) => resource.kind === "worker")
        .map((resource) => [resource.id, resource]));
    const routes = {};
    if (!isPlainRecord(value.routes)) {
        issues.push("Calibration recommendation.routes must be an object.");
    }
    else {
        for (const [role, rawTarget] of Object.entries(value.routes)) {
            if (!EXECUTION_ROLES.includes(role)) {
                issues.push(`Calibration recommendation.routes has unknown role: ${role}.`);
                continue;
            }
            if (typeof rawTarget !== "string" || rawTarget.trim().length === 0) {
                issues.push(`Calibration recommendation.routes.${role} must be a non-empty string.`);
                continue;
            }
            const target = rawTarget.trim();
            if (containsSecretShape(target)) {
                issues.push(`Calibration recommendation.routes.${role} looks secret-shaped and is rejected.`);
                continue;
            }
            if (ROUTE_SENTINELS.includes(target)) {
                routes[role] = target;
                continue;
            }
            const worker = workers.get(target);
            if (!worker) {
                issues.push(`Calibration recommendation.routes.${role} references unknown worker: ${target}.`);
                continue;
            }
            if (!workerEligible(worker)) {
                issues.push(`Calibration recommendation.routes.${role} references an ineligible worker (capacity/availability): ${target}.`);
                continue;
            }
            if (worker.capabilities.length > 0 && !worker.capabilities.includes(role)) {
                issues.push(`Calibration recommendation.routes.${role} references worker ${target}, which does not declare that role capability.`);
                continue;
            }
            if (profile === "local" && worker.location === "remote") {
                issues.push(`Calibration recommendation.routes.${role} routes the local profile to a remote worker: ${target}.`);
                continue;
            }
            routes[role] = target;
        }
    }
    let assuranceMinimum;
    if (value.assuranceMinimum !== undefined) {
        if (!ASSURANCE_LEVELS.includes(value.assuranceMinimum)) {
            issues.push(`Calibration recommendation.assuranceMinimum must be one of: ${ASSURANCE_LEVELS.join(", ")}.`);
        }
        else {
            // Advisory only: a valid level (including `none`/`self-check`) is accepted
            // because canonical task policy, not calibration, is authoritative.
            assuranceMinimum = value.assuranceMinimum;
        }
    }
    let budget;
    if (value.budget !== undefined) {
        if (!isPlainRecord(value.budget)) {
            issues.push("Calibration recommendation.budget must be an object.");
        }
        else {
            const parsed = {};
            for (const field of ["maxReviewPasses", "maxFrontierRuns"]) {
                const raw = value.budget[field];
                if (raw === undefined)
                    continue;
                if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
                    issues.push(`Calibration recommendation.budget.${field} must be a non-negative integer.`);
                }
                else if (field === "maxReviewPasses" && raw < 1) {
                    issues.push("Calibration recommendation.budget.maxReviewPasses must be at least 1.");
                }
                else {
                    parsed[field] = raw;
                }
            }
            if (issues.length === 0)
                budget = parsed;
        }
    }
    const plannerRaw = typeof value.planner === "string" ? value.planner.trim() : "";
    if (plannerRaw.length === 0)
        issues.push("Calibration recommendation.planner must be a non-empty string.");
    else if (containsSecretShape(plannerRaw))
        issues.push("Calibration recommendation.planner looks secret-shaped and is rejected.");
    if (issues.length > 0) {
        return { ok: false, issues };
    }
    return {
        ok: true,
        issues: [],
        recommendation: {
            protocol: CALIBRATION_RESULT_PROTOCOL,
            profile: profile,
            routes,
            ...(assuranceMinimum ? { assuranceMinimum } : {}),
            ...(budget ? { budget } : {}),
            planner: plannerRaw,
        },
    };
}
function sameCalibration(left, right) {
    return left.profile === right.profile
        && left.inventoryFingerprint === right.inventoryFingerprint
        && left.planner === right.planner
        && left.assuranceMinimum === right.assuranceMinimum
        && JSON.stringify(left.routes) === JSON.stringify(right.routes)
        && JSON.stringify(left.budget ?? null) === JSON.stringify(right.budget ?? null);
}
function isMissingFileError(error) {
    return (error !== null
        && typeof error === "object"
        && "code" in error
        && error.code === "ENOENT");
}
/**
 * Reread the raw config immediately before an explicit apply so unknown
 * user-authored top-level keys survive. Only a genuinely missing file is
 * treated as an empty object; permission, I/O, and invalid-JSON errors fail
 * closed instead of risking a rewrite that would drop the user's config.
 */
async function readRawConfigForMerge(rootDirectory) {
    const configPath = join(rootDirectory, CONFIG_PATH);
    let content;
    try {
        content = await readFile(configPath, "utf8");
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return {};
        }
        throw new Error(`Refusing to update ${CONFIG_PATH}: ${error instanceof Error ? error.message : String(error)}.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch {
        throw new Error(`Refusing to update ${CONFIG_PATH}: existing file is not valid JSON.`);
    }
    if (!isPlainRecord(parsed)) {
        throw new Error(`Refusing to update ${CONFIG_PATH}: existing content is not a JSON object.`);
    }
    return parsed;
}
/**
 * Explicit apply of a validated recommendation. Only the generated
 * `executionCalibration` key is written; the raw config file is preserved so
 * user-authored resources, overrides, quality policy, and unknown keys are
 * never rewritten or dropped. Re-applying an identical recommendation and
 * inventory fingerprint is idempotent.
 */
export async function applyExecutionCalibration(rootDirectory, recommendation, inventory) {
    // Read the raw config exactly once so there is no second read that could
    // race with the validated parse. Any non-missing read/JSON error fails closed
    // instead of silently rewriting the user's config as `{ executionCalibration }`.
    const raw = await readRawConfigForMerge(rootDirectory);
    const existing = parseAgenticConfig(raw).executionCalibration;
    // Build the desired effective calibration with a fresh timestamp, then
    // compare against the saved one ignoring the timestamp. Identical effective
    // calibration is idempotent and preserves the existing `generatedAt`; a real
    // change always records a new timestamp.
    const desired = {
        profile: recommendation.profile,
        inventoryFingerprint: inventory.fingerprint,
        generatedAt: new Date().toISOString(),
        planner: recommendation.planner,
        routes: Object.fromEntries(Object.entries(recommendation.routes).sort(([left], [right]) => left.localeCompare(right))),
        ...(recommendation.assuranceMinimum ? { assuranceMinimum: recommendation.assuranceMinimum } : {}),
        ...(recommendation.budget ? { budget: recommendation.budget } : {}),
    };
    if (existing !== undefined && sameCalibration(existing, desired)) {
        return { written: false, calibration: existing };
    }
    raw.executionCalibration = desired;
    const configPath = join(rootDirectory, CONFIG_PATH);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    return { written: true, calibration: desired };
}
export function renderCalibrationPackage(pkg, json = false) {
    if (json) {
        return `${JSON.stringify(pkg, null, 2)}\n`;
    }
    return [
        `Calibration package (${pkg.protocol})`,
        `Inventory fingerprint: ${pkg.inventoryFingerprint}`,
        `Profiles: ${pkg.profiles.join(", ")}`,
        `Roles: ${pkg.roles.join(", ")}`,
        `Resources: ${pkg.resources.map((resource) => resource.id).join(", ") || "none"}`,
        "",
    ].join("\n");
}
export function renderCalibrationValidation(result) {
    const lines = [`Calibration: ${result.ok ? "valid" : "rejected"}`];
    if (result.issues.length > 0) {
        lines.push("Issues:", ...result.issues.map((issue) => `  - ${issue}`));
    }
    lines.push("");
    return lines.join("\n");
}
