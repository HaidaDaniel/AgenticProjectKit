import {
  listAgents,
} from "../agents/index.js";
import {
  allTaskFiles,
  captureTaskScope,
  captureTaskEvidenceSubject,
  findTaskFile,
  getTaskVerification,
  loadTaskFile,
  readTaskBaseline,
  type ProjectTask,
  type TaskClaimBaseline,
  type TaskFileScopeResult,
} from "./index.js";
import {
  compareTaskEvidenceFreshness,
  readTaskEvidence,
  type TaskEvidenceCandidateSubject,
  type TaskEvidenceFreshness,
  type TaskEvidenceRecord,
} from "./evidence.js";
import {
  assessTaskReviews,
  listTaskReviews,
  type TaskReviewAssessment,
} from "./review.js";
import {
  resolveTaskPolicy,
  type EffectiveTaskPolicy,
} from "./policy.js";

export interface TaskCompletionCandidate {
  task: ProjectTask;
  taskPath: string;
  baseline?: TaskClaimBaseline;
  subject: TaskEvidenceCandidateSubject;
  changedFiles: string[];
  scope: TaskFileScopeResult;
  comparisonKnown: boolean;
  diagnostics: string[];
}

export interface TaskGateVerification {
  checkId: string;
  required: boolean;
  result: TaskEvidenceRecord["result"] | "missing";
  freshness: TaskEvidenceFreshness | "missing";
  evidenceId?: string;
  reason: string;
}

export interface TaskGateReview {
  reviewer?: string;
  outcome?: TaskEvidenceRecord["result"];
  freshness: TaskEvidenceFreshness | "missing";
  evidenceId?: string;
  reason: string;
}

export interface TaskCompletionGateResult {
  taskId: string;
  passed: boolean;
  subject: TaskEvidenceCandidateSubject;
  changedFiles: string[];
  outOfScopeFiles: string[];
  forbiddenTouchedFiles: string[];
  attribution?: TaskFileScopeResult["attribution"];
  policy: EffectiveTaskPolicy;
  dependencies: string[];
  verification: TaskGateVerification[];
  review: TaskGateReview;
  evidenceIds: string[];
  blockers: string[];
  diagnostics: string[];
  comparisonKnown: boolean;
}

export class TaskCompletionGateError extends Error {
  readonly gate: TaskCompletionGateResult;

  constructor(gate: TaskCompletionGateResult) {
    super(renderTaskCompletionGate(gate));
    this.name = "TaskCompletionGateError";
    this.gate = gate;
  }
}

function subjectWithBaseline(
  subject: TaskEvidenceCandidateSubject,
  baseline: TaskClaimBaseline | undefined,
): TaskEvidenceCandidateSubject {
  return baseline ? { ...subject, baselineId: baseline.baselineId } : subject;
}

function unknownSubject(
  task: ProjectTask,
  baseline: TaskClaimBaseline | undefined,
): TaskEvidenceCandidateSubject {
  return {
    taskId: task.id,
    repository: "none",
    baselineId: baseline?.baselineId ?? "unknown",
    candidateId: "candidate:unknown",
    worktreeId: "worktree:unknown",
  };
}

export async function captureTaskCompletionCandidate(options: {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  changedFiles?: readonly string[];
}): Promise<TaskCompletionCandidate> {
  const taskPath = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
  const { task } = await loadTaskFile(taskPath);
  const baseline = await readTaskBaseline(options.rootDirectory, task.id);
  const snapshot = await captureTaskScope({
    rootDirectory: options.rootDirectory,
    task,
    taskPath,
    baseline,
    changedFiles: options.changedFiles,
  });
  const changedFiles = snapshot.changedFiles;
  const scope = snapshot;
  let capturedSubject: TaskEvidenceCandidateSubject;
  try {
    capturedSubject = await captureTaskEvidenceSubject(
      options.rootDirectory,
      task,
      scope.changedFiles,
    );
  } catch (error: unknown) {
    snapshot.diagnostics.push(error instanceof Error ? error.message : String(error));
    snapshot.comparisonKnown = false;
    capturedSubject = unknownSubject(task, baseline);
  }
  return {
    task,
    taskPath,
    baseline,
    subject: subjectWithBaseline(capturedSubject, baseline),
    changedFiles: scope.changedFiles,
    scope,
    comparisonKnown: snapshot.comparisonKnown,
    diagnostics: snapshot.diagnostics,
  };
}

function currentRecord(
  records: readonly TaskEvidenceRecord[],
  subject: TaskEvidenceCandidateSubject,
): { record?: TaskEvidenceRecord; freshness: TaskEvidenceFreshness | "missing" } {
  if (records.length === 0) {
    return { freshness: "missing" };
  }
  const assessments = records.map((record) => ({
    record,
    freshness: compareTaskEvidenceFreshness(record, subject),
  }));
  const current = assessments.filter((assessment) => assessment.freshness.freshness === "current");
  if (current.length > 0) {
    const latest = current[current.length - 1];
    return { record: latest.record, freshness: "current" };
  }
  return {
    freshness: assessments.some((assessment) => assessment.freshness.freshness === "unknown")
      ? "unknown"
      : "stale",
  };
}

