# Task 0224 - Finish audited task amendment epochs with bounded legacy reader

State: doing
Owner: codex-task-0224
Mode: maintenance
Lane: verification
Type: bugfix
Scope: task-contract-provenance,verification-epochs,legacy-compatibility
Risk: high
Parallel: false
Depends on: 0222
Tags: bugfix

## Goal

Finish the remaining Task 0221 epoch identity and historical compatibility work on a fresh baseline. Preserve strict validation for new records while accepting only the six proven snapshot-free historical records without rewriting evidence.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- .tasks/0221-add-explicit-audited-task-contract-amendments.md
- .tasks/0222-align-workspace-candidate-freshness-regression-with-content-identity.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .agentic/**
- .tasks/archive/**
- src/core/tasks/gate.ts
- src/core/tasks/evidence.ts
- src/core/tasks/provenance.ts
- package.json
- pnpm-lock.yaml
- docs/releases/**

## Steps

1. Reproduce the strict-reader failures against the preserved epoch records using a disposable copy of runtime state; do not write to the canonical `.agentic` files.
2. Compare the current writer and reader payloads and document the proven historical timestamp drift and carried-path ordering before editing.
3. Apply only the unfinished epoch identity and predecessor contract-hash validation changes. Share one canonical identity encoder for new writes and strict reads; allow a bounded exact-match recovery only for the proven snapshot-free legacy format.
4. Add synthetic regression fixtures for the historical structure and tampering cases. Preserve original times, paths, hashes, IDs, and journal bytes.
5. Run the focused task tests, typecheck, static APK lint, committed-dist build check, and diff check once each on the committed candidate.
6. Obtain hosted Quality success for the exact candidate and record its external evidence.
7. Obtain a fresh independent review, pass the completion gate, and close this successor task through APK.

## Acceptance criteria

- New epoch writes and strict reads use one canonical identity payload.
- Only snapshot-free historical records matching the proven legacy format may use bounded recovery.
- Historical timestamps, carried paths, hashes, IDs, baselines, and evidence bytes remain unchanged.
- Changed IDs, hashes, carried paths, timestamps, modern records, and out-of-bound legacy records fail closed.
- No Task 0222 or Task 0223 contract or implementation path is attributed to this candidate.
- The committed `dist` matches source and exact-candidate checks, review, and gate pass.

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No implementation patch precedes a documented failing-signal attempt; objective reproduction limits stay explicit.
- No forced red test is required for unsupported, flaky, UI-only, or provider-dependent cases.
- The fix preserves behavior outside the reported defect.
- Never change historical `.agentic` baselines, evidence, or epoch records.
- Do not reuse the emergency review as the standard successor-task review.
- Do not attribute foreign contract changes to Task 0221 or this successor.
- Legacy recovery must match the demonstrated historical format and stay bounded.

## Required evidence

- Pre-fix failure against the preserved records, collected without modifying canonical runtime files.
- Regression evidence for accepted legacy structure and rejected tampering.
- Focused tests, typecheck, static APK lint, committed-dist build check, and diff check on the committed candidate.
- Hosted Quality success for the exact candidate SHA.
- Fresh independent review findings and passing APK completion-gate result.

## Review questions

- Can an arbitrary or forged old epoch pass by using the legacy fallback?
- Do writer and reader use identical canonical property order and timestamp semantics for new records?
- Are original stored times, path order, hashes, and journal bytes preserved?
- Are modern snapshot-bearing records always checked strictly against their stored identity?
- Does recovery remain bounded in input size and aggregate hash attempts?

## Counterexample searches

- Changed epoch ID and changed carried SHA values.
- Erased, forged, reordered, aliased, and duplicate carried paths.
- Changed stored timestamp and noncanonical ISO time.
- Historical drift at and beyond accepted bounds.
- Modern records with contract snapshots and altered identity.

## Verification

- `{"id":"task-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"hosted-quality","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm release:check"}`

## Documentation updates

- docs/task-system.md
- docs/progress.md

## Notes

- Task 0221 remains blocked with its original baseline and evidence intact. This successor does not complete or rewrite Task 0221 retroactively.
- The earlier candidate implementation commit `d26954f` and emergency reader fix are diagnostic source material only; all successor evidence must bind to the fresh candidate created for this contract.
- Task 0223 now depends on this successor in place of blocked Task 0221 so shared packaged output work remains sequential.
