import type {
  ProjectTask,
  TaskRisk,
  TaskVerificationCheck,
} from "./index.js";

export type TaskPolicyReviewLevel = "none" | "lightweight" | "independent";
export const ASSURANCE_LEVELS = ["none", "self-check", "fresh-context", "independent", "diverse"] as const;
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number];

export interface AssuranceTrigger {
  id: string;
  reason: string;
  raisesTo: AssuranceLevel;
}

export interface ReviewBudget {
  maxReviewPasses: number;
  maxFrontierReviewPasses: number;
  maxFrontierRuns: number;
  paidEscalation: boolean;
}

export interface TaskPolicyRequirements {
  automatedVerification: boolean;
  scope: boolean;
  independentReview: boolean;
  reviewLevel: TaskPolicyReviewLevel;
  evidenceRequired: boolean;
  evidenceCategories: string[];
  /** Canonical minimum assurance; legacy review fields remain compatibility projections. */
  assurance?: AssuranceLevel;
  assuranceTriggers?: AssuranceTrigger[];
  reviewBudget?: ReviewBudget;
}

export interface TaskPolicyTagRule {
  tag: string;
  evidenceCategories?: string[];
  independentReview?: boolean;
  reviewLevel?: TaskPolicyReviewLevel;
}

export interface TaskPolicyOptions {
  tagRules?: readonly TaskPolicyTagRule[];
}

export interface EffectiveTaskPolicy {
  taskId: string;
  risk: TaskRisk;
  classifications: string[];
  requirements: TaskPolicyRequirements;
  declaredEvidenceCategories: string[];
  blockers: string[];
  diagnostics: string[];
  reasons: string[];
  legacyCompatible: boolean;
}

export const DEFAULT_TASK_POLICY_TAG_RULES: readonly TaskPolicyTagRule[] = [
  { tag: "migration", evidenceCategories: ["report"], independentReview: true, reviewLevel: "independent" },
  { tag: "async", evidenceCategories: ["report"], independentReview: true, reviewLevel: "independent" },
  { tag: "worker", evidenceCategories: ["report"], independentReview: true, reviewLevel: "independent" },
  { tag: "deployment", evidenceCategories: ["live"] },
  { tag: "benchmark", evidenceCategories: ["benchmark"] },
  { tag: "evaluation", evidenceCategories: ["benchmark", "report"] },
  { tag: "security", evidenceCategories: ["report"], independentReview: true, reviewLevel: "independent" },
  { tag: "provider", evidenceCategories: ["report"] },
  { tag: "integration", evidenceCategories: ["report"] },
  { tag: "release", evidenceCategories: ["live", "report"] },
];

const TASK_TYPE_POLICY_TAGS: Record<string, readonly string[]> = {
  migration: ["migration"],
  "async-worker": ["async", "worker"],
  "provider-integration": ["provider", "integration"],
  deployment: ["deployment"],
  benchmark: ["benchmark"],
  security: ["security"],
  release: ["release"],
};

const ASSURANCE_RANK: Record<AssuranceLevel, number> = {
  none: 0,
  "self-check": 1,
  "fresh-context": 2,
  independent: 3,
  diverse: 4,
};

const DEFAULT_REVIEW_BUDGET: ReviewBudget = {
  maxReviewPasses: 2,
  maxFrontierReviewPasses: 1,
  maxFrontierRuns: 1,
  paidEscalation: false,
};

function maxAssurance(current: AssuranceLevel, next: AssuranceLevel): AssuranceLevel {
  return ASSURANCE_RANK[next] > ASSURANCE_RANK[current] ? next : current;
}

function assuranceForRisk(risk: TaskRisk): AssuranceLevel {
  if (risk === "critical") return "independent";
  if (risk === "high") return "fresh-context";
  if (risk === "medium") return "self-check";
  return "none";
}

