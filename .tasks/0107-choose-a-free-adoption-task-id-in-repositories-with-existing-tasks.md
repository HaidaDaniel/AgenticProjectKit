# Task 0107 - Choose a free adoption task id in repositories with existing tasks

State: done
Owner: opencode-0106
Mode: production
Lane: bugfix
Type: bugfix
Scope: adoption,tasks,verification
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Make apk adopt choose the next free numeric task id from existing .tasks files so adoption never creates a duplicate task id in a repository that already has tasks.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/docs/adopt.ts
- src/core/tasks/index.ts
- src/core/scanners/index.ts

## Files allowed to edit

- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- docs/progress.md

## Files forbidden to edit



## Steps

1. Capture a reproducer that fails on the old behavior.
2. Identify and document the root cause before changing code.
3. Implement the smallest safe fix; do not perform unrelated refactors.
4. Add regression coverage and run verification.

## Acceptance criteria

- apk adopt selects the next free numeric id after existing task files; the generated adoption task filename and id do not collide; regression test covers a repository with pre-existing tasks; adopt still never overwrites existing files

## Correctness assumptions

- The reproducer isolates the intended failing behavior.

## Invariants

- adopt plan/apply remains non-destructive; legacy config migration behavior is unchanged

## Required evidence

- Old-behavior reproducer result and regression test output.

## Review questions

- Where is the adoption task id derived
- and does it see active and archived tasks? Could two task files still collide after the fix?

## Counterexample searches

- repository with .tasks/0001 present; repository with non-numeric legacy task filenames; empty .tasks directory

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- docs/progress.md

## Notes

- Keep the fix narrow.
