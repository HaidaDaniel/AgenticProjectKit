# Task 0016 - Define Compact Task Workflow

State: done
Owner: archive
Mode: product
Lane: agent-workflow
Scope: tasks,parallel-agents
Risk: medium
Parallel: false
Depends on: 0015
Tags: task-format,status,parallel

## Goal

Define the compact task metadata, canonical states, owner rules, and parallel-agent safety model.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/context-system.md
- docs/progress.md

## Files allowed to edit

- docs/task-system.md
- docs/context-system.md
- docs/progress.md
- .tasks/0016-define-compact-task-workflow.md

## Files forbidden to edit

- application source files outside task workflow implementation

## Steps

1. Define compact task headers.
2. Define state and owner rules.
3. Define transient task lock behavior.
4. Update task documentation.

## Acceptance criteria

- Compact metadata is documented.
- State and owner rules are explicit.
- Parallel-agent lock behavior is documented.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/task-system.md.
- Update docs/context-system.md.

## Notes

- Keep task headers compact.
