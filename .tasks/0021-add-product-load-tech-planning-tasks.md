# Task 0021 - Add Product Load Tech Planning Tasks

State: done
Owner: archive
Mode: discovery
Lane: planning
Scope: product,load,tech
Risk: medium
Parallel: true
Depends on: 0020
Tags: discovery,tasks,architecture

## Goal

Define a task set that enables deep product, load, technology, and future-risk planning.

## Context files

- AGENTS.md
- docs/product/requirements.md
- docs/engineering/load-profile.md
- docs/engineering/tech-options.md
- docs/engineering/risk-register.md

## Files allowed to edit

- .tasks/**
- docs/progress.md

## Files forbidden to edit

- source files outside task workflow implementation

## Steps

1. Add planning task contracts.
2. Include scope, lane, tags, and parallel hints.
3. Keep context lists narrow.

## Acceptance criteria

- Planning tasks are in compact format.
- Planning tasks can be parallelized by lane and scope.
- Tags make task intent easy to filter.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/progress.md.

## Notes

- This repository now carries the planning capability as docs and task format.
