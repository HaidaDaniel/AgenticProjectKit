# Task 0108 - Make review fields a coherent projection of canonical assurance

State: done
Owner: opencode-0108
Mode: production
Lane: bugfix
Type: bugfix
Scope: policy,execution,verification,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Derive independentReview and reviewLevel from the final canonical assurance so ordinary medium tasks require no separate reviewer, while security/migration/async/release triggers still escalate exactly as canonical assurance specifies.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/execution-profiles.md
- docs/decisions.md
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/execution/index.ts

## Files allowed to edit

- src/core/tasks/policy.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit



## Steps

1. Capture a reproducer that fails on the old behavior.
2. Identify and document the root cause before changing code.
3. Implement the smallest safe fix; do not perform unrelated refactors.
4. Add regression coverage and run verification.

## Acceptance criteria

- medium normal task is self-check with no independent review and passes the gate without a review record; low has none; high is fresh-context; critical is independent; security/auth
- migration
- async/worker
- and release/integration triggers escalate; calibration cannot lower; constrained profile never spends scarce-frontier review capacity on an ordinary medium task; regression tests cover all cases

## Correctness assumptions

- Only the review projection is inconsistent; risk evidence and scope requirements are unchanged

## Invariants

- assurance is monotonic and raise-only; legacy independentReview/reviewLevel are a projection of canonical assurance
- not a second engine; explicit tag/type escalations still apply; gate and done remain the only completion authority

## Required evidence

- Old-behavior reproducer result and regression test output.

## Review questions

- Does any route
- gate
- status
- attention
- or work path still read a risk-derived review field instead of the assurance projection?

## Counterexample searches

- medium task with a live manual check; medium task with only a scarce-frontier review worker; custom tag rule that sets independentReview false after true; calibration assuranceMinimum below canonical

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`

## Documentation updates

- docs/task-system.md
- docs/execution-profiles.md
- docs/progress.md

## Notes

- Keep the fix narrow.
