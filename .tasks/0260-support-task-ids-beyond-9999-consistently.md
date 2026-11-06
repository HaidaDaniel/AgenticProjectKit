# Task 0260 - Support task IDs beyond 9999 consistently

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: tasks,ids,backlog,docs,compatibility
Risk: medium
Parallel: false
Depends on: 0258
Tags: p3,task-id,compatibility,backlog

## Goal

Make numeric task IDs above 9999 parse and render consistently across task allocation backlog Promoted-Task dependency discovery and documentation checks while preserving all existing four-digit IDs and filenames.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/backlog/index.ts
- src/core/backlog/backlog.test.ts
- src/core/tasks/task.test.ts
- scripts/check-docs-consistency.mjs
- .tasks/0258-strengthen-backlog-card-read-integrity.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/backlog/index.ts
- src/core/backlog/backlog.test.ts
- src/core/tasks/task.test.ts
- scripts/check-docs-consistency.mjs
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/config/**

## Steps

1. Reproduce 9999 to 10000 incompatibility in Promoted-Task and discovery; define one numeric ID contract of four or more digits; update backlog metadata parsing task discovery docs-check task row parsing and any central patterns; preserve four-digit behavior and existing files; add focused tests for 9999 10000 promotion archive dependency and discovery; avoid mass history migration

## Acceptance criteria

- Task ID 10000 can be allocated parsed promoted archived and used as a dependency; Promoted-Task accepts four or more digits; existing four-digit IDs remain valid and unchanged; documentation checker recognizes five-digit task rows; no historical task is renamed; focused tests pass

## Correctness assumptions

- Numeric IDs remain zero-padded to at least four digits; five-digit support is the only near-term extension; no UUID or alternate ID scheme is introduced

## Invariants

- No rename of existing tasks; no four-digit regression; no dependency or archive bypass; no mass migration

## Required evidence

- Focused 9999/10000 allocation promotion dependency archive discovery fixtures; docs-check regression; build-current artifact

## Review questions

- Can 10000 be promoted and archived; does dependency parsing remain correct; does the docs checker still accept four-digit IDs; is any historical file renamed

## Counterexample searches

- ID 9999; ID 10000; Promoted-Task 10000; archived five-digit ID; dependency on five-digit ID; docs roadmap row

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document numeric ID width compatibility in docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Depends on 0258 to sequence backlog/index.ts changes; confirmed at HEAD 5021f2e: nextTaskId returns 10000 while Promoted-Task requires exactly four digits
