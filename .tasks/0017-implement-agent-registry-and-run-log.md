# Task 0017 - Implement Agent Registry And Run Log

State: done
Owner: archive
Mode: product
Lane: agent-workflow
Scope: agents,analytics
Risk: medium
Parallel: true
Depends on: 0016
Tags: agents,jsonl,analytics

## Goal

Add strict agent registration and compact append-only run logging for model and platform analysis.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- src/core/tasks/**

## Files allowed to edit

- src/core/agents/**
- src/core/tasks/**
- src/cli/commands/**
- src/cli/index.ts
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- unrelated exporter templates

## Steps

1. Add agent registry JSONL support.
2. Add run log JSONL support.
3. Add strict registered-owner checks.
4. Add tests for registry and logging.

## Acceptance criteria

- Agents can be registered and listed.
- Task transitions fail for unregistered owners.
- Run events include compact platform and model metadata.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/task-system.md.
- Update README.md.

## Notes

- Do not include long prompts or context lists in run logs.