function assuranceTriggers(task: ProjectTask): AssuranceTrigger[] {
  const tags = new Set(task.tags);
  const triggers: AssuranceTrigger[] = [];
  if (tags.has("security") || tags.has("auth")) triggers.push({ id: "security-auth", reason: "Security or authentication changes require independent assurance.", raisesTo: "independent" });
  if (tags.has("migration")) triggers.push({ id: "schema-migration", reason: "Schema or data migration changes require fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("async") || tags.has("worker")) triggers.push({ id: "concurrency-async", reason: "Concurrency or worker lifecycle changes require fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("api") || tags.has("public-api")) triggers.push({ id: "public-api", reason: "Public API compatibility changes require fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("large") || tags.has("large-diff") || tags.has("semantic-diff") || tags.has("broad-scope") || task.scope.length >= 8) triggers.push({ id: "large-semantic-diff", reason: "Large semantic or broad-scope changes require fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("weak-tests") || tags.has("missing-tests")) triggers.push({ id: "weak-tests", reason: "Weak or unexpectedly missing tests require fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("invariant") || tags.has("invariants")) triggers.push({ id: "invariant-change", reason: "Important invariant changes require fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("uncertain") || tags.has("review-uncertain") || tags.has("worker-uncertain")) triggers.push({ id: "worker-reviewer-uncertainty", reason: "Worker or reviewer uncertainty requires fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("scope-expansion")) triggers.push({ id: "unexpected-scope", reason: "Unexpected scope expansion requires fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("deterministic-failure") || tags.has("repeated-failure")) triggers.push({ id: "repeated-deterministic-failures", reason: "Repeated deterministic verification failures require fresh semantic context.", raisesTo: "fresh-context" });
  if (tags.has("release") || tags.has("integration") || task.type === "release") triggers.push({ id: "critical-release", reason: "Critical release or integration work requires independent assurance.", raisesTo: "independent" });
  if (task.risk === "critical") triggers.push({ id: "critical-risk", reason: "Critical risk requires independent assurance with diverse preference.", raisesTo: "independent" });
  return triggers;
}

function policyTags(task: ProjectTask): string[] {
  return [...new Set([
    ...task.tags,
    ...(task.type ? TASK_TYPE_POLICY_TAGS[task.type] ?? [] : []),
  ])];
}

function verificationChecks(task: ProjectTask): TaskVerificationCheck[] {
  return task.verification ?? task.verificationCommands.map((command, index) => ({
    id: `check-${index + 1}`,
    type: "automated",
    required: true,
    environment: "local",
    profile: "deterministic",
    command,
  }));
}

function declaredEvidenceCategories(task: ProjectTask, requiredOnly = false): string[] {
  const categories = new Set<string>();
  for (const check of verificationChecks(task)) {
    if (requiredOnly && !check.required) continue;
    if (check.profile === "report") categories.add("report");
    if (check.environment === "live") categories.add("live");
    if (check.type === "manual") categories.add("manual");
    if (check.artifact) categories.add("artifact");
    if (check.evidence) categories.add("evidence");
  }
  return [...categories].sort();
}

function mergeReviewLevel(
  current: TaskPolicyReviewLevel,
  next: TaskPolicyReviewLevel,
): TaskPolicyReviewLevel {
  const rank: Record<TaskPolicyReviewLevel, number> = {
    none: 0,
    lightweight: 1,
    independent: 2,
  };
  return rank[next] > rank[current] ? next : current;
}

export function resolveTaskPolicy(
  task: ProjectTask,
  options: TaskPolicyOptions = {},
): EffectiveTaskPolicy {
  const tags = policyTags(task);
  const requirements: TaskPolicyRequirements = {
    automatedVerification: true,
    scope: task.risk !== "low",
    independentReview: task.risk !== "low",
    reviewLevel: task.risk === "high" ? "independent" : task.risk === "medium" ? "lightweight" : "none",
    evidenceRequired: task.risk === "high",
    evidenceCategories: [],
  };
  const triggers = assuranceTriggers(task);
  let assurance = assuranceForRisk(task.risk);
  for (const trigger of triggers) assurance = maxAssurance(assurance, trigger.raisesTo);
  const reviewBudget: ReviewBudget = {
    ...DEFAULT_REVIEW_BUDGET,
    ...(task.risk === "critical" ? { maxReviewPasses: 3, maxFrontierReviewPasses: 2, maxFrontierRuns: 2, paidEscalation: true } : {}),
  };
  requirements.assurance = assurance;
  requirements.assuranceTriggers = triggers;
  requirements.reviewBudget = reviewBudget;
  const reasons = [`risk=${task.risk} defaults applied`];
  const diagnostics: string[] = [];
  const blockers: string[] = [];
  const classifications = [...new Set(tags)].sort();
  const rules = [...DEFAULT_TASK_POLICY_TAG_RULES, ...(options.tagRules ?? [])];
  const matchedRules = new Map<string, TaskPolicyTagRule[]>();

  for (const rule of rules) {
    if (!tags.includes(rule.tag)) continue;
    const matches = matchedRules.get(rule.tag) ?? [];
    matches.push(rule);
    matchedRules.set(rule.tag, matches);
    reasons.push(`tag=${rule.tag} requirements applied`);
    if (rule.evidenceCategories) {
      requirements.evidenceRequired = true;
      requirements.evidenceCategories.push(...rule.evidenceCategories);
    }
    if (rule.independentReview !== undefined) {
      requirements.independentReview = requirements.independentReview || rule.independentReview;
    }
    if (rule.reviewLevel) {
      requirements.reviewLevel = mergeReviewLevel(requirements.reviewLevel, rule.reviewLevel);
    }
  }

  for (const [tag, matches] of matchedRules) {
    const reviewValues = new Set(matches
      .map((rule) => rule.independentReview)
      .filter((value): value is boolean => value !== undefined));
    if (reviewValues.size > 1) {
      diagnostics.push(`Conflicting policy rules for tag ${tag}: independentReview values disagree.`);
      blockers.push(`Resolve conflicting policy rules for tag ${tag}.`);
    }
  }

  const declared = declaredEvidenceCategories(task, true);
  const optionalOnly = new Set(
    declaredEvidenceCategories(task).filter((category) => !declared.includes(category)),
  );
  requirements.evidenceCategories = [...new Set(requirements.evidenceCategories)].sort();
  requirements.evidenceRequired = task.risk === "high" || requirements.evidenceCategories.length > 0;
  for (const category of optionalOnly) {
    reasons.push(`optional-only evidence category ${category} creates no requirement and never cancels a risk, type, or tag requirement`);
  }
  if (requirements.evidenceRequired && declared.length === 0) {
    blockers.push("Declare at least one evidence category in verification checks.");
  }
  for (const category of requirements.evidenceCategories) {
    if (!declared.includes(category)) {
      blockers.push(`Evidence category ${category} is required but not declared.`);
    }
  }

  const checks = verificationChecks(task);
  const hasRequiredAutomated = checks.some((check) => check.required && check.type === "automated" && check.command);
  if (requirements.automatedVerification && !hasRequiredAutomated) {
    blockers.push("Declare at least one required automated verification check.");
  }

  if (tags.includes("no-verification")) {
    diagnostics.push("Tag no-verification conflicts with the risk verification requirement.");
    blockers.push("Remove no-verification or declare required automated verification.");
  }
  if (tags.includes("no-review") && requirements.independentReview) {
    diagnostics.push("Tag no-review conflicts with the risk or classification review requirement.");
    blockers.push("Remove no-review or satisfy the required independent review.");
  }
  if (tags.includes("local-only") && requirements.evidenceCategories.includes("live")) {
    diagnostics.push("Tag local-only conflicts with a live evidence requirement.");
    blockers.push("Remove local-only or remove the live policy requirement.");
  }
  if (requirements.independentReview && requirements.reviewLevel === "none") {
    diagnostics.push("Review requirement is enabled without a review level; using independent.");
    requirements.reviewLevel = "independent";
  }

  return {
    taskId: task.id,
    risk: task.risk,
    classifications,
    requirements,
    declaredEvidenceCategories: declared,
    blockers: [...new Set(blockers)],
    diagnostics: [...new Set(diagnostics)],
    reasons,
    legacyCompatible: task.verification === undefined,
  };
}

export function renderTaskPolicy(policy: EffectiveTaskPolicy): string {
  const lines = [
    `Task: ${policy.taskId}`,
    `Risk: ${policy.risk}`,
    `Classifications: ${policy.classifications.length > 0 ? policy.classifications.join(",") : "none"}`,
    `Legacy compatible: ${policy.legacyCompatible ? "yes" : "no"}`,
    "",
    "Requirements:",
    `  - automated verification: ${policy.requirements.automatedVerification ? "required" : "optional"}`,
    `  - scope: ${policy.requirements.scope ? "required" : "not required"}`,
    `  - independent review: ${policy.requirements.independentReview ? policy.requirements.reviewLevel : "not required"}`,
    `  - evidence: ${policy.requirements.evidenceRequired ? "required" : "not required"}`,
    `  - evidence categories: ${policy.requirements.evidenceCategories.length > 0 ? policy.requirements.evidenceCategories.join(",") : "none"}`,
    `  - minimum assurance: ${policy.requirements.assurance ?? "legacy-compatible"}`,
    `  - assurance triggers: ${policy.requirements.assuranceTriggers?.map((trigger) => trigger.id).join(",") || "none"}`,
    `  - review budget: ${policy.requirements.reviewBudget ? `${policy.requirements.reviewBudget.maxReviewPasses} passes/${policy.requirements.reviewBudget.maxFrontierReviewPasses} frontier` : "legacy-compatible"}`,
    `Declared evidence: ${policy.declaredEvidenceCategories.length > 0 ? policy.declaredEvidenceCategories.join(",") : "none"}`,
  ];

  if (policy.blockers.length > 0) {
    lines.push("Blockers:", ...policy.blockers.map((blocker) => `  - ${blocker}`));
  }
  if (policy.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...policy.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
  }
  lines.push("Reasons:", ...policy.reasons.map((reason) => `  - ${reason}`), "");
  return lines.join("\n");
}
