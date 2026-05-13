import assert from "node:assert/strict";
import test from "node:test";

import type { ProjectTask } from "../tasks/index.js";
import {
  buildTaskPromptInput,
  parsePromptAgent,
  PromptAgentError,
  renderTaskPrompt,
} from "./prompt.js";

const TASK: ProjectTask = {
  id: "0014",
  title: "Add Prompt Command",
  state: "todo",
  owner: "none",
  mode: "mvp",
  lane: "implementation",
  scope: ["prompt"],
  risk: "medium",
  parallel: true,
  dependsOn: ["0006", "0007", "0008", "0012"],
  tags: ["prompt", "cli"],
  goal: "Implement apk prompt <agent> --task <task-id> so agents get concise task prompts.",
  contextFiles: [
    "AGENTS.md",
    "docs/context-system.md",
    "docs/task-system.md",
    "src/core/tasks/**",
  ],
  allowedFiles: [
    "src/cli/commands/prompt.ts",
    "src/cli/index.ts",
    "src/core/docs/**",
    "docs/progress.md",
  ],
  forbiddenFiles: ["future task files"],
  steps: ["Define prompt input.", "Implement command.", "Add tests."],
  acceptanceCriteria: [
    "Prompt output includes task goal, mode, allowed files, forbidden files, acceptance criteria, and verification commands.",
    "Prompt output includes exact context files.",
  ],
  verificationCommands: ["pnpm test", "pnpm lint"],
  documentationUpdates: ["Update docs/progress.md."],
  notes: ["Keep prompt output caveman-short by default."],
};

test("renderTaskPrompt includes task contract and selected context", () => {
  assert.equal(
    renderTaskPrompt(buildTaskPromptInput("codex", TASK, 2)),
    [
      "Agent: codex",
      "Task: 0014 - Add Prompt Command",
      "State: todo",
      "Owner: none",
      "Mode: mvp",
      "Lane: implementation",
      "Scope: prompt",
      "Risk: medium",
      "Parallel: true",
      "Tags: prompt,cli",
      "",
      "Goal:",
      "Implement apk prompt <agent> --task <task-id> so agents get concise task prompts.",
      "",
      "Context level: 2",
      "Context files:",
      "- AGENTS.md",
      "- docs/project.md",
      "- docs/scope.md",
      "- docs/architecture.md",
      "- .tasks/0014-add-prompt-command.md",
      "- docs/decisions.md",
      "- docs/context-system.md",
      "- docs/task-system.md",
      "",
      "Allowed files:",
      "- src/cli/commands/prompt.ts",
      "- src/cli/index.ts",
      "- src/core/docs/**",
      "- docs/progress.md",
      "",
      "Forbidden files:",
      "- future task files",
      "",
      "Acceptance criteria:",
      "- Prompt output includes task goal, mode, allowed files, forbidden files, acceptance criteria, and verification commands.",
      "- Prompt output includes exact context files.",
      "",
      "Verification commands:",
      "- pnpm test",
      "- pnpm lint",
      "",
      "Rules:",
      "- Prefer smallest useful vertical slice.",
      "- Avoid premature abstractions.",
      "- Read context files first.",
      "- Work only inside allowed files.",
      "- Do not touch forbidden files.",
      "- Run verification before done.",
      "",
    ].join("\n"),
  );
});

test("buildTaskPromptInput uses task metadata and available docs for level 2 context", () => {
  const input = buildTaskPromptInput("codex", {
    ...TASK,
    lane: "audit",
    scope: ["context", "scanner"],
    tags: ["testing"],
  }, 2, {
    availableFiles: [
      "docs/engineering/scanner-system.md",
      "docs/engineering/testing-strategy.md",
      "docs/product/requirements.md",
    ],
  });

  assert.deepEqual(input.context.files, [
    "AGENTS.md",
    "docs/project.md",
    "docs/scope.md",
    "docs/architecture.md",
    ".tasks/0014-add-prompt-command.md",
    "docs/decisions.md",
    "docs/engineering/scanner-system.md",
    "docs/engineering/testing-strategy.md",
    "docs/context-system.md",
    "docs/task-system.md",
  ]);
});

test("buildTaskPromptInput excludes operational files from level 3 context", () => {
  const input = buildTaskPromptInput("codex", {
    ...TASK,
    contextFiles: [
      ...TASK.contextFiles,
      ".agentic/agents.jsonl",
      ".tasks/.apk.lock",
    ],
    allowedFiles: [
      ...TASK.allowedFiles,
      ".agentic/runs.jsonl",
    ],
  }, 3);

  assert.equal(input.context.files.includes(".agentic/agents.jsonl"), false);
  assert.equal(input.context.files.includes(".agentic/runs.jsonl"), false);
  assert.equal(input.context.files.includes(".tasks/.apk.lock"), false);
});

test("buildTaskPromptInput includes mode guidance", () => {
  const prompt = renderTaskPrompt(buildTaskPromptInput("codex", {
    ...TASK,
    mode: "production",
  }, 1));

  assert.match(prompt, /- Prefer safer changes and stronger verification\./);
  assert.match(prompt, /- Document operational risks\./);
});

test("parsePromptAgent accepts supported agents", () => {
  assert.equal(parsePromptAgent("agents"), "agents");
  assert.equal(parsePromptAgent("claude"), "claude");
  assert.equal(parsePromptAgent("codex"), "codex");
  assert.equal(parsePromptAgent("gemini"), "gemini");
  assert.equal(parsePromptAgent("opencode"), "opencode");
  assert.equal(parsePromptAgent("cursor"), "cursor");
});

test("parsePromptAgent rejects unsupported agents", () => {
  assert.throws(
    () => parsePromptAgent("legacy"),
    (error: unknown) => {
      assert.ok(error instanceof PromptAgentError);
      assert.equal(
        error.message,
        "Unsupported prompt agent: legacy. Expected one of: agents, claude, codex, gemini, opencode, cursor.",
      );
      return true;
    },
  );
});
