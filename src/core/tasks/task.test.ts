import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { promisify } from "node:util";

import {
  registerAgent,
  listAgents,
  migrateAgentLogs,
  readRunLog,
} from "../agents/index.js";
import {
  renderTaskContext,
  selectTaskContext,
} from "../docs/context.js";
import {
  allTaskFiles,
  appendTaskEvidence,
  assessTaskReviews,
  archiveAllTasks,
  archiveTask,
  buildTaskDeps,
  buildTaskProvenance,
  buildTaskFileName,
  captureTaskEvidenceSubject,
  captureTaskCompletionCandidate,
  createTask,
  compareTaskEvidenceFreshness,
  evaluateTaskCompletionGate,
  findTaskDependents,
  findTaskFile,
  getTaskVerification,
  listArchivedTaskFiles,
  listTaskFiles,
  listTaskReviews,
  loadTaskFile,
  nextTaskId,
  normalizeVerificationCommands,
  parseTaskMarkdown,
  prepareTaskReview,
  recordTaskReview,
  renderTaskReviewPrompt,
  renderTaskReviewResult,
  renderTaskCompletionGate,
  renderTaskMarkdown,
  renderNextTask,
  renderTaskDeps,
  renderTaskPolicy,
  renderTaskProvenance,
  readTaskEvidence,
  readTaskBaseline,
  renderTasksTable,
  resolveTaskPolicy,
  selectNextTask,
  TaskFormatError,
  TaskEvidenceFormatError,
  TASK_EVIDENCE_PATH,
  TASK_EVIDENCE_LOCK_PATH,
  inspectLocalLock,
  recoverLocalLock,
  validateTaskDependencies,
  verifyTask,
  verifyTaskFileScope,
  withLocalMutationLock,
  renderTaskVerifyResult,
  recordDogfoodResult,
  renderDogfoodPrompt,
  renderDogfoodResult,
  startDogfoodSession,
  writeTaskFile,
  type ProjectTaskFile,
  type ProjectTask,
  type LocalLockMetadata,
} from "./index.js";
import {
  claimTask,
  createStaleTaskLock,
  doneTask,
  releaseTask,
  reviewTask,
} from "./workflow.js";

const execFileAsync = promisify(execFile);

const TASK: ProjectTask = {
  id: "0007",
  title: "Add Task System",
  state: "todo",
  owner: "none",
  mode: "mvp",
  lane: "implementation",
  scope: ["tasks"],
  risk: "medium",
  parallel: true,
  dependsOn: ["0001", "0002"],
  tags: ["tasks", "parser"],
  goal: "Implement task file parsing and generation support.",
  contextFiles: ["AGENTS.md", "docs/task-system.md"],
  allowedFiles: ["src/core/tasks/**", "docs/progress.md"],
  forbiddenFiles: ["future task files"],
  steps: [
    "Define task parsing.",
    "Define task generation helpers.",
    "Add tests for format validation.",
  ],
  acceptanceCriteria: [
    "Task files can be parsed and generated consistently.",
    "The task format matches the documented contract.",
  ],
  verificationCommands: ["pnpm test"],
  documentationUpdates: ["Update docs/progress.md."],
  notes: ["Prefer explicit fields over inferred task metadata."],
};

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-task-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, {
      force: true,
      recursive: true,
      maxRetries: 5,
      retryDelay: 20,
    });
  }
}

function testLockMetadata(overrides: Partial<LocalLockMetadata> = {}): LocalLockMetadata {
  return {
    schema: 1,
    ownerId: "owner-a",
    kind: "task-mutation",
    pid: 100,
    hostname: "test-host",
    processStart: "2026-01-01T00:00:00.000Z",
    created: "2026-01-01T00:00:01.000Z",
    ...overrides,
  };
}

test("renderTaskMarkdown emits the compact task shape", () => {
  assert.equal(
    renderTaskMarkdown(TASK),
    [
      "# Task 0007 - Add Task System",
      "",
      "State: todo",
      "Owner: none",
      "Mode: mvp",
      "Lane: implementation",
      "Scope: tasks",
      "Risk: medium",
      "Parallel: true",
      "Depends on: 0001,0002",
      "Tags: tasks,parser",
      "",
      "## Goal",
      "",
      "Implement task file parsing and generation support.",
      "",
      "## Context files",
      "",
      "- AGENTS.md",
      "- docs/task-system.md",
      "",
      "## Files allowed to edit",
      "",
      "- src/core/tasks/**",
      "- docs/progress.md",
      "",
      "## Files forbidden to edit",
      "",
      "- future task files",
      "",
      "## Steps",
      "",
      "1. Define task parsing.",
      "2. Define task generation helpers.",
      "3. Add tests for format validation.",
      "",
      "## Acceptance criteria",
      "",
      "- Task files can be parsed and generated consistently.",
      "- The task format matches the documented contract.",
      "",
      "## Verification commands",
      "",
      "- pnpm test",
      "",
      "## Documentation updates",
      "",
      "- Update docs/progress.md.",
      "",
      "## Notes",
      "",
      "- Prefer explicit fields over inferred task metadata.",
      "",
    ].join("\n"),
  );
});

test("parseTaskMarkdown reads rendered compact task files", () => {
  assert.deepEqual(parseTaskMarkdown(renderTaskMarkdown(TASK)), TASK);
  assert.deepEqual(getTaskVerification(TASK), normalizeVerificationCommands(["pnpm test"]));
});