function isOtherCandidate(record: TaskEvidenceRecord, subject: TaskEvidenceCandidateSubject): boolean {
  return record.subject.candidateId !== subject.candidateId;
}

function isGateEligibleEvidence(
  record: TaskEvidenceRecord,
  registeredAgents: ReadonlySet<string>,
): boolean {
  if (record.agent.trim().length === 0 || record.agent === "unknown" || record.gateEligible === false) {
    return false;
  }
  return record.gateEligible === true && registeredAgents.has(record.agent);
}

function evidenceCategoryMatches(
  record: TaskEvidenceRecord,
  category: string,
): boolean {
  if (category === "artifact") return Boolean(record.artifact);
  if (category === "evidence") return Boolean(record.evidence);
  if (category === "manual") return record.type === "manual";
  return record.type === category;
}

function appendUnique(target: string[], value: string | undefined): void {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function reviewAssessment(
  assessments: readonly TaskReviewAssessment[],
  subject: TaskEvidenceCandidateSubject,
): TaskReviewAssessment | undefined {
  const current = assessments.filter((assessment) => assessment.freshness === "current");
  if (current.length > 0) {
    return current[current.length - 1];
  }
  const otherCandidate = assessments.find((assessment) => isOtherCandidate(assessment.record, subject));
  return otherCandidate;
}

export async function evaluateTaskCompletionGate(options: {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  changedFiles?: readonly string[];
}): Promise<TaskCompletionGateResult> {
  const candidate = await captureTaskCompletionCandidate(options);
  const { task, scope, subject } = candidate;
  const policy = resolveTaskPolicy(task);
  const records = await readTaskEvidence(options.rootDirectory, task.id);
  const registeredAgents = new Set((await listAgents(options.rootDirectory)).map((agent) => agent.id));
  const blockers = [...policy.blockers];
  const diagnostics = [
    ...candidate.diagnostics,
    ...(scope.attribution?.diagnostics ?? []),
    ...policy.diagnostics,
  ];
  if (!candidate.comparisonKnown) {
    blockers.push("Baseline-aware Git comparison could not be established; gate-eligible evidence is blocked.");
  }
  const evidenceIds: string[] = [];

  for (const file of scope.outOfScopeFiles) {
    blockers.push(`Scope violation: ${file}.`);
  }
  for (const file of scope.forbiddenTouchedFiles) {
    blockers.push(`Forbidden file touched: ${file}.`);
  }

  const allFiles = await allTaskFiles(options.rootDirectory, options.taskDirectory);
  const dependencies: string[] = [];
  for (const dependency of task.dependsOn) {
    const dependencyFile = allFiles.find((file) => file.task.id === dependency);
    if (!dependencyFile) {
      blockers.push(`Dependency ${dependency} is missing.`);
    } else if (dependencyFile.task.state !== "done") {
      blockers.push(`Dependency ${dependency} is ${dependencyFile.task.state}, not done.`);
    } else {
      dependencies.push(dependency);
    }
  }

  const verification: TaskGateVerification[] = [];
  for (const check of getTaskVerification(task)) {
    if (!check.required) continue;
    const checkRecords = records.filter((record) => (
      record.type !== "review" &&
      record.type !== "completion" &&
      isGateEligibleEvidence(record, registeredAgents) &&
      record.checkId === check.id
    ));
    const selected = currentRecord(checkRecords, subject);
    if (!selected.record) {
      const otherCandidate = checkRecords.find((record) => isOtherCandidate(record, subject));
      const reason = checkRecords.length === 0
        ? `missing verification evidence for check ${check.id}`
        : otherCandidate
          ? `verification evidence belongs to another candidate revision for check ${check.id}`
          : `verification evidence stale for check ${check.id}`;
      verification.push({
        checkId: check.id,
        required: true,
        result: "missing",
        freshness: selected.freshness,
        reason,
      });
      blockers.push(`${reason}.`);
      continue;
    }
    const result = selected.record.result;
    verification.push({
      checkId: check.id,
      required: true,
      result,
      freshness: selected.freshness,
      evidenceId: selected.record.id,
      reason: result === "pass" ? "current verification evidence passed" : `required verification evidence is ${result}`,
    });
    appendUnique(evidenceIds, selected.record.id);
    if (result !== "pass") {
      blockers.push(`Required verification check ${check.id} is ${result}; pass evidence is required.`);
    }
  }

  const requiredCategories = new Set(policy.requirements.evidenceCategories);
  if (policy.requirements.evidenceRequired) {
    for (const category of policy.declaredEvidenceCategories) {
      requiredCategories.add(category);
    }
  }
  for (const category of requiredCategories) {
    const categoryRecords = records.filter((record) => (
      record.type !== "review" &&
      record.type !== "completion" &&
      isGateEligibleEvidence(record, registeredAgents) &&
      record.result === "pass" &&
      evidenceCategoryMatches(record, category)
    ));
    const currentCategory = categoryRecords.find((record) => (
      compareTaskEvidenceFreshness(record, subject).freshness === "current"
    ));
    if (currentCategory) {
      appendUnique(evidenceIds, currentCategory.id);
      continue;
    }
    const otherCandidate = categoryRecords.find((record) => isOtherCandidate(record, subject));
    blockers.push(otherCandidate
      ? `Evidence category ${category} belongs to another candidate revision.`
      : `Missing current ${category} evidence.`);
  }

  const review: TaskGateReview = { freshness: "missing", reason: "independent review is not required" };
  if (policy.requirements.independentReview) {
    const reviewRecords = (await listTaskReviews(options.rootDirectory, task.id))
      .filter((record) => isGateEligibleEvidence(record, registeredAgents));
    const assessments = assessTaskReviews(reviewRecords, subject);
    const selected = reviewAssessment(assessments, subject);
    const reviewBudget = policy.requirements.reviewBudget;
    const budgetExhausted = reviewBudget !== undefined && reviewRecords.length >= reviewBudget.maxReviewPasses;
    if (!selected) {
      review.freshness = "missing";
      review.reason = budgetExhausted ? "review budget exhausted" : "missing independent review evidence";
      blockers.push(budgetExhausted ? "Review budget exhausted; request an explicit human decision." : "Missing independent review evidence.");
    } else if (selected.freshness !== "current") {
      review.freshness = "stale";
      review.evidenceId = selected.record.id;
      review.reviewer = selected.record.reviewer;
      review.outcome = selected.record.result;
      review.reason = isOtherCandidate(selected.record, subject)
        ? "review evidence belongs to another candidate revision"
        : "review evidence stale";
      blockers.push(`${review.reason}.`);
    } else {
      review.freshness = "current";
      review.evidenceId = selected.record.id;
      review.reviewer = selected.record.reviewer;
      review.outcome = selected.record.result;
      review.reason = selected.record.result === "pass"
        ? "current independent review passed"
        : `independent review is ${selected.record.result}`;
      appendUnique(evidenceIds, selected.record.id);
      if (selected.record.reviewer === task.owner) {
        blockers.push("Implementation owner cannot satisfy independent review.");
      }
      if (selected.record.result !== "pass") {
        blockers.push(`Independent review is ${selected.record.result}; pass review evidence is required.`);
      }
      if (budgetExhausted && selected.record.result !== "pass") {
        blockers.push("Review budget exhausted; request an explicit human decision.");
      }
    }
  }

  return {
    taskId: task.id,
    passed: blockers.length === 0,
    subject,
    changedFiles: candidate.changedFiles,
    outOfScopeFiles: scope.outOfScopeFiles,
    forbiddenTouchedFiles: scope.forbiddenTouchedFiles,
    attribution: scope.attribution,
    policy,
    dependencies,
    verification,
    review,
    evidenceIds: [...new Set(evidenceIds)],
    blockers: [...new Set(blockers)],
    diagnostics: [...new Set(diagnostics)],
    comparisonKnown: candidate.comparisonKnown,
  };
}

export function renderTaskCompletionGate(result: TaskCompletionGateResult): string {
  const lines = [
    `Task: ${result.taskId}`,
    `Gate: ${result.passed ? "pass" : "blocked"}`,
    `Subject: baseline=${result.subject.baselineId} candidate=${result.subject.candidateId} worktree=${result.subject.worktreeId}`,
    `Changed files: ${result.changedFiles.length}`,
    `Dependencies: ${result.dependencies.length > 0 ? result.dependencies.join(",") : "none"}`,
    `Policy blockers: ${result.policy.blockers.length}`,
    "Verification:",
    ...(result.verification.length > 0
      ? result.verification.map((check) => `  - ${check.checkId}: ${check.result} (${check.freshness})${check.evidenceId ? ` evidence=${check.evidenceId}` : ""}`)
      : ["  - none"]),
    `Review: ${result.review.reason}${result.review.evidenceId ? ` evidence=${result.review.evidenceId}` : ""}`,
    `Evidence set: ${result.evidenceIds.length > 0 ? result.evidenceIds.join(",") : "none"}`,
  ];
  if (result.blockers.length > 0) {
    lines.push("Blockers:", ...result.blockers.map((blocker) => `  - ${blocker}`));
  }
  if (result.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...result.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
  }
  lines.push("");
  return lines.join("\n");
}
