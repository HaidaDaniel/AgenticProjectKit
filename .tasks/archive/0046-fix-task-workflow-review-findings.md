# Task 0046 - Fix Task Workflow Review Findings

State: done
Owner: codex-review-46
Mode: product
Lane: tasks
Scope: cli,tasks,audit,docs,tests
Risk: high
Parallel: false
Depends on: 0045
Tags: tasks,bugfix,archive,validation

## Goal

Fix regressions and contract gaps found while reviewing Tasks 0041 through 0045.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- .tasks/0041-add-task-listing-filters.md
- .tasks/0042-add-task-dependency-graph-validation.md
- .tasks/0043-add-task-dependency-inspection-command.md
- .tasks/0044-add-validated-task-create-command.md
- .tasks/0045-add-task-archive-command.md
- src/cli/index.ts
- src/cli/commands/tasks.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/audit/index.ts
- src/core/scanners/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0046-fix-task-workflow-review-findings.md
- README.md
- docs/cli-commands.md
- docs/task-system.md
- docs/context-system.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/tasks.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/audit/index.ts
- src/core/scanners/index.ts
- src/core/tasks/task.test.ts
- src/core/audit/audit.test.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- agent registry or run log storage format

## Steps

1. Make `apk task archive` reject unknown flags before any filesystem move.
2. Make `apk task archive --all` reject extra positional args and unknown flags.
3. Make `archiveAllTasks` refuse existing archive paths instead of silently skipping collisions.
4. Make `apk tasks --all` include archived task files, while default `apk tasks` remains active top-level only.
5. Make audit dependency validation include archived done tasks so archived prerequisites do not become false missing-dependency findings.
6. Make `apk task deps <task-id>` inspect archived task ids or return a clean documented error without stack traces.
7. Make `apk task create` enforce every documented required flag, including `--scope` and `--allowed`.
8. Add CLI/core/audit regression tests for each reviewed bug.
9. Update command help and docs where behavior changes.
10. Run verification.

## Acceptance criteria

- `apk task archive 0001 --unknown` exits 1 and does not move the task.
- `apk task archive --all --unknown` exits 1 and does not move any task.
- `apk task archive --all 0001` exits 1 and does not move any task.
- Archive-all refuses archive path collisions with a clear error.
- `apk tasks --all` lists active top-level tasks and `.tasks/archive/*.md` tasks.
- `apk tasks` without flags still excludes done, canceled, and archived tasks.
- `apk audit` accepts an active task depending on an archived done task.
- `apk task deps <archived-id>` has deterministic non-stack-trace output.
- `apk task create` fails before writing when `--scope` or `--allowed` is omitted or empty.
- Invalid `apk task ...` usage prints concise errors instead of uncaught exception stacks.

## Verification commands

- pnpm lint
- pnpm test
- pnpm exec tsx src/cli/index.ts audit
- pnpm exec tsx src/cli/index.ts tasks --all
- pnpm exec tsx src/cli/index.ts task archive --help
- pnpm exec tsx src/cli/index.ts task deps 0045
- pnpm exec tsx src/cli/index.ts task create --help

## Documentation updates

- Update docs/cli-commands.md for exact archive, tasks, deps, and create behavior.
- Update docs/task-system.md if archive or dependency rules change.
- Update docs/context-system.md only if archived task visibility changes context behavior.
- Update docs/progress.md when task status changes.

## Notes

- P1: `runArchiveSubcommand` ignores unknown flags; `apk task archive 0001 --unknown` archived the task instead of failing. See src/cli/commands/task.ts around archive flag handling.
- P1: `runArchiveSubcommand` treats any argv containing `--all` as archive-all; `apk task archive --all --unknown` moved all done tasks.
- P1: `archiveAllTasks` silently skips archive path collisions with `continue`; task 0045 and docs require refusing overwrite.
- P1: `apk tasks --all` still calls `listTaskFiles`, so archived tasks are omitted despite docs saying `--all` includes active and archived history.
- P1: `apk audit` validates only scanned top-level `.tasks/*.md`; active tasks depending on archived done tasks can be reported missing.
- P2: `apk task deps <archived-id>` finds the archived path but `buildTaskDeps` searches only active files and then throws a stack-trace error.
- P2: `apk task create` accepts missing `--allowed` and can write a task with an empty allowed file list despite docs marking it required.
- P2: `runTaskCommand` throws uncaught errors for invalid task usage, producing Node stack traces instead of compact CLI errors.
- General verification currently passes; these are contract gaps and missing regression tests.
