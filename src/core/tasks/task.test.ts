import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { promisify } from "node:util";

import {
  registerAgent,
  listAgents,
  migrateAgentLogs,
  normalizeReasonText,
  readRunLog,
  REASON_DISPLAY_LIMIT,
  REASON_STORAGE_LIMIT,
  summarizeReasonText,
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
  captureTaskBaseline,
  captureTaskEvidenceSubject,
  captureTaskScope,
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
  listTaskHumanDecisions,
  recordTaskHumanDecision,
  loadTaskFile,
  nextTaskId,
  normalizeVerificationCommands,
  PACKAGED_DIST_CHECK_COMMAND,
  PACKAGED_DIST_CHECK_ID,
  packagedDistCheckCommand,
  isPackagedInputPath,
  mayIncludePackagedSource,
  packagedDistTaskContractBlockers,
  repositoryShipsCommittedDist,
  repositoryPackagedDistContract,
  taskPathPatternMayMatchDistOutput,
  parseTaskMarkdown,
  prepareTaskReview,
  recordTaskReview,
  renderTaskReviewPrompt,
  renderTaskReviewResult,
  renderTaskCompletionGate,
  renderTaskMarkdown,
  renderNextTask,
  renderTaskDeps,
  renderTaskEvidence,
  renderTaskPolicy,
  renderTaskProvenance,
  previewArchiveTask,
  previewArchiveTasks,
  readTaskEvidence,
  readTaskBaseline,
  listTaskChangedFilesSinceBaseline,
  readTaskBaselineHistory,
  listGitChangedFiles,
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
  recordManualVerification,
  renderRecordManualVerificationResult,
  withLocalMutationLock,
  renderTaskVerifyResult,
  resolveMergePathAttribution,
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
  blockTask,
  cancelTask,
  createStaleTaskLock,
  doneTask,
  releaseTask,
  reviewTask,
  startTaskEpoch,
} from "./workflow.js";
import { getTaskTemplate, resolveTaskTemplateType } from "../templates/task-templates.js";
import { syncAgentExports } from "../sync/index.js";
import { runTaskApkOperation, type TaskApkOperation } from "./apk-verification.js";

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

test("numbered list sections survive parse and render round trip", () => {
  const rendered = renderTaskMarkdown({
    ...TASK,
    acceptanceCriteria: ["First criterion.", "Second criterion."],
  });
  const numbered = rendered
    .replace("- First criterion.\n", "1. First criterion.\n")
    .replace("- Second criterion.\n", "2. Second criterion.\n");

  const parsed = parseTaskMarkdown(numbered);
  assert.deepEqual(parsed.acceptanceCriteria, ["First criterion.", "Second criterion."]);

  const reparsed = parseTaskMarkdown(renderTaskMarkdown(parsed));
  assert.deepEqual(reparsed.acceptanceCriteria, ["First criterion.", "Second criterion."]);

  const bulletWithNumberedText = renderTaskMarkdown({
    ...TASK,
    acceptanceCriteria: ["1. literal text", "10. answer"],
  });
  assert.deepEqual(
    parseTaskMarkdown(bulletWithNumberedText).acceptanceCriteria,
    ["1. literal text", "10. answer"],
  );
});

test("prose list continuations round trip paragraphs, nested markers, and fenced code", () => {
  const task: ProjectTask = {
    ...TASK,
    acceptanceCriteria: [
      "First paragraph.\nIndented continuation with `inline code`, JSON {\"ok\":true}, and https://example.test.\n\nSecond paragraph.",
      "Parent item.\n- Nested item.\n  - Deeper nested item.\n```ts\nconst value = 1;\n```",
    ],
    correctnessAssumptions: ["The parser owns task Markdown.\nMutation paths preserve continuation text."],
    invariants: ["Steps remain separate.\nNested prose markers stay in their parent item."],
    requiredEvidence: ["Round-trip output.\n\nClaim-style mutation output."],
    reviewQuestions: ["Can a continuation disappear?\nWhat about a fenced block?"],
    counterexampleSearches: ["Search nested bullets.\n  - Search code-like content too."],
    documentationUpdates: ["Document the supported subset.\nInclude blank-line rules."],
    notes: ["Preserve this note.\nIts second line is part of the same item."],
  };

  const rendered = renderTaskMarkdown(task);
  assert.match(rendered, /- First paragraph\.\n  Indented continuation/);
  assert.match(rendered, /\n\n  Second paragraph\./);
  const parsed = parseTaskMarkdown(rendered);
  assert.deepEqual(parsed, task);
  assert.equal(renderTaskMarkdown(parsed), rendered);
});

test("prose list parsing keeps indented numbered and bullet peers separate", () => {
  const task: ProjectTask = {
    ...TASK,
    acceptanceCriteria: ["First item.\nContinuation.", "Second item."],
  };
  const markdown = renderTaskMarkdown(task).replace(
    "- First item.\n  Continuation.\n- Second item.",
    "  1. First item.\n    Continuation.\n\n\n  - Second item.",
  );

  assert.deepEqual(parseTaskMarkdown(markdown), task);
  assert.deepEqual(parseTaskMarkdown(markdown.replace("    Continuation.", "  \tContinuation.")), task);

  const prose = renderTaskMarkdown({ ...TASK, acceptanceCriteria: ["Item.\nContinuation."] });
  assert.throws(
    () => parseTaskMarkdown(prose.replace("- Item.\n  Continuation.", "- Item.\nContinuation.")),
    /unsupported continuation indentation/,
  );
  assert.throws(
    () => parseTaskMarkdown(prose.replace("- Item.\n  Continuation.", "- Item.\n\n\n  Continuation.")),
    /more than one blank line before a continuation/,
  );
});

test("path and verification lists reject continuation text", () => {
  const source = renderTaskMarkdown(TASK);
  const cases = [
    ["Context files", "- AGENTS.md"],
    ["Files allowed to edit", "- src/core/tasks/**"],
    ["Files forbidden to edit", "- future task files"],
  ] as const;

  for (const [section, item] of cases) {
    const malformed = source.replace(
      `## ${section}\n\n${item}`,
      `## ${section}\n\n${item}\n  continuation text`,
    );
    assert.notEqual(malformed, source, `${section} fixture must be changed`);
    assert.throws(
      () => parseTaskMarkdown(malformed),
      new RegExp(`Section "${section}".*single physical list line`),
    );
  }

  const structured = renderTaskMarkdown({
    ...TASK,
    verification: [{
      id: "check",
      type: "automated",
      required: true,
      environment: "local",
      profile: "deterministic",
      command: "pnpm test",
    }],
  });
  const structuredLine = structured.match(/^(- `\{"id":"check".*`)$/m)?.[0];
  assert.ok(structuredLine);
  const multilineVerification = structured.replace(structuredLine, `${structuredLine}\n  continued JSON`);
  assert.throws(
    () => parseTaskMarkdown(multilineVerification),
    /Section "Verification".*single physical list line/,
  );

  assert.throws(
    () => renderTaskMarkdown({ ...TASK, allowedFiles: ["src/core/tasks/**\nsecond path"] }),
    /Files allowed to edit.*one physical list line/,
  );
});

test("legacy verification commands preserve indented command continuations", () => {
  const markdown = renderTaskMarkdown(TASK).replace(
    "## Verification commands\n\n- pnpm test",
    "## Verification commands\n\n- pnpm test\n  --runInBand",
  );
  const parsed = parseTaskMarkdown(markdown);

  assert.deepEqual(parsed.verificationCommands, ["pnpm test\n--runInBand"]);
  assert.deepEqual(parseTaskMarkdown(renderTaskMarkdown(parsed)), parsed);
});

test("Steps keep their existing physical-line parser semantics", () => {
  const markdown = renderTaskMarkdown({ ...TASK, steps: ["First step.", "Second step."] })
    .replace("1. First step.\n2. Second step.", "1. First step.\n    continuation-like step\n2. Second step.");

  assert.deepEqual(parseTaskMarkdown(markdown).steps, [
    "First step.",
    "continuation-like step",
    "Second step.",
  ]);
});

test("plain legacy prose in a list section is preserved as one item", () => {
  const markdown = renderTaskMarkdown(TASK).replace(
    "## Notes\n\n- Prefer explicit fields over inferred task metadata.",
    "## Notes\n\nNone.",
  );
  const parsed = parseTaskMarkdown(markdown);

  assert.deepEqual(parsed.notes, ["None."]);
  assert.match(renderTaskMarkdown(parsed), /## Notes\n\n- None\./);
});

test("unsupported task section headings fail parsing and mutation without changing task bytes", async () => {
  const heading = "## implementation detail\n\nThis contract text must not be discarded.";
  const source = `${renderTaskMarkdown(TASK)}\n${heading}\n`;
  assert.throws(() => parseTaskMarkdown(source), /Unsupported task section heading/);

  const tabSeparatedHeading = renderTaskMarkdown(TASK).replace(
    "## Goal\n\n",
    "##\timplementation detail\n\n- This text precedes the first supported section.\n\n## Goal\n\n",
  );
  assert.throws(() => parseTaskMarkdown(tabSeparatedHeading), /Unsupported task section heading/);

  const repeatedSection = renderTaskMarkdown(TASK).replace(
    "## Notes\n\n",
    "## Goal\n\nThis duplicate section must not replace the original Goal.\n\n## Notes\n\n",
  );
  assert.throws(() => parseTaskMarkdown(repeatedSection), /Duplicate task section heading/);

  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    const taskPath = join(directory, ".tasks", "0007-scoped-task.md");
    const original = await readFile(taskPath, "utf8");
    const malformed = `${original}\n${heading}\n`;
    await writeFile(taskPath, malformed, "utf8");

    await assert.rejects(
      () => claimTask({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "agent-a",
      }),
      /Unsupported task section heading/,
    );
    assert.equal(await readFile(taskPath, "utf8"), malformed);

    const tabMalformed = original.replace(
      "## Goal\n\n",
      "##\timplementation detail\n\n- This text precedes the first supported section.\n\n## Goal\n\n",
    );
    await writeFile(taskPath, tabMalformed, "utf8");
    await assert.rejects(
      () => claimTask({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "agent-a",
      }),
      /Unsupported task section heading/,
    );
    assert.equal(await readFile(taskPath, "utf8"), tabMalformed);
  });
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
        evidenceRef: "link or incident id",
        summary: "Confirm the exact candidate and capture the incident if the smoke check fails.",
      },
    ],
    verificationCommands: ["pnpm test"],
  };

  const rendered = renderTaskMarkdown(task);
  assert.match(rendered, /## Verification/);
  assert.doesNotMatch(rendered, /## Verification commands/);
  assert.deepEqual(parseTaskMarkdown(rendered), task);
});

