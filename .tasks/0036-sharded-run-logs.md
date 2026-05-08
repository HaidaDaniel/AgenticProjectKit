# Task 0036 - Sharded Run Logs

State: done
Owner: codex-a
Mode: product
Lane: analytics
Scope: runs,analytics,team
Risk: medium
Parallel: false
Depends on: 0035
Tags: runs,analytics,team

## Goal

Write run events to date/developer/agent shards and keep legacy run-log reads.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/agents/index.ts
- src/core/tasks/workflow.ts

## Files allowed to edit

- src/core/agents/index.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/progress.md
- .tasks/0036-sharded-run-logs.md

## Files forbidden to edit

- application source files

## Steps

1. Add `developer` to run events.
2. Write events to `.agentic/runs/YYYY-MM-DD_<developer>_<agent>.jsonl`.
3. Read sharded and legacy run logs together.
4. Preserve duration calculation across all logs.

## Acceptance criteria

- Transitions write sharded run events.
- Legacy `.agentic/runs.jsonl` remains readable.
- Done duration still works.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/task-system.md.
- Update docs/progress.md.

## Notes

- Raw events remain compact-safe.
