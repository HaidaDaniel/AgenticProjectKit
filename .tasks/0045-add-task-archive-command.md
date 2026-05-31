# Task 0045 - Add Task Archive Command

State: done
Owner: opencode
Mode: product
Lane: tasks
Scope: cli,tasks,docs,tests
Risk: high
Parallel: false
Depends on: 0041,0042,0043,0044
Tags: tasks,archive,workflow,dependencies

## Goal

Add task archiving only after task listing and dependency resolution are robust, so completed work can move out of the active folder without breaking dependency checks or history inspection.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/index.ts
- src/cli/commands/tasks.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0045-add-task-archive-command.md
- README.md
- docs/cli-commands.md
- docs/task-system.md
- docs/context-system.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/index.ts
- src/cli/commands/tasks.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- agent registry or run log storage format
- exporter templates
- source outside task listing, task lookup, archive, and CLI help surfaces

## Steps

1. Define archive path as `<taskDirectory>/archive/`.
2. Update task file listing helpers to optionally include or exclude archived task files.
3. Keep active task listing scoped to top-level task files unless `--all` or an archive-specific flag requires history.
4. Add `apk task archive <task-id>` for a single done task.
5. Add `apk task archive --all` for all done top-level tasks.
6. Refuse to archive tasks that are not `done`.
7. Refuse to overwrite an archived task path.
8. Ensure dependency validation and `selectNextTask` can still treat archived done tasks as completed dependencies.
9. Ensure `apk task deps <task-id>` can inspect archived tasks or at least show archived prerequisites.
10. Add CLI and core tests for single archive, archive all, non-done refusal, dependency resolution with archived done tasks, and listing behavior.
11. Update docs and help.
12. Run verification.

## Acceptance criteria

- `apk task archive <task-id>` moves a done task to `.tasks/archive/`.
- `apk task archive --all` moves all done top-level tasks.
- Todo, doing, review, blocked, and canceled tasks are not archived.
- `apk next-task` still considers archived done tasks when checking `Depends on`.
- `apk task deps` can show whether a prerequisite is archived and done.
- `apk tasks` default output remains focused on active top-level tasks.
- Docs describe where archived tasks live and how dependency checks treat them.

## Verification commands

- pnpm lint
- pnpm test
- pnpm exec tsx src/cli/index.ts task archive --help
- pnpm exec tsx src/cli/index.ts audit

## Documentation updates

- Update README.md with archive command examples if task maintenance examples are present.
- Update docs/cli-commands.md.
- Update docs/task-system.md.
- Update docs/context-system.md if archived tasks affect context resolution.
- Update docs/progress.md when task status changes.

## Notes

- Do not archive canceled tasks in the first version; keep the rule simple: done-only.
- Use filesystem moves carefully and keep lock behavior consistent with existing task state changes.