test("legacy evidence aliases round trip and incompatible aliases fail clearly", () => {
  const legacy: ProjectTask = {
    ...TASK,
    verification: [{
      id: "legacy-evidence",
      type: "manual",
      required: true,
      environment: "live",
      profile: "trusted",
      instruction: "Inspect the release.",
      evidence: "legacy locator",
    }],
    verificationCommands: [],
  };
  assert.deepEqual(parseTaskMarkdown(renderTaskMarkdown(legacy)), legacy);

  assert.throws(
    () => parseTaskMarkdown(renderTaskMarkdown({
      ...legacy,
      verification: [{ ...legacy.verification![0], evidenceRef: "new locator" }],
    })),
    /evidence and evidenceRef are incompatible aliases.*summary or Notes/,
  );
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

test("bugfix template defaults enforce repro-first sequencing and honest limits", () => {
  const template = getTaskTemplate("bugfix");
  const steps = template.steps.join("\n");

  assert.match(steps, /Capture a failing signal first/);
  assert.ok(
    steps.indexOf("Capture a failing signal") < steps.lastIndexOf("Implement the smallest safe fix"),
    "failing-signal attempt must precede the fix",
  );
  assert.match(steps, /Minimize the reproducer/);
  assert.match(steps, /competing hypotheses/i);
  assert.match(steps, /bounded instrumentation/);
  assert.match(steps, /regression protection/);
  assert.match(template.acceptanceCriteria.join("\n"), /reproduction limits/);
  assert.match(template.correctnessAssumptions?.join("\n") ?? "", /do not establish root cause/);
  assert.match(template.invariants?.join("\n") ?? "", /No forced red test/);
  assert.match(template.requiredEvidence?.join("\n") ?? "", /best-effort observation/);
  assert.match(template.reviewQuestions?.join("\n") ?? "", /hypotheses distinguished from proven root cause/);
  assert.match(template.notes.join("\n"), /not a forced completion gate/);
  assert.equal(template.risk, "medium");
  assert.equal(resolveTaskTemplateType("bugfix"), "bugfix");
});

test("audit template uses the stable builtin for read-only APK lint and keeps audit explicit", () => {
  const checks = getTaskTemplate("audit").verification;
  const apkLint = checks.find((check) => check.id === "apk-lint");
  const audit = checks.find((check) => check.id === "audit");

  assert.equal(apkLint?.apkOperation, "lint");
  assert.equal(apkLint?.command, undefined);
  assert.equal(audit?.command, "node dist/cli/index.js audit");
  assert.equal(audit?.apkOperation, undefined);
});

test("domain templates combine regression execution and required report without duplicate suites", () => {
  for (const type of ["migration", "async-worker", "provider-integration", "security"] as const) {
    const template = getTaskTemplate(type);
    assert.equal(template.verification.length, 1, type);
    const check = template.verification[0];
    assert.equal(check.type, "automated");
    assert.equal(check.required, true);
    assert.equal(check.profile, "report");
    assert.ok(check.artifact);
    assert.match(template.notes.join("\n"), /execute the relevant tests and produce the declared artifact/);
    const task = { ...TASK, type, risk: template.risk, tags: template.tags, verification: template.verification, verificationCommands: [] };
    assert.ok(resolveTaskPolicy(task).requirements.evidenceCategories.includes("report"));
    assert.deepEqual(parseTaskMarkdown(renderTaskMarkdown(task)).verification, template.verification);
  }
});

test("docs templates avoid application suites while retaining runnable contract checks", async () => {
  await withTempDirectory(async (directory) => {
    await writeFile(join(directory, "README.md"), "# Documentation\n");
    const template = getTaskTemplate("docs");
    assert.deepEqual(template.verification.map((check) => check.apkOperation), ["lint"]);
    assert.ok(template.verification.every((check) => check.required && !check.command));
    const created = await createTask(directory, ".tasks", {
      ...TASK, dependsOn: [], contextFiles: ["README.md"], forbiddenFiles: [], verificationCommands: [],
      title: "Clarify Python documentation",
      scope: ["docs"], allowedFiles: ["README.md"], verification: template.verification,
      mode: template.mode, risk: template.risk, type: "docs",
    });
    const { task } = await loadTaskFile(join(directory, created.path));
    assert.equal(getTaskVerification(task)[0]?.apkOperation, "lint");
    assert.deepEqual(task.verificationCommands, []);
    assert.deepEqual(resolveTaskPolicy(task).blockers, []);
    const git = async (...args: string[]) => execFileAsync("git", args, { cwd: directory });
    await writeFile(join(directory, ".gitignore"), ".agentic/\n");
    const synced = await syncAgentExports(directory, { write: true });
    await git("init", "--quiet");
    await git("add", created.path, "README.md", ".gitignore", ...synced.written);
    await git("-c", "user.name=APK", "-c", "user.email=apk@example.test", "commit", "--quiet", "-m", "Docs fixture");
    await registerAgent(directory, { id: "docs-owner", platform: "codex", model: "test" });
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: task.id, owner: "docs-owner" };
    await claimTask(options);
    await writeFile(join(directory, "README.md"), "# Documentation\n\nClarified docs.\n");
    await git("add", "README.md");
    await git("-c", "user.name=APK", "-c", "user.email=apk@example.test", "commit", "--quiet", "-m", "Clarify docs");
    const missing = await evaluateTaskCompletionGate(options);
    assert.equal(missing.passed, false);
    assert.ok(missing.verification.some((check) => check.result === "missing"));
    const verified = await verifyTask({
      ...options,
      runCommand: async () => { throw new Error("Docs verification must not run application shell tests"); },
    });
    assert.equal(verified.passed, true, JSON.stringify({ diagnostics: verified.diagnostics, checks: verified.checkResults }));
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.passed, true, gate.blockers.join("; "));
    await doneTask(options);
    assert.equal((await loadTaskFile(join(directory, created.path))).task.state, "done");
    assert.match(template.notes.join("\n"), /host repository's documentation\/link\/example checks/);
    assert.match(getTaskTemplate("migration").notes.join("\n"), /non-overlapping final set/);
  });
});

test("automated policy recognizes required builtins but rejects optional and unknown operations", () => {
  const template = getTaskTemplate("docs");
  const task = { ...TASK, risk: template.risk, tags: template.tags, type: template.type, verification: template.verification, verificationCommands: [] };
  assert.deepEqual(resolveTaskPolicy(task).blockers, []);
  for (const check of [
    { ...template.verification[0], required: false },
    { ...template.verification[0], apkOperation: "audit" as TaskApkOperation },
    { ...template.verification[0], apkOperation: undefined },
  ]) {
    assert.ok(resolveTaskPolicy({ ...task, verification: [check] }).blockers.includes("Declare at least one required automated verification check."));
  }
});

test("release template defaults order pre-tag evidence before the immutable tag and separate post-tag evidence", () => {
  const template = getTaskTemplate("release");
  const steps = template.steps.join("\n");
  const acceptance = template.acceptanceCriteria.join("\n");
  const invariants = template.invariants?.join("\n") ?? "";

  assert.match(steps, /PRE-TAG criterion/i);
  assert.match(steps, /exact-SHA hosted CI/i);
  assert.match(steps, /exact candidate SHA\/tree/i);
  assert.ok(
    steps.search(/PRE-TAG criterion/i) < steps.search(/Create the annotated tag/i),
    "pre-tag criteria must be observed before tag creation",
  );
  assert.ok(
    steps.search(/exact-SHA hosted CI/i) < steps.search(/Create the annotated tag/i),
    "exact-SHA hosted CI must be observed before tag creation",
  );
  assert.match(steps, /POST-TAG checks separately/i);
  assert.match(steps, /never backfilled into the release-note file committed inside the tag/i);
  assert.match(acceptance, /all existing tags remain untouched/i);
  assert.match(acceptance, /exact-SHA hosted CI/i);
  assert.match(acceptance, /never moved or rewritten/i);
  assert.match(acceptance, /only pre-tag-knowable facts/i);
  assert.match(invariants, /temporally distinct and never conflated/i);
  assert.match(template.correctnessAssumptions?.join("\n") ?? "", /cannot contain its own commit SHA/i);
  assert.match(template.reviewQuestions?.join("\n") ?? "", /actually run against the exact candidate SHA before tag publication/i);
  assert.match(template.counterexampleSearches?.join("\n") ?? "", /claimed pre-tag/i);
  assert.equal(template.tags.includes("release"), true);
  const releaseSmoke = template.verification.find((check) => check.id === "release-smoke");
  assert.equal(releaseSmoke?.evidenceRef, "release URL, CI run, tag object, or release id");
  assert.equal(releaseSmoke?.evidence, undefined);
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
  assert.equal(medium.requirements.independentReview, false);
  assert.equal(medium.requirements.reviewLevel, "none");
  assert.equal(medium.requirements.assurance, "self-check");
  assert.equal(medium.requirements.evidenceRequired, false);
  assert.deepEqual(medium.blockers, []);
});

test("committed-dist task contract classifies packaged source and copied assets deterministically", async () => {
  assert.equal(isPackagedInputPath("src/cli/index.ts"), true);
  assert.equal(isPackagedInputPath("src/core/templates/minimal-docs/product-requirements.md.hbs"), true);
  assert.equal(isPackagedInputPath("src/core/tasks/unpackaged-template.hbs"), false);
  assert.equal(isPackagedInputPath("src/cli/cli.test.ts"), false);
  assert.equal(isPackagedInputPath("docs/task-system.md"), false);
  assert.equal(mayIncludePackagedSource("src/core/tasks/*.ts"), true);
  assert.equal(mayIncludePackagedSource("src/**/*.test.ts"), false);
  assert.equal(mayIncludePackagedSource("src/core/templates/**/*.hbs"), true);
  assert.equal(mayIncludePackagedSource("src/**/*.hbs"), true);
  assert.equal(mayIncludePackagedSource("src/core/**/*.hbs"), true);
  assert.equal(mayIncludePackagedSource("src/core/tasks/**/*.hbs"), false);
  assert.equal(mayIncludePackagedSource("docs/**"), false);
  assert.equal(taskPathPatternMayMatchDistOutput("dist/core/tasks/**"), true);
  assert.equal(taskPathPatternMayMatchDistOutput("d*/**"), true);
  assert.equal(taskPathPatternMayMatchDistOutput("docs/**"), false);
  assert.equal(taskPathPatternMayMatchDistOutput("dist"), false);

  await withTempDirectory(async (directory) => {
    assert.equal(await repositoryShipsCommittedDist(directory), false);
    await writeFile(join(directory, "package.json"), JSON.stringify({
      files: ["dist"],
      packageManager: "pnpm@10.28.1",
      scripts: { build: "tsc" },
    }), "utf8");
    assert.equal(await repositoryShipsCommittedDist(directory), true);
    assert.deepEqual(await repositoryPackagedDistContract(directory), {
      shipsCommittedDist: true,
      buildScriptAvailable: true,
      buildCommand: "pnpm build",
      checkCommand: PACKAGED_DIST_CHECK_COMMAND,
    });

    await writeFile(join(directory, "package.json"), JSON.stringify({
      files: ["dist"],
      packageManager: "npm@10.0.0",
      scripts: { build: "tsc" },
    }), "utf8");
    const npmContract = await repositoryPackagedDistContract(directory);
    assert.equal(npmContract.shipsCommittedDist, true);
    assert.equal(npmContract.checkCommand, packagedDistCheckCommand("npm run build"));

    await writeFile(join(directory, "package.json"), JSON.stringify({ files: ["dist"] }), "utf8");
    const missingBuild = await repositoryPackagedDistContract(directory);
    assert.equal(missingBuild.shipsCommittedDist, true);
    assert.equal(missingBuild.buildScriptAvailable, false);

    await writeFile(join(directory, "package.json"), JSON.stringify({
      files: ["dist"],
      scripts: { build: "tsc" },
    }), "utf8");
    const missingManager = await repositoryPackagedDistContract(directory);
    assert.equal(missingManager.shipsCommittedDist, true);
    assert.equal(missingManager.checkCommand, undefined);

    await writeFile(join(directory, "package-lock.json"), "{}\n", "utf8");
    const lockfileManager = await repositoryPackagedDistContract(directory);
    assert.equal(lockfileManager.checkCommand, packagedDistCheckCommand("npm run build"));
    await writeFile(join(directory, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
    const ambiguousManager = await repositoryPackagedDistContract(directory);
    assert.equal(ambiguousManager.shipsCommittedDist, true);
    assert.equal(ambiguousManager.checkCommand, undefined);
  });

  const sourceTask: ProjectTask = {
    ...TASK,
    state: "doing",
    allowedFiles: ["src/core/init/index.ts", "dist/**"],
    verificationCommands: [],
    verification: [{
      id: PACKAGED_DIST_CHECK_ID,
      type: "automated",
      required: true,
      environment: "local",
      profile: "deterministic",
      command: PACKAGED_DIST_CHECK_COMMAND,
    }],
  };
  assert.deepEqual(packagedDistTaskContractBlockers(sourceTask), []);

  const docsTask = { ...sourceTask, allowedFiles: ["docs/task-system.md"], verification: [] };
  assert.deepEqual(packagedDistTaskContractBlockers(docsTask), []);

  const contradictory = {
    ...sourceTask,
    allowedFiles: ["src/core/init/index.ts"],
    forbiddenFiles: ["dist/core/tasks/**"],
    verification: [{
      id: "tests",
      type: "automated" as const,
      required: true,
      environment: "local" as const,
      profile: "deterministic" as const,
      command: "pnpm test",
    }],
  };
  assert.equal(packagedDistTaskContractBlockers(contradictory).length, 2);
});

test("package payload detection covers broad files globs, published entrypoints, and invalid metadata", async () => {
  await withTempDirectory(async (directory) => {
    const manifest = {
      packageManager: "npm@10.0.0",
      scripts: { build: "tsc" },
    };
    await writeFile(join(directory, "package.json"), JSON.stringify({ ...manifest, files: ["*"] }), "utf8");
    const broadGlob = await repositoryPackagedDistContract(directory);
    assert.equal(broadGlob.shipsCommittedDist, true);
    assert.equal(broadGlob.checkCommand, packagedDistCheckCommand("npm run build"));

    await writeFile(join(directory, "package.json"), JSON.stringify({
      ...manifest,
      files: ["README.md"],
      main: "./dist/cli/index.js",
    }), "utf8");
    assert.equal((await repositoryPackagedDistContract(directory)).shipsCommittedDist, true);

    await writeFile(join(directory, "package.json"), JSON.stringify({
      ...manifest,
      files: ["README.md"],
      bin: { apk: "dist/cli/index.js" },
    }), "utf8");
    assert.equal((await repositoryPackagedDistContract(directory)).shipsCommittedDist, true);

    await writeFile(join(directory, "package.json"), JSON.stringify({
      ...manifest,
      files: ["README.md"],
      directories: { bin: "dist/cli" },
    }), "utf8");
    assert.equal((await repositoryPackagedDistContract(directory)).shipsCommittedDist, true);

    await mkdir(join(directory, "dist"));
    await writeFile(join(directory, "package.json"), JSON.stringify(manifest), "utf8");
    assert.equal((await repositoryPackagedDistContract(directory)).shipsCommittedDist, true);

    await writeFile(join(directory, "package.json"), JSON.stringify({ ...manifest, files: ["README.md"] }), "utf8");
    assert.equal((await repositoryPackagedDistContract(directory)).shipsCommittedDist, false);

    await writeFile(join(directory, "package.json"), "{ invalid json", "utf8");
    const malformed = await repositoryPackagedDistContract(directory);
    assert.equal(malformed.shipsCommittedDist, true);
    assert.equal(malformed.buildScriptAvailable, false);
  });
});

test("review fields are a coherent projection of canonical assurance", () => {
  const low = resolveTaskPolicy({ ...TASK, risk: "low", tags: ["docs"] });
  assert.equal(low.requirements.assurance, "none");
  assert.equal(low.requirements.independentReview, false);
  assert.equal(low.requirements.reviewLevel, "none");

  const medium = resolveTaskPolicy({ ...TASK, risk: "medium", tags: ["docs"] });
  assert.equal(medium.requirements.assurance, "self-check");
  assert.equal(medium.requirements.independentReview, false);
  assert.equal(medium.requirements.reviewLevel, "none");
  assert.deepEqual(medium.requirements.reviewBudget, {
    maxReviewPasses: 8,
    maxFrontierReviewPasses: 1,
    maxFrontierRuns: 1,
    paidEscalation: false,
  });

  const high = resolveTaskPolicy({ ...TASK, risk: "high", tags: ["docs"] });
  assert.equal(high.requirements.assurance, "fresh-context");
  assert.equal(high.requirements.independentReview, true);
  assert.equal(high.requirements.reviewLevel, "lightweight");

  const critical = resolveTaskPolicy({ ...TASK, risk: "critical", tags: ["docs"] });
  assert.equal(critical.requirements.assurance, "independent");
  assert.equal(critical.requirements.independentReview, true);
  assert.equal(critical.requirements.reviewLevel, "independent");
});

test("escalation triggers raise canonical assurance and the review projection", () => {
  const medium = (tags: string[]) => resolveTaskPolicy({ ...TASK, risk: "medium", tags });

  const security = medium(["security"]);
  assert.equal(security.requirements.assurance, "independent");
  assert.equal(security.requirements.independentReview, true);
  assert.equal(security.requirements.reviewLevel, "independent");

  const migration = medium(["migration"]);
  assert.equal(migration.requirements.assurance, "fresh-context");
  assert.equal(migration.requirements.independentReview, true);
  assert.equal(migration.requirements.reviewLevel, "lightweight");

  const asyncTag = medium(["async"]);
  assert.equal(asyncTag.requirements.assurance, "fresh-context");
  assert.equal(asyncTag.requirements.independentReview, true);

  const workerType = resolveTaskPolicy({ ...TASK, risk: "medium", tags: [], type: "async-worker" });
  assert.equal(workerType.requirements.assurance, "fresh-context");
  assert.equal(workerType.requirements.independentReview, true);

  const integration = medium(["integration"]);
  assert.equal(integration.requirements.assurance, "independent");
  assert.equal(integration.requirements.independentReview, true);
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
  assert.deepEqual(release.declaredEvidenceCategories, ["artifact", "evidence", "live", "report"]);
  assert.deepEqual(release.blockers, []);
  assert.equal(release.requirements.assurance, "independent");
  assert.match(renderTaskPolicy(release), /independent review: independent/);
});

test("benchmark templates explicitly declare a satisfiable benchmark evidence category", () => {
  const template = getTaskTemplate("benchmark");
  const benchmark = {
    ...TASK,
    type: "benchmark",
    risk: "high" as const,
    tags: [],
    verification: template.verification,
    verificationCommands: [],
  };
  const policy = resolveTaskPolicy(benchmark);

  assert.deepEqual(policy.requirements.evidenceCategories, ["benchmark"]);
  assert.deepEqual(policy.declaredEvidenceCategories, ["benchmark"]);
  assert.deepEqual(policy.blockers, []);
  assert.ok(policy.reasons.some((reason) => reason.includes("benchmark-run") && reason.includes("benchmark evidence")));
  assert.match(renderTaskPolicy(policy), /Declared evidence: benchmark/);
  assert.match(renderTaskPolicy(policy), /benchmark-run explicitly declares benchmark evidence/);
  assert.equal(parseTaskMarkdown(renderTaskMarkdown(benchmark)).verification?.[0].evidenceType, "benchmark");
});

test("ordinary benchmark task verification preserves the v0.4.6 unsatisfiable-category reproducer", () => {
  const policy = resolveTaskPolicy({
    ...TASK,
    type: "benchmark",
    risk: "low",
    tags: [],
    verificationCommands: [],
    verification: [{
      id: "ordinary-tests",
      type: "automated",
      required: true,
      environment: "local",
      profile: "deterministic",
      command: "pnpm test",
    }],
  });

  assert.deepEqual(policy.requirements.evidenceCategories, ["benchmark"]);
  assert.deepEqual(policy.declaredEvidenceCategories, []);
  assert.ok(policy.blockers.some((blocker) => blocker === "Evidence category benchmark is required but not declared."));
});

test("benchmark evidence declarations reject unsupported types and non-automated environments", () => {
  for (const check of [
    { id: "bad-type", type: "automated", required: true, environment: "local", profile: "report", command: "pnpm test", evidenceType: "report" },
    { id: "manual", type: "manual", required: true, environment: "local", profile: "report", instruction: "Measure it.", evidenceType: "benchmark" },
    { id: "ci", type: "automated", required: true, environment: "ci", profile: "report", command: "pnpm benchmark", evidenceType: "benchmark" },
  ]) {
    assert.throws(
      () => parseTaskMarkdown(renderTaskMarkdown({ ...TASK, verification: [check as NonNullable<ProjectTask["verification"]>[number]], verificationCommands: [] })),
      TaskFormatError,
    );
  }
});

test("read-only APK operation checks round-trip and reject shell coupling", () => {
  const task = {
    ...TASK,
    verification: [{
      id: "apk-lint",
      type: "automated" as const,
      required: true,
      environment: "local" as const,
      profile: "deterministic" as const,
      apkOperation: "lint" as const,
    }],
    verificationCommands: [],
  };

  const parsed = parseTaskMarkdown(renderTaskMarkdown(task));
  assert.deepEqual(parsed.verification, task.verification);
  assert.throws(
    () => parseTaskMarkdown(renderTaskMarkdown({
      ...TASK,
      verification: [{ ...task.verification[0], command: "pnpm exec apk lint --json" }],
      verificationCommands: [],
    })),
    /command and apkOperation are mutually exclusive/,
  );
  assert.throws(
    () => parseTaskMarkdown(renderTaskMarkdown({
      ...TASK,
      verification: [{ ...task.verification[0], apkOperation: "audit" as "lint" }],
      verificationCommands: [],
    })),
    /apkOperation must be one of/,
  );
});

test("builtin APK verification runs without shell commands and records resolved identity", async () => {
  await withTempDirectory(async (directory) => {
    const task = {
      ...TASK,
      verification: [{
        id: "apk-status",
        type: "automated" as const,
        required: true,
        environment: "local" as const,
        profile: "deterministic" as const,
        apkOperation: "status" as const,
      }],
      verificationCommands: [],
    };
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), task);

    let receivedOperation: string | undefined;
    let shellCalled = false;
    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      changedFiles: ["src/core/tasks/index.ts"],
      runCommand: async () => {
        shellCalled = true;
        return 1;
      },
      runApkOperation: async (_rootDirectory, operation) => {
        receivedOperation = operation;
        return { exitCode: 0, resolvedApkIdentity: "apk-current-process" };
      },
    });

    assert.equal(result.passed, true);
    assert.equal(receivedOperation, "status");
    assert.equal(shellCalled, false);
    assert.deepEqual(result.commandsRun, [{
      command: "builtin:apk/status",
      exitCode: 0,
      apkOperation: "status",
      resolvedApkIdentity: "apk-current-process",
    }]);
    assert.equal(result.checkResults[0]?.resolvedApkIdentity, "apk-current-process");
    const evidence = await readTaskEvidence(directory, "0007");
    assert.equal(evidence[0]?.apkOperation, "status");
    assert.equal(evidence[0]?.resolvedApkIdentity, "apk-current-process");
  });
});

test("default APK operation resolver is path-independent and read-only", async () => {
  await withTempDirectory(async (directory) => {
    const spacedDirectory = join(directory, "repository with spaces");
    await mkdir(spacedDirectory, { recursive: true });
    const before = await readdir(spacedDirectory);
    const result = await runTaskApkOperation(spacedDirectory, "status");
    const after = await readdir(spacedDirectory);

    assert.equal(result.exitCode, 0);
    assert.match(result.resolvedApkIdentity, /^agentic-project-kit@\d+\.\d+\.\d+:current-process$/);
    assert.deepEqual(after, before);
  });
});

test("builtin APK operations ignore unavailable launchers, shims, and spaced roots", async () => {
  await withTempDirectory(async (directory) => {
    const spacedRoot = join(directory, "repository with spaces");
    const shimDirectory = join(directory, "Windows launcher shim with spaces");
    await mkdir(spacedRoot, { recursive: true });
    await mkdir(shimDirectory, { recursive: true });
    await writeFile(join(shimDirectory, "apkit.cmd"), "@echo off\r\necho unexpected > shim-used\r\n", "utf8");
    await writeFile(join(shimDirectory, "apkit.ps1"), "Set-Content shim-used unexpected\n", "utf8");
    const originalPath = process.env.PATH;
    process.env.PATH = shimDirectory;

    try {
      for (const operation of ["lint", "doctor", "sync-check", "status"] as const) {
        const result = await runTaskApkOperation(spacedRoot, operation);
        assert.match(result.resolvedApkIdentity, /^agentic-project-kit@\d+\.\d+\.\d+:current-process$/);
        assert.equal(typeof result.exitCode, "number");
      }
    } finally {
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
    }

    assert.deepEqual(await readdir(spacedRoot), []);
    assert.deepEqual((await readdir(directory)).sort(), ["Windows launcher shim with spaces", "repository with spaces"]);
  });
});

test("builtin APK operation dispatch rejects unsupported runtime values", async () => {
  await withTempDirectory(async (directory) => {
    await assert.rejects(
      () => runTaskApkOperation(directory, "audit" as TaskApkOperation),
      /Unsupported APK task operation: audit/,
    );
  });
});

test("legacy verification commands remain shell-backed after builtin support", async () => {
  await withTempDirectory(async (directory) => {
    const legacy = {
      ...TASK,
      verificationCommands: ["pnpm exec apk lint --json"],
      verification: undefined,
    };
    const parsed = parseTaskMarkdown(renderTaskMarkdown(legacy));
    assert.deepEqual(parsed.verificationCommands, legacy.verificationCommands);
    await writeTaskFile(join(directory, ".tasks", "0007-add-task-system.md"), parsed);

    const commands: string[] = [];
    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      changedFiles: ["src/core/tasks/index.ts"],
      runCommand: async (command) => {
        commands.push(command);
        return 0;
      },
    });

    assert.equal(result.passed, true);
    assert.deepEqual(commands, ["pnpm exec apk lint --json"]);
  });
});

test("optional checks never cancel tag evidence requirements", () => {
  const deployment = resolveTaskPolicy({
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
  assert.equal(deployment.requirements.evidenceRequired, true);
  assert.deepEqual(deployment.requirements.evidenceCategories, ["live"]);
  assert.deepEqual(deployment.declaredEvidenceCategories, []);
  assert.deepEqual(deployment.blockers, [
    "Declare at least one evidence category in verification checks.",
    "Evidence category live is required but not declared.",
  ]);

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
  assert.equal(release.requirements.evidenceRequired, true);
  assert.deepEqual(release.requirements.evidenceCategories, ["live", "report"]);
  assert.deepEqual(release.declaredEvidenceCategories, ["artifact", "ci", "evidence", "report"]);
  assert.deepEqual(release.blockers, ["Evidence category live is required but not declared."]);
});

test("optional-only checks create no evidence requirement of their own", () => {
  const policy = resolveTaskPolicy({
    ...TASK,
    risk: "low",
    tags: ["ci"],
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
        instruction: "Check the live system when available.",
        evidence: "live URL/status",
      },
    ],
  });
  assert.equal(policy.requirements.evidenceRequired, false);
  assert.deepEqual(policy.requirements.evidenceCategories, []);
  assert.deepEqual(policy.declaredEvidenceCategories, []);
  assert.deepEqual(policy.blockers, []);
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
    maxReviewPasses: 10,
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

test("V18: lock reads retry bounded transient Windows contention", async () => {
  const metadata: LocalLockMetadata = {
    schema: 1,
    ownerId: "owner-transient-read",
    kind: "evidence-append-recovery",
    pid: 100,
    hostname: "test-host",
    processStart: "2026-01-01T00:00:00.000Z",
    created: "2026-01-01T00:00:00.000Z",
  };
  let reads = 0;
  const runtime = {
    hostname: "test-host",
    pid: 100,
    processStart: metadata.processStart,
    now: () => Date.parse("2026-01-01T00:00:01.000Z"),
    processLiveness: () => "alive" as const,
    readLockFile: async () => {
      reads += 1;
      if (reads < 3) throw Object.assign(new Error("transient lock contention"), { code: "EPERM" });
      return `${JSON.stringify(metadata)}\n`;
    },
  };

  const inspection = await inspectLocalLock("virtual-lock", runtime);
  assert.equal(inspection.state, "live");
  assert.equal(reads, 3);

  let persistentReads = 0;
  await assert.rejects(
    () => inspectLocalLock("virtual-lock", {
      ...runtime,
      readLockFile: async () => {
        persistentReads += 1;
        throw Object.assign(new Error("persistent lock contention"), { code: "EBUSY" });
      },
    }),
    (error: unknown) => {
      assert.equal((error as NodeJS.ErrnoException).code, "EBUSY");
      return true;
    },
  );
  assert.equal(persistentReads, 4);
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
      tags: [...TASK.tags, "large"],
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

test("NUL-delimited Git path discovery preserves whitespace and newline filenames", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const claimedBaseline = await readTaskBaseline(directory, "0007");
    assert.ok(claimedBaseline);

    const paths = ["src/core/tasks/trailing-space.ts ", "src/core/tasks/line\nbreak.ts"];
    for (const path of paths) {
      await writeFile(join(directory, path), "unusual path\n", "utf8");
      await execFileAsync("git", ["add", "--", path], { cwd: directory });
    }
    await execFileAsync("git", ["commit", "--quiet", "-m", "unusual paths"], { cwd: directory });

    const currentBaseline = await readTaskBaseline(directory, "0007");
    assert.ok(currentBaseline);
    const changedFiles = await listTaskChangedFilesSinceBaseline(directory, currentBaseline);
    assert.ok(paths.every((path) => changedFiles.includes(path)));
    const { task } = await loadTaskFile(join(directory, ".tasks", "0007-scoped-task.md"));
    const snapshot = await captureTaskScope({ rootDirectory: directory, task, baseline: currentBaseline });
    assert.equal(snapshot.comparisonKnown, true);
    assert.ok(paths.every((path) => snapshot.attribution?.attributedFiles.includes(path)));
    assert.deepEqual(snapshot.outOfScopeFiles, ["src/core/tasks/line\nbreak.ts"]);
  });
});

test("Git paths with literal backslashes fail scope closed instead of aliasing slash paths", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const path = "src/core/tasks/alias\\outside.ts";
    await writeFile(join(directory, path), "literal backslash path\n", "utf8");
    await execFileAsync("git", ["add", "--", path], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "literal backslash path"], { cwd: directory });

    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.ok(result.diagnostics.some((diagnostic) => /backslash.*cannot be attributed safely/i.test(diagnostic)));
  });
});

test("scope and candidate capture fail closed when HEAD moves after lineage resolution", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const staleBaseline = await readTaskBaseline(directory, "0007");
    assert.ok(staleBaseline?.lineageHeadSha);
    const { task } = await loadTaskFile(join(directory, ".tasks", "0007-scoped-task.md"));

    await writeFile(join(directory, "src", "core", "tasks", "after-lineage.ts"), "in-scope anonymous commit\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/after-lineage.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "anonymous in-scope change"], { cwd: directory });

    const snapshot = await captureTaskScope({ rootDirectory: directory, task, baseline: staleBaseline });
    assert.equal(snapshot.comparisonKnown, false);
    assert.ok(snapshot.diagnostics.some((diagnostic) => /HEAD changed.*after lineage evaluation/i.test(diagnostic)));
    await assert.rejects(
      captureTaskEvidenceSubject(directory, task, snapshot.changedFiles, staleBaseline),
      /HEAD changed.*after lineage evaluation/i,
    );
  });
});

test("verification cannot pass when an anonymous commit arrives during a check", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const result = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      runCommand: async () => {
        await writeFile(join(directory, "src", "core", "tasks", "during-check.ts"), "anonymous commit\n", "utf8");
        await execFileAsync("git", ["add", "src/core/tasks/during-check.ts"], { cwd: directory });
        await execFileAsync("git", ["commit", "--quiet", "-m", "anonymous commit during verification"], { cwd: directory });
        return 0;
      },
    });

    assert.equal(result.passed, false);
    assert.ok(result.diagnostics.some((diagnostic) => /HEAD changed.*after lineage evaluation/i.test(diagnostic)));
    const evidence = await readTaskEvidence(directory, "0007");
    assert.equal(evidence.at(-1)?.result, "fail");
    assert.equal(evidence.at(-1)?.gateEligible, false);
  });
});