test("structured verification survives canonical task round trip", () => {
  const task: ProjectTask = {
    ...TASK,
    verification: [
      {
        id: "unit-tests",
        type: "automated",
        required: true,
        environment: "ci",
        profile: "deterministic",
        command: "pnpm test",
        artifact: "reports/test.xml",
      },
      {
        id: "live-check",
        type: "manual",
        required: false,
        environment: "live",
        profile: "trusted",
        instruction: "Confirm the production smoke check.",
        evidence: "link or incident id",
      },
    ],
    verificationCommands: ["pnpm test"],
  };

  const rendered = renderTaskMarkdown(task);
  assert.match(rendered, /## Verification/);
  assert.doesNotMatch(rendered, /## Verification commands/);
  assert.deepEqual(parseTaskMarkdown(rendered), task);
});

test("optional correctness contract survives canonical round trip without legacy noise", () => {
  const task: ProjectTask = {
    ...TASK,
    correctnessAssumptions: ["Inputs are normalized."],
    invariants: ["No item is processed twice."],
    requiredEvidence: ["Idempotency report"],
    reviewQuestions: ["What if delivery is duplicated?"],
    counterexampleSearches: ["Search retry and timeout paths."],
  };
  const rendered = renderTaskMarkdown(task);
  assert.match(rendered, /## Correctness assumptions/);
  assert.match(rendered, /## Counterexample searches/);
  assert.deepEqual(parseTaskMarkdown(rendered), task);

  const legacy = renderTaskMarkdown(TASK);
  assert.doesNotMatch(legacy, /## Correctness assumptions/);
  assert.doesNotMatch(legacy, /## Review questions/);
});

test("typed task metadata survives round trip and maps to policy tags", () => {
  const task: ProjectTask = {
    ...TASK,
    type: "async-worker",
    tags: [],
  };

  assert.match(renderTaskMarkdown(task), /Type: async-worker/);
  assert.deepEqual(parseTaskMarkdown(renderTaskMarkdown(task)), task);

  const policy = resolveTaskPolicy(task);
  assert.deepEqual(policy.classifications, ["async", "worker"]);
  assert.equal(policy.requirements.independentReview, true);
  assert.deepEqual(policy.requirements.evidenceCategories, ["report"]);
});

test("task policy applies deterministic risk defaults", () => {
  const low = resolveTaskPolicy({
    ...TASK,
    risk: "low",
    tags: ["docs"],
  });
  assert.equal(low.requirements.automatedVerification, true);
  assert.equal(low.requirements.scope, false);
  assert.equal(low.requirements.independentReview, false);
  assert.equal(low.requirements.reviewLevel, "none");
  assert.equal(low.requirements.assurance, "none");
  assert.deepEqual(low.blockers, []);

  const medium = resolveTaskPolicy(TASK);
  assert.equal(medium.requirements.automatedVerification, true);
  assert.equal(medium.requirements.scope, true);
  assert.equal(medium.requirements.independentReview, true);
  assert.equal(medium.requirements.reviewLevel, "lightweight");
  assert.equal(medium.requirements.assurance, "self-check");
  assert.equal(medium.requirements.evidenceRequired, false);
  assert.deepEqual(medium.blockers, []);
});

test("task policy requires declared high-risk evidence and explains tags", () => {
  const high = resolveTaskPolicy({
    ...TASK,
    risk: "high",
    tags: ["security"],
  });
  assert.equal(high.requirements.evidenceRequired, true);
  assert.ok(high.blockers.some((blocker) => blocker.includes("evidence category")));
  assert.equal(high.requirements.independentReview, true);
  assert.equal(high.requirements.reviewLevel, "independent");
  assert.equal(high.requirements.assurance, "independent");

  const release = resolveTaskPolicy({
    ...TASK,
    risk: "low",
    tags: ["release"],
    verification: [
      {
        id: "release-report",
        type: "automated",
        required: true,
        environment: "local",
        profile: "report",
        command: "pnpm test",
        artifact: "reports/release.json",
      },
      {
        id: "live-smoke",
        type: "manual",
        required: true,
        environment: "live",
        profile: "trusted",
        instruction: "Check the deployed release.",
        evidence: "release URL",
      },
    ],
  });
  assert.deepEqual(release.requirements.evidenceCategories, ["live", "report"]);
  assert.deepEqual(release.declaredEvidenceCategories, ["artifact", "evidence", "live", "manual", "report"]);
  assert.deepEqual(release.blockers, []);
  assert.match(renderTaskPolicy(release), /independent review: not required/);
});

test("task policy does not promote optional-only evidence categories", () => {
  const release = resolveTaskPolicy({
    ...TASK,
    risk: "high",
    tags: ["release"],
    verification: [
      {
        id: "release-report",
        type: "automated",
        required: true,
        environment: "ci",
        profile: "report",
        command: "pnpm release:check",
        artifact: "coverage/coverage-summary.json",
        evidence: "clean-checkout command output",
      },
      {
        id: "workflow-review",
        type: "manual",
        required: false,
        environment: "live",
        profile: "trusted",
        instruction: "Record the hosted workflow when available.",
        evidence: "workflow URL/status/SHA",
      },
    ],
  });

  assert.deepEqual(release.requirements.evidenceCategories, ["report"]);
  assert.deepEqual(release.declaredEvidenceCategories, ["artifact", "evidence", "report"]);
  assert.deepEqual(release.blockers, []);

  const optionalOnlyDeployment = resolveTaskPolicy({
    ...TASK,
    risk: "low",
    tags: ["deployment"],
    verification: [
      {
        id: "unit",
        type: "automated",
        required: true,
        environment: "local",
        profile: "deterministic",
        command: "pnpm test",
      },
      {
        id: "live-smoke",
        type: "manual",
        required: false,
        environment: "live",
        profile: "trusted",
        instruction: "Check the deployment when available.",
      },
    ],
  });
  assert.equal(optionalOnlyDeployment.requirements.evidenceRequired, false);
  assert.deepEqual(optionalOnlyDeployment.requirements.evidenceCategories, []);
  assert.deepEqual(optionalOnlyDeployment.declaredEvidenceCategories, []);
  assert.deepEqual(optionalOnlyDeployment.blockers, []);
});

test("task policy raises assurance for critical and stable escalation triggers", () => {
  const critical = resolveTaskPolicy({
    ...TASK,
    risk: "critical",
    tags: ["security", "migration", "broad-scope", "weak-tests", "invariant", "uncertain", "scope-expansion", "deterministic-failure"],
  });

  assert.equal(critical.requirements.assurance, "independent");
  assert.deepEqual(critical.requirements.assuranceTriggers?.map((trigger) => trigger.id), [
    "security-auth",
    "schema-migration",
    "large-semantic-diff",
    "weak-tests",
    "invariant-change",
    "worker-reviewer-uncertainty",
    "unexpected-scope",
    "repeated-deterministic-failures",
    "critical-risk",
  ]);
  assert.deepEqual(critical.requirements.reviewBudget, {
    maxReviewPasses: 3,
    maxFrontierReviewPasses: 2,
    maxFrontierRuns: 2,
    paidEscalation: true,
  });
});

test("task policy diagnoses tag conflicts and preserves legacy compatibility", () => {
  const conflict = resolveTaskPolicy({
    ...TASK,
    risk: "medium",
    tags: ["no-verification", "no-review", "local-only", "release"],
  }, {
    tagRules: [
      { tag: "release", independentReview: false },
      { tag: "release", independentReview: true },
    ],
  });
  assert.ok(conflict.blockers.some((blocker) => blocker.includes("no-verification")));
  assert.ok(conflict.blockers.some((blocker) => blocker.includes("no-review")));
  assert.ok(conflict.blockers.some((blocker) => blocker.includes("local-only")));
  assert.ok(conflict.blockers.some((blocker) => blocker.includes("conflicting policy rules")));
  assert.ok(conflict.diagnostics.length >= 3);

  const legacy = resolveTaskPolicy(TASK);
  assert.equal(legacy.legacyCompatible, true);
  assert.deepEqual(legacy.declaredEvidenceCategories, []);
});

test("structured verification reports actionable metadata errors", () => {
  assert.throws(
    () => parseTaskMarkdown(renderTaskMarkdown({
      ...TASK,
      verification: [{
        id: "bad",
        type: "manual",
        required: true,
        environment: "local",
        profile: "integration",
        command: "pnpm test",
        instruction: "Run it manually.",
      }],
      verificationCommands: [],
    })),
    (error: unknown) => {
      assert.ok(error instanceof TaskFormatError);
      assert.ok(error.issues.some((issue) => issue.includes("must define command or instruction, not both")));
      return true;
    },
  );
});

test("task evidence appends, reads, filters, and compares subject freshness", async () => {
  await withTempDirectory(async (directory) => {
    assert.deepEqual(await readTaskEvidence(directory), []);
    const subject = {
      taskId: "0007",
      repository: "git" as const,
      headSha: "abc123",
      baselineId: "base-a",
      candidateId: "candidate-a",
      worktreeId: "worktree-a",
    };
    await appendTaskEvidence(directory, {
      id: "evidence-a",
      taskId: "0007",
      runId: "run-a",
      agent: "codex-a",
      type: "automated-test",
      result: "pass",
      time: "2026-09-09T10:00:00Z",
      subject,
      checkId: "unit-tests",
      profile: "deterministic",
      command: "pnpm test",
      artifact: "reports/test.xml",
    });
    await appendTaskEvidence(directory, {
      id: "evidence-b",
      taskId: "0007",
      runId: "run-b",
      agent: "codex-a",
      type: "manual",
      result: "fail",
      time: "2026-09-09T10:01:00Z",
      subject: { ...subject, candidateId: "candidate-b", worktreeId: "worktree-b" },
      summary: "Smoke check failed.",
    });

    const all = await readTaskEvidence(directory);
    assert.equal(all.length, 2);
    assert.equal((await readTaskEvidence(directory, "0007")).length, 2);
    assert.equal(all.filter((record) => record.result === "fail").length, 1);
    assert.equal(compareTaskEvidenceFreshness(all[0], subject).freshness, "current");
    assert.equal(
      compareTaskEvidenceFreshness(all[0], { ...subject, candidateId: "candidate-b" }).freshness,
      "stale",
    );
    assert.equal(
      compareTaskEvidenceFreshness(all[0], { ...subject, headSha: undefined }).freshness,
      "unknown",
    );
  });
});

test("task evidence reports corrupted append-only records", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, TASK_EVIDENCE_PATH), "{broken\n", "utf8");

    await assert.rejects(
      () => readTaskEvidence(directory),
      (error: unknown) => {
        assert.ok(error instanceof TaskEvidenceFormatError);
        assert.match(error.message, /Evidence line 1 must be valid JSON/);
        return true;
      },
    );
  });
});

test("task evidence serializes concurrent appenders without corrupting JSONL", async () => {
  await withTempDirectory(async (directory) => {
    const subject = {
      taskId: "0007",
      repository: "none" as const,
      baselineId: "base-none",
      candidateId: "candidate-none",
      worktreeId: "worktree-none",
    };
    await Promise.all(Array.from({ length: 64 }, (_, index) => appendTaskEvidence(directory, {
      id: `evidence-concurrent-${index}`,
      taskId: "0007",
      runId: `run-concurrent-${index}`,
      agent: `agent-${index}`,
      type: "automated-test",
      result: "pass",
      subject,
      gateEligible: false,
    })));
    const records = await readTaskEvidence(directory, "0007");
    assert.equal(records.length, 64);
    assert.equal(new Set(records.map((record) => record.id)).size, 64);
  });
});

test("local lock inspection keeps live, reused-PID, foreign-host, and malformed owners fail-closed", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, ".tasks", ".apk.lock");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    const runtime = {
      hostname: "test-host",
      pid: 100,
      processStart: "2026-01-01T00:00:00.000Z",
      now: () => Date.parse("2026-01-01T01:00:00.000Z"),
      processLiveness: () => "alive" as const,
    };

    await writeFile(lockPath, JSON.stringify(testLockMetadata()), "utf8");
    const live = await inspectLocalLock(lockPath, runtime);
    assert.equal(live.state, "live");
    assert.equal(live.old, true);
    await assert.rejects(
      () => withLocalMutationLock({ path: lockPath, kind: "task-mutation", runtime }, async () => undefined),
      /live.*old but cannot be stolen/,
    );

    await writeFile(lockPath, JSON.stringify(testLockMetadata({ processStart: "2025-12-31T23:59:00.000Z" })), "utf8");
    assert.equal((await inspectLocalLock(lockPath, runtime)).state, "uncertain");
    await writeFile(lockPath, JSON.stringify(testLockMetadata({ hostname: "other-host" })), "utf8");
    assert.equal((await inspectLocalLock(lockPath, runtime)).state, "uncertain");
    await writeFile(lockPath, "broken", "utf8");
    assert.equal((await inspectLocalLock(lockPath, runtime)).state, "malformed");
  });
});

test("local lock compares process-start identity for another live PID", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, ".tasks", ".apk.lock");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(lockPath, JSON.stringify(testLockMetadata({ pid: 200 })), "utf8");
    const reusedPidRuntime = {
      hostname: "test-host",
      pid: 100,
      processStart: "2026-01-01T00:00:00.000Z",
      processLiveness: () => "alive" as const,
      processStartIdentity: () => "2026-01-01T00:10:00.000Z",
    };

    const inspection = await inspectLocalLock(lockPath, reusedPidRuntime);
    assert.equal(inspection.state, "uncertain");
    assert.match(inspection.reason, /process-start identity differs/);
    assert.equal((await recoverLocalLock({
      path: lockPath,
      kind: "task-mutation",
      runtime: reusedPidRuntime,
      force: true,
    })).recovered, true);
  });
});

test("local lock recovers dead owners once and serializes competing contenders", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, ".tasks", ".apk.lock");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(lockPath, JSON.stringify(testLockMetadata({ pid: 200 })), "utf8");
    const runtime = {
      hostname: "test-host",
      pid: 100,
      processStart: "2026-01-01T00:00:00.000Z",
      processLiveness: (pid: number) => pid === 200 ? "dead" as const : "alive" as const,
    };
    let active = 0;
    let maxActive = 0;
    const contender = () => withLocalMutationLock({
      path: lockPath,
      kind: "task-mutation",
      timeoutMs: 1_000,
      runtime,
    }, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    });

    await Promise.all([contender(), contender()]);
    assert.equal(maxActive, 1);
    assert.equal((await inspectLocalLock(lockPath, runtime)).state, "absent");
  });
});

test("local lock also recovers a recovery owner that crashed", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, ".tasks", ".apk.lock");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeFile(`${lockPath}.recovery`, JSON.stringify(testLockMetadata({
      ownerId: "dead-recoverer",
      kind: "task-mutation-recovery",
      pid: 200,
    })), "utf8");
    const runtime = {
      hostname: "test-host",
      pid: 100,
      processStart: "2026-01-01T00:00:00.000Z",
      processLiveness: (pid: number) => pid === 200 ? "dead" as const : "alive" as const,
    };

    await withLocalMutationLock({ path: lockPath, kind: "task-mutation", runtime }, async () => undefined);
    assert.equal((await inspectLocalLock(lockPath, runtime)).state, "absent");
    assert.equal((await inspectLocalLock(`${lockPath}.recovery`, runtime)).state, "absent");
  });
});

test("local lock cleanup cannot delete a replacement owner", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, ".agentic", "evidence.append.lock");
    const successor = testLockMetadata({ ownerId: "successor", kind: "evidence-append" });
    let replaceDuringCleanup = true;
    const runtime = {
      hostname: "test-host",
      pid: 100,
      processStart: "2026-01-01T00:00:00.000Z",
      beforeOwnedRemoval: async (path: string) => {
        if (path !== lockPath || !replaceDuringCleanup) return;
        replaceDuringCleanup = false;
        await rm(lockPath, { force: true });
        await writeFile(lockPath, JSON.stringify(successor), "utf8");
      },
    };
    await withLocalMutationLock({ path: lockPath, kind: "evidence-append", runtime }, async () => undefined);

    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).ownerId, "successor");
  });
});

test("local lock publication never exposes partial metadata to competing contenders", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, ".tasks", ".apk.lock");
    let waitingPublishers = 0;
    let releasePublishers!: () => void;
    let reportReady!: () => void;
    const ready = new Promise<void>((resolve) => { reportReady = resolve; });
    const release = new Promise<void>((resolve) => { releasePublishers = resolve; });
    const runtime = {
      hostname: "test-host",
      pid: 100,
      processStart: "2026-01-01T00:00:00.000Z",
      processLiveness: () => "alive" as const,
      beforePublish: async (path: string) => {
        if (path !== lockPath || waitingPublishers >= 2) return;
        waitingPublishers += 1;
        if (waitingPublishers === 2) reportReady();
        await release;
      },
    };
    let active = 0;
    let maxActive = 0;
    const contender = () => withLocalMutationLock({
      path: lockPath,
      kind: "task-mutation",
      timeoutMs: 1_000,
      runtime,
    }, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    });
    const contenders = [contender(), contender()];

    await ready;
    assert.equal((await inspectLocalLock(lockPath, runtime)).state, "absent");
    releasePublishers();
    await Promise.all(contenders);
    assert.equal(maxActive, 1);
  });
});

test("explicit lock recovery requires force for malformed ownership and still refuses live owners", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, ".tasks", ".apk.lock");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    const runtime = {
      hostname: "test-host",
      pid: 100,
      processStart: "2026-01-01T00:00:00.000Z",
      processLiveness: () => "alive" as const,
    };
    await writeFile(lockPath, "broken", "utf8");
    await assert.rejects(
      () => recoverLocalLock({ path: lockPath, kind: "task-mutation", runtime }),
      /rerun with --force/,
    );
    assert.equal((await recoverLocalLock({ path: lockPath, kind: "task-mutation", runtime, force: true })).recovered, true);
    await writeFile(lockPath, JSON.stringify(testLockMetadata()), "utf8");
    await assert.rejects(
      () => recoverLocalLock({ path: lockPath, kind: "task-mutation", runtime, force: true }),
      /Refusing to recover a live lock/,
    );
  });
});

