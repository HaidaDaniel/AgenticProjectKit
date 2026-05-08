# Task 0039 - Team Workflow Docs Tests

State: done
Owner: codex-a
Mode: production
Lane: testing
Scope: docs,tests,team
Risk: medium
Parallel: false
Depends on: 0038
Tags: docs,tests,team

## Goal

Document team analytics workflow and verify sharded logs, migration, and summaries through tests.

## Context files

- AGENTS.md
- README.md
- docs/engineering/testing-strategy.md
- docs/task-system.md
- package.json

## Files allowed to edit

- README.md
- docs/engineering/testing-strategy.md
- docs/task-system.md
- src/cli/cli.test.ts
- package.json
- docs/progress.md
- .tasks/0039-team-workflow-docs-tests.md

## Files forbidden to edit

- application source files outside tests

## Steps

1. Document two-developer workflow.
2. Add smoke coverage for migration and analytics summary.
3. Run full verification.

## Acceptance criteria

- Team workflow docs explain tracked and ignored analytics files.
- CLI smoke tests cover migration and analytics summary.
- Full test, lint, and build pass.

## Verification commands

- pnpm test
- pnpm lint
- pnpm build

## Documentation updates

- Update README.md.
- Update docs/engineering/testing-strategy.md.
- Update docs/progress.md.

## Notes

- Keep docs compact and operational.
