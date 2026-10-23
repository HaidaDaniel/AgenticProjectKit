# Task 0238 - Fail closed when canonical worker session enumeration is unreadable

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: workers,sessions,diagnostics,tests
Risk: high
Parallel: false
Depends on: 0227
Tags: bugfix

## Goal

Propagate failures enumerating discovered canonical per-task session directories so unknown occupancy can never become ready. This prerequisite correction unblocks independent review of 0228 without expanding its claimed scope.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/work/session.ts
- src/core/status/workers.ts
- src/cli/command.test.ts

## Files allowed to edit

- src/core/work/session.ts
- src/cli/command.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/**
- src/core/status/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**

## Steps

1. Reproduce the baseline EACCES omission using real canonical sessions and a filesystem error injection
2. Remove silent partial enumeration while preserving supported missing top-level store behavior
3. Test nested EACCES ENOENT and ENOTDIR as unavailable rather than empty occupancy
4. Verify healthy active terminal and orphan sessions retain behavior
5. Run canonical checks on committed candidate and obtain fresh independent review

## Acceptance criteria

- An unreadable discovered task session directory causes the reader to reject and workers to report unknown
- Concurrent deletion of a discovered task session directory does not produce ready
- Missing top-level session store remains supported empty state
- Healthy canonical session discovery and public worker JSON remain compatible
- Errors never fabricate an empty successfully enumerated session store

## Correctness assumptions

- Only absence of the top-level session store proves no issued sessions
- An incomplete per-task enumeration cannot prove resource occupancy

## Invariants

- No silent partial session inventory
- No process liveness claims
- No lifecycle or evidence trust changes

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.

## Review questions

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does the fix address the root cause rather than only the symptom?

## Counterexample searches

- Inject EACCES, ENOENT and ENOTDIR only for an already-discovered task session directory.
- Compare a missing top-level store with an unreadable top-level store and healthy active/terminal sessions.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/command.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- docs/task-system.md
- docs/progress.md

## Notes

- Independent review of 0228 reproduced identical false ready on baseline baf9546 and candidate 7b93bd0; review evidence evidence-1792778328853-ij3a3o. Repair source separately before resuming 0228.
