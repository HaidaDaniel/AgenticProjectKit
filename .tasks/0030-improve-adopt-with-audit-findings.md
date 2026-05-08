# Task 0030 - Improve Adopt With Audit Findings

State: done
Owner: codex-a
Mode: product
Lane: adoption
Scope: adopt,audit,scanner
Risk: medium
Parallel: true
Depends on: 0026
Tags: adopt,audit,v0.3

## Goal

Use audit scanner findings to make adopt reports richer while preserving conservative writes.

## Context files

- AGENTS.md
- docs/adoption-flow.md
- docs/engineering/scanner-system.md
- src/core/docs/adopt.ts
- src/core/audit/index.ts
- src/core/scanners/index.ts

## Files allowed to edit

- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- docs/adoption-flow.md
- docs/progress.md

## Files forbidden to edit

- application source files
- exporter templates

## Steps

1. Reuse scanner facts in adoption report content.
2. Keep existing skip-not-overwrite behavior.
3. Add tests for richer adoption output.

## Acceptance criteria

- Adopt report includes docs and export gap summary.
- Existing files remain untouched during adopt.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/adoption-flow.md.
- Update docs/progress.md.

## Notes

- Do not make adopt run audit as a separate write step.
