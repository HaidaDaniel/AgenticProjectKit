import { readAgenticConfigFile, writeAgenticConfigFile } from "../config/file.js";
import type { AgenticConfig, ExecutionCalibration } from "../config/types.js";
import type { ResourceInventory } from "../resources/detect.js";
import {
  EXECUTION_PROFILES,
  EXECUTION_ROLES,
  ExecutionValidationError,
  parseExecutionProfile,
  type ExecutionProfile,
  type ExecutionRole,
} from "./index.js";

export const CALIBRATION_PACKAGE_PROTOCOL = "apk-calibration-v1";
export const CALIBRATION_RESULT_PROTOCOL = "apk-calibration-v1-result";
export const ASSURANCE_LEVELS = ["none", "self-check", "fresh-context", "independent", "diverse"] as const;
export type CalibrationAssuranceLevel = (typeof ASSURANCE_LEVELS)[number];

const ROUTE_SENTINELS = ["deterministic", "wait", "needs-human"] as const;

export interface CalibrationPackageResource {
  id: string;
  kind: string;
  availability: string;
  costClass?: string;
  capacity?: number;
  location?: string;
}

export interface CalibrationPackage {
  protocol: typeof CALIBRATION_PACKAGE_PROTOCOL;
  inventoryFingerprint: string;
  profiles: readonly ExecutionProfile[];
  roles: readonly ExecutionRole[];
  assuranceLevels: readonly CalibrationAssuranceLevel[];
  resources: CalibrationPackageResource[];
  constraints: string[];
}

export interface CalibrationRecommendation {
  protocol: typeof CALIBRATION_RESULT_PROTOCOL;
  profile: ExecutionProfile;
  routes: Record<string, string>;
  assuranceMinimum?: CalibrationAssuranceLevel;
  planner: string;
}

export interface CalibrationValidationResult {
  ok: boolean;
  issues: string[];
  recommendation?: CalibrationRecommendation;
}

export interface ApplyCalibrationResult {
  written: boolean;
  calibration: ExecutionCalibration;
  config: AgenticConfig;
}

const SECRET_SHAPE = /(api[_-]?key|secret|token|password|credential|bearer|private[_-]?key)/i;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsSecretShape(value: string): boolean {
  return SECRET_SHAPE.test(value);
}

/**
 * Bounded vendor-neutral package handed to an external planner harness. It
 * carries the deterministic inventory identity, the allowed IDs/profiles, and
 * the constraints a recommendation must satisfy. It never contains secrets and
 * is not a second authoritative configuration.
 */
export function buildCalibrationPackage(inventory: ResourceInventory): CalibrationPackage {
  return {
    protocol: CALIBRATION_PACKAGE_PROTOCOL,
    inventoryFingerprint: inventory.fingerprint,
    profiles: [...EXECUTION_PROFILES],
    roles: [...EXECUTION_ROLES],
    assuranceLevels: [...ASSURANCE_LEVELS],
    resources: inventory.resources
      .filter((resource) => resource.kind === "worker" || resource.kind === "harness" || resource.kind === "model")
      .map((resource) => ({
        id: resource.id,
        kind: resource.kind,
        availability: resource.availability,
        ...(resource.costClass ? { costClass: resource.costClass } : {}),
        ...(resource.capacity !== undefined ? { capacity: resource.capacity } : {}),
        ...(resource.location ? { location: resource.location } : {}),
      })),
    constraints: [
      "Recommendation is advisory until deterministic validation succeeds.",
      "Only IDs present in this inventory may be routed.",
      "Workers with capacity below one are not eligible.",
      "Secret-shaped values are rejected.",
      "User-authored overrides are never rewritten.",
    ],
  };
}

