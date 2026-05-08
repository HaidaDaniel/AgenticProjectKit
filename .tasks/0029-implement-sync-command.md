# Task 0029 - Implement Sync Command

State: done
Owner: codex-a
Mode: product
Lane: exporters
Scope: cli,exporters,sync
Risk: medium
Parallel: false
Depends on: 0027
Tags: sync,exporters,v0.3

## Goal

Add `apk sync [agent] [--write]` for generated instruction drift checks and safe updates.

## Context files

- AGENTS.md
- docs/agent-exporters.md
- docs/cli-commands.md
- src/core/exporters/index.ts
- src/cli/index.ts

## Files allowed to edit

- src/cli/index.ts
- src/cli/commands/sync.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- docs/cli-commands.md
- docs/progress.md

## Files forbidden to edit

- application source files

## Steps

1. Render expected generated instruction files.
2. Compare expected content against repository files.
3. Make default mode check-only.
4. Make `--write` update only missing or stale generated files.

## Acceptance criteria

- Clean generated files return no drift.
- Missing generated files are reported.
- Stale generated files are reported.
- `--write` updates missing and stale generated files.

## Verification commands

- pnpm test
- pnpm lint
- pnpm exec tsx src/cli/index.ts sync --help

## Documentation updates

- Update docs/cli-commands.md.
- Update docs/progress.md.

## Notes

- Sync targets match export targets.

