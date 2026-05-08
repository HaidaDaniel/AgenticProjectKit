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
  parseTaskMarkdown,
  renderTaskMarkdown,
  renderNextTask,
  renderTasksTable,
  selectNextTask,
  TaskFormatError,
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