export function validateCalibrationRecommendation(
  value: unknown,
  inventory: ResourceInventory,
): CalibrationValidationResult {
  const issues: string[] = [];
  if (!isPlainRecord(value)) {
    return { ok: false, issues: ["Calibration recommendation must be an object."] };
  }
  if (value.protocol !== CALIBRATION_RESULT_PROTOCOL) {
    issues.push(`Calibration recommendation.protocol must be ${CALIBRATION_RESULT_PROTOCOL}.`);
  }

  let profile: ExecutionProfile | undefined;
  try {
    profile = parseExecutionProfile(value.profile);
  } catch (error: unknown) {
    if (error instanceof ExecutionValidationError) issues.push(...error.issues);
    else issues.push("Calibration recommendation.profile is invalid.");
  }

  const workerIds = new Set(
    inventory.resources
      .filter((resource) => resource.kind === "worker" && resource.availability !== "unknown")
      .filter((resource) => resource.available !== false)
      .filter((resource) => (resource.capacity ?? 1) >= 1)
      .map((resource) => resource.id),
  );
  const allIds = new Set(inventory.resources.map((resource) => resource.id));

  const routes: Record<string, string> = {};
  if (!isPlainRecord(value.routes)) {
    issues.push("Calibration recommendation.routes must be an object.");
  } else {
    for (const [role, rawTarget] of Object.entries(value.routes)) {
      if (!(EXECUTION_ROLES as readonly string[]).includes(role)) {
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
      if ((ROUTE_SENTINELS as readonly string[]).includes(target)) {
        routes[role] = target;
        continue;
      }
      if (!allIds.has(target)) {
        issues.push(`Calibration recommendation.routes.${role} references unknown resource: ${target}.`);
        continue;
      }
      if (!workerIds.has(target)) {
        issues.push(`Calibration recommendation.routes.${role} references an ineligible (capacity/availability) worker: ${target}.`);
        continue;
      }
      routes[role] = target;
    }
  }

  let assuranceMinimum: CalibrationAssuranceLevel | undefined;
  if (value.assuranceMinimum !== undefined) {
    if ((ASSURANCE_LEVELS as readonly string[]).includes(value.assuranceMinimum as string)) {
      assuranceMinimum = value.assuranceMinimum as CalibrationAssuranceLevel;
    } else {
      issues.push(`Calibration recommendation.assuranceMinimum must be one of: ${ASSURANCE_LEVELS.join(", ")}.`);
    }
  }

  const plannerRaw = typeof value.planner === "string" ? value.planner.trim() : "";
  if (plannerRaw.length === 0) issues.push("Calibration recommendation.planner must be a non-empty string.");
  else if (containsSecretShape(plannerRaw)) issues.push("Calibration recommendation.planner looks secret-shaped and is rejected.");

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    issues: [],
    recommendation: {
      protocol: CALIBRATION_RESULT_PROTOCOL,
      profile: profile as ExecutionProfile,
      routes,
      ...(assuranceMinimum ? { assuranceMinimum } : {}),
      planner: plannerRaw,
    },
  };
}

/**
 * Explicit apply of a validated recommendation. Only the generated
 * `executionCalibration` field is written; resources, profile, overrides, and
 * quality policy are preserved. Re-applying an identical recommendation and
 * inventory fingerprint is idempotent and does not rewrite the file.
 */
export async function applyExecutionCalibration(
  rootDirectory: string,
  recommendation: CalibrationRecommendation,
  inventory: ResourceInventory,
): Promise<ApplyCalibrationResult> {
  const config = await readAgenticConfigFile(rootDirectory);
  const existing = config.executionCalibration;
  const desired: ExecutionCalibration = {
    profile: recommendation.profile,
    inventoryFingerprint: inventory.fingerprint,
    generatedAt: existing?.generatedAt ?? new Date().toISOString(),
    planner: recommendation.planner,
    routes: Object.fromEntries(
      Object.entries(recommendation.routes).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };

  const sameAsExisting = existing !== undefined
    && existing.profile === desired.profile
    && existing.inventoryFingerprint === desired.inventoryFingerprint
    && existing.planner === desired.planner
    && JSON.stringify(existing.routes) === JSON.stringify(desired.routes);

  if (sameAsExisting) {
    return { written: false, calibration: existing, config };
  }

  const nextConfig: AgenticConfig = { ...config, executionCalibration: desired };
  await writeAgenticConfigFile(rootDirectory, nextConfig);
  return { written: true, calibration: desired, config: nextConfig };
}

export function renderCalibrationPackage(pkg: CalibrationPackage, json = false): string {
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

export function renderCalibrationValidation(result: CalibrationValidationResult): string {
  const lines = [`Calibration: ${result.ok ? "valid" : "rejected"}`];
  if (result.issues.length > 0) {
    lines.push("Issues:", ...result.issues.map((issue) => `  - ${issue}`));
  }
  lines.push("");
  return lines.join("\n");
}
