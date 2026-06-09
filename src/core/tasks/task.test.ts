import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

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
  archiveAllTasks,
  archiveTask,
  buildTaskDeps,
  buildTaskFileName,
  createTask,
  findTaskDependents,
  findTaskFile,
  listArchivedTaskFiles,
  listTaskFiles,
  nextTaskId,
  parseTaskMarkdown,
  renderTaskMarkdown,
  renderNextTask,
  renderTaskDeps,
  renderTasksTable,
  selectNextTask,
  TaskFormatError,
  validateTaskDependencies,
  verifyTask,
  verifyTaskFileScope,
  renderTaskVerifyResult,
  writeTaskFile,
  type ProjectTaskFile,
  type ProjectTask,
} from "./index.js";
import {
  claimTask,
  createStaleTaskLock,
  doneTask,
  releaseTask,
  reviewTask,
} from "./workflow.js";

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
    await rm(directory, { force: true, recursive: true });
  }
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
  assert.equal(selection?.contextCommand, "apk context 0009 --level 2");
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
      contextCommand: "apk context 0012 --level 2",
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
      "Context: apk context 0012 --level 2",
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

test("verifyTask stops on failed verification command", async () => {
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
    ]);
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

    assert.equal(result.nextStep, "apk review 0007 --owner codex-a");
    assert.ok(events.some((event) => (
      event.event === "verify" &&
      event.task === "0007" &&
      event.agent === "codex-a" &&
      event.outcome === "ok"
    )));
  });
});

test("task transitions require registered owner and log events", async () => {
  await withTempDirectory(async (directory) => {
    const tasksDirectory = join(directory, ".tasks");
    const taskPath = join(tasksDirectory, "0007-add-task-system.md");
    await writeTaskFile(taskPath, TASK);

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
  await withTempDirectory(async (directory) => {
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
