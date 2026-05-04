# Task 0007 - Add Task System

State: done
Owner: archive
Mode: mvp
Lane: archive
Scope: completed-v0.1
Risk: medium
Parallel: false
Depends on: 0001, 0002, 0004
Tags: archive,v0.1

## Goal

Implement task file parsing and generation support.

## Context files

- `AGENTS.md`
- `docs/task-system.md`
- `docs/context-system.md`
- `docs/progress.md`
- `.tasks/0007-add-task-system.md`

## Files allowed to edit

- `src/core/tasks/**`
- `src/core/docs/**`
- `src/utils/**`
- `package.json`
- `docs/progress.md`
- `.tasks/0007-add-task-system.md`

## Files forbidden to edit

- future task files

## Steps

1. Define task parsing.
2. Define task generation helpers.
3. Add tests for format validation.
4. Update progress.

## Acceptance criteria

- Task files can be parsed and generated consistently.
- The task format matches the documented contract.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Prefer explicit fields over inferred task metadata.
- Allowed files were expanded to include test script updates needed for task-system coverage.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
