# Task 0028 - Improve Context Selection From Scan Facts

State: done
Owner: codex-a
Mode: product
Lane: context
Scope: context,scanner,tasks
Risk: medium
Parallel: true
Depends on: 0027
Tags: context,scanner,v0.2

## Goal

Use scanner, docs, and task metadata to improve Level 2 and Level 3 context selection.

## Context files

- AGENTS.md
- docs/context-system.md
- docs/engineering/scanner-system.md
- src/core/docs/context.ts
- src/core/scanners/index.ts
- src/core/tasks/index.ts

## Files allowed to edit

- src/core/docs/context.ts
- src/core/docs/prompt.test.ts
- docs/context-system.md
- docs/progress.md

## Files forbidden to edit

- application source files
- unrelated CLI commands

## Steps

1. Add context selection inputs for task scope, tags, and scanner facts.
2. Include relevant product, engineering, or delivery docs only when task metadata calls for them.
3. Keep output deterministic.

## Acceptance criteria

- Level 1 output remains minimal.
- Level 2 output uses task metadata to include relevant docs.
- Level 3 output remains deterministic and avoids operational logs.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/context-system.md.
- Update docs/progress.md.

## Notes

- This is the next actionable v0.2 task.
