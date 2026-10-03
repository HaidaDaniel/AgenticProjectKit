# Task 0027 - Surface Validation Through Audit

State: done
Owner: codex-a
Mode: product
Lane: audit
Scope: validation,audit
Risk: medium
Parallel: false
Depends on: 0026
Tags: validation,audit,v0.2

## Goal

Report config and task validation failures through audit findings.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/audit/index.ts
- src/core/tasks/index.ts
- src/core/config/schema.ts

## Files allowed to edit

- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- docs/progress.md

## Files forbidden to edit

- application source files

## Steps

1. Parse config during audit when present.
2. Parse task files during audit.
3. Return audit error status for invalid task or config files.

## Acceptance criteria

- Invalid task file appears as audit error.
- Invalid config file appears as audit error.
- Audit CLI exits nonzero when validation errors exist.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/progress.md.

## Notes

- Missing docs and exports are warnings, not errors.