test("evidence append rejects malformed lock metadata without deleting it", async () => {
  await withTempDirectory(async (directory) => {
    const lockPath = join(directory, TASK_EVIDENCE_LOCK_PATH);
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(lockPath, "broken", "utf8");
    await assert.rejects(
      () => appendTaskEvidence(directory, {
        taskId: "0007",
        runId: "run-malformed-lock",
        agent: "agent-a",
        type: "automated-test",
        result: "pass",
        subject: {
          taskId: "0007",
          repository: "none",
          baselineId: "base-none",
          candidateId: "candidate-none",
          worktreeId: "worktree-none",
        },
        gateEligible: false,
      }),
      /malformed.*lock recover.*--force/,
    );
    assert.equal(await readFile(lockPath, "utf8"), "broken");
  });
});

test("dogfood sessions write bounded vendor-neutral evidence and preserve failures", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    const taskPath = join(directory, ".tasks", "0007-dogfood-task.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/core/tasks/**"],
      forbiddenFiles: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    const agent = await registerAgent(directory, {
      id: "codex-dogfood",
      developer: "alice",
      platform: "generic-harness",
      model: "vendor-neutral",
    });

    const started = await startDogfoodSession({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: agent.id,
      tool: "generic-harness",
      scenario: "Read the task prompt and report whether the workflow is understandable.",
      sessionId: "dogfood-success",
      startedAt: "2026-09-09T10:00:00Z",
    });
    assert.match(started.prompt, /Protocol: dogfood-v1/);
    assert.match(started.prompt, /generic-harness/);
    assert.match(renderDogfoodPrompt({
      sessionId: started.sessionId,
      task: { ...TASK, dependsOn: [], state: "doing", owner: agent.id },
      agent,
      tool: started.tool,
      scenario: started.scenario,
    }), /Session: dogfood-success/);
    assert.match(await readFile(join(directory, started.promptPath), "utf8"), /Session rules:/);

    const passed = await recordDogfoodResult({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: agent.id,
      sessionId: started.sessionId,
      outcome: "pass",
      endedAt: "2026-09-09T10:00:05Z",
      retries: 1,
      observations: ["Prompt was concise."],
      metrics: {
        actionCount: 3,
        toolCallCount: 2,
        contextUnits: 120,
        durationMs: 5000,
        latencyMs: 300,
      },
    });
    assert.equal(passed.evidence.type, "dogfood");
    assert.equal(passed.evidence.result, "pass");
    assert.equal(passed.evidence.tool, "generic-harness");
    assert.equal(passed.evidence.retries, 1);
    assert.equal(passed.evidence.metrics?.durationMs, 5000);
    assert.match(renderDogfoodResult(passed), /Outcome: pass/);
    assert.equal((await readTaskEvidence(directory, "0007")).length, 1);
    assert.ok((await readRunLog(directory)).some((event) => event.runId === "dogfood-success"));

    await assert.rejects(
      () => startDogfoodSession({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: agent.id,
        tool: "generic-harness",
        scenario: "Do not overwrite the completed session.",
        sessionId: "dogfood-success",
      }),
      /already exists/,
    );
    await assert.rejects(
      () => recordDogfoodResult({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: agent.id,
        sessionId: "..\\escape",
        outcome: "pass",
        endedAt: "2026-09-09T10:00:06Z",
      }),
      /compact id/,
    );

    await assert.rejects(
      () => recordDogfoodResult({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: agent.id,
        sessionId: started.sessionId,
        outcome: "fail",
      }),
      /already has a result/,
    );

    const failedSession = await startDogfoodSession({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: agent.id,
      tool: "other-harness",
      scenario: "Try the same workflow with a second tool.",
      sessionId: "dogfood-failure",
      startedAt: "2026-09-09T10:01:00Z",
    });
    const failed = await recordDogfoodResult({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: agent.id,
      sessionId: failedSession.sessionId,
      outcome: "fail",
      endedAt: "2026-09-09T10:01:03Z",
      failures: ["The result format was unclear."],
      issues: ["Clarify the session handoff."],
    });
    assert.equal(failed.evidence.result, "fail");
    assert.deepEqual(failed.evidence.failures, ["The result format was unclear."]);
    assert.equal((await readTaskEvidence(directory, "0007")).filter((record) => record.type === "dogfood").length, 2);

    await assert.rejects(
      () => recordDogfoodResult({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: agent.id,
        sessionId: failedSession.sessionId,
        outcome: "pass",
      }),
      /already has a result/,
    );
    assert.equal((await readTaskEvidence(directory, "0007")).find((record) => record.runId === "dogfood-failure")?.result, "fail");
  });
});

test("independent review uses a separate reviewer run and revision-bound evidence", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
    const taskPath = join(directory, ".tasks", "0007-reviewable-task.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      state: "todo",
      owner: "none",
      allowedFiles: ["src/core/tasks/**"],
      forbiddenFiles: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, {
      id: "codex-owner",
      developer: "alice",
      platform: "codex",
      model: "gpt-5",
    });
    await registerAgent(directory, {
      id: "codex-reviewer",
      developer: "bob",
      platform: "codex",
      model: "gpt-5",
    });
    await claimTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
    });

    const changedFile = join(directory, "src", "core", "tasks", "changed.ts");
    await writeFile(changedFile, "export const version = 1;\n", "utf8");
    const first = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "pass",
      implementationRunId: "verify-a",
      changedFiles: ["src/core/tasks/changed.ts"],
    });
    assert.match(first.runId, /^review-/);
    assert.equal(first.evidence.agent, "codex-reviewer");
    assert.equal(first.evidence.implementationRunId, "verify-a");
    assert.notEqual(first.runId, first.evidence.implementationRunId);
    assert.match(first.prompt, /do not continue implementation work/);
    assert.match(first.prompt, /Green tests alone are not correctness proof/);
    assert.match(first.prompt, /Baseline-to-current diff:/);
    assert.match(renderTaskReviewPrompt({
      task: {
        ...TASK,
        reviewQuestions: ["Which retry assumption can fail?"],
        counterexampleSearches: ["Search duplicate delivery."],
      },
      reviewer: "codex-reviewer",
      subject: first.subject,
      changedFiles: first.changedFiles,
    }), /Correctness requirements:/);
    assert.match(renderTaskReviewPrompt({
      task: {
        ...TASK,
        invariants: ["No duplicate processing."],
      },
      reviewer: "codex-reviewer",
      subject: first.subject,
      changedFiles: first.changedFiles,
    }), /No duplicate processing\./);
    assert.match(renderTaskReviewResult(first), /Outcome: pass/);

    await writeFile(changedFile, "export const version = 2;\n", "utf8");
    const baseline = await readTaskBaseline(directory, "0007");
    assert.ok(baseline);
    const currentTask = (await loadTaskFile(taskPath)).task;
    const currentSubject = {
      ...(await captureTaskEvidenceSubject(directory, currentTask, ["src/core/tasks/changed.ts"])),
      baselineId: baseline.baselineId,
    };
    const assessmentsBefore = assessTaskReviews([first.evidence], currentSubject);
    assert.equal(assessmentsBefore[0].freshness, "stale");

    const second = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "changes_requested",
      findings: ["Check the version transition boundary."],
      implementationRunId: "verify-b",
      changedFiles: ["src/core/tasks/changed.ts"],
    });
    assert.equal(second.outcome, "changes_requested");
    assert.deepEqual(second.findings, ["Check the version transition boundary."]);
    assert.equal(assessTaskReviews([second.evidence], second.subject)[0].freshness, "current");
    assert.equal((await listTaskReviews(directory, "0007")).length, 2);
    assert.equal((await readTaskEvidence(directory, "0007")).filter((record) => record.type === "review").length, 2);
    assert.match(renderTaskReviewPrompt({
      task: currentTask,
      reviewer: "codex-reviewer",
      subject: second.subject,
      changedFiles: second.changedFiles,
    }), /Acceptance criteria:/);

    await assert.rejects(
      () => recordTaskReview({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        reviewer: "codex-owner",
        outcome: "pass",
        changedFiles: ["src/core/tasks/changed.ts"],
      }),
      /cannot certify the same task/,
    );
  });
});

test("prepared review rejects a mixed revision and keeps the reviewed subject immutable", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-reviewable-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-owner", developer: "alice", platform: "codex", model: "gpt-5" });
    await registerAgent(directory, { id: "codex-reviewer", developer: "bob", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner" });

    const changedFile = join(directory, "src", "candidate.ts");
    await writeFile(changedFile, "export const version = 1;\n", "utf8");
    const preparedA = await prepareTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
    });
    assert.match(preparedA.prompt, new RegExp(`Review run: ${preparedA.reviewRunId}`));
    assert.match(preparedA.prompt, new RegExp(`Candidate: ${preparedA.subject.candidateId}`));
    assert.match(await readFile(join(directory, ".agentic", "reviews", "0007", `${preparedA.reviewRunId}.json`), "utf8"), /review-v1/);

    await writeFile(changedFile, "export const version = 2;\n", "utf8");
    await assert.rejects(
      () => recordTaskReview({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        reviewer: "codex-reviewer",
        reviewRunId: preparedA.reviewRunId,
        outcome: "pass",
      }),
      /stale\/mixed-revision/,
    );
    assert.equal((await readTaskEvidence(directory, "0007")).filter((record) => record.type === "review").length, 0);
    const blocked = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.ok(blocked.blockers.some((blocker) => blocker.includes("Missing independent review")));

    const preparedB = await prepareTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
    });
    const pass = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      reviewRunId: preparedB.reviewRunId,
      outcome: "pass",
    });
    assert.equal(pass.evidence.subject.candidateId, preparedB.subject.candidateId);
    assert.equal((await listTaskReviews(directory, "0007")).length, 1);
  });
});

test("concurrent prepared review results append exactly one terminal outcome", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-reviewable-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-owner", developer: "alice", platform: "codex", model: "gpt-5" });
    await registerAgent(directory, { id: "codex-reviewer", developer: "bob", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner" });

    const prepared = await prepareTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
    });
    const common = {
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      reviewRunId: prepared.reviewRunId,
    } as const;
    const outcomes = await Promise.allSettled([
      recordTaskReview({ ...common, outcome: "pass" }),
      recordTaskReview({ ...common, outcome: "changes_requested", findings: ["Concurrent finding."] }),
    ]);

    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = outcomes.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected);
    assert.match(String(rejected.reason), /Review run already has a result/);
    assert.equal((await readTaskEvidence(directory, "0007")).filter((record) => (
      record.type === "review" && record.runId === prepared.reviewRunId
    )).length, 1);
  });
});

test("review history preserves changes_requested then pass across prepared candidates", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-reviewable-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-owner", developer: "alice", platform: "codex", model: "gpt-5" });
    await registerAgent(directory, { id: "codex-reviewer", developer: "bob", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner" });

    const changedFile = join(directory, "src", "candidate.ts");
    await writeFile(changedFile, "export const version = 1;\n", "utf8");
    const preparedA = await prepareTaskReview({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", reviewer: "codex-reviewer" });
    const requested = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      reviewRunId: preparedA.reviewRunId,
      outcome: "changes_requested",
      findings: ["Check the transition."],
    });
    await writeFile(changedFile, "export const version = 2;\n", "utf8");
    const preparedB = await prepareTaskReview({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", reviewer: "codex-reviewer" });
    const passed = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      reviewRunId: preparedB.reviewRunId,
      outcome: "pass",
    });
    assert.deepEqual((await listTaskReviews(directory, "0007")).map((record) => record.result), ["changes_requested", "pass"]);
    assert.notEqual(requested.evidence.subject.candidateId, passed.evidence.subject.candidateId);
  });
});

