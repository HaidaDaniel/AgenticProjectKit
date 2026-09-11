import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { CONFIG_PATH, readAgenticConfigFile } from "../config/file.js";
import type { ExecutionCalibration } from "../config/types.js";
import type { ResourceInventory } from "../resources/detect.js";
import { WORKER_PROTOCOL } from "../work/contract.js";
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

const ASSURANCE_RANK: Record<CalibrationAssuranceLevel, number> = {
  none: 0,
  "self-check": 1,
  "fresh-context": 2,
  independent: 3,
  diverse: 4,
};
// A global calibration must not advertise an assurance floor below the
// high-risk baseline; the per-task gate still raises assurance where required.
const MINIMUM_CALIBRATION_ASSURANCE: CalibrationAssuranceLevel = "fresh-context";

const ROUTE_SENTINELS = ["deterministic", "wait", "needs-human"] as const;

export interface CalibrationPackageResource {
  id: string;
  kind: string;
  availability: string;
  capabilities: string[];
  costClass?: string;
  capacity?: number;
  occupied?: number;
  location?: string;
  endpoint?: string;
}

export interface CalibrationPackage {
  protocol: typeof CALIBRATION_PACKAGE_PROTOCOL;
  /** Companion to the vendor-neutral worker boundary this package extends. */
  workerProtocol: typeof WORKER_PROTOCOL;
  inventoryFingerprint: string;
  profiles: readonly ExecutionProfile[];
  roles: readonly ExecutionRole[];
  assuranceLevels: readonly CalibrationAssuranceLevel[];
  recommendedPlanningWorker?: string;
  resources: CalibrationPackageResource[];
  constraints: string[];
}

const COST_STRENGTH: Record<string, number> = {
  "scarce-frontier": 4,
  standard: 3,
  cheap: 2,
  "local-free": 1,
};

/** Strongest eligible planning worker by cost class, with stable ID tie-break. */
export function selectPlanningWorker(inventory: ResourceInventory): string | undefined {
  const candidates = inventory.resources
    .filter((resource) => resource.kind === "worker" && workerEligible(resource))
    .filter((resource) => resource.capabilities.length === 0 || resource.capabilities.includes("planning"))
    .sort((left, right) => (
      (COST_STRENGTH[right.costClass ?? ""] ?? 0) - (COST_STRENGTH[left.costClass ?? ""] ?? 0)
      || left.id.localeCompare(right.id)
    ));
  return candidates[0]?.id;
}

export interface CalibrationBudget {
  maxReviewPasses?: number;
  maxFrontierRuns?: number;
}

export interface CalibrationRecommendation {
  protocol: typeof CALIBRATION_RESULT_PROTOCOL;
  profile: ExecutionProfile;
  routes: Record<string, string>;
  assuranceMinimum?: CalibrationAssuranceLevel;
  budget?: CalibrationBudget;
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
}

const SECRET_SHAPE = /(api[_-]?key|secret|token|password|credential|bearer|private[_-]?key)/i;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsSecretShape(value: string): boolean {
  return SECRET_SHAPE.test(value);
}

function workerEligible(resource: { capacity?: number; occupied?: number; available?: boolean; availability: string }): boolean {
  if (resource.availability === "unknown" || resource.available === false) return false;
  return (resource.capacity ?? 1) - (resource.occupied ?? 0) >= 1;
}

/**
 * Bounded vendor-neutral package handed to an external planner harness. It
 * carries the deterministic inventory identity, eligible resources, the allowed
 * IDs/profiles, and the constraints a recommendation must satisfy. It never
 * contains secrets and is not a second authoritative configuration.
 */
export function buildCalibrationPackage(inventory: ResourceInventory): CalibrationPackage {
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
      `Recommendation is advisory until deterministic validation succeeds.`,
      `Minimum calibration assurance is ${MINIMUM_CALIBRATION_ASSURANCE}; lower floors are rejected as unsafe downgrades.`,
      "Only eligible worker IDs with free capacity may be routed.",
      "A worker must declare the requested role capability.",
      "A local profile may not route to a remote worker.",
      "Secret-shaped values are rejected.",
      "User-authored configuration is never rewritten.",
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

  const workers = new Map(
    inventory.resources
      .filter((resource) => resource.kind === "worker")
      .map((resource) => [resource.id, resource] as const),
  );

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

  let assuranceMinimum: CalibrationAssuranceLevel | undefined;
  if (value.assuranceMinimum !== undefined) {
    if (!(ASSURANCE_LEVELS as readonly string[]).includes(value.assuranceMinimum as string)) {
      issues.push(`Calibration recommendation.assuranceMinimum must be one of: ${ASSURANCE_LEVELS.join(", ")}.`);
    } else {
      const level = value.assuranceMinimum as CalibrationAssuranceLevel;
      if (ASSURANCE_RANK[level] < ASSURANCE_RANK[MINIMUM_CALIBRATION_ASSURANCE]) {
        issues.push(`Calibration recommendation.assuranceMinimum ${level} is an unsafe downgrade below ${MINIMUM_CALIBRATION_ASSURANCE}.`);
      } else {
        assuranceMinimum = level;
      }
    }
  }

  let budget: CalibrationBudget | undefined;
  if (value.budget !== undefined) {
    if (!isPlainRecord(value.budget)) {
      issues.push("Calibration recommendation.budget must be an object.");
    } else {
      const parsed: CalibrationBudget = {};
      for (const field of ["maxReviewPasses", "maxFrontierRuns"] as const) {
        const raw = value.budget[field];
        if (raw === undefined) continue;
        if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
          issues.push(`Calibration recommendation.budget.${field} must be a non-negative integer.`);
        } else if (field === "maxReviewPasses" && raw < 1) {
          issues.push("Calibration recommendation.budget.maxReviewPasses must be at least 1.");
        } else {
          parsed[field] = raw;
        }
      }
      if (issues.length === 0) budget = parsed;
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
      ...(budget ? { budget } : {}),
      planner: plannerRaw,
    },
  };
}

function sameCalibration(left: ExecutionCalibration, right: ExecutionCalibration): boolean {
  return left.profile === right.profile
    && left.inventoryFingerprint === right.inventoryFingerprint
    && left.planner === right.planner
    && left.assuranceMinimum === right.assuranceMinimum
    && JSON.stringify(left.routes) === JSON.stringify(right.routes)
    && JSON.stringify(left.budget ?? null) === JSON.stringify(right.budget ?? null);
}

/**
 * Explicit apply of a validated recommendation. Only the generated
 * `executionCalibration` key is written; the raw config file is preserved so
 * user-authored resources, overrides, quality policy, and unknown keys are
 * never rewritten or dropped. Re-applying an identical recommendation and
 * inventory fingerprint is idempotent.
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
    ...(recommendation.assuranceMinimum ? { assuranceMinimum: recommendation.assuranceMinimum } : {}),
    ...(recommendation.budget ? { budget: recommendation.budget } : {}),
  };

  if (existing !== undefined && sameCalibration(existing, desired)) {
    return { written: false, calibration: existing };
  }

  const configPath = join(rootDirectory, CONFIG_PATH);
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(configPath, "utf8"));
    if (isPlainRecord(parsed)) raw = parsed;
  } catch {
    raw = {};
  }
  raw.executionCalibration = desired;
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  return { written: true, calibration: desired };
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
