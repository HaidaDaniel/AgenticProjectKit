# Task 0098 - Preserve numbered list items in task section round-trips

State: doing
Owner: local-agent-0098
Mode: maintenance
Lane: task-system
Scope: task-system,parser,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: task-system,parser,round-trip

## Goal

Task acceptance criteria and other list sections written with numbered items survive parse/render round-trips instead of being silently dropped.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- .tasks/0098-preserve-numbered-list-items-in-task-section-round-trips.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend the shared list parser to accept both `- ` bullet items and `N. ` numbered items while leaving step parsing unchanged.
2. Add a deterministic round-trip regression proving numbered acceptance criteria are captured and preserved through claim-style writeTaskFile re-rendering.
3. Document the accepted list syntax for task sections.

## Acceptance criteria

- `parseList`-backed sections (acceptance criteria, context/allowed/forbidden paths, correctness fields, documentation updates, notes) accept both `- ` and `N. ` list markers.
- Numbered acceptance criteria are no longer silently dropped when a task is parsed and re-rendered.
- Existing bullet-list parsing, steps parsing, and legacy task round-trips are unchanged.
- Rendered output remains deterministic and normalized (numbered items render as bullets without losing text).

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Update docs/task-system.md for the accepted list syntax.
- Update docs/decisions.md for the parsing decision.
- Update docs/progress.md when task state changes.

## Notes

- Corrective task: Task 0092's numbered acceptance criteria were dropped when the task file was re-rendered on claim, because the parser only recognized `- ` bullets. The authoritative 0092 criteria remain in git history; this task prevents recurrence for future contracts.
- Keep the change minimal: widen accepted markers, do not change section semantics or legacy behavior.
