# Task 0095 - Tolerate transient Windows lock-read contention

State: todo
Owner: none
Mode: production
Lane: task-system
Type: bugfix
Scope: task-system,locking,testing
Risk: medium
Parallel: false
Depends on: 0076
Tags: bugfix,concurrency,locking,windows

## Goal

Concurrent lock contenders survive bounded transient Windows access errors without weakening fail-closed ownership checks.

## Context files

- AGENTS.md
- SPEC.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/lock.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/lock.ts
- src/core/tasks/task.test.ts
- SPEC.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- .tasks/0095-tolerate-transient-windows-lock-read-contention.md

## Files forbidden to edit

- src/core/tasks/evidence.ts
- src/cli/**
- .agentic/**
- .tasks/archive/**

## Steps

1. Add deterministic regression for transient lock-read contention
2. Retry only bounded transient filesystem access failures during lock inspection
3. Run focused and full verification then independent review and gate

## Acceptance criteria

- A transient EPERM or EBUSY while reading an operational lock is retried within a fixed bound
- Unknown persistent read failures still fail closed
- Concurrent evidence appenders serialize without corrupting JSONL
- Lock owner identity and recovery semantics remain unchanged

## Correctness assumptions

- The reproducer isolates the intended failing behavior.

## Invariants

- Retry changes observation timing only and never treats unreadable ownership as absent
- Retry count and delay are bounded

## Required evidence

- Old-behavior reproducer result and regression test output.

## Review questions

- Can persistent unreadability be mistaken for absence?
- Can a successor lock be removed after a retry?

## Counterexample searches

- EPERM persists past retry budget
- Lock disappears between retry attempts
- Owner changes while a retry is pending

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/tasks/task.test.ts"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Backprop SPEC invariant and record lock-read behavior

## Notes

- Keep the fix narrow.
