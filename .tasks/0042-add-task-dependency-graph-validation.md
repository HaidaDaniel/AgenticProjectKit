# Task 0042 - Add Task Dependency Graph Validation

State: done
Owner: opencode
Mode: product
Lane: tasks
Scope: cli,tasks,audit,docs,tests
Risk: medium
Parallel: false
Depends on: 0041
Tags: tasks,dependencies,validation,audit

## Goal

Add reusable task dependency graph validation so the CLI can detect missing dependencies and dependency cycles before agents waste time on an invalid plan.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/cli/commands/audit.ts

## Files allowed to edit

- .tasks/0042-add-task-dependency-graph-validation.md
- README.md
- docs/cli-commands.md
- docs/task-system.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/cli/commands/audit.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- task state transition ownership rules
- exporter templates
- source outside task validation, audit, and CLI help surfaces

## Steps

1. Add a pure dependency validation helper in `src/core/tasks/index.ts`.
2. Validate that every `Depends on` id exists in the loaded task set.
3. Validate that dependency edges do not contain cycles.
4. Return structured issues with task id, issue kind, and human-readable message.
5. Keep validation independent from task file parsing so individual files can still be loaded and reported.
6. Surface dependency graph issues through `apk audit`.
7. Add tests for missing dependency ids.
8. Add tests for direct and multi-task dependency cycles.
9. Add tests showing valid cross-number dependencies are accepted.
10. Run verification.

## Acceptance criteria

- Missing dependency ids are reported with the dependent task id and missing id.
- Cycles are reported with enough task ids to locate the loop.
- A task with a higher-numbered dependency is valid when that dependency exists.
- `apk audit` reports dependency graph warnings or errors without crashing.
- Existing valid tasks continue to pass audit.
- No dependency ordering behavior changes are made to `apk next-task` in this task.

## Verification commands

- pnpm lint
- pnpm test
- pnpm exec tsx src/cli/index.ts audit

## Documentation updates

- Update docs/task-system.md with dependency graph validity rules.
- Update docs/cli-commands.md if audit output changes.
- Update docs/progress.md when task status changes.

## Notes

- This task is validation only. Do not add priority or topological task selection here.
- Prefer deterministic issue ordering: task id, issue kind, then dependency id/path.
