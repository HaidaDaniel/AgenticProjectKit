import type {
  TaskCreateInput,
  TaskVerificationCheck,
} from "../tasks/index.js";

export const TASK_TEMPLATE_TYPES = [
  "feature",
  "bugfix",
  "refactor",
  "docs",
  "audit",
  "test",
  "migration",
  "async-worker",
  "provider-integration",
  "deployment",
  "benchmark",
  "security",
  "release",
] as const;
export type TaskTemplateType = (typeof TASK_TEMPLATE_TYPES)[number];

const TASK_TEMPLATE_ALIASES: Record<string, TaskTemplateType> = {
  provider: "provider-integration",
  integration: "provider-integration",
  async: "async-worker",
};

export interface TaskTemplateDefaults {
  type: TaskTemplateType;
  mode: TaskCreateInput["mode"];
  lane: string;
  risk: TaskCreateInput["risk"];
  tags: string[];
  contextFiles: string[];
  verification: TaskVerificationCheck[];
  steps: string[];
  acceptanceCriteria: string[];
  correctnessAssumptions?: string[];
  invariants?: string[];
  requiredEvidence?: string[];
  reviewQuestions?: string[];
  counterexampleSearches?: string[];
  documentationUpdates: string[];
  notes: string[];
}

function automated(
  id: string,
  options: {
    command?: string;
    profile?: TaskVerificationCheck["profile"];
    artifact?: string;
  } = {},
): TaskVerificationCheck {
  return {
    id,
    type: "automated",
    required: true,
    environment: "local",
    profile: options.profile ?? "deterministic",
    command: options.command ?? "pnpm test",
    ...(options.artifact ? { artifact: options.artifact } : {}),
  };
}

function live(id: string, instruction: string, evidence: string): TaskVerificationCheck {
  return {
    id,
    type: "manual",
    required: true,
    environment: "live",
    profile: "trusted",
    instruction,
    evidence,
  };
}

const docsUpdate = ["Update docs/progress.md when task state changes."];

