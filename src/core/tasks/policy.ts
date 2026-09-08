import type {
  ProjectTask,
  TaskRisk,
  TaskVerificationCheck,
} from "./index.js";

export type TaskPolicyReviewLevel = "none" | "lightweight" | "independent";

export interface TaskPolicyRequirements {
  automatedVerification: boolean;
  scope: boolean;
  independentReview: boolean;
  reviewLevel: TaskPolicyReviewLevel;
  evidenceRequired: boolean;
  evidenceCategories: string[];
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

function declaredEvidenceCategories(task: ProjectTask): string[] {
  const categories = new Set<string>();
  for (const check of verificationChecks(task)) {
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

  requirements.evidenceCategories = [...new Set(requirements.evidenceCategories)].sort();
  const declared = declaredEvidenceCategories(task);
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
