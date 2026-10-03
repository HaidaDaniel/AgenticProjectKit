# Task 0055 - Add Task Work Loop Command

State: done
Owner: codex-plan-47
Mode: product
Lane: workflow
Scope: cli,tasks,prompt,verify,docs,tests
Risk: high
Parallel: false
Depends on: 0049,0050
Tags: work-loop,prompt,verify,workflow,cli

## Goal

Add a CLI-only task work loop that connects claim, context, prompt, verify, and review/done guidance without launching agents or building a web UI.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- README.md
- src/cli/index.ts
- src/cli/commands/task-state.ts
- src/cli/commands/context.ts
- src/cli/commands/prompt.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/agents/index.ts
- src/core/docs/prompt.test.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0055-add-task-work-loop-command.md
- README.md
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/work.ts
- src/core/work/index.ts
- src/core/work/work.test.ts
- src/core/agents/index.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans
- code that launches external AI agents

## Steps

1. Add `apk work <task-id> --owner <agent-id> --target <agent> [--level <1|2|3|auto>]` help and routing.
2. Validate that the owner is a registered agent.
3. If the task is `todo`, claim it; if already `doing` by the owner, continue; otherwise fail clearly.
4. Resolve context files using existing context logic.
5. Render the task prompt using existing prompt logic.
6. Print the prompt by default; optionally write it to `.agentic/sessions/<task-id>/<run-id>/prompt.md` when `--write-session` is supplied.
7. Do not launch Codex, Claude, Cursor, Gemini, or any external agent process.
8. Add `apk work verify <task-id> --owner <agent-id>` or a documented follow-up path that calls `apk task verify`.
9. After verification passes, print concise next commands for `apk review` or `apk done`.
10. Add run-log events for work session creation without storing prompt contents in the run log.
11. Add tests for claiming, already-owned doing task, wrong owner, prompt generation, session write, and verify guidance.

## Acceptance criteria

- `apk work <task-id> --owner <agent-id> --target codex` claims a todo task and prints the generated prompt.
- The command refuses unregistered owners.
- The command refuses tasks owned by a different agent.
- `--write-session` stores prompt artifacts under `.agentic/sessions/<task-id>/<run-id>/` and does not alter run-log privacy rules.
- The command does not execute external AI agents.
- The command points users to `apk task verify` before review/done.
- No web UI is introduced.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js work --help
- node dist/cli/index.js task verify --help
- node dist/cli/index.js status
- node dist/cli/index.js audit

## Documentation updates

- Update docs/cli-commands.md with `apk work`.
- Update docs/task-system.md with the optional end-to-end CLI loop.
- Update docs/context-system.md if `--level auto` changes context behavior.
- Update README workflow examples.
- Update docs/progress.md when task state changes.

## Notes

- This implements the useful "task -> prompt -> result -> review" loop from analysis while staying CLI-only.
- Do not add a web dashboard or agent runner here.
