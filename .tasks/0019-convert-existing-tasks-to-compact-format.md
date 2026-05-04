# Task 0019 - Convert Existing Tasks To Compact Format

State: done
Owner: archive
Mode: product
Lane: migration
Scope: tasks,docs
Risk: low
Parallel: false
Depends on: 0016
Tags: migration,tasks

## Goal

Convert existing v0.1 task files to the compact metadata format for consistency.

## Context files

- AGENTS.md
- docs/task-system.md
- .tasks/**

## Files allowed to edit

- .tasks/**
- docs/progress.md

## Files forbidden to edit

- source files

## Steps

1. Rewrite task metadata headers.
2. Preserve task body sections.
3. Mark completed v0.1 tasks as archived done tasks.

## Acceptance criteria

- All task files parse with the compact parser.
- Completed v0.1 tasks are marked `State: done`.
- Task body content is preserved.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/progress.md.

## Notes

- Keep historical task content intact.