test("parseTaskMarkdown reports useful compact validation errors", () => {
  assert.throws(
    () =>
      parseTaskMarkdown(
        [
          "# Broken",
          "",
          "State: waiting",
          "Owner:",
          "Mode: legacy",
          "Lane:",
          "Scope: none",
          "Risk: risky",
          "Parallel: maybe",
          "Depends on:",
          "Tags: none",
          "",
          "## Goal",
          "",
          "",
        ].join("\n"),
      ),
    (error: unknown) => {
      assert.ok(error instanceof TaskFormatError);
      assert.ok(error.issues.includes('Heading must match "# Task <id> - <title>".'));
      assert.ok(error.issues.includes("State must be one of: todo, doing, review, done, blocked, canceled."));
      assert.ok(error.issues.includes("Owner must not be empty."));
      assert.ok(error.issues.includes("Parallel must be true or false."));
      return true;
    },
  );
});

test("selectTaskContext returns level 1 base files plus current task", () => {
  assert.deepEqual(selectTaskContext(TASK, 1), {
    taskId: "0007",
    level: 1,
    files: [
      "AGENTS.md",
      "docs/project.md",
      "docs/scope.md",
      "docs/architecture.md",
      ".tasks/0007-add-task-system.md",
    ],
  });
});

test("selectTaskContext returns deterministic level 2 docs", () => {
  assert.deepEqual(selectTaskContext(TASK, 2).files, [
    "AGENTS.md",
    "docs/project.md",
    "docs/scope.md",
    "docs/architecture.md",
    ".tasks/0007-add-task-system.md",
    "docs/decisions.md",
    "docs/task-system.md",
  ]);
});

test("selectTaskContext can use the actual task file path", () => {
  assert.deepEqual(
    selectTaskContext(TASK, 1, {
      taskFile: ".tasks/0007-custom-name.md",
    }).files,
    [
      "AGENTS.md",
      "docs/project.md",
      "docs/scope.md",
      "docs/architecture.md",
      ".tasks/0007-custom-name.md",
    ],
  );
});

test("renderTaskContext prints explicit file list", () => {
  assert.equal(
    renderTaskContext(selectTaskContext(TASK, 1)),
    [
      "Task: 0007",
      "Context level: 1",
      "",
      "Files:",
      "- AGENTS.md",
      "- docs/project.md",
      "- docs/scope.md",
      "- docs/architecture.md",
      "- .tasks/0007-add-task-system.md",
      "",
    ].join("\n"),
  );
});

test("budgeted task context keeps required files and ranks relevant signals", () => {
  const task = {
    ...TASK,
    title: "Context Pack",
    contextFiles: ["AGENTS.md", "docs/context-system.md"],
    allowedFiles: ["src/feature.ts"],
  };
  const availableFiles = [
    "AGENTS.md",
    "docs/project.md",
    "docs/scope.md",
    "docs/architecture.md",
    ".tasks/0007-context-pack.md",
    "docs/decisions.md",
    "docs/context-system.md",
    "src/feature.ts",
    "src/feature.test.ts",
    "docs/history.md",
    ".agentic/runs/2026-09-09-codex.jsonl",
  ];
  const fileSizes = Object.fromEntries(availableFiles.map((file) => [file, 2]));
  const selection = selectTaskContext(task, 2, {
    budget: 17,
    availableFiles,
    fileSizes,
    changedFiles: ["src/feature.test.ts"],
    dependencyFiles: ["src/feature.ts"],
    recentFiles: ["docs/history.md"],
  });

  assert.equal(selection.estimatedUnits, 16);
  assert.ok(selection.entries?.every((entry) => entry.tier === "required" || entry.path === "src/feature.ts"));
  assert.ok(selection.entries?.some((entry) => entry.path === "src/feature.ts" && entry.tier === "relevant"));
  assert.equal(selection.files.includes("src/feature.test.ts"), false);
  assert.equal(selection.files.includes("docs/history.md"), false);
  assert.equal(selection.files.some((file) => file.includes(".agentic/runs/")), false);
  assert.equal(selection.diagnostics, undefined);
});

test("budgeted task context reports required overflow without dropping contracts", () => {
  const selection = selectTaskContext(TASK, 1, {
    budget: 5,
    fileSizes: {
      "AGENTS.md": 10,
      "docs/project.md": 10,
      "docs/scope.md": 10,
      "docs/architecture.md": 10,
      ".tasks/0007-add-task-system.md": 10,
      "docs/task-system.md": 10,
    },
  });

  assert.ok((selection.estimatedUnits ?? 0) > 5);
  assert.equal(selection.diagnostics?.[0]?.code, "required-over-budget");
  assert.ok(selection.files.includes("AGENTS.md"));
  assert.ok(selection.files.includes(".tasks/0007-add-task-system.md"));
  assert.ok(selection.files.includes("docs/task-system.md"));
});

test("selectNextTask returns lowest-numbered todo task with done dependencies", () => {
  const files: ProjectTaskFile[] = [
    {
      path: ".tasks/0001-done.md",
      task: {
        ...TASK,
        id: "0001",
        title: "Done",
        state: "done",
        owner: "archive",
      },
    },
    {
      path: ".tasks/0009-next.md",
      task: {
        ...TASK,
        id: "0009",
        title: "Next",
        dependsOn: ["0001"],
      },
    },
    {
      path: ".tasks/0010-blocked-by-dep.md",
      task: {
        ...TASK,
        id: "0010",
        title: "Blocked By Dependency",
        dependsOn: ["0002"],
      },
    },
  ];

  const selection = selectNextTask(files);

  assert.equal(selection?.task.id, "0009");
  assert.equal(selection?.contextCommand, "pnpm exec apk context 0009 --level 2");
});

test("selectNextTask ignores busy and terminal states", () => {
  assert.equal(
    selectNextTask([
      { path: "doing.md", task: { ...TASK, state: "doing", owner: "codex-a" } },
      { path: "review.md", task: { ...TASK, state: "review", owner: "codex-a" } },
      { path: "blocked.md", task: { ...TASK, state: "blocked" } },
      { path: "done.md", task: { ...TASK, state: "done", owner: "archive" } },
      { path: "canceled.md", task: { ...TASK, state: "canceled" } },
    ]),
    undefined,
  );
});

test("renderNextTask prints candidate details", () => {
  assert.equal(
    renderNextTask({
      path: ".tasks/0012-add-next-task-command.md",
      contextCommand: "pnpm exec apk context 0012 --level 2",
      task: {
        ...TASK,
        id: "0012",
        title: "Add Next Task Command",
        risk: "medium",
      },
    }),
    [
      "Task: 0012",
      "Title: Add Next Task Command",
      "State: todo",
      "Owner: none",
      "Mode: mvp",
      "Lane: implementation",
      "Risk: medium",
      "Path: .tasks/0012-add-next-task-command.md",
      "Context: pnpm exec apk context 0012 --level 2",
      "",
    ].join("\n"),
  );
});

test("renderTasksTable prints compact rows", () => {
  assert.match(renderTasksTable([{ path: "task.md", task: TASK }]), /0007\s+todo\s+none\s+implementation\s+medium\s+yes\s+Add Task System/);
});

test("verifyTaskFileScope accepts allowed exact and glob paths", () => {
  const result = verifyTaskFileScope(TASK, [
    "src/core/tasks/index.ts",
    "docs/progress.md",
  ]);

  assert.deepEqual(result.outOfScopeFiles, []);
  assert.deepEqual(result.forbiddenTouchedFiles, []);
});

test("verifyTaskFileScope reports out-of-allowed files", () => {
  const result = verifyTaskFileScope(TASK, [
    "README.md",
  ]);

  assert.deepEqual(result.outOfScopeFiles, ["README.md"]);
  assert.deepEqual(result.forbiddenTouchedFiles, []);
});

test("verifyTaskFileScope reports forbidden files even when allowed", () => {
  const task: ProjectTask = {
    ...TASK,
    allowedFiles: ["package.json"],
    forbiddenFiles: ["package.json"],
  };

  const result = verifyTaskFileScope(task, ["package.json"]);

  assert.deepEqual(result.outOfScopeFiles, []);
  assert.deepEqual(result.forbiddenTouchedFiles, ["package.json"]);
});

test("claim baseline attributes later git changes without blaming pre-existing dirty files", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "docs", "foo"), { recursive: true });
    await mkdir(join(directory, "secrets"), { recursive: true });
    await writeFile(join(directory, "docs", "foo", "preexisting.md"), "before\n", "utf8");
    await writeFile(join(directory, "docs", "foo", "delete-me.md"), "delete\n", "utf8");
    await writeFile(join(directory, "secrets", "config.txt"), "clean\n", "utf8");
    const task: ProjectTask = {
      ...TASK,
      allowedFiles: ["docs/foo/**", "secrets/**"],
      forbiddenFiles: ["secrets/**"],
      verificationCommands: ["pnpm test"],
    };
    const taskPath = join(directory, ".tasks", "0007-add-task-system.md");
    await writeTaskFile(taskPath, task);
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");

    // These edits exist before claim and must not be attributed unless changed again.
    await writeFile(join(directory, "docs", "foo", "preexisting.md"), "before-claim\n", "utf8");
    await writeFile(join(directory, "secrets", "config.txt"), "preexisting-secret\n", "utf8");

    await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5",
    });
    await claimTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
    });

    await writeFile(join(directory, "docs", "foo", "new.md"), "new\n", "utf8");
    await writeFile(join(directory, "docs", "foobar.md"), "wrong directory\n", "utf8");
    await writeFile(join(directory, "secrets", "config.txt"), "changed-after-claim\n", "utf8");
    await rm(join(directory, "docs", "foo", "delete-me.md"));
    await git("add", "docs/foo/new.md");
    await git("commit", "--quiet", "-m", "post-claim change");

    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      checkFilesOnly: true,
    });

    assert.equal(result.passed, false);
    assert.deepEqual(result.attribution?.preExistingFiles, ["docs/foo/preexisting.md"]);
    assert.ok(result.attribution?.bookkeepingFiles.some((file) => file.endsWith(".tasks/0007-add-task-system.md")));
    assert.ok(result.attribution?.attributedFiles.includes("docs/foo/new.md"));
    assert.ok(result.attribution?.attributedFiles.includes("docs/foo/delete-me.md"));
    assert.ok(result.attribution?.attributedFiles.includes("docs/foobar.md"));
    assert.ok(result.attribution?.attributedFiles.includes("secrets/config.txt"));
    assert.deepEqual(result.outOfScopeFiles, ["docs/foobar.md"]);
    assert.deepEqual(result.forbiddenTouchedFiles, ["secrets/config.txt"]);
  });
});

test("verifyTask supports file-only checks and renders next step", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), TASK);

    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      checkFilesOnly: true,
      changedFiles: ["src/core/tasks/index.ts"],
    });

    assert.equal(result.passed, true);
    assert.equal(result.commandsSkipped, true);
    assert.match(renderTaskVerifyResult(result), /Result: pass/);
    assert.match(renderTaskVerifyResult(result), /Next: move task to review or done/);
  });
});

