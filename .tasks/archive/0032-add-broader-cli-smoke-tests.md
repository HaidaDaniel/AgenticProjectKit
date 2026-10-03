# Task 0032 - Add Broader CLI Smoke Tests

State: done
Owner: codex-a
Mode: production
Lane: testing
Scope: cli,tests
Risk: medium
Parallel: true
Depends on: 0029
Tags: tests,cli,v0.3

## Goal

Add broader CLI smoke coverage for implemented commands.

## Context files

- AGENTS.md
- docs/engineering/testing-strategy.md
- src/cli/index.ts
- package.json

## Files allowed to edit

- src/cli/cli.test.ts
- package.json
- docs/engineering/testing-strategy.md
- docs/progress.md

## Files forbidden to edit

- application source files
- exporter templates

## Steps

1. Add smoke tests for CLI help.
2. Add smoke tests for audit and sync command behavior.
3. Wire the tests into `pnpm test`.

## Acceptance criteria

- CLI help includes all implemented commands.
- Audit and sync smoke tests run in temp directories.
- Existing core tests still pass.

## Verification commands

- pnpm test
- pnpm lint
- pnpm build

## Documentation updates

- Update docs/engineering/testing-strategy.md.
- Update docs/progress.md.

## Notes

- Keep smoke tests deterministic and temp-directory based.
