# Task 0022 - Readiness Pass Agent Workflow And Discovery

State: done
Owner: archive
Mode: product
Lane: verification
Scope: agents,tasks,discovery
Risk: medium
Parallel: false
Depends on: 0018,0019,0020,0021
Tags: readiness,verification

## Goal

Verify compact task workflow, agent registry, run logging, and discovery planning docs.

## Context files

- AGENTS.md
- README.md
- docs/task-system.md
- docs/cli-commands.md
- docs/progress.md

## Files allowed to edit

- README.md
- docs/**
- .tasks/**

## Files forbidden to edit

- unrelated source files

## Steps

1. Run unit tests.
2. Run type checks.
3. Run build and pack checks.
4. Run CLI smoke commands for agent and task workflow.
5. Update progress.

## Acceptance criteria

- Verification passes.
- README documents agent registration and task workflow.
- Progress reflects the completed upgrade.

## Verification commands

- pnpm test
- pnpm lint
- pnpm build
- pnpm pack --pack-destination $env:TEMP

## Documentation updates

- Update README.md.
- Update docs/progress.md.

## Notes

- This task closes the compact workflow upgrade.