async function setupReclaimRepo(directory: string): Promise<void> {
  const git = async (...args: string[]) => {
    await execFileAsync("git", args, { cwd: directory });
  };
  await git("init", "--quiet");
  await git("config", "user.email", "codex@example.test");
  await git("config", "user.name", "Codex");
  await mkdir(join(directory, ".tasks"), { recursive: true });
  await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
  await mkdir(join(directory, "secrets"), { recursive: true });
  await mkdir(join(directory, "docs", "task-b"), { recursive: true });
  await writeFile(join(directory, "secrets", "config.txt"), "clean\n", "utf8");
  await writeTaskFile(join(directory, ".tasks", "0007-scoped-task.md"), {
    ...TASK,
    risk: "low",
    dependsOn: [],
    allowedFiles: ["src/core/tasks/**"],
    forbiddenFiles: ["secrets/**"],
    verificationCommands: [],
    verification: [
      { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
    ],
  });
  await writeTaskFile(join(directory, ".tasks", "0008-bounded-task.md"), {
    ...TASK,
    id: "0008",
    title: "Bounded Task B",
    risk: "low",
    dependsOn: [],
    allowedFiles: ["docs/task-b/**", "tooling/**"],
    forbiddenFiles: [],
    verificationCommands: [],
    verification: [
      { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
    ],
  });
  await git("add", ".");
  await git("commit", "--quiet", "-m", "initial");
  await registerAgent(directory, { id: "agent-a", developer: "alice", platform: "opencode", model: "m1" });
  await registerAgent(directory, { id: "agent-b", developer: "bob", platform: "opencode", model: "m1" });
}

async function completeBoundedTaskB(
  directory: string,
  options: {
    path?: string;
    contents?: string;
    author?: string;
    owner?: string;
    afterDone?: (candidateSha: string) => Promise<void>;
  } = {},
): Promise<{ candidateSha: string; bookkeepingSha: string; file: string }> {
  const file = options.path ?? "docs/task-b/change.md";
  const owner = options.owner ?? "agent-b";
  await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
  const parent = file.split("/").slice(0, -1).join("/");
  await mkdir(join(directory, parent), { recursive: true });
  await writeFile(join(directory, file), options.contents ?? "task B change\n", "utf8");
  await execFileAsync("git", ["add", file], { cwd: directory });
  await execFileAsync("git", [
    ...(options.author ? ["-c", `user.name=${options.author}`, "-c", "user.email=external@example.test"] : []),
    "commit", "--quiet", "-m", "ordinary commit text",
  ], { cwd: directory });
  const candidateSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
  const verification = await verifyTask({
    rootDirectory: directory,
    taskDirectory: ".tasks",
    taskId: "0008",
    owner,
    runCommand: async () => 0,
  });
  assert.equal(verification.passed, true, verification.diagnostics.join("; "));
  await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
  await options.afterDone?.(candidateSha);
  await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
  await execFileAsync("git", ["commit", "--quiet", "-m", "completion bookkeeping"], { cwd: directory });
  const bookkeepingSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
  return { candidateSha, bookkeepingSha, file };
}

async function completeTaskBChain(
  directory: string,
  options: {
    commitCount?: number;
    includeTaskFileInFirstCommit?: boolean;
    addCompletionNote?: boolean;
  } = {},
): Promise<{ firstSha: string; candidateSha: string; bookkeepingSha: string; chainShas: string[]; files: string[] }> {
  const commitCount = options.commitCount ?? 1;
  const owner = "agent-b";
  await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
  const files: string[] = [];
  const chainShas: string[] = [];
  for (let index = 0; index < commitCount; index += 1) {
    const file = `docs/task-b/change-${index + 1}.md`;
    files.push(file);
    await writeFile(join(directory, file), `task B change ${index + 1}\n`, "utf8");
    await execFileAsync("git", ["add", file], { cwd: directory });
    if (options.includeTaskFileInFirstCommit && index === 0) {
      await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
    }
    await execFileAsync("git", ["commit", "--quiet", "-m", "ordinary commit text"], { cwd: directory });
    chainShas.push((await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim());
  }
  const firstSha = chainShas[0]!;
  const candidateSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
  const verification = await verifyTask({
    rootDirectory: directory,
    taskDirectory: ".tasks",
    taskId: "0008",
    owner,
    runCommand: async () => 0,
  });
  assert.equal(verification.passed, true, verification.diagnostics.join("; "));
  await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
  if (options.addCompletionNote) {
    const taskPath = join(directory, ".tasks", "0008-bounded-task.md");
    const taskMarkdown = await readFile(taskPath, "utf8");
    await writeFile(taskPath, taskMarkdown.replace("\n## Notes\n", "\n## Notes\n- Completion evidence note.\n"), "utf8");
  }
  await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
  await execFileAsync("git", ["commit", "--quiet", "-m", "completion bookkeeping"], { cwd: directory });
  const bookkeepingSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
  return { firstSha, candidateSha, bookkeepingSha, chainShas, files };
}

async function setupReclaimRepoWithUntrackedTaskB(directory: string): Promise<void> {
  const git = async (...args: string[]) => {
    await execFileAsync("git", args, { cwd: directory });
  };
  await git("init", "--quiet");
  await git("config", "user.email", "codex@example.test");
  await git("config", "user.name", "Codex");
  await mkdir(join(directory, ".tasks"), { recursive: true });
  await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
  await mkdir(join(directory, "secrets"), { recursive: true });
  await mkdir(join(directory, "docs", "task-b"), { recursive: true });
  await writeFile(join(directory, "secrets", "config.txt"), "clean\n", "utf8");
  await writeTaskFile(join(directory, ".tasks", "0007-scoped-task.md"), {
    ...TASK,
    risk: "low",
    dependsOn: [],
    allowedFiles: ["src/core/tasks/**"],
    forbiddenFiles: ["secrets/**"],
    verificationCommands: [],
    verification: [
      { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
    ],
  });
  await git("add", ".");
  await git("commit", "--quiet", "-m", "initial");
  await writeTaskFile(join(directory, ".tasks", "0008-bounded-task.md"), {
    ...TASK,
    id: "0008",
    title: "Bounded Task B",
    risk: "low",
    dependsOn: [],
    allowedFiles: ["docs/task-b/**", "tooling/**"],
    forbiddenFiles: [],
    verificationCommands: [],
    verification: [
      { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
    ],
  });
  await registerAgent(directory, { id: "agent-a", developer: "alice", platform: "opencode", model: "m1" });
  await registerAgent(directory, { id: "agent-b", developer: "bob", platform: "opencode", model: "m1" });
}

async function completeTypeOnlyTaskB(directory: string, file: string): Promise<void> {
  const owner = "agent-b";
  await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
  await rm(join(directory, file));
  await symlink("target", join(directory, file));
  await execFileAsync("git", ["add", file], { cwd: directory });
  await execFileAsync("git", ["commit", "--quiet", "-m", "type-only candidate"], { cwd: directory });
  const verification = await verifyTask({
    rootDirectory: directory,
    taskDirectory: ".tasks",
    taskId: "0008",
    owner,
    runCommand: async () => 0,
  });
  assert.equal(verification.passed, true, verification.diagnostics.join("; "));
  await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
  await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
  await execFileAsync("git", ["commit", "--quiet", "-m", "type-only completion bookkeeping"], { cwd: directory });
}

test("claim re-render preserves multiline prose contract text", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    const taskPath = join(directory, ".tasks", "0007-scoped-task.md");
    const { task } = await loadTaskFile(taskPath);
    const multilineTask: ProjectTask = {
      ...task,
      acceptanceCriteria: ["First paragraph.\nSecond paragraph.\n\nThird paragraph."],
      requiredEvidence: ["A claim-style rewrite.\n- Nested evidence note."],
      notes: ["Keep this entire contract item.\n  Keep its indentation too."],
    };
    await writeTaskFile(taskPath, multilineTask);

    const claimed = await claimTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
    });
    const persisted = (await loadTaskFile(taskPath)).task;

    assert.equal(claimed.state, "doing");
    assert.deepEqual(claimed.acceptanceCriteria, multilineTask.acceptanceCriteria);
    assert.deepEqual(claimed.requiredEvidence, multilineTask.requiredEvidence);
    assert.deepEqual(claimed.notes, multilineTask.notes);
    assert.deepEqual(persisted.acceptanceCriteria, multilineTask.acceptanceCriteria);
    assert.deepEqual(persisted.requiredEvidence, multilineTask.requiredEvidence);
    assert.deepEqual(persisted.notes, multilineTask.notes);
  });
});

test("claim rejects multiline path and verification entries without changing task bytes", async () => {
  const cases = [
    ["Context files", "continued-context", /Section "Context files".*single physical list line/],
    ["Files allowed to edit", "continued-allowed-path", /Section "Files allowed to edit".*single physical list line/],
    ["Files forbidden to edit", "continued-forbidden-path", /Section "Files forbidden to edit".*single physical list line/],
    ["Verification", "continued-verification", /Section "Verification".*single physical list line/],
  ] as const;

  for (const [section, continuation, error] of cases) {
    await withTempDirectory(async (directory) => {
      await setupReclaimRepo(directory);
      const taskPath = join(directory, ".tasks", "0007-scoped-task.md");
      const original = await readFile(taskPath, "utf8");
      const sectionStart = original.indexOf(`## ${section}\n\n`);
      assert.notEqual(sectionStart, -1, `${section} section should exist`);
      const itemStart = sectionStart + `## ${section}\n\n`.length;
      const itemEnd = original.indexOf("\n", itemStart);
      const malformed = `${original.slice(0, itemEnd)}\n  ${continuation}${original.slice(itemEnd)}`;
      await writeFile(taskPath, malformed, "utf8");

      await assert.rejects(
        () => claimTask({
          rootDirectory: directory,
          taskDirectory: ".tasks",
          taskId: "0007",
          owner: "agent-a",
        }),
        error,
      );
      assert.equal(await readFile(taskPath, "utf8"), malformed);
    });
  }
});

function verifyScopedTask(directory: string, owner = "agent-a") {
  return verifyTask({
    rootDirectory: directory,
    taskDirectory: ".tasks",
    taskId: "0007",
    owner,
    checkFilesOnly: true,
  });
}

test("release and reclaim cannot launder a task-created dirty out-of-scope file", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await mkdir(join(directory, "src", "bootstrap"), { recursive: true });
    await writeFile(join(directory, "src", "bootstrap", "setup.ts"), "bootstrap\n", "utf8");

    const first = await verifyScopedTask(directory);
    assert.equal(first.passed, false);
    assert.deepEqual(first.outOfScopeFiles, ["src/bootstrap/setup.ts"]);

    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const second = await verifyScopedTask(directory);
    assert.equal(second.passed, false);
    assert.deepEqual(second.outOfScopeFiles, ["src/bootstrap/setup.ts"]);
    assert.deepEqual(second.attribution?.preExistingFiles, []);
    assert.ok(second.attribution?.attributedFiles.includes("src/bootstrap/setup.ts"));
  });
});

test("release and reclaim cannot launder a committed out-of-scope change", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await mkdir(join(directory, "src", "bootstrap"), { recursive: true });
    await writeFile(join(directory, "src", "bootstrap", "setup.ts"), "bootstrap\n", "utf8");
    await execFileAsync("git", ["add", "src/bootstrap/setup.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "out-of-scope"], { cwd: directory });

    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.deepEqual(result.outOfScopeFiles, ["src/bootstrap/setup.ts"]);
  });
});

test("release and reclaim keeps files that were dirty before the first claim pre-existing", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await writeFile(join(directory, "secrets", "config.txt"), "preexisting\n", "utf8");
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, true);
    assert.deepEqual(result.attribution?.preExistingFiles, ["secrets/config.txt"]);
    assert.deepEqual(result.attribution?.attributedFiles, []);
  });
});

test("different-owner reclaim preserves the authoritative baseline and attribution", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const authoritative = await readTaskBaseline(directory, "0007");
    await writeFile(join(directory, "src", "core", "tasks", "new.ts"), "new\n", "utf8");
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-b" });

    const afterReclaim = await readTaskBaseline(directory, "0007");
    assert.equal(afterReclaim?.baselineId, authoritative?.baselineId);

    const result = await verifyScopedTask(directory, "agent-b");
    assert.equal(result.passed, true);
    assert.ok(result.attribution?.attributedFiles.includes("src/core/tasks/new.ts"));
  });
});

test("block then release then claim does not reset attribution", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await writeFile(join(directory, "src", "core", "tasks", "new.ts"), "new\n", "utf8");
    await blockTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const result = await verifyScopedTask(directory);
    assert.ok(result.attribution?.attributedFiles.includes("src/core/tasks/new.ts"));
  });
});

test("intervening unrelated commits after release fail scope closed", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    await writeFile(join(directory, "src", "core", "tasks", "unrelated.ts"), "unrelated\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/unrelated.ts"], { cwd: directory });
    await execFileAsync("git", [
      "-c", "user.name=Different Author", "-c", "user.email=other@example.test",
      "commit", "--quiet", "-m", "Task 0008 completion bookkeeping",
    ], { cwd: directory });
    const anonymousSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.deepEqual(baseline?.provenOtherTaskCommits ?? [], []);
    assert.ok(baseline?.lineageDiagnostic?.includes(anonymousSha.slice(0, 12)));

    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.ok(result.diagnostics.some((diagnostic) => /advanced|intervening|ambiguous/i.test(diagnostic)));
  });
});

test("proven task candidate and terminal bookkeeping commits are excluded after release", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const commits = await completeBoundedTaskB(directory, { author: "Different Author" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed");
    assert.deepEqual(baseline?.provenOtherTaskCommits?.map(({ sha, taskId, kind }) => ({ sha, taskId, kind })), [
      { sha: commits.candidateSha, taskId: "0008", kind: "task-candidate" },
      { sha: commits.bookkeepingSha, taskId: "0008", kind: "completion-bookkeeping" },
    ]);

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, true);
    assert.deepEqual(verified.changedFiles, []);
    assert.deepEqual(verified.attribution?.excludedFiles, [".tasks/0008-bounded-task.md", commits.file]);

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    const provenance = await buildTaskProvenance(directory, ".tasks", "0007");
    assert.deepEqual(gate.attribution, verified.attribution);
    assert.deepEqual(provenance.scopeAttribution, verified.attribution);
    assert.equal(gate.subject.baselineId, verified.subject.baselineId);
    assert.equal(gate.subject.candidateId, verified.subject.candidateId);
    assert.equal(gate.subject.worktreeId, verified.subject.worktreeId);
    assert.equal(provenance.currentSubject.baselineId, verified.subject.baselineId);
    assert.equal(provenance.currentSubject.candidateId, verified.subject.candidateId);
    assert.equal(provenance.currentSubject.worktreeId, verified.subject.worktreeId);
    assert.match(renderTaskVerifyResult(verified), new RegExp(commits.candidateSha.slice(0, 12)));
    assert.match(renderTaskProvenance(provenance), new RegExp(commits.bookkeepingSha.slice(0, 12)));
    assert.match(renderTaskCompletionGate(gate), new RegExp(commits.candidateSha.slice(0, 12)));
  });
});

test("a task baseline at another candidate HEAD can attribute its later bookkeeping commit", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    const commits = await completeBoundedTaskB(directory, {
      afterDone: async (candidateSha) => {
        const head = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
        assert.equal(head, candidateSha);
        await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
      },
    });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed");
    assert.deepEqual(baseline?.provenOtherTaskCommits?.map(({ sha, taskId, kind }) => ({ sha, taskId, kind })), [
      { sha: commits.bookkeepingSha, taskId: "0008", kind: "completion-bookkeeping" },
    ]);
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, true);
    assert.deepEqual(result.changedFiles, []);
    assert.deepEqual(result.attribution?.excludedFiles, [".tasks/0008-bounded-task.md"]);
  });
});

test("completed multi-commit task chain is excluded from a stale baseline scope", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const commits = await completeTaskBChain(directory, { commitCount: 2 });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed");
    assert.deepEqual(baseline?.provenOtherTaskCommits?.map(({ sha, taskId, kind }) => ({ sha, taskId, kind })), [
      { sha: commits.firstSha, taskId: "0008", kind: "task-candidate" },
      { sha: commits.candidateSha, taskId: "0008", kind: "task-candidate" },
      { sha: commits.bookkeepingSha, taskId: "0008", kind: "completion-bookkeeping" },
    ]);

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, true, verified.diagnostics.join("; "));
    assert.deepEqual(verified.changedFiles, []);
    assert.deepEqual(
      verified.attribution?.excludedFiles?.sort(),
      [...commits.files, ".tasks/0008-bounded-task.md"].sort(),
    );
  });
});

test("completed task with a first-commit task file is excluded from a stale baseline scope", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepoWithUntrackedTaskB(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const commits = await completeTaskBChain(directory, { commitCount: 1, includeTaskFileInFirstCommit: true });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed");
    assert.deepEqual(baseline?.provenOtherTaskCommits?.map(({ sha, taskId, kind }) => ({ sha, taskId, kind })), [
      { sha: commits.candidateSha, taskId: "0008", kind: "task-candidate" },
      { sha: commits.bookkeepingSha, taskId: "0008", kind: "completion-bookkeeping" },
    ]);

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, true, verified.diagnostics.join("; "));
    assert.deepEqual(verified.changedFiles, []);
    assert.deepEqual(
      verified.attribution?.excludedFiles?.sort(),
      [...commits.files, ".tasks/0008-bounded-task.md"].sort(),
    );
  });
});

test("completed first-commit task chain accepts terminal completion notes", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepoWithUntrackedTaskB(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const commits = await completeTaskBChain(directory, {
      commitCount: 1,
      includeTaskFileInFirstCommit: true,
      addCompletionNote: true,
    });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed", baseline?.lineageDiagnostic);
    assert.deepEqual(baseline?.provenOtherTaskCommits?.map(({ sha, taskId, kind }) => ({ sha, taskId, kind })), [
      { sha: commits.candidateSha, taskId: "0008", kind: "task-candidate" },
      { sha: commits.bookkeepingSha, taskId: "0008", kind: "completion-bookkeeping" },
    ]);

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, true, verified.diagnostics.join("; "));
    assert.deepEqual(verified.changedFiles, []);
  });
});

test("multi-commit and first-commit task chains are excluded together from a stale baseline scope", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      return execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
    await mkdir(join(directory, "secrets"), { recursive: true });
    await mkdir(join(directory, "docs", "task-b"), { recursive: true });
    await mkdir(join(directory, "extra"), { recursive: true });
    await writeFile(join(directory, "secrets", "config.txt"), "clean\n", "utf8");
    await writeTaskFile(join(directory, ".tasks", "0007-scoped-task.md"), {
      ...TASK,
      risk: "low",
      dependsOn: [],
      allowedFiles: ["src/core/tasks/**"],
      forbiddenFiles: ["secrets/**"],
      verificationCommands: [],
      verification: [
        { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
      ],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await writeTaskFile(join(directory, ".tasks", "0008-bounded-task.md"), {
      ...TASK,
      id: "0008",
      title: "Bounded Task B",
      risk: "low",
      dependsOn: [],
      allowedFiles: ["docs/task-b/**", "tooling/**"],
      forbiddenFiles: [],
      verificationCommands: [],
      verification: [
        { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
      ],
    });
    await writeTaskFile(join(directory, ".tasks", "0009-bounded-task-c.md"), {
      ...TASK,
      id: "0009",
      title: "Bounded Task C",
      risk: "low",
      dependsOn: [],
      allowedFiles: ["extra/**"],
      forbiddenFiles: [],
      verificationCommands: [],
      verification: [
        { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
      ],
    });
    await registerAgent(directory, { id: "agent-a", developer: "alice", platform: "opencode", model: "m1" });
    await registerAgent(directory, { id: "agent-b", developer: "bob", platform: "opencode", model: "m1" });

    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const chain = await completeTaskBChain(directory, { commitCount: 4, includeTaskFileInFirstCommit: true });

    const owner = "agent-b";
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0009", owner });
    await writeFile(join(directory, "extra", "change.md"), "task C change\n", "utf8");
    await git("add", "extra/change.md", ".tasks/0009-bounded-task-c.md");
    await git("commit", "--quiet", "-m", "ordinary commit text");
    const candidateC = (await git("rev-parse", "HEAD")).stdout.trim();
    const verificationC = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0009",
      owner,
      runCommand: async () => 0,
    });
    assert.equal(verificationC.passed, true, verificationC.diagnostics.join("; "));
    await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0009", owner });
    await git("add", ".tasks/0009-bounded-task-c.md");
    await git("commit", "--quiet", "-m", "completion bookkeeping");
    const bookkeepingC = (await git("rev-parse", "HEAD")).stdout.trim();

    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed", baseline?.lineageDiagnostic);
    assert.deepEqual(
      baseline?.provenOtherTaskCommits?.map(({ sha, taskId, kind }) => ({ sha, taskId, kind })),
      [
        ...chain.chainShas.map((sha) => ({ sha, taskId: "0008", kind: "task-candidate" })),
        { sha: chain.bookkeepingSha, taskId: "0008", kind: "completion-bookkeeping" },
        { sha: candidateC, taskId: "0009", kind: "task-candidate" },
        { sha: bookkeepingC, taskId: "0009", kind: "completion-bookkeeping" },
      ],
    );

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, true, verified.diagnostics.join("; "));
    assert.deepEqual(verified.changedFiles, []);
    assert.ok(verified.attribution?.excludedFiles?.includes(".tasks/0008-bounded-task.md"));
    assert.ok(verified.attribution?.excludedFiles?.includes(".tasks/0009-bounded-task-c.md"));
    assert.ok(verified.attribution?.excludedFiles?.includes("extra/change.md"));
  });
});

test("chain commit that temporarily touched an out-of-scope path is not proven", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const owner = "agent-b";
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
    await writeFile(join(directory, "docs", "task-b", "change-1.md"), "task B change 1\n", "utf8");
    await writeFile(join(directory, "src", "core", "tasks", "borrowed.ts"), "borrowed\n", "utf8");
    await execFileAsync("git", ["add", "docs/task-b/change-1.md", "src/core/tasks/borrowed.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "ordinary commit text"], { cwd: directory });
    await writeFile(join(directory, "docs", "task-b", "change-2.md"), "task B change 2\n", "utf8");
    await execFileAsync("git", ["rm", "--quiet", "src/core/tasks/borrowed.ts"], { cwd: directory });
    await execFileAsync("git", ["add", "docs/task-b/change-2.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "ordinary commit text"], { cwd: directory });
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner,
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true, verification.diagnostics.join("; "));
    await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
    await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "completion bookkeeping"], { cwd: directory });

    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "clean", baseline?.lineageDiagnostic);
    assert.deepEqual(baseline?.provenOtherTaskCommits ?? [], []);

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, false);
    assert.ok(verified.outOfScopeFiles.includes("docs/task-b/change-1.md"));
    assert.ok(verified.outOfScopeFiles.includes("docs/task-b/change-2.md"));
  });
});

