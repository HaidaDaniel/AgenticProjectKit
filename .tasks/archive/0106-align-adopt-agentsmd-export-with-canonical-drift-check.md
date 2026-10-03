# Task 0106 - Align adopt AGENTS.md export with canonical drift check

State: done
Owner: opencode-0106
Mode: production
Lane: bugfix
Type: bugfix
Scope: adoption,exporters,verification
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Make apk adopt emit an AGENTS.md that exactly matches the canonical agent exporter so apk lint and apk sync report current immediately after adoption.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/docs/adopt.ts
- src/core/exporters/index.ts
- src/core/sync/index.ts

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

- apk adopt writes AGENTS.md identical to canonical export output; adopter test asserts generated exports are current after adopt; apk lint passes in a freshly adopted repository; no unrelated source behavior changes

## Correctness assumptions

- The reproducer isolates the intended failing behavior.

## Invariants

- adopt still never overwrites existing files; legacy config migration behavior is unchanged

## Required evidence

- Old-behavior reproducer result and regression test output.

## Review questions

- Does adopt output match renderAgentExportFiles with the canonical policy? Is the drift check the single source of expected content?

## Counterexample searches

- adopt over an existing customized AGENTS.md; legacy v0.3.1 migration; CRLF-normalized comparison

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- docs/progress.md

## Notes

- Keep the fix narrow.
