import assert from "node:assert/strict";
import test from "node:test";

import {
  renderTaskContext,
  selectTaskContext,
} from "../docs/context.js";
import {
  parseTaskMarkdown,
  renderTaskMarkdown,
  renderNextTask,
  selectNextTask,
  TaskFormatError,
  type ProjectTaskFile,
  type ProjectTask,
} from "./index.js";

const TASK: ProjectTask = {
  id: "0007",
  title: "Add Task System",
  status: "todo",
  mode: "mvp",
  risk: "medium",
  dependsOn: ["0001", "0002"],
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

test("renderTaskMarkdown emits the documented task shape", () => {
  assert.equal(
    renderTaskMarkdown(TASK),
    [
      "# Task 0007 - Add Task System",
      "",
      "Status: todo",
      "Mode: mvp",
      "Risk: medium",
      "Depends on: 0001, 0002",
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

test("parseTaskMarkdown reads rendered task files", () => {
  assert.deepEqual(parseTaskMarkdown(renderTaskMarkdown(TASK)), TASK);
});

test("parseTaskMarkdown accepts no dependencies", () => {
  const task = parseTaskMarkdown(
    renderTaskMarkdown({
      ...TASK,
      dependsOn: [],
    }),
  );

  assert.deepEqual(task.dependsOn, []);
});

test("parseTaskMarkdown strips markdown code ticks from list paths", () => {
  const task = parseTaskMarkdown(
    renderTaskMarkdown({
      ...TASK,
      contextFiles: ["`AGENTS.md`", "`docs/task-system.md`"],
    }),
  );

  assert.deepEqual(task.contextFiles, ["AGENTS.md", "docs/task-system.md"]);
});

test("parseTaskMarkdown reports useful validation errors", () => {
  assert.throws(
    () =>
      parseTaskMarkdown(
        [
          "# Broken",
          "",
          "Status: waiting",
          "Mode: legacy",
          "Risk: risky",
          "Depends on:",
          "",
          "## Goal",
          "",
          "",
        ].join("\n"),
      ),
    (error: unknown) => {
      assert.ok(error instanceof TaskFormatError);
      assert.deepEqual(error.issues, [
        'Heading must match "# Task <id> - <title>".',
        "Depends on must not be empty.",
        "Status must be one of: todo, in-progress, done.",
        "Mode must be one of: discovery, mvp, product, production, maintenance, audit, adopt.",
        "Risk must be one of: low, medium, high.",
        'Section "Context files" is required.',
        'Section "Files allowed to edit" is required.',
        'Section "Files forbidden to edit" is required.',
        'Section "Steps" is required.',
        'Section "Acceptance criteria" is required.',
        'Section "Verification commands" is required.',
        'Section "Documentation updates" is required.',
        'Section "Notes" is required.',
        'Depends on must be "none" or a comma-separated task id list.',
        "Goal must not be empty.",
        "Context files must include at least one item.",
        "Verification commands must include at least one item.",
      ]);
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

test("selectTaskContext returns level 3 source and support files", () => {
  assert.deepEqual(selectTaskContext(TASK, 3).files, [
    "AGENTS.md",
    "docs/project.md",
    "docs/scope.md",
    "docs/architecture.md",
    ".tasks/0007-add-task-system.md",
    "docs/decisions.md",
    "docs/task-system.md",
    "src/core/tasks/**",
    "docs/progress.md",
  ]);
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

test("selectNextTask returns lowest-numbered todo task and ignores done tasks", () => {
  const files: ProjectTaskFile[] = [
    {
      path: ".tasks/0001-done.md",
      task: {
        ...TASK,
        id: "0001",
        title: "Done",
        status: "done",
      },
    },
    {
      path: ".tasks/0010-later.md",
      task: {
        ...TASK,
        id: "0010",
        title: "Later",
        status: "todo",
      },
    },
    {
      path: ".tasks/0009-next.md",
      task: {
        ...TASK,
        id: "0009",
        title: "Next",
        status: "todo",
      },
    },
  ];

  const selection = selectNextTask(files);

  assert.equal(selection?.task.id, "0009");
  assert.equal(selection?.contextCommand, "apk context 0009 --level 2");
});

test("selectNextTask returns undefined when no todo tasks exist", () => {
  assert.equal(
    selectNextTask([
      {
        path: ".tasks/0001-done.md",
        task: {
          ...TASK,
          status: "done",
        },
      },
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
      "Mode: mvp",
      "Risk: medium",
      "Path: .tasks/0012-add-next-task-command.md",
      "Context: apk context 0012 --level 2",
      "",
    ].join("\n"),
  );
});

test("renderNextTask prints no-task message", () => {
  assert.equal(renderNextTask(undefined), "No actionable todo tasks found.\n");
});