test("chain with a non-lifecycle task-file edit is not proven", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const owner = "agent-b";
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
    await writeFile(join(directory, "docs", "task-b", "change-1.md"), "task B change 1\n", "utf8");
    await execFileAsync("git", ["add", "docs/task-b/change-1.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "ordinary commit text"], { cwd: directory });
    const taskPath = join(directory, ".tasks", "0008-bounded-task.md");
    const rewritten = (await readFile(taskPath, "utf8")).replace("Bounded Task B", "Renamed Task B");
    await writeFile(taskPath, rewritten, "utf8");
    await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "rename task contract"], { cwd: directory });
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner,
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true, verification.diagnostics.join("; "));
    await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner });
    await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "completion bookkeeping"], { cwd: directory });

    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "clean", baseline?.lineageDiagnostic);
    assert.deepEqual(baseline?.provenOtherTaskCommits ?? [], []);

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, false);
    assert.ok(verified.outOfScopeFiles.includes("docs/task-b/change-1.md"));
  });
});

test("overlapping completed task chains fail closed as ambiguous", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    const taskCPath = join(directory, ".tasks", "0009-bounded-task-c.md");
    await writeTaskFile(taskCPath, {
      ...TASK,
      id: "0009",
      title: "Bounded Task C",
      risk: "low",
      dependsOn: [],
      allowedFiles: ["docs/task-b/**", "extra/**", ".tasks/0008-bounded-task.md"],
      forbiddenFiles: [],
      verificationCommands: [],
      verification: [
        { id: "check", type: "automated", required: true, environment: "local", profile: "deterministic", command: "true" },
      ],
    });
    await execFileAsync("git", ["add", ".tasks/0009-bounded-task-c.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "add task c contract"], { cwd: directory });

    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0009", owner: "agent-b" });

    await completeTaskBChain(directory, { commitCount: 2 });
    await mkdir(join(directory, "extra"), { recursive: true });
    await writeFile(join(directory, "extra", "change.md"), "task C change\n", "utf8");
    await execFileAsync("git", ["add", "extra/change.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "ordinary commit text"], { cwd: directory });
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0009",
      owner: "agent-b",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true, verification.diagnostics.join("; "));
    await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0009", owner: "agent-b" });
    await execFileAsync("git", ["add", ".tasks/0009-bounded-task-c.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "completion bookkeeping"], { cwd: directory });
    const bookkeepingC = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();

    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    const proven = baseline?.provenOtherTaskCommits ?? [];
    assert.ok(proven.some((entry) => entry.taskId === "0009" && entry.kind === "task-candidate"));
    assert.ok(proven.some((entry) => entry.sha === bookkeepingC && entry.taskId === "0009" && entry.kind === "completion-bookkeeping"));
    assert.ok(!proven.some((entry) => entry.taskId === "0008"), "ambiguous shared commits must not be attributed to task 0008");

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, false);
    assert.ok(verified.outOfScopeFiles.includes("docs/task-b/change-1.md"));
    assert.ok(verified.outOfScopeFiles.includes("docs/task-b/change-2.md"));
  });
});

test("a dirty file introduced during release keeps reclaim lineage ambiguous", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await completeBoundedTaskB(directory);
    await writeFile(join(directory, "src", "core", "tasks", "released-dirty.ts"), "changed while released\n", "utf8");
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /released-dirty\.ts.*changed while the task was released/i);
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.equal(result.attribution?.lineageStatus, "intervening");
  });
});

test("active task keeps its own earlier commit and excludes a later proven task candidate", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await writeFile(join(directory, "secrets", "config.txt"), "pre-existing dirty\n", "utf8");
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await writeFile(join(directory, "src", "core", "tasks", "owned.ts"), "owned by A\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/owned.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "candidate work"], { cwd: directory });
    await completeBoundedTaskB(directory);

    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, true);
    assert.deepEqual(result.outOfScopeFiles, []);
    assert.deepEqual(result.attribution?.attributedFiles, ["src/core/tasks/owned.ts"]);
    assert.deepEqual(result.attribution?.preExistingFiles, ["secrets/config.txt"]);
    assert.ok(result.attribution?.excludedFiles.includes("docs/task-b/change.md"));
  });
});

test("dirty changes to an excluded file after lineage resolution fail scope closed", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const commits = await completeBoundedTaskB(directory);
    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed");

    await writeFile(join(directory, commits.file), "edited after lineage resolution\n", "utf8");
    const { task } = await loadTaskFile(join(directory, ".tasks", "0007-scoped-task.md"));
    const snapshot = await captureTaskScope({ rootDirectory: directory, task, baseline });
    assert.equal(snapshot.comparisonKnown, false);
    assert.ok(snapshot.diagnostics.some((diagnostic) => /working-tree file .*overlaps an excluded task commit/i.test(diagnostic)));
  });
});

test("another task cannot launder active task dirty work by adopting it as pre-existing", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await writeFile(join(directory, "docs", "task-b", "change.md"), "created by active task A\n", "utf8");
    await completeBoundedTaskB(directory, { contents: "committed by task B\n" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /includes docs\/task-b\/change\.md.*already dirty at that task's baseline/i);
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.equal(result.attribution?.lineageStatus, "intervening");
  });
});

test("a proven unrelated commit cannot hide task A's committed scope violation", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await writeFile(join(directory, "secrets", "config.txt"), "A changed forbidden file\n", "utf8");
    await execFileAsync("git", ["add", "secrets/config.txt"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "out of scope"], { cwd: directory });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const commits = await completeBoundedTaskB(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.deepEqual(result.outOfScopeFiles, ["secrets/config.txt"]);
    assert.ok(result.attribution?.excludedFiles.includes(commits.file));
  });
});

test("a tooling change is excluded only when its commit has bounded task provenance", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const toolingCommit = await completeBoundedTaskB(directory, { path: "tooling/apk-core.ts" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, true);
    assert.ok(result.attribution?.excludedCommits.some((commit) => commit.sha === toolingCommit.candidateSha));
    assert.ok(result.attribution?.excludedFiles.includes(toolingCommit.file));
  });
});

test("same-file overlap between task A history and a proven task B commit fails closed", async () => {
  for (const owner of ["agent-a", "agent-b"]) {
    await withTempDirectory(async (directory) => {
      await setupReclaimRepo(directory);
      await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
      await writeFile(join(directory, "docs", "task-b", "change.md"), "A touched this first\n", "utf8");
      await execFileAsync("git", ["add", "docs/task-b/change.md"], { cwd: directory });
      await execFileAsync("git", ["commit", "--quiet", "-m", "A commit"], { cwd: directory });
      await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
      await completeBoundedTaskB(directory, { contents: "B changed the same file\n", owner });
      await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

      const baseline = await readTaskBaseline(directory, "0007");
      assert.equal(baseline?.lineageStatus, "intervening");
      assert.match(baseline?.lineageDiagnostic ?? "", /overlap.*docs\/task-b\/change\.md/i);
      const result = await verifyScopedTask(directory);
      assert.equal(result.passed, false);
      assert.equal(result.attribution?.lineageStatus, "intervening");
    });
  }
});

test("merge history between release and reclaim has a bounded fail-closed diagnostic", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const baseBranch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "side"], { cwd: directory });
    await writeFile(join(directory, "src", "core", "tasks", "side.ts"), "side\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/side.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "side"], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
    await writeFile(join(directory, "src", "core", "tasks", "main.ts"), "main\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/main.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "main"], { cwd: directory });
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", "side", "-m", "merge"], { cwd: directory });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /merge|unproven|proven.*fails closed/i);
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.equal(result.attribution?.lineageStatus, "intervening");
  });
});

test("a clean merge of independently proven task history is attributed without blocking scope", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const baseBranch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "proven-side"], { cwd: directory });
    const completed = await completeBoundedTaskB(directory);
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", "proven-side", "-m", "merge proven task"], { cwd: directory });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed");
    assert.deepEqual(baseline?.provenOtherTaskCommits?.map(({ sha, taskId, kind }) => ({ sha, taskId, kind })), [
      { sha: completed.candidateSha, taskId: "0008", kind: "task-candidate" },
      { sha: completed.bookkeepingSha, taskId: "0008", kind: "completion-bookkeeping" },
    ]);
    assert.equal(baseline?.mergeCommits?.length, 1);
    assert.equal(baseline?.mergeCommits?.[0]?.parents.length, 2);
    assert.ok(baseline?.mergeCommits?.[0]?.files.includes(completed.file));

    const verified = await verifyScopedTask(directory);
    assert.equal(verified.passed, true, verified.diagnostics.join("; "));
    assert.deepEqual(verified.changedFiles, []);
    assert.deepEqual(verified.attribution?.mergeCommits, baseline?.mergeCommits);
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    const provenance = await buildTaskProvenance(directory, ".tasks", "0007");
    assert.deepEqual(gate.attribution?.mergeCommits, baseline?.mergeCommits);
    assert.deepEqual(provenance.scopeAttribution?.mergeCommits, baseline?.mergeCommits);
    assert.match(renderTaskVerifyResult(verified), /merge .*parents=.*inherited-from=/i);
    assert.match(renderTaskCompletionGate(gate), /merge .*parents=.*inherited-from=/i);
    assert.match(renderTaskProvenance(provenance), /merge .*parents=.*inherited-from=/i);
  });
});

test("a clean merge uses the bounded task range instead of repository-wide ancestry", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    for (let index = 0; index < 140; index += 1) {
      await writeFile(join(directory, "pre-baseline-history.txt"), `${index}\n`, "utf8");
      await execFileAsync("git", ["add", "pre-baseline-history.txt"], { cwd: directory });
      await execFileAsync("git", ["commit", "--quiet", "-m", `pre-baseline history ${index}`], { cwd: directory });
    }
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const baseBranch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "proven-side"], { cwd: directory });
    const completed = await completeBoundedTaskB(directory);
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", "proven-side", "-m", "merge proven task after long history"], { cwd: directory });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "attributed", baseline?.lineageDiagnostic);
    assert.ok(baseline?.mergeCommits?.some((merge) => merge.files.includes(completed.file)));
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, true, result.diagnostics.join("; "));
  });
});

test("a merge cannot hide a reverted first-parent forbidden change", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const baseBranch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "proven-side"], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await writeFile(join(directory, "secrets", "hidden-merge-leak.txt"), "secret\n", "utf8");
    await execFileAsync("git", ["add", "secrets/hidden-merge-leak.txt"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "forbidden first-parent change"], { cwd: directory });
    await execFileAsync("git", ["revert", "--quiet", "--no-edit", "HEAD"], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", "proven-side"], { cwd: directory });
    await completeBoundedTaskB(directory);
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", "proven-side", "-m", "merge proven task"], { cwd: directory });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /first-parent.*hidden-merge-leak\.txt|hidden-merge-leak\.txt.*first-parent/i);
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.equal(result.attribution?.lineageStatus, "intervening");
  });
});

test("a conflict-resolved merge path remains ambiguous and fails scope closed", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const baseBranch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "conflict-side"], { cwd: directory });
    await writeFile(join(directory, "src", "core", "tasks", "conflict.ts"), "side\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/conflict.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "conflict side"], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
    await writeFile(join(directory, "src", "core", "tasks", "conflict.ts"), "main\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/conflict.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "conflict main"], { cwd: directory });
    await assert.rejects(
      () => execFileAsync("git", ["merge", "--no-ff", "conflict-side", "-m", "conflict merge"], { cwd: directory }),
    );
    await writeFile(join(directory, "src", "core", "tasks", "conflict.ts"), "resolved\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/conflict.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "conflict merge"], { cwd: directory });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /merge-resolution.*conflict\.ts|conflict\.ts.*merge-resolution/i);
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.equal(result.attribution?.lineageStatus, "intervening");
  });
});

test("DAG enumeration stops at the bounded commit cap", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    for (let index = 0; index < 129; index += 1) {
      await execFileAsync("git", ["commit", "--quiet", "--allow-empty", "-m", `bounded history ${index}`], { cwd: directory });
    }

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /128-commit attribution limit/i);
  });
});

test("criss-cross merge bases fail closed with a merge diagnostic", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const baseBranch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "criss-a"], { cwd: directory });
    await writeFile(join(directory, "src/core/tasks/criss-a.ts"), "a\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/criss-a.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "criss a1"], { cwd: directory });
    const a1 = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", "-b", "criss-b"], { cwd: directory });
    await mkdir(join(directory, "src/core/tasks"), { recursive: true });
    await writeFile(join(directory, "src/core/tasks/criss-b.ts"), "b\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/criss-b.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "criss b1"], { cwd: directory });
    const b1 = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", a1, "-m", "criss b2"], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", "criss-a"], { cwd: directory });
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", b1, "-m", "criss a2"], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", "criss-b"], { cwd: directory });
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", "criss-a", "-m", "criss final"], { cwd: directory });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /criss-cross|merge bases|merge-resolution/i);
  });
});

test("file-type-only changes on both merge parents fail closed", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    const file = "docs/task-b/mode.txt";
    await writeFile(join(directory, file), "target", "utf8");
    await execFileAsync("git", ["add", file], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "seed mode fixture"], { cwd: directory });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const baseBranch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "mode-side"], { cwd: directory });
    await completeTypeOnlyTaskB(directory, file);
    await execFileAsync("git", ["checkout", "--quiet", baseBranch], { cwd: directory });
    await rm(join(directory, file));
    await symlink("target", join(directory, file));
    await execFileAsync("git", ["add", file], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "active type change"], { cwd: directory });
    try {
      await execFileAsync("git", ["merge", "--quiet", "--no-ff", "mode-side", "-m", "mode merge"], { cwd: directory });
    } catch {
      await rm(join(directory, file), { force: true });
      await symlink("target", join(directory, file));
      await execFileAsync("git", ["add", file], { cwd: directory });
      await execFileAsync("git", ["commit", "--quiet", "-m", "type merge"], { cwd: directory });
    }

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "intervening");
    assert.match(baseline?.lineageDiagnostic ?? "", /merge-resolution.*mode\.txt|mode\.txt.*merge-resolution/i);
  });
});

test("an unreadable merge parent entry fails closed even when the result matches the other parent", () => {
  assert.deepEqual(
    resolveMergePathAttribution(
      "entry:100644 blob result",
      "missing",
      ["unreadable", "entry:100644 blob result"],
      ["parent-a", "parent-b"],
    ),
    { mergeResolution: true, inheritedFrom: [] },
  );
});

test("legacy multiple-claim baseline history selects the earliest authoritative baseline", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await mkdir(join(directory, "src", "bootstrap"), { recursive: true });
    await writeFile(join(directory, "src", "bootstrap", "setup.ts"), "bootstrap\n", "utf8");
    // Simulate an old APK version that captured a fresh baseline on reclaim while
    // leaving the out-of-scope file dirty.
    await captureTaskBaseline(directory, "0007", "agent-a", ".tasks/0007-scoped-task.md", "claim");

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "clean");
    const result = await verifyScopedTask(directory);
    assert.equal(result.passed, false);
    assert.deepEqual(result.outOfScopeFiles, ["src/bootstrap/setup.ts"]);
    assert.deepEqual(result.attribution?.preExistingFiles, []);
  });
});

test("verification epoch recovers a stale baseline and carries the full discoverable path set", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const taskPath = join(directory, ".tasks", "0007-scoped-task.md");
    const task = (await loadTaskFile(taskPath)).task;
    await writeFile(join(directory, "src", "core", "tasks", "owned.ts"), "owned\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/owned.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "owned candidate"], { cwd: directory });
    for (let index = 0; index < 130; index += 1) {
      const path = join(directory, "src", "core", "tasks", `history-${index}.ts`);
      await writeFile(path, `${index}\n`, "utf8");
      await execFileAsync("git", ["add", `src/core/tasks/history-${index}.ts`], { cwd: directory });
      await execFileAsync("git", ["commit", "--quiet", "-m", `history ${index}`], { cwd: directory });
    }

    const stale = await readTaskBaseline(directory, "0007");
    assert.equal(stale?.lineageStatus, "intervening");
    const epoch = await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      reason: "recover the bounded stale baseline after verified repository history growth",
    });
    assert.equal(epoch.phase, "epoch");
    assert.ok(epoch.epochId);
    assert.equal(epoch.predecessorBaselineId, stale?.baselineId);
    assert.ok(epoch.carriedForwardFiles?.some(({ path }) => path === "src/core/tasks/owned.ts"));
    assert.ok((epoch.carriedForwardFiles?.length ?? 0) >= 131);

    const current = await readTaskBaseline(directory, "0007");
    assert.equal(current?.epochId, epoch.epochId);
    assert.equal(current?.lineageStatus, "clean");
    const scope = await captureTaskScope({ rootDirectory: directory, task, taskPath, baseline: current });
    assert.equal(scope.comparisonKnown, true);
    assert.equal(scope.outOfScopeFiles.length, 0);
    assert.equal(scope.forbiddenTouchedFiles.length, 0);
    assert.ok(scope.attribution?.carriedForwardFiles.includes("src/core/tasks/owned.ts"));
  });
});

test("epoch snapshot validation rejects a newly dirty path before append", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const before = await readTaskBaseline(directory, "0007");
    const beforeHeadSha = before?.headSha;
    assert.ok(beforeHeadSha);
    const beforeHistory = await readTaskBaselineHistory(directory, "0007");
    await writeFile(join(directory, "secrets", "appeared-after-discovery.txt"), "forbidden\n", "utf8");

    await assert.rejects(
      () => captureTaskBaseline(
        directory,
        "0007",
        "agent-a",
        ".tasks/0007-scoped-task.md",
        "claim",
        undefined,
        {
          headSha: beforeHeadSha,
          changedFiles: Object.keys(before.dirtyFiles).sort(),
          dirtyFiles: before.dirtyFiles,
        },
      ),
      /working-tree paths changed/i,
    );
    assert.equal((await readTaskBaselineHistory(directory, "0007")).length, beforeHistory.length);
    assert.ok((await listGitChangedFiles(directory)).includes("secrets/appeared-after-discovery.txt"));
  });
});

test("verification epoch preserves a carried forbidden path as a blocker", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const taskPath = join(directory, ".tasks", "0007-scoped-task.md");
    const task = (await loadTaskFile(taskPath)).task;
    await writeFile(join(directory, "secrets", "leak.txt"), "must remain visible\n", "utf8");
    await execFileAsync("git", ["add", "secrets/leak.txt"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "forbidden candidate"], { cwd: directory });
    for (let index = 0; index < 129; index += 1) {
      const path = join(directory, "src", "core", "tasks", `history-${index}.ts`);
      await writeFile(path, `${index}\n`, "utf8");
      await execFileAsync("git", ["add", `src/core/tasks/history-${index}.ts`], { cwd: directory });
      await execFileAsync("git", ["commit", "--quiet", "-m", `history ${index}`], { cwd: directory });
    }

    const epoch = await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      reason: "recover stale baseline while preserving every discoverable path",
    });
    const current = await readTaskBaseline(directory, "0007");
    const scope = await captureTaskScope({ rootDirectory: directory, task, taskPath, baseline: current });
    assert.equal(current?.epochId, epoch.epochId);
    assert.equal(scope.comparisonKnown, true);
    assert.ok(scope.outOfScopeFiles.includes("secrets/leak.txt"));
    assert.ok(scope.forbiddenTouchedFiles.includes("secrets/leak.txt"));
    assert.ok(scope.attribution?.carriedForwardFiles.includes("secrets/leak.txt"));
  });
});

test("verification epoch carries paths that history later deletes", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const taskPath = join(directory, ".tasks", "0007-scoped-task.md");
    const task = (await loadTaskFile(taskPath)).task;
    const restoredPath = "src/core/tasks/restored.ts";
    await writeFile(join(directory, restoredPath), "temporary candidate\n", "utf8");
    await execFileAsync("git", ["add", restoredPath], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "temporary candidate"], { cwd: directory });
    await rm(join(directory, restoredPath));
    await execFileAsync("git", ["add", "--all", restoredPath], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "restore tree"], { cwd: directory });

    const epoch = await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      reason: "retain historical paths even when the endpoint tree no longer contains them",
    });
    assert.ok(epoch.carriedForwardFiles?.some(({ path, sha256 }) => path === restoredPath && sha256 === "missing"));
    const current = await readTaskBaseline(directory, "0007");
    const scope = await captureTaskScope({ rootDirectory: directory, task, taskPath, baseline: current });
    assert.ok(scope.attribution?.carriedForwardFiles.includes(restoredPath));
  });
});

test("verification epoch rejects merge ancestry instead of resetting scope", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const branch = (await execFileAsync("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim();
    await execFileAsync("git", ["checkout", "--quiet", "-b", "epoch-side"], { cwd: directory });
    await writeFile(join(directory, "src/core/tasks/side.ts"), "side\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/side.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "side history"], { cwd: directory });
    await execFileAsync("git", ["checkout", "--quiet", branch], { cwd: directory });
    await mkdir(join(directory, "src/core/tasks"), { recursive: true });
    await writeFile(join(directory, "src/core/tasks/main.ts"), "main\n", "utf8");
    await execFileAsync("git", ["add", "src/core/tasks/main.ts"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "main history"], { cwd: directory });
    await execFileAsync("git", ["merge", "--quiet", "--no-ff", "epoch-side", "-m", "merge history"], { cwd: directory });

    await assert.rejects(
      () => startTaskEpoch({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "agent-a",
        reason: "do not recover through unsupported merge ancestry",
      }),
      /merge|unsupported|ancestor/i,
    );
    const current = await readTaskBaseline(directory, "0007");
    assert.equal(current?.phase, "claim");
  });
});

