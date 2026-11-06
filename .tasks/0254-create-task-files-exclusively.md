# Task 0254 - Create task files exclusively

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: tasks,creation,concurrency,filesystem
Risk: high
Parallel: false
Depends on: 0253
Tags: p1,tasks,exclusive-write,concurrency

## Goal

Make canonical task creation publish a new task file with an exclusive create operation so an external writer that creates the same target between the existence check and write cannot be overwritten or silently replaced.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- .tasks/0253-fail-closed-on-task-inventory-errors.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
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

1. Reproduce the check-then-write race in a fixture; replace the creation write with an exclusive target operation; preserve canonical next-ID allocation and archived-ID checks; map an existing target to an actionable TaskCreateError without deleting or rewriting the external file; keep ordinary APK mutation locking; add tests for normal creation conflict and target appearing after the precheck

## Acceptance criteria

- Normal task creation still succeeds; an existing target is never overwritten; a target created after the file-existence precheck is reported as a conflict; external target bytes remain unchanged; task IDs remain unique and archived IDs are respected; APK mutation lock still serializes ordinary APK creators; focused tests pass

## Correctness assumptions

- The canonical create path must be safe against external filesystem writers even when APK's own mutation lock cannot coordinate them; exclusive create is sufficient to prevent overwrite

## Invariants

- No target overwrite; no external file deletion; no duplicate ID allocation; creation path remains separate from lifecycle update path; existing lock behavior is preserved

## Required evidence

- Deterministic race/conflict test output; external byte-preservation assertion; unique-ID and archived-ID tests; build-current artifact

## Review questions

- Can a writer win after the precheck; does failure preserve the external file; can the conflict be retried with a fresh ID; does the change affect lifecycle updates

## Counterexample searches

- Existing target; external target created after precheck; archived ID collision; concurrent APK creators; filesystem error during exclusive create

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document exclusive task creation in docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Depends on 0253 for fail-closed inventory; confirmed at HEAD 5021f2e: createTaskUnderTaskLock checks fileExists then calls writeTaskFile