const templates: Record<TaskTemplateType, TaskTemplateDefaults> = {
  feature: {
    type: "feature",
    mode: "product",
    lane: "implementation",
    risk: "medium",
    tags: ["feature"],
    contextFiles: ["AGENTS.md", "docs/project.md", "docs/task-system.md"],
    verification: [automated("unit-tests")],
    steps: ["Implement the smallest useful feature slice.", "Add focused tests.", "Run verification."],
    acceptanceCriteria: ["Feature behavior is implemented and tested."],
    documentationUpdates: docsUpdate,
    notes: ["Avoid unrelated refactors."],
  },
  bugfix: {
    type: "bugfix",
    mode: "product",
    lane: "bugfix",
    risk: "medium",
    tags: ["bugfix"],
    contextFiles: ["AGENTS.md", "docs/task-system.md"],
    verification: [automated("regression-tests")],
    steps: [
      "Capture a reproducer that fails on the old behavior.",
      "Identify and document the root cause before changing code.",
      "Implement the smallest safe fix; do not perform unrelated refactors.",
      "Add regression coverage and run verification.",
    ],
    acceptanceCriteria: [
      "The reproducer passes after the fix and fails on the old behavior.",
      "The root cause is documented in the task or change notes.",
      "No unrelated refactor is included.",
    ],
    correctnessAssumptions: ["The reproducer isolates the intended failing behavior."],
    invariants: ["The fix preserves behavior outside the reported defect."],
    requiredEvidence: ["Old-behavior reproducer result and regression test output."],
    reviewQuestions: ["Does the fix address the root cause rather than only the symptom?"],
    counterexampleSearches: ["Search adjacent inputs, error paths, and repeated execution."],
    documentationUpdates: docsUpdate,
    notes: ["Keep the fix narrow."],
  },
  refactor: {
    type: "refactor",
    mode: "product",
    lane: "refactor",
    risk: "medium",
    tags: ["refactor"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("behavior-tests")],
    steps: ["Identify the behavior-preserving change.", "Refactor in small steps.", "Run verification."],
    acceptanceCriteria: ["Behavior is unchanged.", "Code is simpler or clearer."],
    correctnessAssumptions: ["Existing tests and documented contracts describe supported behavior."],
    invariants: ["Observable behavior and public interfaces remain unchanged."],
    requiredEvidence: ["Before/after test output and public behavior comparison."],
    reviewQuestions: ["Did the refactor alter an implicit contract or error path?"],
    counterexampleSearches: ["Search boundary inputs, failure paths, and concurrency-sensitive callers."],
    documentationUpdates: docsUpdate,
    notes: ["Do not change public behavior unless the task says so."],
  },
  docs: {
    type: "docs",
    mode: "product",
    lane: "documentation",
    risk: "low",
    tags: ["docs"],
    contextFiles: ["AGENTS.md", "docs/project.md", "docs/scope.md"],
    verification: [automated("lint", { command: "pnpm lint" }), automated("tests")],
    steps: ["Read relevant docs.", "Update documentation.", "Run verification."],
    acceptanceCriteria: ["Docs are accurate and scoped."],
    documentationUpdates: docsUpdate,
    notes: ["Do not change source code unless explicitly required."],
  },
  audit: {
    type: "audit",
    mode: "audit",
    lane: "audit",
    risk: "medium",
    tags: ["audit"],
    contextFiles: ["AGENTS.md", "docs/cli-commands.md", "docs/task-system.md"],
    verification: [automated("tests"), automated("audit", { command: "node dist/cli/index.js audit" })],
    steps: ["Inspect current behavior.", "Add or update audit checks.", "Run verification."],
    acceptanceCriteria: ["Audit findings are deterministic and documented."],
    documentationUpdates: docsUpdate,
    notes: ["Keep audit static unless the task says otherwise."],
  },
  test: {
    type: "test",
    mode: "product",
    lane: "testing",
    risk: "low",
    tags: ["tests"],
    contextFiles: ["AGENTS.md", "docs/task-system.md"],
    verification: [automated("tests")],
    steps: ["Identify missing coverage.", "Add focused tests.", "Run verification."],
    acceptanceCriteria: ["Tests cover the intended behavior."],
    documentationUpdates: docsUpdate,
    notes: ["Prefer focused regression tests."],
  },
  migration: {
    type: "migration",
    mode: "production",
    lane: "migration",
    risk: "high",
    tags: ["migration"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("compatibility"), automated("migration-report", { profile: "report", artifact: "reports/migration.json" })],
    steps: [
      "Define compatibility boundaries and the migration precondition.",
      "Implement data integrity checks and an idempotent migration path.",
      "Exercise failure handling and rollback/recovery.",
      "Run verification against representative old and new data.",
    ],
    acceptanceCriteria: [
      "Old and new representations have a documented compatibility path.",
      "Data integrity is checked before and after migration.",
      "Failure leaves a recoverable state and rollback is documented.",
      "A repeated run is safe or explicitly rejected before mutation.",
    ],
    correctnessAssumptions: ["Input data may contain older valid representations and partial prior work."],
    invariants: ["No source record is silently lost, duplicated, or made unreadable."],
    requiredEvidence: ["Compatibility matrix, integrity report, failure result, and rollback/recovery evidence."],
    reviewQuestions: ["What happens if the process stops after a partial commit?"],
    counterexampleSearches: ["Search mixed-version data, duplicate reruns, malformed records, and interrupted batches."],
    documentationUpdates: docsUpdate,
    notes: ["Prefer reversible, idempotent steps."],
  },
  "async-worker": {
    type: "async-worker",
    mode: "production",
    lane: "worker",
    risk: "high",
    tags: ["async", "worker"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("worker-tests"), automated("worker-report", { profile: "report", artifact: "reports/worker.json" })],
    steps: [
      "Define idempotency, retry, cancellation, and concurrency bounds.",
      "Implement graceful shutdown and partial-commit handling.",
      "Exercise the all-fail path and recovery behavior.",
      "Run verification with duplicate, delayed, and interrupted work.",
    ],
    acceptanceCriteria: [
      "Duplicate delivery is idempotent.",
      "Retry and cancellation are bounded and observable.",
      "Concurrency limits and graceful shutdown are enforced.",
      "Partial commits and the all-fail path leave recoverable state.",
    ],
    correctnessAssumptions: ["Delivery is at-least-once and a worker can stop between side effects."],
    invariants: ["A job is not acknowledged until its durable effects are safe to repeat."],
    requiredEvidence: ["Idempotency, retry, cancellation, shutdown, and all-fail results."],
    reviewQuestions: ["Can a retry race with cancellation or shutdown and lose the outcome?"],
    counterexampleSearches: ["Search duplicate delivery, timeout, partial commit, full outage, and worker restart paths."],
    documentationUpdates: docsUpdate,
    notes: ["Make failure behavior explicit before optimizing throughput."],
  },
  "provider-integration": {
    type: "provider-integration",
    mode: "production",
    lane: "integration",
    risk: "high",
    tags: ["provider", "integration"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("integration-tests"), automated("provider-report", { profile: "report", artifact: "reports/provider-integration.json" })],
    steps: [
      "Define timeout, capability, fallback, and error-propagation boundaries.",
      "Implement the provider adapter and malformed-response handling.",
      "Exercise unavailable-provider and fallback behavior.",
      "Run deterministic and integration verification.",
    ],
    acceptanceCriteria: [
      "Timeouts and unavailable providers fail predictably.",
      "Fallback behavior is explicit and bounded.",
      "Malformed responses and provider errors cannot be mistaken for success.",
      "Capability mismatch is detected before unsupported work is sent.",
    ],
    correctnessAssumptions: ["The external provider can be slow, unavailable, or return malformed data."],
    invariants: ["Provider failures remain distinguishable from successful domain results."],
    requiredEvidence: ["Timeout, unavailable, fallback, malformed-response, and capability results."],
    reviewQuestions: ["Can an error or partial provider response cross the success boundary?"],
    counterexampleSearches: ["Search timeout races, empty responses, schema drift, capability mismatch, and fallback loops."],
    documentationUpdates: docsUpdate,
    notes: ["Keep provider-specific behavior behind a narrow boundary."],
  },
  deployment: {
    type: "deployment",
    mode: "production",
    lane: "deployment",
    risk: "high",
    tags: ["deployment"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("deployment-tests"), live("deployment-smoke", "Check clean install, restart, upgrade, readiness, permissions, configuration persistence, and rollback/recovery.", "deployment URL, logs, or incident id")],
    steps: [
      "Verify clean install and configuration prerequisites.",
      "Exercise restart, upgrade, readiness, permissions, and configuration persistence.",
      "Validate rollback/recovery and capture live evidence.",
      "Run all verification before changing the candidate again.",
    ],
    acceptanceCriteria: [
      "Clean install, restart, and upgrade paths work.",
      "Readiness and permissions are correct.",
      "Configuration persists as intended.",
      "Rollback/recovery is tested and bounded.",
    ],
    correctnessAssumptions: ["The deployed environment may restart or contain configuration from a prior version."],
    invariants: ["A failed rollout does not leave an unready or irrecoverable deployment."],
    requiredEvidence: ["Install, restart, upgrade, readiness, permissions, persistence, and rollback evidence."],
    reviewQuestions: ["What state remains if deployment fails after configuration or schema mutation?"],
    counterexampleSearches: ["Search clean-host, restart-during-upgrade, missing-permission, stale-config, and rollback paths."],
    documentationUpdates: docsUpdate,
    notes: ["Treat live evidence as candidate-bound and immutable."],
  },
  benchmark: {
    type: "benchmark",
    mode: "product",
    lane: "benchmark",
    risk: "high",
    tags: ["benchmark"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("benchmark-report", { profile: "report", artifact: "reports/benchmark.json" })],
    steps: [
      "Record a baseline with the same deterministic fixture and metric definition.",
      "Run comparable candidate and baseline measurements.",
      "Check leakage, relevant holdout behavior, and production-budget semantics.",
      "Publish the bounded benchmark report before changing the candidate.",
    ],
    acceptanceCriteria: [
      "Baseline and candidate are comparable under a deterministic fixture.",
      "Metrics are defined and reported with uncertainty where applicable.",
      "Leakage and relevant holdout behavior are checked.",
      "Production-budget semantics are explicit.",
    ],
    correctnessAssumptions: ["The fixture represents the decision boundary and remains stable across runs."],
    invariants: ["Baseline and candidate use identical measurement semantics."],
    requiredEvidence: ["Baseline, comparability, fixture, metric, leakage, holdout, and budget report."],
    reviewQuestions: ["Could the apparent improvement come from leakage, fixture drift, or a changed budget?"],
    counterexampleSearches: ["Search holdout leakage, fixture edge cases, metric gaming, and production-budget overruns."],
    documentationUpdates: docsUpdate,
    notes: ["Do not treat a single aggregate score as correctness proof."],
  },
  security: {
    type: "security",
    mode: "production",
    lane: "security",
    risk: "high",
    tags: ["security"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("security-tests"), automated("security-report", { profile: "report", artifact: "reports/security.json" })],
    steps: [
      "Map privilege, authentication, authorization, and secret boundaries.",
      "Implement the change with fail-closed negative paths.",
      "Check for secret leakage and unauthorized escalation.",
      "Run adversarial verification and capture the security report.",
    ],
    acceptanceCriteria: [
      "Negative paths fail closed.",
      "Secrets are not exposed in output, logs, or task evidence.",
      "Privilege, authentication, and authorization boundaries are enforced.",
    ],
    correctnessAssumptions: ["Inputs, callers, and dependencies may be malicious or compromised."],
    invariants: ["Unauthorized actors cannot cross the protected capability boundary."],
    requiredEvidence: ["Negative-path, fail-closed, leakage, privilege, and auth-boundary results."],
    reviewQuestions: ["Is any default, error path, or fallback more permissive than the success path?"],
    counterexampleSearches: ["Search missing credentials, confused deputy, privilege escalation, injection, and secret-in-log paths."],
    documentationUpdates: docsUpdate,
    notes: ["Prefer explicit denial over heuristic sanitization."],
  },
  release: {
    type: "release",
    mode: "production",
    lane: "release",
    risk: "high",
    tags: ["release"],
    contextFiles: ["AGENTS.md", "docs/architecture.md", "docs/task-system.md"],
    verification: [automated("release-report", { profile: "report", artifact: "reports/release.json" }), live("release-smoke", "Check the candidate SHA/tree, CI evidence, post-bump validation, and release smoke path.", "release URL, CI run, or release id")],
    steps: [
      "Freeze and record the candidate SHA/tree.",
      "Collect CI evidence and run post-bump validation.",
      "Perform release smoke checks and rollback/recovery review.",
      "Do not mutate the candidate after evidence is captured.",
    ],
    acceptanceCriteria: [
      "Candidate SHA/tree is recorded and matches the evaluated release.",
      "CI evidence and post-bump validation pass.",
      "Release smoke and recovery paths are verified.",
      "No candidate mutation occurs after final evidence.",
    ],
    correctnessAssumptions: ["Release evidence must identify the exact immutable candidate."],
    invariants: ["Published artifacts and recorded evidence refer to the same candidate tree."],
    requiredEvidence: ["Candidate SHA/tree, CI, post-bump, smoke, and recovery evidence."],
    reviewQuestions: ["Can the release artifact, evidence, and evaluated tree diverge?"],
    counterexampleSearches: ["Search dirty-tree, post-evidence mutation, partial publish, and rollback paths."],
    documentationUpdates: docsUpdate,
    notes: ["Treat evidence capture as the final mutation boundary."],
  },
};

export function resolveTaskTemplateType(value: string): TaskTemplateType {
  const normalized = TASK_TEMPLATE_ALIASES[value] ?? value;
  if ((TASK_TEMPLATE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as TaskTemplateType;
  }
  throw new Error(`Unknown task template type: ${value}. Expected one of: ${TASK_TEMPLATE_TYPES.join(", ")}.`);
}

export function getTaskTemplate(type: TaskTemplateType): TaskTemplateDefaults {
  return templates[type];
}