test("verification epoch makes predecessor evidence stale and exposes epoch provenance", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true);
    const epoch = await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      reason: "refresh the verification subject after the old baseline became stale",
    });
    const provenance = await buildTaskProvenance(directory, ".tasks", "0007");
    const prior = provenance.evidence.find((record) => record.runId === verification.runId);
    assert.equal(prior?.freshness, "stale");
    assert.equal(provenance.epochs.length, 1);
    assert.equal(provenance.epochs[0]?.epochId, epoch.epochId);
    assert.equal(provenance.epochs[0]?.current, true);
    assert.match(renderTaskProvenance(provenance), /Verification epochs:/);
  });
});

test("epoch baselines prove completed candidates for later task attribution", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      reason: "anchor task A before a later completed task candidate",
    });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner: "agent-b" });
    await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner: "agent-b",
      reason: "anchor task B before its candidate commit",
    });
    await writeFile(join(directory, "docs", "task-b", "epoch-change.md"), "epoch candidate\n", "utf8");
    await execFileAsync("git", ["add", "docs/task-b/epoch-change.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "epoch candidate"], { cwd: directory });
    const candidateSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner: "agent-b",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true, verification.diagnostics.join("; "));
    await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner: "agent-b" });
    await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "epoch completion bookkeeping"], { cwd: directory });

    const baselineA = await readTaskBaseline(directory, "0007");
    assert.equal(baselineA?.lineageStatus, "attributed");
    assert.ok(baselineA?.provenOtherTaskCommits?.some((commit) => commit.sha === candidateSha));
    const result = await verifyScopedTask(directory, "agent-a");
    assert.equal(result.passed, true, result.diagnostics.join("; "));
    assert.ok(result.attribution?.excludedFiles.includes("docs/task-b/epoch-change.md"));
  });
});

test("a carried path overlapping a proven task commit remains ambiguous", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    const taskBPath = join(directory, ".tasks", "0008-bounded-task.md");
    const taskB = (await loadTaskFile(taskBPath)).task;
    await writeTaskFile(taskBPath, {
      ...taskB,
      allowedFiles: [...taskB.allowedFiles, "src/core/tasks/**"],
    });
    await execFileAsync("git", ["add", taskBPath], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "expand task B scope"], { cwd: directory });

    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const sharedPath = "src/core/tasks/shared.ts";
    await writeFile(join(directory, sharedPath), "A\n", "utf8");
    await execFileAsync("git", ["add", sharedPath], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "task A candidate"], { cwd: directory });
    await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "agent-a",
      reason: "carry the existing task A candidate before parallel attribution",
    });

    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner: "agent-b" });
    await startTaskEpoch({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner: "agent-b",
      reason: "anchor task B before its shared-path candidate",
    });
    await writeFile(join(directory, sharedPath), "B\n", "utf8");
    await execFileAsync("git", ["add", sharedPath], { cwd: directory });
    const candidate = await execFileAsync("git", ["commit", "--quiet", "-m", "task B shared path"], { cwd: directory });
    const candidateSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner: "agent-b",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true, verification.diagnostics.join("; "));
    await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner: "agent-b" });
    await execFileAsync("git", ["add", ".tasks/0008-bounded-task.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "task B completion bookkeeping"], { cwd: directory });
    assert.equal(candidate.stdout, "");

    const baselineA = await readTaskBaseline(directory, "0007");
    assert.equal(baselineA?.lineageStatus, "attributed");
    assert.ok(baselineA?.provenOtherTaskCommits?.some((commit) => commit.sha === candidateSha));
    const result = await verifyScopedTask(directory, "agent-a");
    assert.equal(result.passed, false);
    assert.equal(result.attribution?.excludedFiles.includes(sharedPath), false);
    assert.ok(result.attribution?.diagnostics.some((diagnostic) => /carried-forward path.*ambiguous/i.test(diagnostic)));
  });
});

test("a released task without reclaim stays clean and does not fail closed", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });

    const baseline = await readTaskBaseline(directory, "0007");
    assert.equal(baseline?.lineageStatus, "clean");
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

test("recordManualVerification records a candidate-bound manual pass the gate accepts", async () => {
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
      verification: [
        {
          id: "unit",
          type: "automated",
          required: true,
          environment: "local",
          profile: "deterministic",
          command: "pass",
        },
        {
          id: "live-smoke",
          type: "manual",
          required: true,
          environment: "live",
          profile: "trusted",
          instruction: "Check the hosted run.",
          evidence: "CI run URL/status/SHA",
        },
      ],
      verificationCommands: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    const before = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(before.passed, false);
    assert.ok(before.blockers.some((blocker) => blocker.includes("live-smoke")));

    const recorded = await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "live-smoke",
      result: "pass",
      evidence: "https://ci.example.test/runs/42 status=success sha=abc",
    });
    assert.equal(recorded.gateEligible, true);
    assert.equal(recorded.type, "live");
    assert.equal(recorded.checkId, "live-smoke");
    assert.match(renderRecordManualVerificationResult(recorded), /Result: pass/);

    const after = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(after.passed, true, after.blockers.join("; "));
    assert.equal(after.subject.candidateId, recorded.subject.candidateId);
  });
});

test("recorded live evidence satisfies a required manual/live check and its live category", async () => {
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
      tags: ["deployment"],
      dependsOn: [],
      verification: [
        {
          id: "release-report",
          type: "automated",
          required: true,
          environment: "ci",
          profile: "report",
          command: "pass",
          artifact: "reports/release.json",
          evidence: "release report",
        },
        {
          id: "clean-checkout-ci",
          type: "manual",
          required: true,
          environment: "live",
          profile: "trusted",
          instruction: "Record the hosted run.",
          evidence: "CI run URL/status/SHA",
        },
      ],
      verificationCommands: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    const before = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(before.passed, false);
    assert.ok(before.blockers.some((blocker) => blocker.includes("clean-checkout-ci")));
    assert.ok(before.blockers.some((blocker) => blocker.includes("live evidence")));
    assert.equal(before.blockers.some((blocker) => blocker.includes("manual evidence")), false);

    const recorded = await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "clean-checkout-ci",
      result: "pass",
      evidence: "https://ci.example.test/runs/9 status=success sha=def",
    });
    assert.equal(recorded.type, "live");
    assert.equal(recorded.gateEligible, true);

    const pendingCi = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(pendingCi.passed, false);
    assert.ok(pendingCi.blockers.some((blocker) => blocker.includes("release-report")));
    await recordManualVerification({
      rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a",
      checkId: "release-report", result: "pass",
      evidence: "https://ci.example.test/runs/release-report status=success sha=def",
    });

    const after = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(after.passed, true, after.blockers.join("; "));
  });
});

test("recordManualVerification rejects automated checks, missing evidence, foreign owners, and unregistered owners", async () => {
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
      verification: [
        {
          id: "unit",
          type: "automated",
          required: true,
          environment: "local",
          profile: "deterministic",
          command: "pass",
        },
        {
          id: "live-smoke",
          type: "manual",
          required: true,
          environment: "live",
          profile: "trusted",
          instruction: "Check the hosted run.",
        },
      ],
      verificationCommands: [],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
        checkId: "unit",
        result: "pass",
        evidence: "reference",
      }),
      /automated/,
    );
    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
        checkId: "live-smoke",
        result: "pass",
        evidence: "   ",
      }),
      /evidence reference/,
    );
    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
        checkId: "live-smoke",
        result: "pass",
        evidence: "x".repeat(241),
      }),
      /short locator\/reference.*--summary.*Notes/,
    );
    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
        checkId: "live-smoke",
        result: "pass",
        evidence: "reference\nstatus",
      }),
      /single-line short locator\/reference.*--summary.*Notes/,
    );
    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
        checkId: "live-smoke",
        result: "pass",
        evidence: "reference",
        summary: "x".repeat(1001),
      }),
      /--summary must be at most 1000 characters.*Notes/,
    );
    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-a",
        checkId: "live-smoke",
        result: "pass",
        evidence: "reference",
        summary: "first line\nsecond line",
      }),
      /--summary must be single-line.*Notes/,
    );
    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "ghost",
        checkId: "live-smoke",
        result: "pass",
        evidence: "reference",
      }),
      /Agent is not registered/,
    );
    await registerAgent(directory, { id: "codex-b", developer: "bob", platform: "codex", model: "gpt-5" });
    await assert.rejects(
      recordManualVerification({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        owner: "codex-b",
        checkId: "live-smoke",
        result: "pass",
        evidence: "reference",
      }),
      /only the task owner/,
    );
  });
});

async function setupHostedCiRepo(
  directory: string,
  verification: ProjectTask["verification"] = [
    { id: "hosted-ci", type: "automated", required: true, environment: "ci", profile: "deterministic", command: "pass" },
  ],
): Promise<void> {
  const git = async (...args: string[]) => {
    await execFileAsync("git", args, { cwd: directory });
  };
  await git("init", "--quiet");
  await git("config", "user.email", "codex@example.test");
  await git("config", "user.name", "Codex");
  await mkdir(join(directory, ".tasks"), { recursive: true });
  await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
  await writeTaskFile(join(directory, ".tasks", "0007-hosted-task.md"), {
    ...TASK,
    state: "todo",
    owner: "none",
    risk: "low",
    dependsOn: [],
    tags: [],
    allowedFiles: ["src/core/tasks/**"],
    forbiddenFiles: [],
    verificationCommands: [],
    verification,
  });
  await git("add", ".");
  await git("commit", "--quiet", "-m", "initial");
  await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
  await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });
}

test("completion gate rejects stale packaged output and accepts the rebuilt candidate", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src", "cli"), { recursive: true });
    await mkdir(join(directory, "dist", "cli"), { recursive: true });
    await mkdir(join(directory, "src", "core", "templates", "minimal-docs"), { recursive: true });
    await mkdir(join(directory, "dist", "core", "templates", "minimal-docs"), { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({
      files: ["dist"],
      packageManager: "pnpm@10.28.1",
      scripts: { build: "node build.mjs" },
    }), "utf8");
    await writeFile(join(directory, "build.mjs"), [
      "import { copyFile, mkdir } from 'node:fs/promises';",
      "await mkdir('dist/cli', { recursive: true });",
      "await copyFile('src/cli/index.ts', 'dist/cli/index.js');",
      "await mkdir('dist/core/templates/minimal-docs', { recursive: true });",
      "await copyFile('src/core/templates/minimal-docs/product-requirements.md.hbs', 'dist/core/templates/minimal-docs/product-requirements.md.hbs');",
      "",
    ].join("\n"), "utf8");
    await writeFile(join(directory, "src", "cli", "index.ts"), "export const value = 'source-v1';\n", "utf8");
    await writeFile(join(directory, "dist", "cli", "index.js"), "export const value = 'source-v1';\n", "utf8");
    await writeFile(join(directory, "src", "core", "templates", "minimal-docs", "product-requirements.md.hbs"), "starter-v1\n", "utf8");
    await writeFile(join(directory, "dist", "core", "templates", "minimal-docs", "product-requirements.md.hbs"), "starter-v1\n", "utf8");
    await writeTaskFile(join(directory, ".tasks", "0007-packaged-source.md"), {
      ...TASK,
      state: "todo",
      owner: "none",
      risk: "low",
      dependsOn: [],
      tags: [],
      allowedFiles: ["src/cli/index.ts", "dist/**"],
      forbiddenFiles: [],
      verificationCommands: [],
      verification: [{
        id: PACKAGED_DIST_CHECK_ID,
        type: "automated",
        required: true,
        environment: "local",
        profile: "deterministic",
        command: PACKAGED_DIST_CHECK_COMMAND,
      }],
    });
    await writeTaskFile(join(directory, ".tasks", "0008-packaged-template-asset.md"), {
      ...TASK,
      id: "0008",
      title: "Package template asset",
      state: "todo",
      owner: "none",
      risk: "low",
      dependsOn: [],
      tags: [],
      allowedFiles: ["src/core/templates/minimal-docs/product-requirements.md.hbs", "dist/**"],
      forbiddenFiles: [],
      verificationCommands: [],
      verification: [{
        id: PACKAGED_DIST_CHECK_ID,
        type: "automated",
        required: true,
        environment: "local",
        profile: "deterministic",
        command: PACKAGED_DIST_CHECK_COMMAND,
      }],
    });
    await writeTaskFile(join(directory, ".tasks", "0009-build-script-removal.md"), {
      ...TASK,
      id: "0009",
      title: "Remove build script while changing package source",
      state: "todo",
      owner: "none",
      risk: "low",
      dependsOn: [],
      tags: [],
      allowedFiles: ["package.json", "src/cli/index.ts", "dist/**"],
      forbiddenFiles: [],
      verificationCommands: [],
      verification: [{
        id: PACKAGED_DIST_CHECK_ID,
        type: "automated",
        required: true,
        environment: "local",
        profile: "deterministic",
        command: PACKAGED_DIST_CHECK_COMMAND,
      }],
    });
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial");
    await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
    await registerAgent(directory, { id: "codex-b", developer: "bob", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });

    await writeFile(join(directory, "src", "cli", "index.ts"), "export const value = 'source-v2';\n", "utf8");
    const stale = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
    });
    assert.equal(stale.checkResults[0]?.id, PACKAGED_DIST_CHECK_ID);
    assert.equal(stale.checkResults[0]?.status, "fail");
    assert.equal(await readFile(join(directory, "dist", "cli", "index.js"), "utf8"), "export const value = 'source-v2';\n");
    const uncommittedSourceOutput = await execFileAsync("git", ["status", "--porcelain", "--untracked-files=all", "--", "dist"], { cwd: directory });
    assert.match(uncommittedSourceOutput.stdout, /dist\/cli\/index\.js/);
    const staleGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(staleGate.passed, false);
    assert.ok(
      staleGate.blockers.some((blocker) => blocker.includes(PACKAGED_DIST_CHECK_ID)),
      staleGate.blockers.join("; "),
    );

    await git("add", "src/cli/index.ts", "dist/cli/index.js");
    await git("commit", "--quiet", "-m", "commit rebuilt TypeScript output");
    const rebuilt = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
    });
    assert.equal(rebuilt.passed, true);
    const rebuiltGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(rebuiltGate.passed, true, rebuiltGate.blockers.join("; "));

    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008", owner: "codex-b" });
    await writeFile(join(directory, "src", "core", "templates", "minimal-docs", "product-requirements.md.hbs"), "starter-v2\n", "utf8");
    const staleAsset = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner: "codex-b",
    });
    assert.equal(staleAsset.checkResults[0]?.status, "fail");
    assert.equal(await readFile(join(directory, "dist", "core", "templates", "minimal-docs", "product-requirements.md.hbs"), "utf8"), "starter-v2\n");
    const uncommittedAssetOutput = await execFileAsync("git", ["status", "--porcelain", "--untracked-files=all", "--", "dist"], { cwd: directory });
    assert.match(uncommittedAssetOutput.stdout, /product-requirements\.md\.hbs/);
    const staleAssetGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008" });
    assert.equal(staleAssetGate.passed, false);

    await git("add", "src/core/templates/minimal-docs/product-requirements.md.hbs", "dist/core/templates/minimal-docs/product-requirements.md.hbs");
    await git("commit", "--quiet", "-m", "commit rebuilt template output");
    const currentAsset = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0008",
      owner: "codex-b",
    });
    assert.equal(currentAsset.passed, true);
    const currentAssetGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0008" });
    assert.equal(currentAssetGate.passed, true, currentAssetGate.blockers.join("; "));

    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0009", owner: "codex-a" });
    await writeFile(join(directory, "package.json"), JSON.stringify({
      files: ["*"],
      main: "dist/cli/index.js",
      packageManager: "pnpm@10.28.1",
    }), "utf8");
    await writeFile(join(directory, "src", "cli", "index.ts"), "export const value = 'source-v3';\n", "utf8");
    assert.equal(await repositoryShipsCommittedDist(directory), true);
    const missingBuildScript = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0009",
      owner: "codex-a",
    });
    assert.equal(missingBuildScript.passed, false);
    assert.equal(missingBuildScript.checkResults[0]?.status, "fail");
    const missingBuildGate = await evaluateTaskCompletionGate({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0009",
    });
    assert.equal(missingBuildGate.passed, false);
    assert.ok(missingBuildGate.blockers.some((blocker) => blocker.includes("no usable scripts.build")));
  });
});

test("build-current rejects no-op builds and ignored dist output", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, "src"), { recursive: true });
    await mkdir(join(directory, "dist"), { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({
      files: ["dist"],
      packageManager: "pnpm@10.28.1",
      scripts: { build: "node build.mjs" },
    }), "utf8");
    await writeFile(join(directory, ".gitignore"), "dist/ignored-output.txt\n", "utf8");
    await writeFile(join(directory, "src", "index.ts"), "export const value = 1;\n", "utf8");
    await writeFile(join(directory, "dist", "index.js"), "export const value = 1;\n", "utf8");
    await writeFile(join(directory, "build.mjs"), "// Deliberately successful no-op build.\n", "utf8");
    await git("add", ".");
    await git("commit", "--quiet", "-m", "initial stale-output fixture");

    await assert.rejects(() => execFileAsync("sh", ["-c", packagedDistCheckCommand("pnpm build")], { cwd: directory }));
    const noOpStatus = await execFileAsync("git", ["status", "--porcelain", "--untracked-files=all", "--ignored=matching", "--", "dist"], { cwd: directory });
    assert.match(noOpStatus.stdout, /D dist\/index\.js/);

    await writeFile(join(directory, "build.mjs"), [
      "import { copyFile, mkdir, writeFile } from 'node:fs/promises';",
      "await mkdir('dist', { recursive: true });",
      "await copyFile('src/index.ts', 'dist/index.js');",
      "await writeFile('dist/ignored-output.txt', 'ignored\\n');",
      "",
    ].join("\n"), "utf8");
    await assert.rejects(() => execFileAsync("sh", ["-c", packagedDistCheckCommand("pnpm build")], { cwd: directory }));
    const ignoredStatus = await execFileAsync("git", ["status", "--porcelain", "--untracked-files=all", "--ignored=matching", "--", "dist"], { cwd: directory });
    assert.match(ignoredStatus.stdout, /!! dist\/ignored-output\.txt/);
  });
});

async function setupBenchmarkRepo(
  directory: string,
  verification: NonNullable<ProjectTask["verification"]> = [{
    id: "benchmark-run",
    type: "automated",
    required: true,
    environment: "local",
    profile: "report",
    command: "benchmark",
    evidenceType: "benchmark",
  }],
  type = "benchmark",
  tags = ["benchmark"],
  risk: ProjectTask["risk"] = "low",
): Promise<void> {
  const git = async (...args: string[]) => {
    await execFileAsync("git", args, { cwd: directory });
  };
  await git("init", "--quiet");
  await git("config", "user.email", "codex@example.test");
  await git("config", "user.name", "Codex");
  await mkdir(join(directory, ".tasks"), { recursive: true });
  await mkdir(join(directory, "src", "benchmark"), { recursive: true });
  await writeFile(join(directory, "src", "benchmark", "fixture.ts"), "export const fixture = 1;\n", "utf8");
  await writeTaskFile(join(directory, ".tasks", "0007-benchmark-task.md"), {
    ...TASK,
    type,
    state: "todo",
    owner: "none",
    mode: "product",
    lane: "benchmark",
    risk,
    dependsOn: [],
    tags,
    allowedFiles: ["src/benchmark/**"],
    forbiddenFiles: [],
    verificationCommands: [],
    verification,
  });
  await git("add", ".");
  await git("commit", "--quiet", "-m", "initial");
  await registerAgent(directory, { id: "codex-a", developer: "alice", platform: "codex", model: "gpt-5" });
  await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" });
}

async function setupManualArtifactRepo(directory: string, tags: string[] = []): Promise<void> {
  await setupBenchmarkRepo(directory, [
    { id: "unit", type: "automated", required: true, environment: "local", profile: "deterministic", command: "unit" },
    {
      id: "manual-artifact",
      type: "manual",
      required: true,
      environment: "local",
      profile: "trusted",
      instruction: "Inspect the generated manual verification artifact.",
      artifact: "reports/manual-result.json",
      evidenceRef: "Observer report reference",
      summary: "Confirm the generated artifact matches the candidate and explain any discrepancy.",
    },
  ], "bugfix", tags, "high");
}

test("external manual artifact recording preserves separate candidate-bound references", async () => {
  await withTempDirectory(async (directory) => {
    await setupManualArtifactRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    assert.equal(verification.checkResults.find((check) => check.id === "manual-artifact")?.status, "unavailable");
    assert.match(renderTaskVerifyResult(verification), /unavailable manual-artifact \(required\) artifact=reports\/manual-result\.json/);
    const localRecords = await readTaskEvidence(directory, "0007");
    assert.equal(localRecords.find((record) => record.checkId === "manual-artifact")?.artifact, "reports/manual-result.json");
    assert.equal(localRecords.find((record) => record.checkId === "manual-artifact")?.evidence, "Observer report reference");
    assert.equal(localRecords.find((record) => record.checkId === "manual-artifact")?.summary, "Confirm the generated artifact matches the candidate and explain any discrepancy.");

    await assert.rejects(() => recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "manual-artifact",
      result: "pass",
      evidence: "",
    }), /non-empty externally-observed evidence reference/);

    const recorded = await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "manual-artifact",
      result: "pass",
      evidence: "https://observer.example/runs/manual-7",
    });
    assert.equal(recorded.type, "manual");
    assert.equal(recorded.record.artifact, "reports/manual-result.json");
    assert.equal(recorded.record.evidence, "https://observer.example/runs/manual-7");
    assert.equal(recorded.record.summary, "Confirm the generated artifact matches the candidate and explain any discrepancy.");
    assert.match(renderRecordManualVerificationResult(recorded), /Artifact reference: reports\/manual-result\.json/);
    assert.match(renderRecordManualVerificationResult(recorded), /Evidence reference: https:\/\/observer\.example\/runs\/manual-7/);
    await registerAgent(directory, { id: "codex-reviewer", developer: "bob", platform: "codex", model: "gpt-5" });
    await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "pass",
    });

    const records = await readTaskEvidence(directory, "0007");
    const evidenceOutput = renderTaskEvidence(records, "0007");
    assert.match(evidenceOutput, /Artifact reference: reports\/manual-result\.json/);
    assert.match(evidenceOutput, /Evidence reference: https:\/\/observer\.example\/runs\/manual-7/);
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, true, gate.blockers.join("; "));
    assert.deepEqual(gate.policy.declaredEvidenceCategories, ["artifact", "evidence", "manual"]);
    assert.match(renderTaskPolicy(gate.policy), /manual-artifact declares artifact reference reports\/manual-result\.json/);
    assert.match(renderTaskCompletionGate(gate), /artifact=reports\/manual-result\.json/);
  });
});

