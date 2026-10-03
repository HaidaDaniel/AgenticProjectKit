# Task 0026 - Implement Audit Command

State: done
Owner: codex-a
Mode: product
Lane: audit
Scope: cli,docs,validation
Risk: medium
Parallel: false
Depends on: 0025
Tags: audit,cli,v0.2

## Goal

Add `apk audit [directory]` that writes repository reports without touching application source files.

## Context files

- AGENTS.md
- docs/cli-commands.md
- docs/architecture.md
- src/cli/index.ts
- src/core/scanners/index.ts

## Files allowed to edit

- src/cli/index.ts
- src/cli/commands/audit.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- docs/cli-commands.md
- docs/architecture.md
- docs/progress.md

## Files forbidden to edit

- application source files

## Steps

1. Add audit core report generation.
2. Add CLI command and help text.
3. Add tests for report writing and source preservation.

## Acceptance criteria

- `apk audit` writes `docs/audit-report.md`.
- `apk audit` writes `docs/project-map.md`.
- Audit does not rewrite application source files.

## Verification commands

- pnpm test
- pnpm lint
- pnpm exec tsx src/cli/index.ts audit --help

## Documentation updates

- Update docs/cli-commands.md.
- Update docs/architecture.md.
- Update docs/progress.md.

## Notes

- Audit reports errors for invalid task or config files.

