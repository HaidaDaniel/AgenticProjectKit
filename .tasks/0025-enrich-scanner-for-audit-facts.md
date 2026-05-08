# Task 0025 - Enrich Scanner For Audit Facts

State: done
Owner: codex-a
Mode: product
Lane: audit
Scope: scanner,audit
Risk: medium
Parallel: false
Depends on: 0024
Tags: scanner,audit,v0.2

## Goal

Extend repository scanning with deterministic kit doc, agent export, config, and task file facts.

## Context files

- AGENTS.md
- docs/engineering/scanner-system.md
- src/core/scanners/index.ts

## Files allowed to edit

- src/core/scanners/index.ts
- docs/progress.md

## Files forbidden to edit

- application source files

## Steps

1. Add file-set scan output for required kit docs.
2. Add file-set scan output for generated agent exports.
3. Add config and task file presence facts.

## Acceptance criteria

- Scanner exposes present and missing kit docs.
- Scanner exposes present and missing generated agent exports.
- Scanner exposes config and task file facts.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/progress.md.

## Notes

- Keep scanner deterministic and dependency-free.