test("manual artifact fail and unavailable local placeholders do not satisfy check or category", async () => {
  await withTempDirectory(async (directory) => {
    await setupManualArtifactRepo(directory);
    await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    const unavailableGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(unavailableGate.passed, false);
    assert.equal(unavailableGate.verification.find((check) => check.checkId === "manual-artifact")?.result, "unavailable");
    assert.ok(unavailableGate.blockers.includes("Missing current artifact evidence."));

    const recorded = await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "manual-artifact",
      result: "fail",
      evidence: "https://observer.example/runs/manual-fail",
    });
    assert.equal(recorded.record.artifact, "reports/manual-result.json");
    const failedGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(failedGate.passed, false);
    assert.equal(failedGate.verification.find((check) => check.checkId === "manual-artifact")?.result, "fail");
    assert.ok(failedGate.blockers.includes("Missing current artifact evidence."));
  });
});

test("manual artifact references remain stale or candidate-mismatched history", async () => {
  await withTempDirectory(async (directory) => {
    await setupManualArtifactRepo(directory);
    await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "manual-artifact",
      result: "pass",
      evidence: "https://observer.example/runs/manual-old",
    });
    await writeFile(join(directory, "src", "benchmark", "fixture.ts"), "export const fixture = 2;\n", "utf8");
    const staleGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(staleGate.passed, false);
    assert.ok(staleGate.blockers.includes("Evidence category artifact belongs to another candidate revision."));

    const current = await captureTaskCompletionCandidate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    await appendTaskEvidence(directory, {
      taskId: "0007",
      runId: "different-manual-artifact-candidate",
      agent: "codex-a",
      gateEligible: true,
      type: "manual",
      result: "pass",
      subject: { ...current.subject, candidateId: "candidate:different" },
      checkId: "manual-artifact",
      profile: "trusted",
      artifact: "reports/manual-result.json",
      evidence: "https://observer.example/runs/manual-different-candidate",
    });
    const differentCandidateGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(differentCandidateGate.passed, false);
    assert.ok(differentCandidateGate.blockers.includes("Evidence category artifact belongs to another candidate revision."));
  });
});

test("a different artifact reference cannot satisfy the declared check or artifact category", async () => {
  await withTempDirectory(async (directory) => {
    await setupManualArtifactRepo(directory);
    const candidate = await captureTaskCompletionCandidate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    await appendTaskEvidence(directory, {
      taskId: "0007",
      runId: "wrong-artifact-reference",
      agent: "codex-a",
      gateEligible: true,
      type: "manual",
      result: "pass",
      subject: candidate.subject,
      checkId: "manual-artifact",
      profile: "trusted",
      artifact: "reports/other-result.json",
      evidence: "https://observer.example/runs/wrong-artifact",
    });
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.equal(gate.verification.find((check) => check.checkId === "manual-artifact")?.result, "missing");
    assert.ok(gate.blockers.includes("Missing current artifact evidence."));
  });
});

test("artifact metadata and incidental text cannot satisfy unrelated evidence categories", async () => {
  await withTempDirectory(async (directory) => {
    await setupManualArtifactRepo(directory, ["benchmark", "provider", "deployment"]);
    const candidate = await captureTaskCompletionCandidate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    await appendTaskEvidence(directory, {
      taskId: "0007",
      runId: "artifact-only-reference",
      agent: "codex-a",
      gateEligible: true,
      type: "automated-test",
      result: "pass",
      subject: candidate.subject,
      checkId: "unrelated-check",
      profile: "deterministic",
      artifact: "reports/manual-result.json",
      summary: "benchmark report live manual evidence",
    });
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    for (const category of ["benchmark", "report", "live", "manual", "evidence"]) {
      assert.ok(gate.blockers.includes(`Missing current ${category} evidence.`), category);
    }
  });
});

test("malformed, multiline, and overlong artifact/evidence references are rejected", () => {
  const exactBoundaryTask = parseTaskMarkdown(renderTaskMarkdown({
    ...TASK,
    verification: [{
      id: "boundary-check",
      type: "manual",
      required: true,
      environment: "live",
      profile: "trusted",
      instruction: "Inspect the release.",
      evidenceRef: "x".repeat(240),
      summary: "x".repeat(1000),
    }],
    verificationCommands: [],
  }));
  assert.equal(exactBoundaryTask.verification?.[0]?.evidenceRef?.length, 240);
  assert.equal(exactBoundaryTask.verification?.[0]?.summary?.length, 1000);

  for (const field of ["artifact", "evidence", "evidenceRef"] as const) {
    for (const reference of ["", "x".repeat(241), "reports/manual\nresult.json"]) {
      assert.throws(() => parseTaskMarkdown(renderTaskMarkdown({
        ...TASK,
        verification: [{
          id: "manual-artifact",
          type: "manual",
          required: true,
          environment: "local",
          profile: "trusted",
          instruction: "Inspect the artifact.",
          [field]: reference,
        }],
        verificationCommands: [],
      })), TaskFormatError, `${field} reference ${JSON.stringify(reference)}`);
    }
  }
  assert.throws(() => parseTaskMarkdown(renderTaskMarkdown({
    ...TASK,
    verification: [{
      id: "long-summary",
      type: "manual",
      required: true,
      environment: "live",
      profile: "trusted",
      instruction: "Inspect the release.",
      evidenceRef: "release-url",
      summary: "x".repeat(1001),
    }],
    verificationCommands: [],
  })), /summary must be at most 1000 characters/);
  assert.throws(() => parseTaskMarkdown(renderTaskMarkdown({
    ...TASK,
    verification: [{
      id: "multiline-summary",
      type: "manual",
      required: true,
      environment: "live",
      profile: "trusted",
      instruction: "Inspect the release.",
      evidenceRef: "release-url",
      summary: "first line\nsecond line",
    }],
    verificationCommands: [],
  })), /summary must be single-line/);
});

test("explicit benchmark execution writes typed current evidence and satisfies the gate", async () => {
  await withTempDirectory(async (directory) => {
    await setupBenchmarkRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    const evidence = await readTaskEvidence(directory, "0007");
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });

    assert.equal(verification.passed, true);
    assert.equal(verification.checkResults[0].evidenceType, "benchmark");
    assert.match(renderTaskVerifyResult(verification), /evidence=benchmark/);
    assert.equal(evidence[0].type, "benchmark");
    assert.equal(evidence[0].result, "pass");
    assert.equal(evidence[0].gateEligible, true);
    assert.equal(gate.passed, true, gate.blockers.join("; "));
    assert.equal(gate.verification[0].evidenceType, "benchmark");
    assert.match(renderTaskCompletionGate(gate), /evidenceType=benchmark/);
    assert.deepEqual(gate.policy.declaredEvidenceCategories, ["benchmark"]);
  });
});

test("external benchmark recording uses the declared check and current candidate", async () => {
  await withTempDirectory(async (directory) => {
    await setupBenchmarkRepo(directory);
    const recorded = await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "benchmark-run",
      result: "pass",
      evidence: "https://benchmark.example/runs/42 status=success",
    });
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });

    assert.equal(recorded.type, "benchmark");
    assert.equal(recorded.gateEligible, true);
    assert.equal(recorded.subject.candidateId, gate.subject.candidateId);
    assert.equal(recorded.subject.repository, "git");
    assert.ok(recorded.subject.headSha);
    assert.notEqual(recorded.subject.baselineId, "unknown");
    assert.ok(recorded.subject.worktreeId);
    assert.match(renderRecordManualVerificationResult(recorded), /Type: benchmark/);
    assert.equal(gate.passed, true, gate.blockers.join("; "));
  });
});

test("benchmark fail, unavailable, pending, and not-run results never satisfy the gate", async () => {
  for (const result of ["fail", "unavailable", "pending", "not-run"] as const) {
    await withTempDirectory(async (directory) => {
      await setupBenchmarkRepo(directory);
      const candidate = await captureTaskCompletionCandidate({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
      });
      await appendTaskEvidence(directory, {
        taskId: "0007",
        runId: `benchmark-${result}`,
        agent: "codex-a",
        gateEligible: true,
        type: "benchmark",
        result,
        subject: candidate.subject,
        checkId: "benchmark-run",
        profile: "report",
        evidence: "https://benchmark.example/runs/result",
      });
      const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });

      assert.equal(gate.passed, false, result);
      assert.equal(gate.verification[0].result, result, result);
      assert.ok(gate.blockers.some((blocker) => blocker.includes("benchmark")), result);
    });
  }
});

test("benchmark evidence is stale after the candidate changes and cannot pass", async () => {
  await withTempDirectory(async (directory) => {
    await setupBenchmarkRepo(directory);
    await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "benchmark-run",
      result: "pass",
      evidence: "https://benchmark.example/runs/old status=success",
    });
    await writeFile(join(directory, "src", "benchmark", "fixture.ts"), "export const fixture = 2;\n", "utf8");
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });

    assert.equal(gate.passed, false);
    assert.equal(gate.verification[0].result, "missing");
    assert.ok(gate.blockers.some((blocker) => blocker.includes("another candidate revision")));
    assert.ok(gate.blockers.some((blocker) => blocker.includes("another candidate revision") && blocker.includes("benchmark")));
  });
});

test("benchmark evidence type rejects report/manual/live/artifact and text masquerading", async () => {
  await withTempDirectory(async (directory) => {
    await setupBenchmarkRepo(directory);
    const candidate = await captureTaskCompletionCandidate({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
    });
    for (const [index, type] of (["automated-test", "ci", "report", "manual", "live", "dogfood"] as const).entries()) {
      await appendTaskEvidence(directory, {
        taskId: "0007",
        runId: `masquerade-${type}`,
        agent: "codex-a",
        gateEligible: true,
        type,
        result: "pass",
        subject: candidate.subject,
        checkId: "benchmark-run",
        profile: "report",
        ...(index === 1 ? { artifact: "reports/benchmark.json" } : {}),
        summary: "benchmark passed",
        evidence: "benchmark output",
        ...(type === "dogfood" ? {
          scenario: "compare fixture",
          tool: "benchmark-runner",
          taskGoal: "measure planner latency",
          startedAt: "2026-09-25T00:00:00.000Z",
          endedAt: "2026-09-25T00:00:01.000Z",
        } : {}),
      });
    }
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });

    assert.equal(gate.passed, false);
    assert.equal(gate.verification[0].result, "missing");
    assert.ok(gate.blockers.some((blocker) => blocker.includes("missing verification evidence for check benchmark-run")));
    assert.ok(gate.blockers.some((blocker) => blocker === "Missing current benchmark evidence."));
  });
});

test("benchmark candidate mutation during execution converts the result to a non-pass", async () => {
  await withTempDirectory(async (directory) => {
    await setupBenchmarkRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => {
        await writeFile(join(directory, "src", "benchmark", "fixture.ts"), "export const fixture = 3;\n", "utf8");
        return 0;
      },
    });
    const evidence = await readTaskEvidence(directory, "0007");
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });

    assert.equal(verification.passed, false);
    assert.equal(verification.checkResults[0].status, "fail");
    assert.match(verification.checkResults[0].reason ?? "", /mixed-revision/);
    assert.equal(evidence[0].type, "benchmark");
    assert.equal(evidence[0].result, "fail");
    assert.equal(evidence[0].gateEligible, false);
    assert.equal(gate.passed, false);
  });
});

test("ordinary benchmark-like command text remains automated-test evidence", async () => {
  await withTempDirectory(async (directory) => {
    await setupBenchmarkRepo(directory, [{
      id: "unit",
      type: "automated",
      required: true,
      environment: "local",
      profile: "deterministic",
      command: "pnpm benchmark",
    }], "bugfix", []);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    const evidence = await readTaskEvidence(directory, "0007");
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });

    assert.equal(verification.passed, true);
    assert.equal(verification.checkResults[0].evidenceType, undefined);
    assert.equal(evidence[0].type, "automated-test");
    assert.equal(gate.passed, true, gate.blockers.join("; "));
  });
});

for (const profile of ["deterministic", "integration", "trusted", "report"] as const) {
  for (const type of ["automated", "manual"] as const) {
    test(`CI classification cannot be bypassed by ${type}/${profile}`, async () => {
      await withTempDirectory(async (directory) => {
        await setupHostedCiRepo(directory, [{
          id: "hosted-ci", type, profile, required: true, environment: "ci",
          ...(type === "automated" ? { command: "pass" } : { instruction: "Observe hosted CI." }),
          artifact: "reports/hosted.json",
          evidence: "hosted run URL/status/SHA",
        }, { id: "local-unit", type: "automated", required: true, environment: "local", profile: "deterministic", command: "local-pass" }]);
        const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" };
        const local = await verifyTask({ ...options, runCommand: async () => 0 });
        assert.equal(local.checkResults[0].status, type === "automated" ? "pass" : "unavailable");
        const localRecords = (await readTaskEvidence(directory, "0007")).filter((record) => record.checkId === "hosted-ci");
        assert.ok(localRecords.every((record) => record.gateEligible === false), "local CI observations are diagnostic only");
        let gate = await evaluateTaskCompletionGate(options);
        assert.equal(gate.passed, false);
        assert.ok(gate.policy.declaredEvidenceCategories.includes("ci"));
        if (profile === "report") assert.ok(gate.policy.declaredEvidenceCategories.includes("report"));

        const recorded = await recordManualVerification({
          ...options, checkId: "hosted-ci", result: "pass",
          evidence: "https://ci.example.test/runs/matrix status=success sha=candidate",
        });
        assert.equal(recorded.type, "ci");
        assert.equal(recorded.record.profile, profile);
        assert.equal(recorded.record.artifact, "reports/hosted.json");
        gate = await evaluateTaskCompletionGate(options);
        assert.equal(gate.passed, true, gate.blockers.join("; "));

        // A later failed local command or unavailable manual check cannot shadow hosted proof.
        await verifyTask({ ...options, runCommand: async (command) => command === "local-pass" ? 0 : 1 });
        gate = await evaluateTaskCompletionGate(options);
        assert.equal(gate.passed, true, gate.blockers.join("; "));
        assert.equal(gate.verification[0].evidenceId, recorded.record.id);
        await recordManualVerification({
          ...options, checkId: "hosted-ci", result: "fail",
          evidence: "https://ci.example.test/runs/matrix status=failure sha=candidate",
        });
        assert.equal((await evaluateTaskCompletionGate(options)).passed, false);
      });
    });
  }
}

test("CI per-check matching rejects historical lower types and unrelated hosted passes", async () => {
  await withTempDirectory(async (directory) => {
    await setupHostedCiRepo(directory, [{
      id: "hosted-ci", type: "automated", required: true, environment: "ci", profile: "report", command: "pass",
    }]);
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" };
    const diagnostic = await verifyTask({ ...options, runCommand: async () => 0 });
    for (const type of ["report", "manual", "automated-test"] as const) {
      await appendTaskEvidence(directory, {
        taskId: "0007", agent: "codex-a", gateEligible: true, runId: "historical-local-" + type,
        type, result: "pass", subject: diagnostic.subject, checkId: "hosted-ci", profile: "report",
      });
    }
    await appendTaskEvidence(directory, {
      taskId: "0007", agent: "codex-a", gateEligible: true, runId: "unrelated-hosted",
      type: "ci", result: "pass", subject: diagnostic.subject, checkId: "another-ci", profile: "report",
    });
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.passed, false, "a category pass cannot substitute for this check's hosted result");
    assert.equal(gate.verification[0].result, "missing");
  });
});

test("hosted report evidence coherently satisfies report and artifact categories", async () => {
  await withTempDirectory(async (directory) => {
    await setupHostedCiRepo(directory, [{
      id: "hosted-ci", type: "manual", required: true, environment: "ci", profile: "report",
      instruction: "Observe hosted CI.", artifact: "reports/release.json",
    }]);
    const taskPath = join(directory, ".tasks", "0007-hosted-task.md");
    const { task } = await loadTaskFile(taskPath);
    await writeTaskFile(taskPath, { ...task, tags: ["security"] });
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a" };
    const recorded = await recordManualVerification({
      ...options, checkId: "hosted-ci", result: "pass",
      evidence: "https://ci.example.test/runs/report status=success sha=candidate",
    });
    const gate = await evaluateTaskCompletionGate(options);
    assert.deepEqual(gate.policy.declaredEvidenceCategories, ["artifact", "ci", "report"]);
    assert.equal(gate.verification[0].result, "pass");
    assert.ok(gate.evidenceIds.includes(recorded.record.id));
    assert.ok(!gate.blockers.some((blocker) => /Missing current (report|ci|artifact) evidence/.test(blocker)));
  });
});

test("required environment ci checks declare the ci evidence category", () => {
  const policy = resolveTaskPolicy({
    ...TASK,
    risk: "high",
    tags: [],
    verification: [
      { id: "hosted-ci", type: "automated", required: true, environment: "ci", profile: "deterministic", command: "pass" },
    ],
  });
  assert.ok(policy.declaredEvidenceCategories.includes("ci"));
});

test("local verify of an environment ci check records diagnostic-only evidence", async () => {
  await withTempDirectory(async (directory) => {
    await setupHostedCiRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });
    assert.equal(verification.checkResults.find((check) => check.id === "hosted-ci")?.status, "pass");

    const records = (await readTaskEvidence(directory, "0007")).filter((record) => record.checkId === "hosted-ci");
    assert.ok(records.length > 0);
    assert.ok(records.every((record) => record.type !== "ci"));
    assert.ok(records.every((record) => record.gateEligible !== true));

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("hosted-ci")));
  });
});

test("explicit candidate-bound hosted ci evidence satisfies the gate requirement", async () => {
  await withTempDirectory(async (directory) => {
    await setupHostedCiRepo(directory);
    await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });

    const recorded = await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "hosted-ci",
      result: "pass",
      evidence: "https://ci.example.test/runs/1 status=success sha=abc",
    });
    assert.equal(recorded.type, "ci");
    assert.equal(recorded.gateEligible, true);

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, true, gate.blockers.join("; "));
  });
});

test("a later local verify does not shadow a current hosted ci pass", async () => {
  await withTempDirectory(async (directory) => {
    await setupHostedCiRepo(directory);
    await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "hosted-ci",
      result: "pass",
      evidence: "https://ci.example.test/runs/2 status=success sha=abc",
    });
    await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      runCommand: async () => 0,
    });

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, true, gate.blockers.join("; "));
    assert.equal(gate.verification.find((check) => check.checkId === "hosted-ci")?.result, "pass");
  });
});

test("a candidate change makes a prior hosted ci pass stale and blocks the gate", async () => {
  await withTempDirectory(async (directory) => {
    await setupHostedCiRepo(directory);
    await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "hosted-ci",
      result: "pass",
      evidence: "https://ci.example.test/runs/3 status=success sha=old",
    });
    await writeFile(join(directory, "src", "core", "tasks", "change.ts"), "change\n", "utf8");

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => /hosted-ci/.test(blocker) && /another candidate revision|stale/.test(blocker)));
  });
});

test("a hosted ci failure blocks the gate", async () => {
  await withTempDirectory(async (directory) => {
    await setupHostedCiRepo(directory);
    await recordManualVerification({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-a",
      checkId: "hosted-ci",
      result: "fail",
      evidence: "https://ci.example.test/runs/4 status=failure sha=abc",
    });

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("hosted-ci") && blocker.includes("fail")));
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

test("completion gate does not require optional-only evidence categories", async () => {
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
      tags: ["ci"],
      verification: [
        {
          id: "unit",
          type: "automated",
          required: true,
          environment: "local",
          profile: "deterministic",
          command: "pass",
        },
        {
          id: "live-smoke",
          type: "manual",
          required: false,
          environment: "live",
          profile: "trusted",
          instruction: "Check the live system when available.",
          evidence: "live URL/status",
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
    assert.equal(verification.checkResults.find((result) => result.id === "live-smoke")?.status, "unavailable");

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, true);
    assert.equal(gate.blockers.some((blocker) => /live|manual|live-smoke/.test(blocker)), false);
  });
});

test("completion gate keeps tag evidence requirements over optional checks", async () => {
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
      tags: ["deployment"],
      verification: [
        {
          id: "unit",
          type: "automated",
          required: true,
          environment: "local",
          profile: "deterministic",
          command: "pass",
        },
        {
          id: "live-smoke",
          type: "manual",
          required: false,
          environment: "live",
          profile: "trusted",
          instruction: "Check the deployment when available.",
          evidence: "deployment URL/status",
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
    assert.equal(verification.checkResults.find((result) => result.id === "live-smoke")?.status, "unavailable");

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.includes("Evidence category live is required but not declared."));
    assert.ok(gate.blockers.includes("Missing current live evidence."));
  });
});

