# Task 0203 - Avoid archived task ID collisions during adoption

State: doing
Owner: codex-public-readiness-20261007
Mode: production
Lane: implementation
Type: bugfix
Scope: docs,adoption,tasks
Risk: high
Parallel: false
Depends on: none
Tags: adoption,release-blocker,regression

## Goal

Make adoption task allocation consider active and archived task IDs so applying adoption cannot create a duplicate task identity that contract lint rejects.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/audit/lint.ts

## Files allowed to edit

- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- docs/progress.md
- dist/**

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .tasks/archive/**

## Steps

1. Inspect adoption task discovery and archive semantics
2. Include archived task filenames when selecting a free adoption task ID
3. Add a regression test with an archived task ID above the active maximum
4. Run focused adoption and lint checks
5. then canonical task verification

## Acceptance criteria

- Adoption preserves an existing active document-adopted-repository task
- New adoption task IDs are free across active and archived task files
- A repository with archived Task 0196 does not generate active Task 0196
- Candidate adoption apply followed by lint has no duplicate-task-id finding

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- Do not modify archived task files
- Adoption remains conservative and idempotent
- Do not change package or release metadata

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.

## Review questions

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does the fix address the root cause rather than only the symptom?

## Counterexample searches

- Search a UI-only defect, an intermittent race, an inaccessible provider, a host without a test framework, and an expensive reproducer.
- Search adjacent inputs, error paths, and repeated execution.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm exec apk lint --json"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- This task unblocks Task 0173 exact-candidate self-adoption validation.
