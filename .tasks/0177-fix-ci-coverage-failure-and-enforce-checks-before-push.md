# Task 0177 - Fix CI coverage failure and enforce checks before push

State: done
Owner: codex-ci-0177
Mode: maintenance
Lane: quality
Type: bugfix
Scope: quality,verification,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Reproduce the current hosted Quality coverage failure, correct its proven cause, and make local pre-push reliably enforce the project checks needed to prevent another failing CI push.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- .husky/pre-push
- package.json
- docs/releases/v0.4.2.md
- .tasks/0078-add-first-class-local-quality-guardrails-for-agenticprojectkit-itself.md
- scripts/check-docs-consistency.test.mjs
- scripts/setup-hooks.mjs
- .tasks/0177-fix-ci-coverage-failure-and-enforce-checks-before-push.md

## Files allowed to edit

- package.json
- .husky/pre-push
- docs/engineering/testing-strategy.md
- docs/progress.md
- scripts/setup-hooks.mjs
- .tasks/0177-fix-ci-coverage-failure-and-enforce-checks-before-push.md

## Files forbidden to edit



## Steps

1. Reproduce the failing coverage result from hosted run 36316706652 and compare it with green run 36307813436.
2. Isolate how the new documentation-consistency test entry affects source coverage while retaining that test in fast quality.
3. Make the smallest evidence-based coverage correction.
4. Strengthen the existing Husky pre-push hook to run the useful CI checks without duplicating quality, coverage, or build work.
5. Preserve the documented explicit Husky setup path; repair generated hook-stub permissions there and do not add an install lifecycle hook contrary to the distribution decision.
6. Run the full declared quality, coverage, build, APK, and drift checks; commit implementation before candidate-bound verification and gate.

## Acceptance criteria

- The coverage failure from hosted Quality run 36316706652 is reproduced and its cause is addressed without removing documentation consistency tests from quality.
- pnpm test:coverage reports source coverage that satisfies its documented thresholds.
- The documented `pnpm setup:dev` path enables pre-push and the hook runs the documented CI-equivalent checks before allowing a push.
- Re-running `pnpm setup:dev` repairs execute permissions on existing generated Husky hook stubs.
- Documentation truthfully describes the checks and install/setup path.
- All task verification passes and changes remain inside the allowed scope.

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No implementation patch precedes a documented failing-signal attempt; objective reproduction limits stay explicit.
- No forced red test is required for unsupported, flaky, UI-only, or provider-dependent cases.
- The fix preserves behavior outside the reported defect.

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.

## Review questions

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does the fix address the root cause rather than only the symptom?

## Counterexample searches

- Search a UI-only defect, an intermittent race, an inaccessible provider, a host without a test framework, and an expensive reproducer.
- Search adjacent inputs, error paths, and repeated execution.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"check-5","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"check-6","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"check-7","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-8","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"check-9","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm setup:dev && test -x .husky/_/pre-push"}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