test("completion gate does not block on optional workflow review for non-release tags", async () => {
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
      risk: "high",
      dependsOn: [],
      tags: ["ci", "quality", "clean-checkout"],
      verification: [
        {
          id: "coverage",
          type: "automated",
          required: true,
          environment: "local",
          profile: "deterministic",
          command: "pass",
          artifact: "coverage/coverage-summary.json",
        },
        {
          id: "release-check",
          type: "automated",
          required: true,
          environment: "ci",
          profile: "report",
          command: "pass",
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

    await recordManualVerification({
      rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-a",
      checkId: "release-check", result: "pass",
      evidence: "https://ci.example.test/runs/release-check status=success sha=candidate",
    });

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.equal(gate.blockers.some((blocker) => /live|manual|workflow-review/.test(blocker)), false);
    assert.deepEqual(gate.blockers, ["Missing independent review evidence."]);
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
      tags: [...TASK.tags, "large"],
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

test("ordinary medium task completes without a separate review record", async () => {
  await withTempDirectory(async (directory) => {
    const git = async (...args: string[]) => {
      await execFileAsync("git", args, { cwd: directory });
    };
    await git("init", "--quiet");
    await git("config", "user.email", "codex@example.test");
    await git("config", "user.name", "Codex");
    await mkdir(join(directory, ".tasks"), { recursive: true });
    await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
    await writeTaskFile(join(directory, ".tasks", "0007-medium-task.md"), {
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
    await registerAgent(directory, { id: "codex-owner", developer: "alice", platform: "codex", model: "gpt-5" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner" });
    await writeFile(join(directory, "src", "core", "tasks", "changed.ts"), "export const version = 1;\n", "utf8");
    await verifyTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner", runCommand: async () => 0 });

    const policy = resolveTaskPolicy(await loadTaskFile(join(directory, ".tasks", "0007-medium-task.md")).then((loaded) => loaded.task));
    assert.equal(policy.requirements.assurance, "self-check");
    assert.equal(policy.requirements.independentReview, false);

    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, true, gate.blockers.join("; "));
    assert.equal(gate.review.freshness, "missing");
    assert.equal(gate.review.reason, "independent review is not required");

    const done = await doneTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner" });
    assert.equal(done.state, "done");
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
      tags: [...TASK.tags, "large"],
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
      tags: [...TASK.tags, "large"],
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

test("createTask rejects an allowed child inside a forbidden parent before writing", async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, ".agentic"), { recursive: true });
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({}), "utf8");

    await assert.rejects(
      () => createTask(directory, ".tasks", {
        title: "Scoped Internal App Change",
        mode: "product",
        lane: "implementation",
        scope: ["tasks"],
        risk: "medium",
        parallel: false,
        dependsOn: [],
        tags: [],
        goal: "Create a narrowly scoped task contract.",
        contextFiles: ["AGENTS.md"],
        allowedFiles: ["internal/app/asset/**"],
        forbiddenFiles: ["internal/app/**"],
        steps: ["Implement the change."],
        acceptanceCriteria: ["The narrow allowlist is preserved."],
        verificationCommands: ["pnpm test"],
        documentationUpdates: [],
        notes: [],
      }),
      /Path contract validation failed before writing task.*positive allowedFiles already bounds edits.*remove or narrow the broad forbidden parent/s,
    );
    await assert.rejects(
      () => readFile(join(directory, ".tasks", "0001-scoped-internal-app-change.md"), "utf8"),
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

test("archiveTask refuses to archive non-terminal tasks", async () => {
  await withTempDirectory(async (directory) => {
    const states: Array<"todo" | "blocked"> = [
      "todo", "blocked",
    ];

    for (const state of states) {
      await writeTaskFile(
        join(directory, ".tasks", `0010-${state}-task.md`),
        { ...TASK, id: "0010", title: `${state} Task`, state },
      );

      await assert.rejects(
        () => archiveTask(directory, ".tasks", "0010"),
        /only done or canceled tasks can be archived/,
      );

      await rm(join(directory, ".tasks", `0010-${state}-task.md`), { force: true });
    }
  });
});

test("archiveTask supports canceled tasks and preserves bytes with ID dependents", async () => {
  await withTempDirectory(async (directory) => {
    const canceledPath = join(directory, ".tasks", "0010-canceled-task.md");
    await writeTaskFile(canceledPath, {
      ...TASK,
      id: "0010",
      title: "Canceled Task",
      state: "canceled",
      owner: "archive",
      contextFiles: [".tasks/0010-canceled-task.md"],
    });
    await writeTaskFile(join(directory, ".tasks", "0011-dependent-task.md"), {
      ...TASK,
      id: "0011",
      title: "Dependent Task",
      dependsOn: ["0010"],
    });
    const before = await readFile(canceledPath);
    const preview = await previewArchiveTask(directory, ".tasks", "0010");

    assert.equal(preview.state, "canceled");
    assert.equal(preview.canArchive, true);
    assert.deepEqual(preview.dependents.map((dependent) => dependent.id), ["0011"]);
    const result = await archiveTask(directory, ".tasks", "0010");

    assert.equal(result.archivePath, ".tasks/archive/0010-canceled-task.md");
    assert.deepEqual(await readFile(join(directory, result.archivePath)), before);
    const archived = await listArchivedTaskFiles(directory);
    assert.equal(archived.find((file) => file.task.id === "0010")?.task.state, "canceled");
    assert.equal(validateTaskDependencies(await listTaskFiles(directory), archived).length, 0);
  });
});

test("archive preview blocks live literal task-path references before mutation", async () => {
  await withTempDirectory(async (directory) => {
    const taskPath = join(directory, ".tasks", "0001-done-task.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      id: "0001",
      title: "Done Task",
      state: "done",
      owner: "archive",
    });
    await writeTaskFile(join(directory, ".tasks", "0002-active-task.md"), {
      ...TASK,
      id: "0002",
      title: "Active Task",
      contextFiles: [".tasks/0001-done-task.md"],
    });
    const before = await readFile(taskPath, "utf8");

    const preview = await previewArchiveTasks(directory, ".tasks", ["0001"]);
    assert.equal(preview.plans[0]?.canArchive, false);
    assert.match(preview.plans[0]?.blockers.join("\n") ?? "", /0002-active-task\.md/);
    await assert.rejects(
      () => archiveTask(directory, ".tasks", "0001"),
      /cannot be archived safely.*literal reference/s,
    );
    assert.equal(await readFile(taskPath, "utf8"), before);
    assert.deepEqual((await readdir(join(directory, ".tasks"))).sort(), ["0001-done-task.md", "0002-active-task.md"]);
  });
});

test("archive preview scans no-Git source, immutable history, and binary references", async () => {
  await withTempDirectory(async (directory) => {
    const taskPath = join(directory, ".tasks", "0001-done-task.md");
    await writeTaskFile(taskPath, {
      ...TASK,
      id: "0001",
      title: "Done Task",
      state: "done",
      owner: "archive",
    });
    await mkdir(join(directory, "src"), { recursive: true });
    await mkdir(join(directory, "docs", "releases"), { recursive: true });
    const literal = ".tasks/0001-done-task.md";
    await writeFile(join(directory, "src", "fixture.ts"), `const taskPath = ${JSON.stringify(literal)};\n`, "utf8");
    await writeFile(join(directory, "docs", "releases", "history.md"), `Historical note: ${literal}\n`, "utf8");
    await writeFile(
      join(directory, "src", "fixture.bin"),
      Buffer.concat([Buffer.from([0xff, 0x00]), Buffer.from(`${literal}\n`)]),
    );

    const preview = await previewArchiveTask(directory, ".tasks", "0001");
    assert.equal(preview.canArchive, false);
    assert.ok(preview.references.some((reference) => reference.path === "src/fixture.ts" && reference.kind === "tracked-text"));
    assert.ok(preview.references.some((reference) => reference.path === "docs/releases/history.md" && reference.kind === "immutable-history"));
    assert.ok(preview.references.some((reference) => reference.path === "src/fixture.bin" && reference.kind === "tracked-text"));
    assert.match(preview.blockers.join("\n"), /src\/fixture\.bin/);
  });
});

test("archive --all blocks candidate-to-candidate literal references", async () => {
  await withTempDirectory(async (directory) => {
    const firstPath = join(directory, ".tasks", "0001-done-first.md");
    const secondPath = join(directory, ".tasks", "0002-done-second.md");
    await writeTaskFile(firstPath, {
      ...TASK,
      id: "0001",
      title: "Done First",
      state: "done",
      owner: "archive",
      contextFiles: [".tasks/0002-done-second.md"],
    });
    await writeTaskFile(secondPath, {
      ...TASK,
      id: "0002",
      title: "Done Second",
      state: "done",
      owner: "archive",
    });

    const preview = await previewArchiveTasks(directory, ".tasks");
    assert.equal(preview.plans.find((plan) => plan.taskId === "0001")?.canArchive, true);
    const secondPlan = preview.plans.find((plan) => plan.taskId === "0002");
    assert.equal(secondPlan?.canArchive, false);
    assert.match(secondPlan?.blockers.join("\n") ?? "", /0001-done-first\.md/);

    const result = await archiveAllTasks(directory, ".tasks");
    assert.deepEqual(result.archived.map((entry) => entry.taskId), ["0001"]);
    assert.deepEqual(result.skipped.map((entry) => entry.taskId), ["0002"]);
  });
});

test("archive --all moves multiple terminal tasks in a Git checkout", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(join(directory, ".tasks", "0001-done-first.md"), {
      ...TASK,
      id: "0001",
      title: "Done First",
      state: "done",
      owner: "archive",
    });
    await writeTaskFile(join(directory, ".tasks", "0002-canceled-second.md"), {
      ...TASK,
      id: "0002",
      title: "Canceled Second",
      state: "canceled",
      owner: "archive",
    });
    await execFileAsync("git", ["init", "-q"], { cwd: directory });
    await execFileAsync("git", ["add", "."], { cwd: directory });
    await execFileAsync("git", [
      "-c", "user.name=APK Test",
      "-c", "user.email=apk-test@example.invalid",
      "commit", "-qm", "fixture",
    ], { cwd: directory });

    const result = await archiveAllTasks(directory, ".tasks");
    assert.deepEqual(result.archived.map((entry) => entry.taskId), ["0001", "0002"]);
    assert.equal(result.skipped.length, 0);
    assert.doesNotReject(() => readFile(join(directory, ".tasks", "archive", "0001-done-first.md")));
    assert.doesNotReject(() => readFile(join(directory, ".tasks", "archive", "0002-canceled-second.md")));
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

test("archiveAllTasks skips unsafe literal references without partial guessing", async () => {
  await withTempDirectory(async (directory) => {
    const unsafePath = join(directory, ".tasks", "0001-done-unsafe.md");
    const safePath = join(directory, ".tasks", "0002-canceled-safe.md");
    await writeTaskFile(unsafePath, {
      ...TASK,
      id: "0001",
      title: "Unsafe Done",
      state: "done",
      owner: "archive",
    });
    await writeTaskFile(safePath, {
      ...TASK,
      id: "0002",
      title: "Safe Canceled",
      state: "canceled",
      owner: "archive",
    });
    await writeTaskFile(join(directory, ".tasks", "0003-active-task.md"), {
      ...TASK,
      id: "0003",
      title: "Active Task",
      contextFiles: [".tasks/0001-done-unsafe.md"],
    });

    const result = await archiveAllTasks(directory, ".tasks");

    assert.deepEqual(result.archived.map((entry) => entry.taskId), ["0002"]);
    assert.deepEqual(result.skipped.map((entry) => entry.taskId), ["0001"]);
    assert.match(result.skipped[0]?.blockers.join("\n") ?? "", /0003-active-task\.md/);
    assert.doesNotReject(() => readFile(unsafePath));
    assert.doesNotReject(() => readFile(join(directory, ".tasks", "archive", "0002-canceled-safe.md")));
  });
});

test("archive preview and apply skip archive path collisions consistently", async () => {
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

    const preview = await previewArchiveTask(directory, ".tasks", "0001");
    assert.equal(preview.canArchive, false);
    assert.match(preview.blockers.join("\n"), /Archive path already exists/);
    const result = await archiveAllTasks(directory, ".tasks");
    assert.deepEqual(result.archived, []);
    assert.deepEqual(result.skipped.map((entry) => entry.taskId), ["0001"]);
    assert.doesNotReject(
      () => readFile(join(directory, ".tasks", "0001-done-task.md")),
    );
  });
});

test("archive preview reports malformed unrelated archive files as a blocker", async () => {
  await withTempDirectory(async (directory) => {
    await writeTaskFile(
      join(directory, ".tasks", "0001-done-task.md"),
      { ...TASK, id: "0001", title: "Done Task", state: "done", owner: "archive" },
    );
    await mkdir(join(directory, ".tasks", "archive"), { recursive: true });
    await writeFile(join(directory, ".tasks", "archive", "9999-malformed.md"), "not a task", "utf8");

    const preview = await previewArchiveTask(directory, ".tasks", "0001");
    assert.equal(preview.canArchive, false);
    assert.match(preview.blockers.join("\n"), /cannot parse existing archive files/);
    assert.doesNotReject(() => readFile(join(directory, ".tasks", "0001-done-task.md")));
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

test("bounded lifecycle reason normalization separates storage from display", () => {
  const short = "short reason";
  assert.equal(normalizeReasonText(short), short);
  assert.equal(summarizeReasonText(short), short);

  const exactly160 = "a".repeat(160);
  assert.equal(normalizeReasonText(exactly160).length, 160);
  assert.equal(summarizeReasonText(exactly160), exactly160);

  const d161 = "b".repeat(161);
  assert.equal(normalizeReasonText(d161).length, 161);
  const summary = summarizeReasonText(d161);
  assert.equal(summary.length, 160);
  assert.ok(summary.endsWith("…"), "compact summary must indicate truncation");

  const nearMax = "c".repeat(REASON_STORAGE_LIMIT - 1);
  assert.equal(normalizeReasonText(nearMax).length, REASON_STORAGE_LIMIT - 1);

  const overMax = "d".repeat(REASON_STORAGE_LIMIT + 500);
  assert.equal(normalizeReasonText(overMax).length, REASON_STORAGE_LIMIT);

  const multiline = "line one\n\n  line two\t line three  ";
  assert.equal(normalizeReasonText(multiline), "line one line two line three");

  const emoji = "🙂".repeat(4);
  assert.equal(normalizeReasonText(emoji, 5), "🙂🙂");
  assert.equal(Buffer.from(normalizeReasonText(emoji, 5), "utf8").toString("utf8"), "🙂🙂");
});

test("block stores the full bounded transition reason in task notes", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const reason = "R".repeat(400);
    await blockTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a", reason });

    const { task } = await loadTaskFile(join(directory, ".tasks", "0007-scoped-task.md"));
    assert.equal(task.state, "blocked");
    assert.equal(task.notes.at(-1), `block: ${reason}`);
    assert.ok(task.notes.at(-1)!.length > 160);
    assert.equal(task.notes[0], TASK.notes[0]);

    const huge = "H".repeat(REASON_STORAGE_LIMIT + 1000);
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await blockTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a", reason: huge });
    const bounded = await loadTaskFile(join(directory, ".tasks", "0007-scoped-task.md"));
    const stored = bounded.task.notes.at(-1)!;
    assert.equal(stored, `block: ${"H".repeat(REASON_STORAGE_LIMIT)}`);
  });
});

test("cancel stores the full bounded transition reason in task notes", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const reason = "cancel ".repeat(60).trim();
    await cancelTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a", reason });

    const { task } = await loadTaskFile(join(directory, ".tasks", "0007-scoped-task.md"));
    assert.equal(task.state, "canceled");
    assert.equal(task.notes.at(-1), `cancel: ${reason}`);
    assert.ok(task.notes.at(-1)!.length > 160);
  });
});

test("release and block keep bounded full reasons in the runtime run log", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const releaseReason = "release " + "x".repeat(400);
    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a", reason: releaseReason });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const blockReason = "block " + "y".repeat(400);
    await blockTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a", reason: blockReason });

    const runs = (await readRunLog(directory)).filter((event) => event.task === "0007");
    const release = runs.find((event) => event.event === "release");
    const block = runs.find((event) => event.event === "block");
    assert.equal(release?.reason, releaseReason);
    assert.equal(block?.reason, blockReason);
    assert.ok((release?.reason ?? "").length > 160);
    assert.ok((block?.reason ?? "").length > 160);

    await releaseTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    const huge = "Z".repeat(REASON_STORAGE_LIMIT + 1000);
    await blockTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a", reason: huge });
    const boundedRuns = (await readRunLog(directory)).filter((event) => event.task === "0007" && event.event === "block");
    assert.equal(boundedRuns.at(-1)?.reason, "Z".repeat(REASON_STORAGE_LIMIT));
  });
});

test("legacy short lifecycle reasons remain unchanged and readable", async () => {
  await withTempDirectory(async (directory) => {
    await setupReclaimRepo(directory);
    await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a" });
    await blockTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "agent-a", reason: "waiting on dependency" });
    const { task } = await loadTaskFile(join(directory, ".tasks", "0007-scoped-task.md"));
    assert.equal(task.notes.at(-1), "block: waiting on dependency");
    assert.ok(REASON_DISPLAY_LIMIT < REASON_STORAGE_LIMIT);
  });
});

interface DecisionHarness {
  directory: string;
  changedFile: string;
}

interface DecisionRepoOptions {
  risk?: ProjectTask["risk"];
  resources?: {
    models: unknown[];
    harnesses: unknown[];
    workers: unknown[];
  };
  frontierRuns?: number;
}

async function setupDecisionRepo(
  directory: string,
  options: DecisionRepoOptions = {},
): Promise<DecisionHarness> {
  const git = async (...args: string[]) => {
    await execFileAsync("git", args, { cwd: directory });
  };
  await git("init", "--quiet");
  await git("config", "user.email", "codex@example.test");
  await git("config", "user.name", "Codex");
  await mkdir(join(directory, ".tasks"), { recursive: true });
  await mkdir(join(directory, "src", "core", "tasks"), { recursive: true });
  if (options.resources || options.frontierRuns) {
    await mkdir(join(directory, ".agentic"), { recursive: true });
  }
  if (options.resources) {
    await writeFile(join(directory, ".agentic", "config.json"), JSON.stringify({ resources: options.resources }), "utf8");
  }
  for (let index = 1; index <= (options.frontierRuns ?? 0); index += 1) {
    const runDirectory = join(directory, ".agentic", "sessions", "work", "0007", `frontier-run-${index}`);
    await mkdir(runDirectory, { recursive: true });
    await writeFile(join(runDirectory, "metadata.json"), JSON.stringify({
      protocol: "apk-worker-v1",
      taskId: "0007",
      runId: `frontier-run-${index}`,
      owner: "codex-reviewer",
      resourceId: "frontier-review",
      role: "review",
      packageHash: "fixture",
    }), "utf8");
    await writeFile(join(runDirectory, "activation.json"), JSON.stringify({
      protocol: "apk-worker-v1",
      taskId: "0007",
      runId: `frontier-run-${index}`,
      packageHash: "fixture",
      activatedAt: "2026-10-05T00:00:00.000Z",
    }), "utf8");
  }
  await writeTaskFile(join(directory, ".tasks", "0007-decision-task.md"), {
    ...TASK,
    state: "todo",
    owner: "none",
    risk: options.risk ?? "medium",
    tags: [...TASK.tags, "large"],
    dependsOn: [],
    allowedFiles: [
      "src/core/tasks/**",
      ...(options.resources ? [".agentic/config.json"] : []),
      ...(options.frontierRuns ? [".agentic/sessions/**"] : []),
    ],
    forbiddenFiles: [],
    verificationCommands: ["pass"],
  });
  await git("add", ".");
  await git("commit", "--quiet", "-m", "initial");
  await registerAgent(directory, { id: "codex-owner", developer: "alice", platform: "codex", model: "gpt-5" });
  await registerAgent(directory, { id: "codex-reviewer", developer: "bob", platform: "codex", model: "gpt-5" });
  await registerAgent(directory, { id: "codex-recorder", developer: "carol", platform: "codex", model: "gpt-5" });
  await claimTask({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007", owner: "codex-owner" });
  const changedFile = join(directory, "src", "core", "tasks", "changed.ts");
  await writeFile(changedFile, "export const version = 1;\n", "utf8");
  return { directory, changedFile };
}

for (const [risk, maximum] of [["medium", 8], ["critical", 10]] as const) {
  test(`a current passing review on the final ${risk} budget pass is accepted`, async () => {
    await withTempDirectory(async (directory) => {
      await setupDecisionRepo(directory, { risk });
      const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
      const verification = await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 0 });
      for (let index = 1; index < maximum; index += 1) {
        await recordTaskReview({
          ...options,
          reviewer: "codex-reviewer",
          outcome: "changes_requested",
          findings: [`Finding ${index}.`],
          implementationRunId: verification.runId,
        });
      }
      await recordTaskReview({
        ...options,
        reviewer: "codex-reviewer",
        outcome: "pass",
        implementationRunId: verification.runId,
      });
      const gate = await evaluateTaskCompletionGate(options);
      assert.equal(gate.passed, true);
      assert.equal(gate.review.budget?.maxReviewPasses, maximum);
      assert.equal(gate.review.budget?.passesUsed, maximum);
      assert.equal(gate.review.budget?.exhausted, true);
      assert.equal(gate.review.outcome, "pass");
      assert.ok(!gate.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
      await assert.rejects(
        () => recordTaskReview({
          ...options,
          reviewer: "codex-reviewer",
          outcome: "pass",
          implementationRunId: verification.runId,
        }),
        /Review budget exhausted/,
      );
    });
  });
}

test("the gate blocks a current pass recorded after the total review budget overrun", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
    const verification = await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 0 });
    const candidate = await captureTaskCompletionCandidate(options);
    for (let index = 1; index <= 9; index += 1) {
      await appendTaskEvidence(directory, {
        taskId: "0007",
        runId: `overrun-review-${index}`,
        agent: "codex-reviewer",
        gateEligible: true,
        type: "review",
        result: index === 9 ? "pass" : "changes_requested",
        subject: candidate.subject,
        reviewer: "codex-reviewer",
        implementationRunId: verification.runId,
        summary: index === 9 ? "Independent review passed." : `Finding ${index}.`,
      });
    }
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.review.budget?.passesUsed, 9);
    assert.equal(gate.review.outcome, "pass");
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Review budget overrun")));
  });
});

