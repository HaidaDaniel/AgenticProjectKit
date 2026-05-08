# Task 0024 - Fix 0023 Owner Metadata

State: done
Owner: codex-a
Mode: maintenance
Lane: bugfix
Scope: tasks
Risk: low
Parallel: false
Depends on: none
Tags: tasks,validation,bugfix

## Goal

Restore task list validity by replacing invalid completed-task owner metadata in task 0023.

## Context files

- AGENTS.md
- docs/task-system.md
- .tasks/0023-fix-adopt-export-discovery-platform-docs.md

## Files allowed to edit

- .tasks/0023-fix-adopt-export-discovery-platform-docs.md
- docs/progress.md

## Files forbidden to edit

- application source files

## Steps

1. Set task 0023 owner to a non-none owner.
2. Verify task listing works.

## Acceptance criteria

- `apk tasks` reads all task files.
- `apk next-task` no longer fails on task 0023.

## Verification commands

- pnpm exec tsx src/cli/index.ts tasks
- pnpm exec tsx src/cli/index.ts next-task

## Documentation updates

- Update docs/progress.md.

## Notes

- `archive` remains valid for historical completed tasks.

