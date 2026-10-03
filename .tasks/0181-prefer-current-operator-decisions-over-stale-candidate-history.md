# Task 0181 - Prefer current operator decisions over stale candidate history

State: todo
Owner: none
Mode: maintenance
Lane: quality
Type: bugfix
Scope: tasks,gate,review,provenance,verification
Risk: high
Parallel: false
Depends on: 0179
Tags: correctness,invariant

## Goal

Select the latest current operator-asserted decision before stale history when displaying or resolving review-budget state; preserve bounded grants and candidate freshness without synthesizing authorization.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/task.test.ts
- dist/**
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- docs/roadmap.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/v*.md

## Steps

1. Reproduce a current grant alongside older stale grants selecting a stale displayed decision
2. Inspect current versus stale accept-current interactions with grant supersession and budget blockers
3. Choose the latest current decision with deterministic ordering and use stale fallback only when none is current
4. Regress stale acceptance current grant and multiple-current chronological ordering cases
5. Preserve the independent-review hard blockers and operator assertion boundary
6. Build and commit current dist then verify and obtain fresh independent review

## Acceptance criteria

- Gate status and provenance expose the latest current decision when one exists
- A stale accept-current record cannot supersede a current grant
- Current accept-current supersedes grants only under existing structured exhaustion semantics
- Stale-only history remains visible without resolving blockers
- No operator identity or consent is invented
- Grant caps and append-only evidence history remain unchanged

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

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"deterministic","instruction":"Observe a successful hosted Quality run for the exact committed candidate SHA.","evidence":"exact SHA plus successful hosted Quality run URL"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Observed during Task 0178 on 2026-10-03: current grant evidence-1791017174354-509plw was counted as +2 while the gate displayed stale evidence-1791016635259-l1mbv9. gate.ts sorts current assessments before stale assessments and then selects at(-1); reproduce this before altering code.