test("verifyTask records failed check and continues eligible checks", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), {
      ...TASK,
      verificationCommands: ["pass", "fail", "skip"],
    });

    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      changedFiles: ["src/core/tasks/index.ts"],
      runCommand: async (command) => command === "fail" ? 7 : 0,
    });

    assert.equal(result.passed, false);
    assert.deepEqual(result.commandsRun, [
      { command: "pass", exitCode: 0 },
      { command: "fail", exitCode: 7 },
      { command: "skip", exitCode: 0 },
    ]);
    assert.deepEqual(result.checkResults.map((check) => check.status), ["pass", "fail", "pass"]);
    assert.equal(result.evidenceWritten, 3);
    assert.equal((await readTaskEvidence(directory, "0007")).length, 3);
  });
});

test("verifyTask selects profiles and keeps manual/live requirements unresolved", async () => {
  await withTempDirectory(async (directory) => {
    const task: ProjectTask = {
      ...TASK,
      verification: [
        {
          id: "unit",
          type: "automated",
          required: true,
          environment: "ci",
          profile: "deterministic",
          command: "unit",
        },
        {
          id: "integration",
          type: "automated",
          required: true,
          environment: "local",
          profile: "integration",
          command: "integration",
        },
        {
          id: "production-smoke",
          type: "manual",
          required: true,
          environment: "live",
          profile: "trusted",
          instruction: "Check production smoke path.",
        },
        {
          id: "report",
          type: "automated",
          required: false,
          environment: "local",
          profile: "report",
          command: "report",
          evidence: "report URL",
        },
      ],
      verificationCommands: ["unit", "integration", "report"],
    };
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), task);
    const executed: string[] = [];
    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      changedFiles: ["src/core/tasks/index.ts"],
      runCommand: async (command) => {
        executed.push(command);
        return command === "report" ? 9 : 0;
      },
    });

    assert.deepEqual(executed, ["unit", "integration", "report"]);
    assert.deepEqual(result.checkResults.map((check) => [check.id, check.status]), [
      ["unit", "pass"],
      ["integration", "pass"],
      ["production-smoke", "unavailable"],
      ["report", "fail"],
    ]);
    assert.equal(result.passed, false);
    assert.equal((await readTaskEvidence(directory, "0007")).length, 4);
  });
});

test("verifyTask profile selection leaves required unselected checks not-run", async () => {
  await withTempDirectory(async (directory) => {
    const task: ProjectTask = {
      ...TASK,
      verification: [
        {
          id: "unit",
          type: "automated",
          required: true,
          environment: "ci",
          profile: "deterministic",
          command: "unit",
        },
        {
          id: "integration",
          type: "automated",
          required: true,
          environment: "local",
          profile: "integration",
          command: "integration",
        },
      ],
      verificationCommands: ["unit", "integration"],
    };
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), task);
    const executed: string[] = [];
    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      profile: "deterministic",
      changedFiles: ["src/core/tasks/index.ts"],
      runCommand: async (command) => {
        executed.push(command);
        return 0;
      },
    });

    assert.deepEqual(executed, ["unit"]);
    assert.deepEqual(result.checkResults.map((check) => check.status), ["pass", "not-run"]);
    assert.equal(result.passed, false);
  });
});

test("verifyTask rejects a pass when candidate changes during execution", async () => {
  await withTempDirectory(async (directory) => {
    const task: ProjectTask = {
      ...TASK,
      verification: [{
        id: "mutating-check",
        type: "automated",
        required: true,
        environment: "local",
        profile: "deterministic",
        command: "mutate",
      }],
      verificationCommands: ["mutate"],
    };
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), task);
    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      changedFiles: ["src/core/tasks/index.ts"],
      runCommand: async () => {
        await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
        await writeFile(join(directory, "src", "core", "tasks", "index.ts"), "changed\n", "utf8");
        return 0;
      },
    });

    assert.equal(result.passed, false);
    assert.equal(result.checkResults[0].status, "fail");
    assert.match(result.checkResults[0].reason ?? "", /mixed-revision/);
    assert.equal((await readTaskEvidence(directory, "0007"))[0].result, "fail");
  });
});

test("verifyTask recaptures new files and reports mixed revision scope", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: [],
      verification: [{ id: "mutating-check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "mutate" }],
      verificationCommands: ["mutate"],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });
    await writeFile(join(directory, "src", "a.ts"), "export const a = true;\n", "utf8");

    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => {
        await writeFile(join(directory, "src", "new.ts"), "export const newFile = true;\n", "utf8");
        return 0;
      },
    });
    assert.equal(result.passed, false);
    assert.deepEqual(result.changedFiles, ["src/a.ts", "src/new.ts"]);
    assert.equal(result.checkResults[0].status, "fail");
    assert.match(result.checkResults[0].reason ?? "", /mixed-revision/);
    assert.equal((await readTaskEvidence(directory, "0007"))[0].result, "fail");
  });
});

test("verifyTask surfaces forbidden files created during a check", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: ["secret.txt"],
      verification: [{ id: "mutating-check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "mutate" }],
      verificationCommands: ["mutate"],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });
    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => {
        await writeFile(join(directory, "secret.txt"), "not allowed\n", "utf8");
        await writeFile(join(directory, "outside.txt"), "out of scope\n", "utf8");
        return 0;
      },
    });
    assert.equal(result.passed, false);
    assert.deepEqual(result.forbiddenTouchedFiles, ["secret.txt"]);
    assert.deepEqual(result.outOfScopeFiles, ["outside.txt", "secret.txt"]);
  });
});

test("verifyTask recaptures deletion during a check", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: [],
      verification: [{ id: "mutating-check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "mutate" }],
      verificationCommands: ["mutate"],
    });
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "delete.ts"), "export const oldValue = true;\n", "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });
    await writeFile(join(directory, "src", "delete.ts"), "export const oldValue = false;\n", "utf8");
    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => {
        await rm(join(directory, "src", "delete.ts"));
        return 0;
      },
    });
    assert.equal(result.passed, false);
    assert.equal(result.checkResults[0].status, "fail");
    assert.match(result.checkResults[0].reason ?? "", /mixed-revision/);
  });
});

test("verifyTask records run log event when owner is supplied", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), TASK);
    await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5.5",
    });

    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkFilesOnly: true,
      changedFiles: ["src/core/tasks/index.ts"],
    });
    const events = await readRunLog(directory);

    assert.equal(result.nextStep, "pnpm exec apk review 0007 --owner codex-a");
    assert.ok(events.some((event) => (
      event.event === "verify" &&
      event.task === "0007" &&
      event.agent === "codex-a" &&
      event.outcome === "ok"
    )));
  });
});

test("anonymous verification remains diagnostic and cannot satisfy the completion gate", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-gated-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      risk: "low",
      dependsOn: [],
      verificationCommands: ["pass"],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    const anonymous = await verifyTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", runCommand: async () => 0 });
    assert.equal(anonymous.passed, true);
    assert.equal((await readTaskEvidence(directory, "0007"))[0].gateEligible, false);
    const fakeCandidate = await captureTaskCompletionCandidate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    await appendTaskEvidence(directory, {
      id: "fake-trusted-flag",
      taskId: "0007",
      runId: "fake-trusted-flag-run",
      agent: "fake-agent",
      gateEligible: true,
      type: "automated-test",
      result: "pass",
      subject: fakeCandidate.subject,
      checkId: "check-1",
      profile: "deterministic",
    });
    const blocked = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(blocked.passed, false);
    assert.ok(blocked.blockers.some((blocker) => blocker.includes("missing verification evidence")));

    const trusted = await verifyTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a", runCommand: async () => 0 });
    assert.equal(trusted.passed, true);
    const ready = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(ready.passed, true);
  });
});

test("completion gate ignores unavailable optional-only evidence categories", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-gated-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      risk: "low",
      dependsOn: [],
      tags: ["release"],
      verification: [
        {
          id: "release-report",
          type: "automated",
          required: true,
          environment: "ci",
          profile: "report",
          command: "pass",
          artifact: "coverage/coverage-summary.json",
          evidence: "clean-checkout command output",
        },
        {
          id: "workflow-review",
          type: "manual",
          required: false,
          environment: "live",
          profile: "trusted",
          instruction: "Record the hosted workflow when available.",
          evidence: "workflow URL/status/SHA",
        },
      ],
      verificationCommands: ["pass"],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true);
    assert.equal(verification.checkResults.find((result) => result.id === "workflow-review")?.status, "unavailable");

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, true);
    assert.equal(gate.blockers.some((blocker) => /live|manual|workflow-review/.test(blocker)), false);
  });
});

test("baseline Git failures block gate-eligible verification while empty diffs remain valid", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-gated-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      risk: "low",
      dependsOn: [],
      verificationCommands: ["pass"],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    const baselinePath = join(directory, ".agentic", "task-baselines.jsonl");
    const baseline = await readTaskBaseline(directory, "0007");
    assert.ok(baseline);
    await writeFile(baselinePath, `${JSON.stringify({ ...baseline, headSha: "not-a-real-commit" })}\n`, "utf8");
    const failed = await verifyTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a", runCommand: async () => 0 });
    assert.equal(failed.passed, false);
    assert.ok(failed.diagnostics.some((diagnostic) => diagnostic.includes("Git comparison failed")));
    assert.notEqual((await readTaskEvidence(directory, "0007"))[0].result, "pass");
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Git comparison")));
  });
});

test("completion gate reports dependencies, scope, evidence, and review blockers", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "0007-gated-task.md"), {
      ...TASK,
      risk: "medium",
      dependsOn: ["9999"],
      allowedFiles: ["src/core/tasks/**"],
      forbiddenFiles: [],
      verificationCommands: ["pnpm test"],
    });

    const gate = await evaluateTaskCompletionGate({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      changedFiles: ["README.md"],
    });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Dependency 9999 is missing")));
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Scope violation: README.md")));
    assert.ok(gate.blockers.some((blocker) => blocker.includes("missing verification evidence")));
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Missing independent review")));
    assert.match(renderTaskCompletionGate(gate), /Gate: blocked/);
  });
});

test("non-Git verification stays unknown without explicit inputs and supports explicit inputs", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "0007-non-git.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      risk: "low",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: [],
      verificationCommands: ["pass"],
    });
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    const ambiguous = await verifyTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a", runCommand: async () => 0 });
    assert.equal(ambiguous.passed, false);
    assert.equal((await readTaskEvidence(directory, "0007"))[0].gateEligible, false);
    const blocked = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(blocked.comparisonKnown, false);
    assert.equal(blocked.passed, false);

    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "explicit.ts"), "export const explicit = true;\n", "utf8");
    const explicit = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      changedFiles: ["src/explicit.ts"],
      runCommand: async () => 0,
    });
    assert.equal(explicit.passed, true);
    assert.equal((await readTaskEvidence(directory, "0007"))[1].gateEligible, true);
    const ready = await evaluateTaskCompletionGate({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      changedFiles: ["src/explicit.ts"],
    });
    assert.equal(ready.passed, true);
  });
});

test("evidence append lock is bookkeeping during candidate inspection", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-lock-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, TASK_EVIDENCE_LOCK_PATH), "pid\n", "utf8");

    const candidate = await captureTaskCompletionCandidate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(candidate.changedFiles.includes(TASK_EVIDENCE_LOCK_PATH), false);
    assert.equal(candidate.scope.attribution?.bookkeepingFiles.includes(TASK_EVIDENCE_LOCK_PATH), true);
  });
});