test("the gate counts task-bound frontier review passes and activated runs", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory, {
      resources: {
        models: [{ id: "frontier-model", roles: ["review"] }],
        harnesses: [{ id: "frontier-harness", sessionIsolation: true, workerProtocols: ["apk-worker-v1"] }],
        workers: [{
          id: "frontier-review",
          modelId: "frontier-model",
          harnessId: "frontier-harness",
          location: "remote",
          billingMode: "subscription",
          costClass: "scarce-frontier",
          availability: "available",
          capacity: 1,
          capabilities: { roles: ["review"], workerProtocols: ["apk-worker-v1"] },
        }],
      },
      frontierRuns: 1,
    });
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
    const verification = await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 0 });
    await recordTaskReview({
      ...options,
      reviewer: "codex-reviewer",
      outcome: "changes_requested",
      implementationRunId: verification.runId,
      resourceId: "frontier-review",
    });
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.review.budget?.maxReviewPasses, 8);
    assert.equal(gate.review.budget?.passesUsed, 1);
    assert.equal(gate.review.budget?.frontierPassesUsed, 1);
    assert.equal(gate.review.budget?.maxFrontierReviewPasses, 1);
    assert.equal(gate.review.budget?.frontierRunsUsed, 1);
    assert.equal(gate.review.budget?.maxFrontierRuns, 1);
    assert.equal(gate.review.budget?.frontierExhausted, true);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Frontier review budget exhausted")));
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Frontier run budget exhausted")));
  });
});

test("malformed activated frontier metadata is counted conservatively", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory, {
      resources: {
        models: [{ id: "frontier-model", roles: ["review"] }],
        harnesses: [{ id: "frontier-harness", sessionIsolation: true, workerProtocols: ["apk-worker-v1"] }],
        workers: [{
          id: "frontier-review",
          modelId: "frontier-model",
          harnessId: "frontier-harness",
          location: "remote",
          billingMode: "subscription",
          costClass: "scarce-frontier",
          availability: "available",
          capacity: 1,
          capabilities: { roles: ["review"], workerProtocols: ["apk-worker-v1"] },
        }],
      },
      frontierRuns: 1,
    });
    const metadataPath = join(directory, ".agentic", "sessions", "work", "0007", "frontier-run-1", "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Record<string, unknown>;
    delete metadata.resourceId;
    await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`, "utf8");

    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.review.budget?.frontierRunsUsed, 1);
    assert.equal(gate.review.budget?.frontierExhausted, true);
  });
});

test("frontier review history keeps its recorded cost when the registry changes", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory, {
      resources: {
        models: [{ id: "frontier-model", roles: ["review"] }],
        harnesses: [{ id: "frontier-harness", sessionIsolation: true, workerProtocols: ["apk-worker-v1"] }],
        workers: [{
          id: "frontier-review",
          modelId: "frontier-model",
          harnessId: "frontier-harness",
          location: "remote",
          billingMode: "subscription",
          costClass: "scarce-frontier",
          availability: "available",
          capacity: 1,
          capabilities: { roles: ["review"], workerProtocols: ["apk-worker-v1"] },
        }],
      },
    });
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
    const verification = await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 0 });
    await recordTaskReview({
      ...options,
      reviewer: "codex-reviewer",
      outcome: "changes_requested",
      implementationRunId: verification.runId,
      resourceId: "frontier-review",
    });
    const configPath = join(directory, ".agentic", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as { resources: { workers: Array<{ costClass: string }> } };
    config.resources.workers[0].costClass = "cheap";
    await writeFile(configPath, `${JSON.stringify(config)}\n`, "utf8");
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.review.budget?.frontierPassesUsed, 1);
  });
});

// Operator assertions below are isolated test fixtures, never repository authorization.
for (const staleDecision of ["grant-review-passes", "accept-current", "changes-required"] as const) {
  test(`current operator grant wins over stale ${staleDecision} history`, async () => {
    await withTempDirectory(async (directory) => {
      const repo = await setupDecisionRepo(directory);
      const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
      const oldVerification = await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 0 });
      for (let index = 0; index < 2; index += 1) {
        await recordTaskReview({ ...options, reviewer: "codex-reviewer", outcome: "changes_requested", implementationRunId: oldVerification.runId });
      }
      const historical = await recordTaskHumanDecision({
        ...options, recorder: "codex-recorder", actor: "fixture-operator", decision: staleDecision,
        reason: "Fixture assertion for the earlier candidate.",
        ...(staleDecision === "grant-review-passes" ? { reviewBudgetGrant: 2 } : {}),
      });
      await writeFile(repo.changedFile, "export const version = 2;\n", "utf8");
      await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 0 });
      const current = await recordTaskHumanDecision({
        ...options, recorder: "codex-recorder", actor: "fixture-operator", decision: "grant-review-passes",
        reason: "Fixture assertion granting one pass to this candidate.", reviewBudgetGrant: 1,
      });
      const gate = await evaluateTaskCompletionGate(options);
      assert.equal(gate.review.decision?.evidenceId, current.evidence.id);
      assert.equal(gate.review.decision?.freshness, "current");
      assert.equal(gate.review.budget?.grantedPasses, 1);
      assert.equal(gate.review.budget?.effectiveMaxReviewPasses, 9);
      assert.equal(gate.review.budget?.passesUsed, 2, "stale review history remains counted and is not reset for the new candidate");
      assert.equal(gate.review.budget?.exhausted, false);
      assert.equal(gate.passed, false, "a grant cannot replace current independent review");
      assert.ok(!gate.blockers.some((blocker) => /Human decision changes-required/.test(blocker)));
      const provenance = await buildTaskProvenance(directory, ".tasks", "0007");
      assert.equal(provenance.evidence.find((record) => record.id === current.evidence.id)?.freshness, "current");
      assert.equal(provenance.evidence.find((record) => record.id === historical.evidence.id)?.freshness, "stale");
      assert.equal((await listTaskHumanDecisions(directory, "0007")).length, 2);
    });
  });
}

for (const equalTimes of [false, true]) {
  test(`current operator decisions use deterministic ${equalTimes ? "ID tie-breaking" : "chronological ordering"}`, async () => {
    await withTempDirectory(async (directory) => {
      await setupDecisionRepo(directory);
      const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
      const { subject } = await captureTaskCompletionCandidate(options);
      // Append newest first to prove file order cannot select the older decision.
      for (const [id, time, decision] of [
        ["decision-z", "2026-10-03T10:00:02.000Z", "changes-required"],
        ["decision-a", equalTimes ? "2026-10-03T10:00:02.000Z" : "2026-10-03T10:00:01.000Z", "grant-review-passes"],
      ] as const) {
        await appendTaskEvidence(directory, {
          id, time, taskId: "0007", runId: id, agent: "codex-recorder", gateEligible: true,
          type: "human-decision", result: decision === "changes-required" ? "changes_requested" : "pass", subject, decision, actor: "fixture-operator",
          trustModel: "operator-asserted", ...(decision === "grant-review-passes" ? { reviewBudgetGrant: 1 } : {}),
        });
      }
      const gate = await evaluateTaskCompletionGate(options);
      assert.equal(gate.review.decision?.evidenceId, "decision-z");
      assert.equal(gate.review.decision?.decision, "changes-required");
      assert.equal(gate.review.budget?.grantedPasses, 1);
      assert.ok(gate.blockers.some((blocker) => blocker.includes("Human decision changes-required")));
    });
  });
}

test("invalid operator acceptance cannot supersede a bounded current grant", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
    const grant = await recordTaskHumanDecision({
      ...options, recorder: "codex-recorder", actor: "fixture-operator", decision: "grant-review-passes",
      reason: "Fixture grants two passes.", reviewBudgetGrant: 2,
    });
    await assert.rejects(appendTaskEvidence(directory, {
      taskId: "0007", runId: "legacy-acceptance", agent: "codex-recorder", gateEligible: true,
      type: "human-decision", result: "pass", subject: grant.evidence.subject,
      time: "2099-01-01T00:00:00.000Z", decision: "accept-current", actor: "fixture-operator",
      trustModel: "operator-asserted",
    }), /Evidence.resolvedBlocker must be review-budget-exhausted/);
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.review.decision?.decision, "grant-review-passes");
    assert.equal(gate.review.budget?.grantedPasses, 2);
    assert.equal(gate.passed, false);
    assert.doesNotMatch(gate.review.reason, /resolved by human decision/);
  });
});

test("current structured acceptance supersedes grants while preserving hard blockers", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
    const verification = await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 1 });
    for (let index = 0; index < 2; index += 1) {
      await recordTaskReview({ ...options, reviewer: "codex-reviewer", outcome: "changes_requested", implementationRunId: verification.runId });
    }
    await recordTaskHumanDecision({
      ...options, recorder: "codex-recorder", actor: "fixture-operator", decision: "grant-review-passes",
      reason: "Fixture grants two passes.", reviewBudgetGrant: 2,
    });
    const accepted = await recordTaskHumanDecision({
      ...options, recorder: "codex-recorder", actor: "fixture-operator", decision: "accept-current",
      reason: "Fixture accepts the exhausted review condition only.",
    });
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.review.decision?.evidenceId, accepted.evidence.id);
    assert.equal(gate.review.budget?.grantedPasses, 0);
    assert.equal(gate.review.budget?.effectiveMaxReviewPasses, 8);
    assert.equal(gate.review.budget?.passesUsed, 2);
    assert.equal(gate.passed, false);
    assert.match(gate.review.reason, /resolved by human decision/);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Required verification check check-1 is fail")));
    assert.ok(!gate.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
  });
});

test("stale changes-required stays visible without blocking a current independent pass", async () => {
  await withTempDirectory(async (directory) => {
    const repo = await setupDecisionRepo(directory);
    const options = { rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" };
    await recordTaskHumanDecision({
      ...options, recorder: "codex-recorder", actor: "fixture-operator", decision: "changes-required",
      reason: "Fixture requested changes to the old candidate.",
    });
    await writeFile(repo.changedFile, "export const version = 2;\n", "utf8");
    const verification = await verifyTask({ ...options, owner: "codex-owner", runCommand: async () => 0 });
    await recordTaskReview({ ...options, reviewer: "codex-reviewer", outcome: "pass", implementationRunId: verification.runId });
    const gate = await evaluateTaskCompletionGate(options);
    assert.equal(gate.review.decision?.decision, "changes-required");
    assert.equal(gate.review.decision?.freshness, "stale");
    assert.equal(gate.passed, true);
    assert.doesNotMatch(gate.review.reason, /resolved by human decision/);
  });
});

test("accept-current resolves only review-budget exhaustion for the bound candidate", async () => {
  await withTempDirectory(async (directory) => {
    const repo = await setupDecisionRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true);
    for (let index = 1; index <= 8; index += 1) {
      await recordTaskReview({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        reviewer: "codex-reviewer",
        outcome: "changes_requested",
        findings: [`Finding ${index}.`],
        implementationRunId: verification.runId,
      });
    }
    const blocked = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(blocked.passed, false);
    assert.ok(blocked.review.budget?.exhausted);
    assert.ok(blocked.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
    assert.equal(blocked.review.decision, undefined);

    const decision = await recordTaskHumanDecision({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      recorder: "codex-recorder",
      actor: "repo-operator",
      decision: "accept-current",
      reason: "Operator accepts the reviewed candidate after exhausted review budget.",
    });
    assert.equal(decision.evidence.decision, "accept-current");
    assert.equal(decision.evidence.actor, "repo-operator");
    assert.equal(decision.evidence.trustModel, "operator-asserted");
    assert.equal(decision.evidence.resolvedBlocker, "review-budget-exhausted");
    assert.ok(decision.gateEligible);

    const resolved = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(resolved.passed, true);
    assert.ok(resolved.review.decision);
    assert.equal(resolved.review.decision?.decision, "accept-current");
    assert.equal(resolved.review.decision?.actor, "repo-operator");
    assert.equal(resolved.review.decision?.freshness, "current");
    assert.match(resolved.review.reason, /resolved by human decision/);
    assert.ok((await listTaskHumanDecisions(directory, "0007")).length === 1);

    // Candidate mutation makes the decision stale and non-resolving.
    await writeFile(repo.changedFile, "export const version = 2;\n", "utf8");
    const staleDecisionGate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(staleDecisionGate.passed, false);
    assert.ok(staleDecisionGate.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
    assert.equal(staleDecisionGate.review.decision?.freshness, "stale");
    assert.match(staleDecisionGate.review.decision?.reason ?? "", /subject differs|belongs/);
  });
});

test("accept-current cannot bypass failed deterministic verification", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const failing = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 1,
    });
    assert.equal(failing.passed, false);
    await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "changes_requested",
      findings: ["Boundary not covered."],
      implementationRunId: failing.runId,
    });
    await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "changes_requested",
      findings: ["Boundary still not covered."],
      implementationRunId: failing.runId,
    });
    await recordTaskHumanDecision({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      recorder: "codex-recorder",
      actor: "repo-operator",
      decision: "accept-current",
      reason: "Operator attempted acceptance.",
    });
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Required verification check check-1 is fail")));
    assert.ok(!gate.passed);
    assert.ok(gate.blockers.every((blocker) => !blocker.includes("Review budget exhausted")));
  });
});

test("accept-current on a scope-violated candidate records no gate-eligible resolution", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    for (let index = 1; index <= 8; index += 1) {
      await recordTaskReview({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        reviewer: "codex-reviewer",
        outcome: "changes_requested",
        findings: [`Finding ${index}.`],
        implementationRunId: verification.runId,
      });
    }
    const before = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.ok(before.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
    await writeFile(join(directory, "out-of-scope.md"), "outside\n", "utf8");
    const decision = await recordTaskHumanDecision({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      recorder: "codex-recorder",
      actor: "repo-operator",
      decision: "accept-current",
      reason: "Operator accepts despite the violation.",
    });
    assert.equal(decision.gateEligible, false);
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
    assert.ok(gate.blockers.some((blocker) => blocker.startsWith("Scope violation:")));
    assert.equal(gate.review.decision, undefined);
  });
});

test("accept-attribution runs checks for explicitly approved intervening commits", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const outsidePath = join(directory, "urgent-hotfix.md");
    await writeFile(outsidePath, "urgent work\n", "utf8");
    await execFileAsync("git", ["add", "urgent-hotfix.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "urgent hotfix"], { cwd: directory });
    const acceptedCommit = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();

    const before = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(before.passed, false);
    assert.ok(before.blockers.some((blocker) => blocker.startsWith("Scope violation:")));

    const decision = await recordTaskHumanDecision({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      recorder: "codex-recorder",
      actor: "fixture-operator",
      decision: "accept-attribution",
      acceptedCommits: [acceptedCommit],
      reason: "Urgent hotfix was explicitly approved as an intervening commit.",
    });
    assert.equal(decision.gateEligible, true);
    assert.deepEqual(decision.evidence.acceptedCommits, [acceptedCommit]);

    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    assert.equal(verification.passed, true, verification.diagnostics.join("; "));
    await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "pass",
      implementationRunId: verification.runId,
    });
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, true, gate.blockers.join("; "));
    assert.ok(gate.evidenceIds.includes(decision.evidence.id));
    assert.equal(gate.comparisonKnown, true);

    await writeFile(join(directory, "new-unapproved.md"), "unapproved\n", "utf8");
    const stale = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(stale.passed, false);
    assert.ok(stale.blockers.some((blocker) => blocker.startsWith("Scope violation:")));
    assert.ok(!stale.evidenceIds.includes(decision.evidence.id));
  });
});

test("accept-attribution rejects a partial commit list and self-authorization", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    await writeFile(join(directory, "urgent-hotfix-1.md"), "one\n", "utf8");
    await execFileAsync("git", ["add", "urgent-hotfix-1.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "urgent one"], { cwd: directory });
    const firstCommit = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
    await writeFile(join(directory, "urgent-hotfix-2.md"), "two\n", "utf8");
    await execFileAsync("git", ["add", "urgent-hotfix-2.md"], { cwd: directory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "urgent two"], { cwd: directory });

    await assert.rejects(
      () => recordTaskHumanDecision({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        recorder: "codex-recorder",
        actor: "fixture-operator",
        decision: "accept-attribution",
        acceptedCommits: [firstCommit],
        reason: "The incomplete approval must fail closed.",
      }),
      /does not cover disputed paths/,
    );
    await assert.rejects(
      () => recordTaskHumanDecision({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        recorder: "codex-owner",
        actor: "codex-owner",
        decision: "accept-attribution",
        acceptedCommits: [firstCommit],
        reason: "The implementation owner cannot self-authorize.",
      }),
      /distinct from the recording agent/,
    );
  });
});

test("grant-review-passes extends the budget once and exhausts again after one more pass", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    for (let index = 1; index <= 8; index += 1) {
      await recordTaskReview({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        reviewer: "codex-reviewer",
        outcome: "changes_requested",
        findings: [`Finding ${index}.`],
        implementationRunId: verification.runId,
      });
    }
    const exhausted = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.ok(exhausted.review.budget?.exhausted);

    await recordTaskHumanDecision({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      recorder: "codex-recorder",
      actor: "repo-operator",
      decision: "grant-review-passes",
      reason: "Operator grants one more review pass.",
      reviewBudgetGrant: 1,
    });
    const granted = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(granted.review.budget?.exhausted, false);
    assert.equal(granted.review.budget?.grantedPasses, 1);
    assert.equal(granted.review.budget?.effectiveMaxReviewPasses, 9);
    assert.ok(granted.blockers.some((blocker) => blocker.includes("Independent review is changes_requested")));
    assert.ok(granted.blockers.every((blocker) => !blocker.includes("Review budget exhausted")));

    await recordTaskReview({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      reviewer: "codex-reviewer",
      outcome: "changes_requested",
      implementationRunId: verification.runId,
    });
    const consumed = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(consumed.review.budget?.exhausted, true);
    assert.equal(consumed.review.budget?.grantedPasses, 1);
    assert.ok(consumed.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
  });
});

test("changes-required decisions never satisfy the gate", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const verification = await verifyTask({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      owner: "codex-owner",
      runCommand: async () => 0,
    });
    for (let index = 1; index <= 8; index += 1) {
      await recordTaskReview({
        rootDirectory: directory,
        taskDirectory: ".tasks",
        taskId: "0007",
        reviewer: "codex-reviewer",
        outcome: "changes_requested",
        findings: [`Finding ${index}.`],
        implementationRunId: verification.runId,
      });
    }
    await recordTaskHumanDecision({
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      recorder: "codex-recorder",
      actor: "repo-operator",
      decision: "changes-required",
      reason: "Operator requires the boundary fix first.",
    });
    const gate = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(gate.passed, false);
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Independent review is changes_requested")));
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Human decision changes-required")));
    assert.ok(gate.blockers.some((blocker) => blocker.includes("Review budget exhausted")));
    assert.equal(gate.review.decision?.decision, "changes-required");
  });
});

test("human decision recording enforces the operator trust boundary and cancel routes to cancellation", async () => {
  await withTempDirectory(async (directory) => {
    await setupDecisionRepo(directory);
    const decisionOptions = {
      rootDirectory: directory,
      taskDirectory: ".tasks",
      taskId: "0007",
      recorder: "codex-recorder",
      actor: "codex-recorder",
      decision: "accept-current" as const,
      reason: "Agent self-authorizing attempt.",
    };
    await assert.rejects(
      () => recordTaskHumanDecision(decisionOptions),
      /cannot authorize itself/,
    );
    await assert.rejects(
      () => recordTaskHumanDecision({
        ...decisionOptions,
        actor: "repo-operator",
        reason: "",
      }),
      /non-empty decision reason/,
    );
    await assert.rejects(
      () => recordTaskHumanDecision({
        ...decisionOptions,
        actor: "repo-operator",
        reason: "no explicit operator decision exists",
        reviewBudgetGrant: 1,
      }),
      /only valid for grant-review-passes/,
    );

    // Agenda gate never synthesizes a decision when the operator has not communicated one.
    const noDecision = await evaluateTaskCompletionGate({ rootDirectory: directory, taskDirectory: ".tasks", taskId: "0007" });
    assert.equal(noDecision.review.decision, undefined);
    assert.ok((await listTaskHumanDecisions(directory, "0007")).length === 0);
  });
});

test("review prompt presents spec and engineering axes with a conservative overall rule", () => {
  const prompt = renderTaskReviewPrompt({
    task: TASK,
    reviewer: "codex-reviewer",
    subject: {
      taskId: TASK.id,
      repository: "git",
      baselineId: "baseline:test",
      candidateId: "candidate:test",
      worktreeId: "worktree:test",
    },
    changedFiles: ["src/core/tasks/changed.ts"],
  });

  assert.match(prompt, /Spec correctness:/);
  assert.match(prompt, /Engineering quality:/);
  assert.match(prompt, /label each finding with the axis/);
  assert.match(prompt, /Disclose coverage explicitly/i);
  assert.match(prompt, /Report one Overall outcome, and keep it conservative/i);
  assert.match(prompt, /if either axis requires changes or fails, the Overall outcome cannot be pass/i);
  assert.match(prompt, /a matter of taste is not an invented blocker/i);
  assert.match(prompt, /Submit one Overall outcome: pass, changes_requested, or fail\./);
  assert.match(prompt, /do not continue implementation work/);
  assert.match(prompt, /Green tests alone are not correctness proof/);
  assert.match(prompt, /candidate-bound, registered, gate-eligible verification evidence/);
  assert.match(prompt, /Stale, failed, missing, or untrusted evidence cannot be reused/);
  assert.match(prompt, /Do not automatically rerun the full suite/);
  assert.match(prompt, /fresh review context; do not inherit the implementation conversation/);
});
