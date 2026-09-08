import {
  allTaskFiles,
  captureTaskEvidenceSubject,
  findTaskFile,
  getTaskVerification,
  listGitChangedFiles,
  listTaskChangedFilesSinceBaseline,
  loadTaskFile,
  readTaskBaseline,
  verifyTaskFileScope,
  verifyTaskFileScopeSinceBaseline,
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

export async function captureTaskCompletionCandidate(options: {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  changedFiles?: readonly string[];
}): Promise<TaskCompletionCandidate> {
  const taskPath = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
  const { task } = await loadTaskFile(taskPath);
  const baseline = await readTaskBaseline(options.rootDirectory, task.id);
  const changedFiles = [...(options.changedFiles ?? (
    baseline
      ? await listTaskChangedFilesSinceBaseline(options.rootDirectory, baseline)
      : await listGitChangedFiles(options.rootDirectory).catch(() => [])
  ))]
    .map((path) => path.replace(/\\/g, "/").replace(/^\.\//, ""))
    .filter((path) => path.length > 0)
    .sort();
  const scope = baseline
    ? await verifyTaskFileScopeSinceBaseline(options.rootDirectory, task, changedFiles, baseline)
    : verifyTaskFileScope(task, changedFiles);
  const capturedSubject = await captureTaskEvidenceSubject(
    options.rootDirectory,
    task,
    scope.changedFiles,
  );
  return {
    task,
    taskPath,
    baseline,
    subject: subjectWithBaseline(capturedSubject, baseline),
    changedFiles: scope.changedFiles,
    scope,
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
  return { freshness: "stale" };
}

function isOtherCandidate(record: TaskEvidenceRecord, subject: TaskEvidenceCandidateSubject): boolean {
  return record.subject.candidateId !== subject.candidateId;
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
  const blockers = [...policy.blockers];
  const diagnostics = [
    ...(scope.attribution?.diagnostics ?? []),
    ...policy.diagnostics,
  ];
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
    const reviewRecords = await listTaskReviews(options.rootDirectory, task.id);
    const assessments = assessTaskReviews(reviewRecords, subject);
    const selected = reviewAssessment(assessments, subject);
    if (!selected) {
      review.freshness = "missing";
      review.reason = "missing independent review evidence";
      blockers.push("Missing independent review evidence.");
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