test("completion gate accepts current evidence, rejects stale candidates, and records provenance", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-gated-task.md"), {
      ...TASK,
      risk: "medium",
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/core/tasks/**"],
      forbiddenFiles: [],
      verificationCommands: ["pass"],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, {
      id: "codex-owner",
      developer: "alice",
      platform: "codex",
      model: "gpt-5",
    });
    await registerAgent(directory, {
      id: "codex-reviewer",
      developer: "bob",
      platform: "codex",
      model: "gpt-5",
    });
    await claimTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
    });

    const changedFile = join(directory, "src", "core", "tasks", "changed.ts");
    await writeFile(changedFile, "export const version = 1;\n", "utf8");
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true);

    const beforeReview = await evaluateTaskCompletionGate({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
    });
    assert.equal(beforeReview.passed, false);
    assert.ok(beforeReview.blockers.some((blocker) => blocker.includes("Missing independent review")));

    const review = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "pass",
      implementationRunId: verification.runId,
    });
    const ready = await evaluateTaskCompletionGate({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
    });
    assert.equal(ready.passed, true);
    const verificationEvidence = (await readTaskEvidence(directory, "0007"))
      .find((record) => record.runId === verification.runId && record.checkId === "check-1");
    assert.ok(verificationEvidence);
    assert.ok(ready.evidenceIds.includes(verificationEvidence!.id));
    assert.ok(ready.evidenceIds.includes(review.evidence.id));

    await writeFile(changedFile, "export const version = 2;\n", "utf8");
    const stale = await evaluateTaskCompletionGate({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
    });
    assert.equal(stale.passed, false);
    assert.ok(stale.blockers.some((blocker) => blocker.includes("verification evidence belongs to another candidate revision")));
    assert.ok(stale.blockers.some((blocker) => blocker.includes("review evidence belongs to another candidate revision")));

    await assert.rejects(
      () => doneTask({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-owner",
      }),
      /Gate: blocked/,
    );
    assert.equal((await loadTaskFile(join(directory, ".tasks", "0007-gated-task.md"))).task.state, "doing");

    const freshVerification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    const freshReview = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "pass",
      implementationRunId: freshVerification.runId,
    });
    const done = await doneTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
    });
    assert.equal(done.state, "done");
    assert.ok(freshReview.evidence.id !== review.evidence.id);
    const completion = (await readTaskEvidence(directory, "0007")).find((record) => record.type === "completion");
    assert.ok(completion);
    assert.equal(completion?.result, "pass");
    const freshVerificationEvidence = (await readTaskEvidence(directory, "0007"))
      .find((record) => record.runId === freshVerification.runId && record.checkId === "check-1");
    assert.ok(freshVerificationEvidence);
    assert.ok(completion?.evidenceSet?.includes(freshVerificationEvidence!.id));
    assert.ok(completion?.evidenceSet?.includes(freshReview.evidence.id));
  });
});

test("task provenance reconstructs stale and superseded runs plus final evidence set", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
    const taskPath = join(directory, ".tasks", "0007-provenance-task.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/core/tasks/**"],
      forbiddenFiles: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, {
      id: "codex-owner",
      developer: "alice",
      platform: "codex",
      model: "gpt-5",
    });
    await registerAgent(directory, {
      id: "codex-reviewer",
      developer: "bob",
      platform: "generic-harness",
      model: "vendor-neutral",
    });
    await claimTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
    });

    const changedPath = join(directory, "src", "core", "tasks", "provenance.ts");
    await writeFile(changedPath, "export const revision = 1;\n", "utf8");
    const verificationA = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    const reviewA = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "pass",
      implementationRunId: verificationA.runId,
      changedFiles: ["src/core/tasks/provenance.ts"],
    });

    await writeFile(changedPath, "export const revision = 2;\n", "utf8");
    const verificationB = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    const reviewB = await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "pass",
      implementationRunId: verificationB.runId,
      changedFiles: ["src/core/tasks/provenance.ts"],
    });
    assert.equal(reviewB.subject.candidateId, verificationB.subject.candidateId);
    const currentTask = (await loadTaskFile(taskPath)).task;
    const currentSubject = await captureTaskEvidenceSubject(
      directory,
      currentTask,
      ["src/core/tasks/provenance.ts"],
    );
    assert.equal(currentSubject.candidateId, reviewB.subject.candidateId);
    await reviewTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
    });
    const reviewStateTask = (await loadTaskFile(taskPath)).task;
    const reviewStateSubject = await captureTaskEvidenceSubject(
      directory,
      reviewStateTask,
      ["src/core/tasks/provenance.ts"],
    );
    assert.equal(reviewStateSubject.candidateId, reviewB.subject.candidateId);
    await doneTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
    });

    const provenance = await buildTaskProvenance(directory, ".tasks", "0007");
    const firstVerification = provenance.evidence.find((record) => record.runId === verificationA.runId);
    const latestVerification = provenance.evidence.find((record) => record.runId === verificationB.runId);
    const firstReview = provenance.evidence.find((record) => record.id === reviewA.evidence.id);
    const latestReview = provenance.evidence.find((record) => record.id === reviewB.evidence.id);
    assert.equal(provenance.commits.length, 0);
    assert.ok(provenance.diffFiles.some((file) => file.path === "src/core/tasks/provenance.ts"));
    assert.equal(firstVerification?.freshness, "stale");
    assert.ok(firstVerification?.supersededBy.includes(latestVerification!.id));
    assert.equal(firstReview?.freshness, "stale");
    assert.ok(firstReview?.supersededBy.includes(latestReview!.id));
    assert.equal(latestVerification?.freshness, "current");
    assert.equal(latestReview?.freshness, "current");
    assert.equal(provenance.completion?.result, "pass");
    assert.ok(provenance.completion?.evidenceSet.includes(latestVerification!.id));
    assert.ok(provenance.completion?.evidenceSet.includes(latestReview!.id));
    assert.equal(latestVerification?.freshnessAtDecision, "current");
    assert.equal(latestReview?.freshnessAtDecision, "current");
    assert.match(renderTaskProvenance(provenance), /superseded-by=/);
    assert.match(renderTaskProvenance(provenance), /Completion: .*evidence-set=/);
  });
});

test("task provenance separates task-attributed files from repository-wide activity", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-provenance-task.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      dependsOn: [],
      allowedFiles: ["src/**"],
      forbiddenFiles: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-owner", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner" });
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "task.ts"), "export const task = true;\n", "utf8");
    await git("add", "src/task.ts");
    await git("commit", "--quiet", "-m", "task change");
    await writeFile(join(directory, "unrelated.txt"), "other agent\n", "utf8");
    await git("add", "unrelated.txt");
    await git("commit", "--quiet", "-m", "unrelated change");

    const provenance = await buildTaskProvenance(directory, ".tasks", "0007");
    assert.deepEqual(provenance.taskAttributedFiles, ["src/task.ts"]);
    assert.equal(provenance.repositoryActivity.commits.length, 2);
    assert.ok(provenance.repositoryActivity.commits.some((commit) => commit.subject === "unrelated change"));
    const rendered = renderTaskProvenance(provenance);
    assert.match(rendered, /Task-attributed changed files:/);
    assert.match(rendered, /Repository activity since task baseline:/);
  });
});

test("task transitions require registered owner and log events", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    const tasksDirectory = join(directory, ".tasks");
    const taskPath = join(tasksDirectory, "0007-add-task-system.md");
    const transitionTask = {
      ...TASK,
      risk: "low" as const,
      dependsOn: [],
    };
    await writeTaskFile(taskPath, transitionTask);
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");

    await assert.rejects(
      () => claimTask({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
      }),
      /Agent is not registered/,
    );

    await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5.5",
      created: "2026-05-04T12:00:00Z",
    });

    const claimed = await claimTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
    });
    assert.equal(claimed.state, "doing");
    assert.equal(claimed.owner, "codex-a");

    const review = await reviewTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
    });
    assert.equal(review.state, "review");

    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      changedFiles: [],
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true);

    const done = await doneTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
    });
    assert.equal(done.state, "done");

    assert.deepEqual((await readRunLog(directory)).map((event) => event.event), [
      "register",
      "claim",
      "review",
      "verify",
      "done",
    ]);
    assert.deepEqual(await readdir(join(directory, ".agentic", "agents")), ["codex-a.json"]);
    assert.match((await readdir(join(directory, ".agentic", "runs")))[0], /^\d{4}-\d{2}-\d{2}_alice_codex-a\.jsonl$/);
  });
});

test("agent registry reads sharded and legacy agents", async () => {
  await withTempDirectory(async (directory) => {
    await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5.5",
      created: "2026-05-04T12:00:00Z",
    });
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "agents.jsonl"),
      `${JSON.stringify({
        id: "cursor-a",
        platform: "cursor",
        model: "claude-4",
        label: "cursor-a",
        created: "2026-05-04T13:00:00Z",
      })}\n`,
      "utf8",
    );

    const agents = await listAgents(directory);

    assert.deepEqual(agents.map((agent) => [agent.id, agent.developer]), [
      ["codex-a", "alice"],
      ["cursor-a", "unknown"],
    ]);
  });
});

test("migrateAgentLogs converts legacy files to sharded layout", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "agents.jsonl"),
      `${JSON.stringify({
        id: "codex-a",
        platform: "codex",
        model: "gpt-5.5",
        label: "codex-a",
        created: "2026-05-04T12:00:00Z",
      })}\n`,
      "utf8",
    );
    await writeFile(
      join(directory, ".agentic", "runs.jsonl"),
      `${JSON.stringify({
        time: "2026-05-04T12:01:00Z",
        event: "claim",
        task: "0007",
        agent: "codex-a",
        platform: "codex",
        model: "gpt-5.5",
        state: "doing",
        outcome: "ok",
      })}\n`,
      "utf8",
    );

    const result = await migrateAgentLogs(directory, { removeLegacy: true });

    assert.deepEqual(result.agentsWritten, ["codex-a"]);
    assert.equal(result.runEventsWritten, 1);
    assert.match(
      await readFile(join(directory, ".agentic", "agents", "codex-a.json"), "utf8"),
      /"developer": "unknown"/,
    );
    assert.match(
      await readFile(join(directory, ".agentic", "runs", "2026-05-04_unknown_codex-a.jsonl"), "utf8"),
      /"developer":"unknown"/,
    );
    await assert.rejects(
      () => readFile(join(directory, ".agentic", "agents.jsonl"), "utf8"),
      /ENOENT/,
    );
  });
});

test("task transitions reject owner mismatch and stale locks", async () => {
  await withTempDirectory(async (directory) => {
    const taskPath = join(directory, ".tasks", "0007-add-task-system.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      state: "doing",
      owner: "codex-a",
    });
    await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5.5",
    });
    await registerAgent(directory, {
      id: "cursor-a",
      developer: "bob",
      platform: "cursor",
      model: "claude-4",
    });

    await assert.rejects(
      () => releaseTask({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "cursor-a",
      }),
      /owned by codex-a/,
    );

    await createStaleTaskLock(directory, ".tasks");
    await assert.rejects(
      () => releaseTask({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
      }),
      /Task lock exists/,
    );
  });
});

test("releaseTask can reopen ownerless blocked tasks with a registered owner", async () => {
  await withTempDirectory(async (directory) => {
    const taskPath = join(directory, ".tasks", "0007-add-task-system.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      state: "blocked",
      owner: "none",
    });
    await registerAgent(directory, {
      id: "codex-a",
      developer: "alice",
      platform: "codex",
      model: "gpt-5.5",
    });

    const released = await releaseTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
    });

    assert.equal(released.state, "todo");
    assert.equal(released.owner, "none");
  });
});

test("validateTaskDependencies reports missing dependency ids", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", dependsOn: ["0002"] } },
    { path: "0003.md", task: { ...TASK, id: "0003", dependsOn: [] } },
  ];

  const issues = validateTaskDependencies(files);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "missing");
  assert.equal(issues[0].taskId, "0001");
  assert.match(issues[0].message, /0001.*0002/);
});

test("validateTaskDependencies reports direct cycles", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", dependsOn: ["0002"] } },
    { path: "0002.md", task: { ...TASK, id: "0002", dependsOn: ["0001"] } },
  ];

  const issues = validateTaskDependencies(files);

  assert.ok(issues.some((i) => i.kind === "cycle"));
  assert.ok(issues.some((i) => i.message.includes("0001") && i.message.includes("0002")));
});

test("validateTaskDependencies reports multi-task cycles", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", dependsOn: ["0003"] } },
    { path: "0002.md", task: { ...TASK, id: "0002", dependsOn: ["0001"] } },
    { path: "0003.md", task: { ...TASK, id: "0003", dependsOn: ["0002"] } },
  ];

  const issues = validateTaskDependencies(files);

  assert.ok(issues.some((i) => i.kind === "cycle"));
});

test("validateTaskDependencies accepts valid cross-number dependencies", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", dependsOn: [] } },
    { path: "0002.md", task: { ...TASK, id: "0002", dependsOn: ["0001"] } },
    { path: "0003.md", task: { ...TASK, id: "0003", dependsOn: ["0001", "0002"] } },
  ];

  const issues = validateTaskDependencies(files);

  assert.equal(issues.length, 0);
});

test("validateTaskDependencies returns no issues for tasks with no dependencies", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", dependsOn: [] } },
    { path: "0002.md", task: { ...TASK, id: "0002", dependsOn: [] } },
  ];

  const issues = validateTaskDependencies(files);

  assert.equal(issues.length, 0);
});

test("findTaskDependents returns tasks that depend on a given task", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", title: "Base", dependsOn: [], state: "done", owner: "archive" } },
    { path: "0002.md", task: { ...TASK, id: "0002", title: "Child A", dependsOn: ["0001"] } },
    { path: "0003.md", task: { ...TASK, id: "0003", title: "Child B", dependsOn: ["0001"] } },
    { path: "0004.md", task: { ...TASK, id: "0004", title: "Independent", dependsOn: [] } },
  ];

  const dependents = findTaskDependents(files, "0001");

  assert.equal(dependents.length, 2);
  assert.equal(dependents[0].id, "0002");
  assert.equal(dependents[1].id, "0003");
});

test("findTaskDependents returns empty array for task with no dependents", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", title: "Base", dependsOn: [], state: "done", owner: "archive" } },
    { path: "0002.md", task: { ...TASK, id: "0002", title: "Child", dependsOn: ["0001"] } },
  ];

  const dependents = findTaskDependents(files, "0002");

  assert.equal(dependents.length, 0);
});

test("buildTaskDeps returns prerequisites, dependents, and issues", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", title: "Base", dependsOn: [], state: "done", owner: "archive" } },
    { path: "0002.md", task: { ...TASK, id: "0002", title: "Missing", dependsOn: [] } },
    { path: "0003.md", task: { ...TASK, id: "0003", title: "Target", dependsOn: ["0001", "0099"] } },
    { path: "0004.md", task: { ...TASK, id: "0004", title: "Child", dependsOn: ["0003"] } },
  ];

  const result = buildTaskDeps(files, "0003", ".tasks/0003-target.md");

  assert.ok(result);
  assert.equal(result!.id, "0003");
  assert.equal(result!.prerequisites.length, 2);
  assert.equal(result!.prerequisites[0].id, "0001");
  assert.equal(result!.prerequisites[1].id, "0099");
  assert.equal(result!.dependents.length, 1);
  assert.equal(result!.dependents[0].id, "0004");
  assert.equal(result!.missingDeps.length, 1);
  assert.equal(result!.missingDeps[0], "0099");
});

test("buildTaskDeps returns undefined for unknown task id", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", title: "Base", dependsOn: [], state: "done", owner: "archive" } },
  ];

  const result = buildTaskDeps(files, "0099", ".tasks/0099-unknown.md");

  assert.equal(result, undefined);
});

test("buildTaskDeps returns cycle issues", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001", title: "A", dependsOn: ["0002"] } },
    { path: "0002.md", task: { ...TASK, id: "0002", title: "B", dependsOn: ["0001"] } },
  ];

  const result = buildTaskDeps(files, "0001", ".tasks/0001-a.md");

  assert.ok(result);
  assert.ok(result!.cycleIssues.length > 0);
});

test("renderTaskDeps shows prerequisites and dependents", () => {
  const result = {
    id: "0003",
    title: "Target",
    state: "todo" as const,
    path: ".tasks/0003-target.md",
    prerequisites: [
      { id: "0001", title: "Base", state: "done" as const, archived: false },
      { id: "0002", title: "Prereq", state: "doing" as const, archived: false },
    ],
    dependents: [
      { id: "0004", title: "Child", state: "todo" as const, archived: false },
    ],
    missingDeps: [],
    cycleIssues: [],
  };

  const output = renderTaskDeps(result);

  assert.match(output, /Task: 0003/);
  assert.match(output, /Title: Target/);
  assert.match(output, /State: todo/);
  assert.match(output, /Prerequisites:/);
  assert.match(output, /- 0001 \[done\] Base/);
  assert.match(output, /- 0002 \[doing\] Prereq/);
  assert.match(output, /Dependents:/);
  assert.match(output, /- 0004 \[todo\] Child/);
});

test("renderTaskDeps shows missing dependencies", () => {
  const result = {
    id: "0003",
    title: "Target",
    state: "todo" as const,
    path: ".tasks/0003-target.md",
    prerequisites: [],
    dependents: [],
    missingDeps: ["0099"],
    cycleIssues: [],
  };

  const output = renderTaskDeps(result);

  assert.match(output, /Prerequisites: none/);
  assert.match(output, /Dependents: none/);
  assert.match(output, /Missing dependencies:/);
  assert.match(output, /- 0099/);
});

test("renderTaskDeps shows cycle issues", () => {
  const result = {
    id: "0001",
    title: "A",
    state: "todo" as const,
    path: ".tasks/0001-a.md",
    prerequisites: [],
    dependents: [],
    missingDeps: [],
    cycleIssues: ["Dependency cycle detected: 0001 -> 0002 -> 0001."],
  };

  const output = renderTaskDeps(result);

  assert.match(output, /Cycle issues:/);
  assert.match(output, /0001 -> 0002 -> 0001/);
});

test("nextTaskId returns the next numeric id from existing tasks", () => {
  const files: ProjectTaskFile[] = [
    { path: "0001.md", task: { ...TASK, id: "0001" } },
    { path: "0003.md", task: { ...TASK, id: "0003" } },
    { path: "0004.md", task: { ...TASK, id: "0004" } },
  ];

  assert.equal(nextTaskId(files), "0005");
});

test("nextTaskId returns 0001 for empty task list", () => {
  assert.equal(nextTaskId([]), "0001");
});

test("buildTaskFileName generates kebab-case slug from title", () => {
  assert.equal(buildTaskFileName("0046", "Add Feature X"), "0046-add-feature-x.md");
  assert.equal(buildTaskFileName("0001", "It's a task!"), "0001-it-s-a-task.md");
});

test("createTask writes a valid task file with auto-generated id", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    const result = await createTask(directory, ".tasks", {
      title: "Example Task",
      mode: "mvp",
      lane: "implementation",
      scope: ["cli", "docs"],
      risk: "low",
      parallel: false,
      dependsOn: [],
      tags: ["example"],
      goal: "Demonstrate task creation.",
      contextFiles: ["AGENTS.md", "docs/task-system.md"],
      allowedFiles: [".tasks/0001-example-task.md"],
      forbiddenFiles: ["package.json"],
      steps: ["Create the task.", "Verify it works."],
      acceptanceCriteria: ["Task file is valid."],
      verificationCommands: ["pnpm test"],
      documentationUpdates: ["docs/progress.md"],
      notes: ["First created task."],
    });

    assert.equal(result.id, "0001");
    assert.equal(result.path, ".tasks/0001-example-task.md");
    assert.equal(result.task.state, "todo");
    assert.equal(result.task.owner, "none");
    assert.equal(result.task.dependsOn.length, 0);

    const content = await readFile(join(directory, ".tasks", "0001-example-task.md"), "utf8");
    assert.match(content, /# Task 0001 - Example Task/);
    assert.match(content, /State: todo/);
    assert.match(content, /Owner: none/);

    const reparse = parseTaskMarkdown(content);
    assert.equal(reparse.id, "0001");
    assert.equal(reparse.title, "Example Task");
  });
});

test("createTask rejects missing dependency id", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    await assert.rejects(
      () => createTask(directory, ".tasks", {
        title: "Depends on Missing",
        mode: "mvp",
        lane: "implementation",
        scope: [],
        risk: "low",
        parallel: false,
        dependsOn: ["9999"],
        tags: [],
        goal: "Test missing dep.",
        contextFiles: ["AGENTS.md"],
        allowedFiles: [],
        forbiddenFiles: [],
        steps: [],
        acceptanceCriteria: ["Fails validation."],
        verificationCommands: ["pnpm test"],
        documentationUpdates: [],
        notes: [],
      }),
      /Dependency validation failed/,
    );

    assert.rejects(
      () => readFile(join(directory, ".tasks", "0001-depends-on-missing.md"), "utf8"),
      /ENOENT/,
    );
  });
});

test("createTask avoids overwriting existing task file", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    await createTask(directory, ".tasks", {
      title: "Example Task",
      mode: "mvp",
      lane: "implementation",
      scope: [],
      risk: "low",
      parallel: false,
      dependsOn: [],
      tags: [],
      goal: "First creation.",
      contextFiles: ["AGENTS.md"],
      allowedFiles: [],
      forbiddenFiles: [],
      steps: [],
      acceptanceCriteria: ["Works."],
      verificationCommands: ["pnpm test"],
      documentationUpdates: [],
      notes: [],
    });

    await assert.rejects(
      () => createTask(directory, ".tasks", {
        title: "Example Task",
        mode: "mvp",
        lane: "implementation",
        scope: [],
        risk: "low",
        parallel: false,
        dependsOn: [],
        tags: [],
        goal: "Second creation.",
        contextFiles: ["AGENTS.md"],
        allowedFiles: [],
        forbiddenFiles: [],
        steps: [],
        acceptanceCriteria: ["Works."],
        verificationCommands: ["pnpm test"],
        documentationUpdates: [],
        notes: [],
      }),
      /Task file already exists/,
    );
  });
});

test("createTask validates rendered task before writing", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(
      join(directory, ".agentic", "config.json"),
      JSON.stringify({}),
      "utf8",
    );

    await assert.rejects(
      () => createTask(directory, ".tasks", {
        title: "Bad Task",
        mode: "mvp",
        lane: "implementation",
        scope: [],
        risk: "low",
        parallel: false,
        dependsOn: [],
        tags: [],
        goal: "",
        contextFiles: [],
        allowedFiles: [],
        forbiddenFiles: [],
        steps: [],
        acceptanceCriteria: [],
        verificationCommands: [],
        documentationUpdates: [],
        notes: [],
      }),
      /Rendered task validation failed/,
    );

    assert.rejects(
      () => readFile(join(directory, ".tasks", "0001-bad-task.md"), "utf8"),
      /ENOENT/,
    );
  });
});

test("createTask refuses to allocate ids while task lock exists", async () => {
  await withTempDirectory(async (directory) => {
    await createStaleTaskLock(directory, ".tasks");

    await assert.rejects(
      () => createTask(directory, ".tasks", {
        title: "Locked Task",
        mode: "mvp",
        lane: "implementation",
        scope: ["cli"],
        risk: "low",
        parallel: false,
        dependsOn: [],
        tags: [],
        goal: "Should not write while locked.",
        contextFiles: ["AGENTS.md"],
        allowedFiles: ["src/cli/index.ts"],
        forbiddenFiles: [],
        steps: [],
        acceptanceCriteria: ["Fails cleanly."],
        verificationCommands: ["pnpm test"],
        documentationUpdates: [],
        notes: [],
      }),
      /Task lock exists/,
    );

    assert.rejects(
      () => readFile(join(directory, ".tasks", "0001-locked-task.md"), "utf8"),
      /ENOENT/,
    );
  });
});

test("archiveTask moves a done task to archive directory", async () => {
  await withTempDirectory(async (directory) => {
    const taskPath = join(directory, ".tasks", "0001-done-task.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      id: "0001",
      title: "Done Task",
      state: "done",
      owner: "archive",
    });

    const result = await archiveTask(directory, ".tasks", "0001");

    assert.equal(result.taskId, "0001");
    assert.equal(result.archivePath, ".tasks/archive/0001-done-task.md");
    assert.rejects(
      () => readFile(taskPath),
      /ENOENT/,
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "archive", "0001-done-task.md")),
    );
  });
});

test("archiveTask uses the shared task mutation lock", async () => {
  await withTempDirectory(async (directory) => {
    const taskPath = join(directory, ".tasks", "0001-done-task.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      id: "0001",
      title: "Done Task",
      state: "done",
      owner: "archive",
    });
    await createStaleTaskLock(directory, ".tasks");

    await assert.rejects(
      () => archiveTask(directory, ".tasks", "0001"),
      /Task lock exists:.*malformed/,
    );
    assert.doesNotReject(() => readFile(taskPath));
  });
});

test("archiveTask refuses to archive non-done tasks", async () => {
  await withTempDirectory(async (directory) => {
    const states: Array<"todo" | "blocked" | "canceled"> = [
      "todo", "blocked", "canceled",
    ];

    for (const state of states) {
      await writeTaskFile(
        join(directory, ".tasks", `0010-${state}-task.md`),
        { ...TASK, id: "0010", title: `${state} Task`, state },
      );

      await assert.rejects(
        () => archiveTask(directory, ".tasks", "0010"),
        /only done tasks can be archived/,
      );

      await rm(join(directory, ".tasks", `0010-${state}-task.md`), { force: true });
    }
  });
});

test("archiveTask refuses to archive task that does not exist", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".tasks"), { recursive: true });

    await assert.rejects(
      () => archiveTask(directory, ".tasks", "9999"),
      /Task file not found/,
    );
  });
});

test("archiveAllTasks moves all done tasks to archive", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(
      join(directory, ".tasks", "0001-done-one.md"),
      { ...TASK, id: "0001", title: "Done One", state: "done", owner: "archive" },
    );
    await writeTaskFile(
      join(directory, ".tasks", "0002-done-two.md"),
      { ...TASK, id: "0002", title: "Done Two", state: "done", owner: "archive" },
    );
    await writeTaskFile(
      join(directory, ".tasks", "0003-todo-task.md"),
      { ...TASK, id: "0003", title: "Todo Task", state: "todo" },
    );

    const result = await archiveAllTasks(directory, ".tasks");

    assert.equal(result.archived.length, 2);
    assert.ok(result.archived.some((a) => a.taskId === "0001"));
    assert.ok(result.archived.some((a) => a.taskId === "0002"));
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0003-todo-task.md")),
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "archive", "0001-done-one.md")),
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "archive", "0002-done-two.md")),
    );
  });
});

test("archiveAllTasks refuses archive path collisions with clear error", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(
      join(directory, ".tasks", "0001-done-task.md"),
      { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    );
    await mkdir(join(directory, ".tasks", "archive"), { recursive: true });
    await writeFile(
      join(directory, ".tasks", "archive", "0001-done-task.md"),
      "existing",
      "utf8",
    );

    await assert.rejects(
      () => archiveAllTasks(directory, ".tasks"),
      /Archive path already exists/,
    );
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
    );
  });
});

test("selectNextTask considers archived done tasks as completed dependencies", async () => {
  await withTempDirectory(async (_directory) => {
    const archivedTask: ProjectTaskFile = {
      path: ".tasks/archive/0001-done-task.md",
      task: { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    };

    const activeTasks: ProjectTaskFile[] = [
      {
        path: ".tasks/0002-waiting-task.md",
        task: { ...TASK, id: "0002", title: "Waiting Task", dependsOn: ["0001"] },
      },
    ];

    const selection = selectNextTask(activeTasks, [archivedTask]);

    assert.equal(selection?.task.id, "0002");
  });
});

test("selectNextTask keeps todo task blocked when archived dep is missing", () => {
  const activeTasks: ProjectTaskFile[] = [
    {
      path: ".tasks/0002-waiting-task.md",
      task: { ...TASK, id: "0002", title: "Waiting Task", dependsOn: ["0001"] },
    },
  ];

  const selection = selectNextTask(activeTasks, []);

  assert.equal(selection, undefined);
});

test("validateTaskDependencies accepts archived done tasks as valid dependencies", () => {
  const archivedFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0001-done-task.md",
      task: { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    },
  ];

  const activeFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/0002-waiting-task.md",
      task: { ...TASK, id: "0002", title: "Waiting Task", dependsOn: ["0001"] },
    },
  ];

  const issues = validateTaskDependencies(activeFiles, archivedFiles);

  assert.equal(issues.length, 0);
});

test("listArchivedTaskFiles reads task files from archive directory", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(
      join(directory, ".tasks", "archive", "0001-done-task.md"),
      { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    );
    await writeTaskFile(
      join(directory, ".tasks", "archive", "0002-done-task.md"),
      { ...TASK, id: "0002", title: "Done Task Two", state: "done", owner: "archive" },
    );
    await writeTaskFile(
      join(directory, ".tasks", "0003-todo-task.md"),
      { ...TASK, id: "0003", title: "Todo Task", state: "todo" },
    );

    const archived = await listArchivedTaskFiles(directory);
    const active = await listTaskFiles(directory);

    assert.equal(archived.length, 2);
    assert.equal(active.length, 1);
    assert.equal(archived[0].task.id, "0001");
    assert.equal(archived[1].task.id, "0002");
  });
});

test("allTaskFiles combines active and archived tasks", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(
      join(directory, ".tasks", "archive", "0001-done-task.md"),
      { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    );
    await writeTaskFile(
      join(directory, ".tasks", "0003-todo-task.md"),
      { ...TASK, id: "0003", title: "Todo Task", state: "todo" },
    );

    const all = await allTaskFiles(directory);

    assert.equal(all.length, 2);
    assert.equal(all[0].task.id, "0001");
    assert.equal(all[1].task.id, "0003");
  });
});

test("findTaskFile resolves archived task files", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(
      join(directory, ".tasks", "archive", "0001-done-task.md"),
      { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    );

    const path = await findTaskFile(directory, "0001");

    assert.match(path, /archive/);
  });
});

test("buildTaskDeps shows archived prerequisites", () => {
  const activeFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/0002-target-task.md",
      task: { ...TASK, id: "0002", title: "Target Task", dependsOn: ["0001"] },
    },
  ];

  const archivedFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0001-done-task.md",
      task: { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    },
  ];

  const result = buildTaskDeps(activeFiles, "0002", ".tasks/0002-target-task.md", archivedFiles);

  assert.ok(result);
  assert.equal(result!.prerequisites.length, 1);
  assert.equal(result!.prerequisites[0].id, "0001");
  assert.equal(result!.prerequisites[0].archived, true);
  assert.equal(result!.prerequisites[0].state, "done");
});

test("findTaskDependents includes archived dependents", () => {
  const activeFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0001-done-task.md",
      task: { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive", dependsOn: [] },
    },
  ];

  const archivedFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0000-done-dep.md",
      task: { ...TASK, id: "0000", title: "Done Dep", state: "done", owner: "archive", dependsOn: [] },
    },
  ];

  const dependents = findTaskDependents(activeFiles, "0001", archivedFiles);

  assert.equal(dependents.length, 0);
});

test("renderTaskDeps shows archived tag for archived prerequisites", () => {
  const result = {
    id: "0003",
    title: "Target",
    state: "todo" as const,
    path: ".tasks/0003-target.md",
    prerequisites: [
      { id: "0001", title: "Archived Base", state: "done" as const, archived: true },
      { id: "0002", title: "Active Prereq", state: "doing" as const, archived: false },
    ],
    dependents: [
      { id: "0004", title: "Archived Child", state: "done" as const, archived: true },
    ],
    missingDeps: [],
    cycleIssues: [],
  };

  const output = renderTaskDeps(result);

  assert.match(output, /- 0001 \[done\] \(archived\) Archived Base/);
  assert.match(output, /- 0002 \[doing\] Active Prereq/);
  assert.match(output, /- 0004 \[done\] \(archived\) Archived Child/);
});

test("nextTaskId includes archived tasks in id sequence", () => {
  const activeFiles: ProjectTaskFile[] = [];
  const archivedFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0005-done-task.md",
      task: { ...TASK, id: "0005", title: "Done Task", state: "done", owner: "archive" },
    },
  ];

  assert.equal(nextTaskId(activeFiles, archivedFiles), "0006");
});

// Regression tests for task 0046 review findings

test("buildTaskDeps resolves archived target task", () => {
  const activeFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/0002-active-task.md",
      task: { ...TASK, id: "0002", title: "Active Task", dependsOn: ["0001"] },
    },
  ];

  const archivedFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0001-done-task.md",
      task: { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive", dependsOn: [] },
    },
  ];

  const result = buildTaskDeps(activeFiles, "0001", ".tasks/archive/0001-done-task.md", archivedFiles);

  assert.ok(result, "buildTaskDeps should resolve archived target task");
  assert.equal(result!.id, "0001");
  assert.equal(result!.title, "Done Task");
  assert.equal(result!.state, "done");
  assert.equal(result!.dependents.length, 1);
  assert.equal(result!.dependents[0].id, "0002");
});

test("buildTaskDeps shows archived prerequisites for archived target", () => {
  const activeFiles: ProjectTaskFile[] = [];

  const archivedFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0001-base-task.md",
      task: { ...TASK, id: "0001", title: "Base Task", state: "done", owner: "archive", dependsOn: [] },
    },
    {
      path: ".tasks/archive/0002-target-task.md",
      task: { ...TASK, id: "0002", title: "Target Task", state: "done", owner: "archive", dependsOn: ["0001"] },
    },
  ];

  const result = buildTaskDeps(activeFiles, "0002", ".tasks/archive/0002-target-task.md", archivedFiles);

  assert.ok(result);
  assert.equal(result!.prerequisites.length, 1);
  assert.equal(result!.prerequisites[0].id, "0001");
  assert.equal(result!.prerequisites[0].archived, true);
});

test("validateTaskDependencies accepts active task depending on archived done task", () => {
  const archivedFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/archive/0001-done-task.md",
      task: { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    },
  ];

  const activeFiles: ProjectTaskFile[] = [
    {
      path: ".tasks/0002-waiting-task.md",
      task: { ...TASK, id: "0002", title: "Waiting Task", dependsOn: ["0001"] },
    },
  ];

  const issues = validateTaskDependencies(activeFiles, archivedFiles);

  assert.equal(issues.length, 0, "Should have no issues for active task depending on archived done task");
});
