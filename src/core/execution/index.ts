import type { AssuranceLevel, ReviewBudget, TaskPolicyRequirements } from "../tasks/policy.js";
import {
  RESOURCE_COST_CLASSES,
  RESOURCE_LOCATIONS,
  type ResourceCostClass,
  type ResourceLocation,
  type ResourceRegistry,
  type ResourceWorkspaceMode,
  type WorkerResource,
} from "../resources/index.js";

export const EXECUTION_PROFILES = ["local", "constrained", "balanced", "abundant"] as const;
export type ExecutionProfile = (typeof EXECUTION_PROFILES)[number];

export const EXECUTION_ROLES = [
  "planning",
  "implementation",
  "review",
  "fix",
  "documentation",
  "triage",
  "verification",
] as const;
export type ExecutionRole = (typeof EXECUTION_ROLES)[number];

export const EXECUTION_COMPLEXITIES = ["simple", "medium", "complex"] as const;
export type ExecutionComplexity = (typeof EXECUTION_COMPLEXITIES)[number];

export const EXECUTION_PROFILE_SOURCES = ["default", "config", "calibration", "cli"] as const;
export type ExecutionProfileSource = (typeof EXECUTION_PROFILE_SOURCES)[number];

export const EXECUTION_ROUTE_SOURCES = ["deterministic", "calibration", "override", "resolver"] as const;
export type ExecutionRouteSource = (typeof EXECUTION_ROUTE_SOURCES)[number];

export const CALIBRATION_ROUTE_SENTINELS = ["deterministic", "wait", "needs-human"] as const;

export interface ExecutionCalibrationInfluence {
  status: "current" | "stale";
  planner: string;
  inventoryFingerprint: string;
  profile?: ExecutionProfile;
  /** Calibration route recommendation for this role, if any. */
  routeRecommendation?: string;
  routeApplied: boolean;
  assuranceMinimum?: AssuranceLevel;
  reason: string;
}

export type ExecutionRouteKind = "deterministic" | "worker" | "wait" | "needs-human" | "budget-exhausted";

export interface ExecutionOverride {
  resourceId?: string;
  preferCostClass?: ResourceCostClass;
  preferLocation?: ResourceLocation;
  allowProfileBypass?: boolean;
}

export interface ExecutionRouteRequest {
  profile?: ExecutionProfile;
  profileSource?: ExecutionProfileSource;
  role: ExecutionRole;
  policy: TaskPolicyRequirements;
  registry: ResourceRegistry;
  complexity?: ExecutionComplexity;
  contextLimit?: number;
  requiredTools?: readonly string[];
  workspaceMode?: ResourceWorkspaceMode;
  override?: ExecutionOverride;
  /** Current calibration route recommendation for this role (worker id or sentinel). */
  calibrationRoute?: string;
  /** Raise-only calibration assurance preference. */
  assuranceFloor?: AssuranceLevel;
  calibration?: ExecutionCalibrationInfluence;
}

export interface AssurancePlanRequest {
  policy: TaskPolicyRequirements;
  profile?: ExecutionProfile;
  registry: ResourceRegistry;
  role?: ExecutionRole;
  /** Raise-only calibration assurance preference; canonical policy is never lowered. */
  assuranceFloor?: AssuranceLevel;
}

export interface AssurancePlan {
  /** Effective requirement after clamping the calibration preference upward. */
  required: AssuranceLevel;
  /** Canonical task-policy requirement before any calibration preference. */
  canonicalRequired: AssuranceLevel;
  calibrationPreference?: AssuranceLevel;
  selected: AssuranceLevel;
  status: "ready" | "unavailable" | "budget-exhausted";
  budget: ReviewBudget;
  resourceIds: string[];
  reason: string;
}

export interface ExecutionCandidate {
  resourceId: string;
  eligible: boolean;
  reasons: string[];
}

export interface ExecutionRoute {
  profile: ExecutionProfile;
  profileSource: ExecutionProfileSource;
  role: ExecutionRole;
  kind: ExecutionRouteKind;
  routeSource: ExecutionRouteSource;
  resourceId?: string;
  queue: "none" | "wait" | "manual";
  policy: {
    independentReview: boolean;
    reviewLevel: TaskPolicyRequirements["reviewLevel"];
  };
  explanation: string;
  candidates: ExecutionCandidate[];
  assurance?: AssurancePlan;
  override?: ExecutionOverride;
  calibration?: ExecutionCalibrationInfluence;
}

