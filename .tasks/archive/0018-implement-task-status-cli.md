# Task 0018 - Implement Task Status CLI

State: done
Owner: archive
Mode: product
Lane: agent-workflow
Scope: cli,tasks
Risk: medium
Parallel: true
Depends on: 0016,0017
Tags: cli,status,locks

## Goal

Add compact task listing and state transition commands for parallel agent workflow.

## Context files

- AGENTS.md
- docs/cli-commands.md
- docs/task-system.md
- src/cli/index.ts
- src/core/tasks/**

## Files allowed to edit

- src/cli/**
- src/core/tasks/**
- src/core/agents/**
- docs/cli-commands.md
- docs/progress.md

## Files forbidden to edit

- unrelated docs

## Steps

1. Add `apk tasks`.
2. Add claim, release, block, review, done, and cancel commands.
3. Guard transitions with transient lock.
4. Add CLI smoke coverage.

## Acceptance criteria

- Busy tasks are not selected by next-task.
- Registered owners can move tasks through valid states.
- Invalid transitions fail with useful errors.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/cli-commands.md.
- Update README.md.

## Notes

- Default task list output stays compact.
