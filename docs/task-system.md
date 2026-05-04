# Task System

The task system is the unit of execution for Agentic Project Kit.

Each task should be atomic, verifiable, and suitable for an AI agent to complete locally.

## Recommended task file layout

```md
# Task 0001 - Title

Status: todo
Mode: mvp
Risk: low
Depends on: none

## Goal

## Context files

## Files allowed to edit

## Files forbidden to edit

## Steps

## Acceptance criteria

## Verification commands

## Documentation updates

## Notes
```

## Task rules

- Use one task file per unit of work.
- Keep the allowed-file list narrow.
- Keep the forbidden-file list explicit.
- Include exact context files.
- Include concrete verification commands.
- Do not mark a task done until all acceptance criteria pass.
- Update `docs/progress.md` when the task status changes.

## Task index

The repository may also keep a central index of tasks, but the individual task file remains the primary contract for execution.

