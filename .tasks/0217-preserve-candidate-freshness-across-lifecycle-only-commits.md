# Task 0217 - Preserve candidate freshness across lifecycle-only commits

State: doing
Owner: codex-b3-lifecycle-freshness-0217
Mode: maintenance
Lane: implementation
Type: bugfix
Scope: tasks,evidence,provenance
Risk: high
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Fix the mismatch between documented content-derived candidate identity and exact-HEAD freshness so committing only lifecycle bookkeeping preserves evidence, while source, task contract, test, or plan changes still stale it.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/evidence.ts
- src/core/tasks/index.ts
- src/core/tasks/provenance.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- .tasks/0217-preserve-candidate-freshness-across-lifecycle-only-commits.md
- src/core/tasks/evidence.ts
- src/core/tasks/index.ts
- src/core/tasks/review.ts
- src/core/tasks/task.test.ts
- dist/core/tasks/evidence.js
- dist/core/tasks/index.js
- dist/core/tasks/review.js
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- src/core/**/providers/**

## Steps

1. Reproduce and document the HEAD-only invalidation after a lifecycle commit.
2. Derive candidate and worktree identity from normalized task contract and material scoped file contents; retain the exact HEAD SHA as provenance metadata.
3. Exclude only lifecycle task state/owner/notes, APK bookkeeping, and `docs/progress.md`; retain task contract and all other changed file contents.
4. Add regression tests for lifecycle-only commits and material source/contract changes; update source, compiled `dist`, and canonical docs.
5. Run focused tests, build-current, fresh independent review, and the canonical APK gate.
6. Complete the task, commit lifecycle bookkeeping separately, and push both commits.

## Acceptance criteria

- Candidate-bound evidence remains current across lifecycle-only task/progress commits when the normalized task contract and all material scoped files are unchanged.
- Changes to source, tests, task contract, or an experiment plan change the evidence candidate and produce stale freshness.
- Symlink target/type and executable-bit changes remain material even if dereferenced file bytes are identical; target bytes are fingerprinted without lossy decoding.
- Candidate evidence capture fails closed when a staged scoped tracked path has additional unstaged worktree changes; ordinary unstaged-only candidate changes remain verifiable.
- Exact `headSha` remains recorded as historical provenance; baseline lineage and ambiguous ownership checks remain fail-closed.
- Existing evidence records are not rewritten or re-labelled.

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

- Does a lifecycle-only commit preserve identity only when material candidate inputs are byte-identical?;Do task contract edits and frozen plan edits force stale evidence?;Are historical evidence records and exact HEAD metadata retained?

## Counterexample searches

- Change implementation after review;change allowed plan JSON;change task goal or verification command;commit only task state/owner and docs progress;uncommitted code and staged code;unresolved git baseline

## Verification

- `{"id":"task-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"pnpm typecheck"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- docs/task-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
