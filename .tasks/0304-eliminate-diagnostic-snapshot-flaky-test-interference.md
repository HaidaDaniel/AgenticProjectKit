# Task 0304 - Eliminate diagnostic snapshot flaky test interference

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: diagnostics,config,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix,tests,flake,diagnostics,invariant

## Goal

Identify and remove the cross-test global filesystem monkeypatching that makes the configuration-change snapshot test intermittent, without weakening its assertion or product behavior.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/diagnostics.ts
- src/core/config/file.ts
- src/core/tasks/task.test.ts
- docs/reviews/2026-11-19-a110cb4-pre-release-review.md

## Files allowed to edit

- src/core/tasks/diagnostics.ts
- src/core/config/file.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/cli/**
- src/core/status/**
- src/core/exporters/**
- src/core/audit/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Record bounded repetitions showing the failure in full-file runs and success in isolation; establish the cause as shared global fsPromises patching with syncBuiltinESMExports across multiple tests.
2. Introduce the smallest injectable config-read boundary needed by the snapshot path, defaulting to the current reader so product behavior is unchanged.
3. Rewrite only the flaky test to use that injection instead of patching global fsPromises; preserve the exact assertion that a configuration change during capture is rejected.
4. Run at least ten targeted repetitions under normal execution and at least five under c8 instrumentation; record counts and outcomes.
5. Confirm the full task test suite still passes and no other test was weakened.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- The root cause is documented with repetition evidence and is not merely timing speculation.
- The flaky test no longer mutates global fsPromises state.
- The original assertion and coverage are preserved.
- Ten or more normal repetitions and five or more c8 repetitions pass with zero failures.
- Full task test suite and canonical verification pass.

## Correctness assumptions

- Test isolation is preferable to global monkeypatching

## Invariants

- Snapshot consistency detection behavior is unchanged for production callers

## Required evidence

- Repetition counts and outcomes for normal and c8 runs

## Review questions

- Did the fix only mask the flake by weakening a test

## Counterexample searches

- Injected reader not used by snapshot; Config change no longer detected; Other global patches still interfere

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"flake-repetitions","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run 10 normal and 5 c8 repetitions of the targeted diagnostic snapshot test; record exact commands, counts and outcomes."}`

## Documentation updates

- Document the injectable config reader in docs/task-system.md

## Notes

- Flake analysis in docs/reviews/2026-11-19-a110cb4-pre-release-review.md
- Preserve pre-existing untracked WIP