export class ExecutionValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid execution configuration:\n- ${issues.join("\n- ")}`);
    this.name = "ExecutionValidationError";
    this.issues = issues;
  }
}

const COST_RANK: Record<ResourceCostClass, number> = {
  "local-free": 0,
  cheap: 1,
  standard: 2,
  "scarce-frontier": 3,
};

const ROLE_ALIASES: Record<ExecutionRole, readonly string[]> = {
  planning: ["planning", "plan"],
  implementation: ["implementation", "implement", "coding"],
  review: ["review"],
  fix: ["fix", "debugging", "implementation", "implement"],
  documentation: ["documentation", "docs", "triage"],
  triage: ["triage", "documentation", "docs"],
  verification: ["verification", "verify", "deterministic"],
};

const DEFAULT_PROFILE: ExecutionProfile = "constrained";
const DEFAULT_ASSURANCE_BUDGET: ReviewBudget = {
  maxReviewPasses: 2,
  maxFrontierReviewPasses: 1,
  maxFrontierRuns: 1,
  paidEscalation: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, issues: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 160) {
    issues.push(`${label} must be a non-empty string of at most 160 characters.`);
    return "";
  }
  return value.trim();
}

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string, issues: string[]): T | undefined {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    issues.push(`${label} must be one of: ${values.join(", ")}.`);
    return undefined;
  }
  return value as T;
}

export function parseExecutionProfile(value: unknown): ExecutionProfile {
  const profile = oneOf(value, EXECUTION_PROFILES, "executionProfile", []);
  if (!profile) throw new ExecutionValidationError([`executionProfile must be one of: ${EXECUTION_PROFILES.join(", ")}.`]);
  return profile;
}

export function parseExecutionOverride(value: unknown): ExecutionOverride {
  if (!isRecord(value)) throw new ExecutionValidationError(["executionOverrides must be an object."]);
  const issues: string[] = [];
  const resourceId = value.resourceId === undefined ? undefined : text(value.resourceId, "executionOverrides.resourceId", issues);
  const preferCostClass = value.preferCostClass === undefined
    ? undefined
    : oneOf(value.preferCostClass, RESOURCE_COST_CLASSES, "executionOverrides.preferCostClass", issues);
  const preferLocation = value.preferLocation === undefined
    ? undefined
    : oneOf(value.preferLocation, RESOURCE_LOCATIONS, "executionOverrides.preferLocation", issues);
  const allowProfileBypass = typeof value.allowProfileBypass === "boolean" ? value.allowProfileBypass : undefined;
  if (value.allowProfileBypass !== undefined && typeof value.allowProfileBypass !== "boolean") {
    issues.push("executionOverrides.allowProfileBypass must be a boolean.");
  }
  if (issues.length > 0) throw new ExecutionValidationError(issues);
  return {
    ...(resourceId ? { resourceId } : {}),
    ...(preferCostClass ? { preferCostClass } : {}),
    ...(preferLocation ? { preferLocation } : {}),
    ...(allowProfileBypass === undefined ? {} : { allowProfileBypass }),
  };
}

function normalizedProfile(profile: ExecutionProfile | undefined): ExecutionProfile {
  return profile ?? DEFAULT_PROFILE;
}

function assuranceRank(level: AssuranceLevel): number {
  return ["none", "self-check", "fresh-context", "independent", "diverse"].indexOf(level);
}

export function resolveAssurancePlan(request: AssurancePlanRequest): AssurancePlan {
  const canonicalRequired = request.policy.assurance
    ?? (request.policy.independentReview ? "independent" : "none");
  // Calibration assurance is a raise-only preference; the canonical task policy
  // is never lowered and remains authoritative.
  const required = request.assuranceFloor && assuranceRank(request.assuranceFloor) > assuranceRank(canonicalRequired)
    ? request.assuranceFloor
    : canonicalRequired;
  const calibration = request.assuranceFloor && assuranceRank(request.assuranceFloor) > assuranceRank(canonicalRequired)
    ? { calibrationPreference: request.assuranceFloor }
    : {};
  const budget = request.policy.reviewBudget ?? DEFAULT_ASSURANCE_BUDGET;
  if (budget.maxReviewPasses <= 0 || (assuranceRank(required) >= assuranceRank("fresh-context") && budget.maxFrontierRuns <= 0)) {
    return { required, canonicalRequired, ...calibration, selected: required, status: "budget-exhausted", budget, resourceIds: [], reason: "Review budget does not permit the required assurance." };
  }
  if (assuranceRank(required) <= assuranceRank("self-check")) {
    return { required, canonicalRequired, ...calibration, selected: required, status: "ready", budget, resourceIds: [], reason: `${required} assurance is satisfied by the implementation context and deterministic checks.` };
  }
  const reviewWorkers = request.registry.workers.filter((worker) => {
    if (!supportsRole(worker, "review") || worker.availability !== "available" || worker.occupied >= worker.capacity) return false;
    const harness = request.registry.harnesses.find((item) => item.id === worker.harnessId);
    return required === "fresh-context" ? Boolean(harness?.sessionIsolation) : true;
  });
  if (required === "diverse") {
    const families = new Set(reviewWorkers.map((worker) => request.registry.models.find((model) => model.id === worker.modelId)?.family ?? worker.modelId));
    if (families.size < 2) {
      return { required, canonicalRequired, ...calibration, selected: required, status: "unavailable", budget, resourceIds: reviewWorkers.map((worker) => worker.id), reason: "Diverse assurance requires review resources from two distinct model families." };
    }
  }
  if (reviewWorkers.length === 0) {
    return { required, canonicalRequired, ...calibration, selected: required, status: "unavailable", budget, resourceIds: [], reason: required === "fresh-context" ? "No available review resource proves an isolated session." : "No available review resource can satisfy the required assurance." };
  }
  return {
    required,
    canonicalRequired,
    ...calibration,
    selected: required,
    status: "ready",
    budget,
    resourceIds: reviewWorkers.sort((left, right) => left.id.localeCompare(right.id)).map((worker) => worker.id),
    reason: `${required} assurance is available from validated review resources.`,
  };
}

function supportsRole(worker: WorkerResource, role: ExecutionRole): boolean {
  const aliases = ROLE_ALIASES[role];
  return worker.capabilities.roles.some((candidate) => aliases.includes(candidate));
}

function profileAllows(
  profile: ExecutionProfile,
  worker: WorkerResource,
  request: ExecutionRouteRequest,
  complexity: ExecutionComplexity,
): boolean {
  const { role } = request;
  if (profile === "local") return worker.location === "local";
  if (profile === "constrained" && worker.costClass === "scarce-frontier") {
    return (role === "planning" || role === "implementation" || role === "fix" || role === "review")
      && (complexity === "complex" || (role === "review" && request.policy.independentReview && request.policy.reviewLevel === "independent"));
  }
  return true;
}

function candidateReasons(
  worker: WorkerResource,
  request: ExecutionRouteRequest,
  profile: ExecutionProfile,
  complexity: ExecutionComplexity,
): string[] {
  const reasons: string[] = [];
  if (!supportsRole(worker, request.role)) reasons.push(`role ${request.role} is not declared`);
  if (worker.availability !== "available") reasons.push(`availability=${worker.availability}`);
  if (worker.occupied >= worker.capacity) reasons.push(`capacity busy ${worker.occupied}/${worker.capacity}`);
  if (!profileAllows(profile, worker, request, complexity)) reasons.push(`${profile} profile excludes this resource for ${complexity} ${request.role}`);
  if (request.contextLimit !== undefined) {
    const limit = worker.capabilities.contextLimit ?? request.registry.models.find((model) => model.id === worker.modelId)?.contextLimit;
    if (limit !== undefined && limit < request.contextLimit) reasons.push(`context limit ${limit} is below ${request.contextLimit}`);
  }
  if (request.requiredTools) {
    for (const tool of request.requiredTools) {
      if (!worker.capabilities.tools.includes(tool)) reasons.push(`missing tool ${tool}`);
    }
  }
  if (request.workspaceMode && !worker.capabilities.workspaceModes.includes(request.workspaceMode)) {
    reasons.push(`workspace mode ${request.workspaceMode} is unsupported`);
  }
  return reasons;
}

function calibrationInfluence(
  request: ExecutionRouteRequest,
  routeApplied: boolean,
  reason: string,
): { calibration?: ExecutionCalibrationInfluence } {
  if (!request.calibration) return {};
  return { calibration: { ...request.calibration, routeApplied, reason } };
}

function deterministicRoute(
  request: ExecutionRouteRequest,
  profile: ExecutionProfile,
  profileSource: ExecutionProfileSource,
): ExecutionRoute | undefined {
  const deterministicCalibration = request.calibrationRoute === "deterministic"
    ? { applied: true, reason: "current calibration deterministic sentinel matches the canonical deterministic lane" }
    : { applied: false, reason: "canonical deterministic lane" };
  if (request.role === "verification") {
    return {
      profile, profileSource, routeSource: "deterministic", role: request.role, kind: "deterministic", queue: "none",
      policy: { independentReview: request.policy.independentReview, reviewLevel: request.policy.reviewLevel },
      explanation: "Mechanical verification uses the deterministic lane and does not consume a worker resource.",
      candidates: [],
      ...calibrationInfluence(request, deterministicCalibration.applied, deterministicCalibration.reason),
    };
  }
  if (request.role === "review" && !request.policy.independentReview) {
    return {
      profile, profileSource, routeSource: "deterministic", role: request.role, kind: "deterministic", queue: "none",
      policy: { independentReview: false, reviewLevel: request.policy.reviewLevel },
      explanation: "The upstream task policy does not require semantic review; no worker route is created.",
      candidates: [],
      ...calibrationInfluence(request, deterministicCalibration.applied, deterministicCalibration.reason),
    };
  }
  return undefined;
}

export function resolveExecutionRoute(request: ExecutionRouteRequest): ExecutionRoute {
  const profile = normalizedProfile(request.profile);
  const profileSource = request.profileSource ?? "default";
  const override = request.override;

  const calibrationRoute = request.calibrationRoute;
  const calibrationWorkerRoute = calibrationRoute !== undefined
    && !(CALIBRATION_ROUTE_SENTINELS as readonly string[]).includes(calibrationRoute)
    ? calibrationRoute
    : undefined;
  const calibrationSentinel = calibrationRoute !== undefined && calibrationWorkerRoute === undefined
    ? calibrationRoute as (typeof CALIBRATION_ROUTE_SENTINELS)[number]
    : undefined;

  // Canonical deterministic lanes never dispatch a semantic worker. They are
  // resolved first so a calibration `wait`/`needs-human` can still pause or
  // escalate them, while the `deterministic` sentinel stays restricted to them.
  const deterministic = deterministicRoute(request, profile, profileSource);

  // Canonical assurance is authoritative: a non-ready requirement returns before
  // any calibration sentinel can influence the route.
  const assurance = request.role === "review" && !deterministic ? resolveAssurancePlan({
    policy: request.policy,
    profile,
    registry: request.registry,
    role: request.role,
    ...(request.assuranceFloor ? { assuranceFloor: request.assuranceFloor } : {}),
  }) : undefined;
  if (assurance && assurance.status !== "ready") {
    return {
      profile, profileSource, routeSource: "resolver",
      role: request.role, kind: assurance.status === "budget-exhausted" ? "budget-exhausted" : "needs-human",
      queue: "manual",
      policy: { independentReview: request.policy.independentReview, reviewLevel: request.policy.reviewLevel },
      explanation: assurance.reason,
      candidates: [],
      assurance,
      ...(override ? { override } : {}),
      ...calibrationInfluence(request, false, assurance.reason),
    };
  }
  const complexity = request.complexity ?? "medium";
  const candidates = request.registry.workers.map((worker) => {
    const reasons = candidateReasons(worker, request, profile, complexity);
    const bypass = override?.resourceId === worker.id && override.allowProfileBypass === true;
    const profileReason = `${profile} profile excludes this resource for ${complexity} ${request.role}`;
    const effectiveReasons = bypass ? reasons.filter((reason) => reason !== profileReason) : reasons;
    return { worker, reasons: effectiveReasons };
  });
  const eligible = candidates.filter(({ reasons }) => reasons.length === 0);
  const pickResolver = () => [...eligible].sort((left, right) => {
    const leftLocation = override?.preferLocation && left.worker.location === override.preferLocation ? -1 : 0;
    const rightLocation = override?.preferLocation && right.worker.location === override.preferLocation ? -1 : 0;
    if (leftLocation !== rightLocation) return leftLocation - rightLocation;
    const leftCost = override?.preferCostClass === left.worker.costClass ? -1 : COST_RANK[left.worker.costClass];
    const rightCost = override?.preferCostClass === right.worker.costClass ? -1 : COST_RANK[right.worker.costClass];
    return leftCost - rightCost || left.worker.id.localeCompare(right.worker.id);
  })[0];
  const renderedCandidates = candidates.map(({ worker, reasons }) => ({
    resourceId: worker.id,
    eligible: reasons.length === 0,
    reasons: reasons.length === 0 ? [`eligible cost=${worker.costClass} capacity=${worker.occupied}/${worker.capacity}`] : reasons,
  }));

  const sentinelRoute = (
    kind: ExecutionRouteKind,
    queue: "none" | "wait" | "manual",
    explanation: string,
    reason: string,
  ): ExecutionRoute => ({
    profile, profileSource, routeSource: "calibration", role: request.role, kind, queue,
    policy: { independentReview: request.policy.independentReview, reviewLevel: request.policy.reviewLevel },
    explanation,
    candidates: deterministic ? [] : renderedCandidates,
    ...(assurance ? { assurance } : {}),
    ...(override ? { override } : {}),
    ...calibrationInfluence(request, true, reason),
  });

  // A current calibration `wait`/`needs-human` is a conservative pause or
  // escalation. It may apply even when the underlying canonical lane is
  // deterministic because it only prevents automatic execution and never
  // weakens policy. A hard `resourceId` override outranks calibration and skips
  // these sentinels; soft location/cost preferences do not.
  if (!override?.resourceId && calibrationSentinel === "wait") {
    return sentinelRoute(
      "wait",
      "wait",
      "Current calibration recommends waiting; no worker is dispatched.",
      "current calibration sentinel: wait",
    );
  }
  if (!override?.resourceId && calibrationSentinel === "needs-human") {
    return sentinelRoute(
      "needs-human",
      "manual",
      "Current calibration recommends a human decision; the resolver does not auto-select a worker.",
      "current calibration sentinel: needs-human",
    );
  }

  // No sentinel applies: the canonical deterministic lane wins where defined.
  if (deterministic) return deterministic;

  let selected: { worker: WorkerResource; reasons: string[] } | undefined;
  let routeSource: ExecutionRouteSource = "resolver";
  let explanation: string | undefined;
  let calibrationApplied = false;
  let calibrationReason = "no current calibration route for this role";

  if (override?.resourceId) {
    // Explicit resource selection outranks calibration. An override that is not
    // eligible yields wait/needs-human, never a silent fallback to a different
    // worker.
    selected = eligible.find(({ worker }) => worker.id === override.resourceId);
    if (selected) {
      routeSource = "override";
      explanation = `Explicit override selected ${selected.worker.id}; capability, availability, and capacity checks still apply.`;
    }
  } else if (calibrationWorkerRoute) {
    selected = eligible.find(({ worker }) => worker.id === calibrationWorkerRoute);
    if (selected) {
      routeSource = "calibration";
      calibrationApplied = true;
      calibrationReason = `current calibration route ${calibrationWorkerRoute} passed capability, availability, and capacity checks`;
      explanation = `Current calibration recommended ${selected.worker.id}; capability, availability, and capacity checks passed.`;
    } else {
      const fallback = pickResolver();
      if (fallback) {
        selected = fallback;
        routeSource = "resolver";
        calibrationReason = `current calibration route ${calibrationWorkerRoute} is not eligible; fell back to the deterministic resolver`;
        explanation = `Current calibration recommended ${calibrationWorkerRoute}, which is not eligible; fallback selected ${fallback.worker.id} by deterministic profile ordering.`;
      } else {
        calibrationReason = `current calibration route ${calibrationWorkerRoute} is not eligible and no fallback resource is available`;
      }
    }
  } else {
    selected = pickResolver();
    if (selected) {
      routeSource = "resolver";
      explanation = `Selected ${selected.worker.id} by deterministic profile ordering${override?.preferLocation || override?.preferCostClass ? " with explicit preferences" : ""}; ties are resolved by stable resource ID.`;
    }
    if (calibrationSentinel === "deterministic") {
      // `deterministic` only applies where canonical semantics already permit a
      // deterministic lane (verification, or review not required by policy).
      // Those cases returned above, so reaching here means the sentinel would
      // bypass required semantic work: refuse it and let canonical policy win.
      calibrationReason = "calibration deterministic sentinel is incompatible with the canonical semantic route for this role; canonical policy remains authoritative";
    }
  }

  if (selected) {
    return {
      profile, profileSource, routeSource, role: request.role, kind: "worker", resourceId: selected.worker.id, queue: "none",
      policy: { independentReview: request.policy.independentReview, reviewLevel: request.policy.reviewLevel },
      explanation: explanation ?? `Selected ${selected.worker.id}.`,
      candidates: renderedCandidates,
      ...(assurance ? { assurance } : {}),
      ...(override ? { override } : {}),
      ...calibrationInfluence(request, calibrationApplied, calibrationReason),
    };
  }
  const hasMatchingRole = candidates.some(({ worker }) => supportsRole(worker, request.role));
  const hasBlockedMatching = candidates.some(({ worker, reasons }) => supportsRole(worker, request.role) && reasons.some((reason) => reason.includes("availability=") || reason.includes("capacity busy")));
  return {
    profile, profileSource, routeSource: "resolver",
    role: request.role, kind: hasBlockedMatching ? "wait" : "needs-human", queue: hasBlockedMatching ? "wait" : "manual",
    policy: { independentReview: request.policy.independentReview, reviewLevel: request.policy.reviewLevel },
    explanation: hasBlockedMatching
      ? `No eligible ${request.role} resource is currently available; wait without oversubscribing capacity.`
      : hasMatchingRole
        ? `Matching resources exist but profile, capability, or override constraints reject them.`
        : `No registered resource declares capability for role ${request.role}.`,
    candidates: renderedCandidates,
    ...(assurance ? { assurance } : {}),
    ...(override ? { override } : {}),
    ...calibrationInfluence(request, false, calibrationReason),
  };
}

export function renderExecutionRoute(route: ExecutionRoute, json = false): string {
  if (json) return `${JSON.stringify(route, null, 2)}\n`;
  const lines = [
    `Execution profile: ${route.profile} (source=${route.profileSource})`,
    `Role: ${route.role}`,
    `Route: ${route.kind}${route.resourceId ? ` (${route.resourceId})` : ""} (source=${route.routeSource})`,
    `Queue: ${route.queue}`,
    `Policy review: ${route.policy.independentReview ? route.policy.reviewLevel : "not-required"}`,
    `Explanation: ${route.explanation}`,
  ];
  if (route.assurance) {
    lines.push(`Assurance: required=${route.assurance.required} canonical=${route.assurance.canonicalRequired}${route.assurance.calibrationPreference ? ` calibration=${route.assurance.calibrationPreference}` : ""} status=${route.assurance.status}`);
  }
  if (route.calibration) {
    const recommendation = route.calibration.routeRecommendation ? ` route=${route.calibration.routeRecommendation}` : "";
    lines.push(`Calibration: ${route.calibration.status}${recommendation} planner=${route.calibration.planner} applied=${route.calibration.routeApplied}; ${route.calibration.reason}`);
  }
  lines.push(
    "Candidates:",
    ...route.candidates.map((candidate) => `- ${candidate.resourceId}: ${candidate.eligible ? "eligible" : "rejected"}; ${candidate.reasons.join(", ")}`),
  );
  return `${lines.join("\n")}\n`;
}

export { DEFAULT_PROFILE as DEFAULT_EXECUTION_PROFILE, COST_RANK as EXECUTION_COST_RANK };
