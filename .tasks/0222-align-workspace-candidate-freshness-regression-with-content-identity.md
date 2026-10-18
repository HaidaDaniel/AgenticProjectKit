# Task 0222 - Align workspace candidate freshness regression with content identity

State: done
Owner: codex-task-0222
Mode: maintenance
Lane: quality
Type: bugfix
Scope: ci,verification,candidate-freshness,regression
Risk: low
Parallel: false
Depends on: none
Tags: ci,regression,candidate-freshness

## Goal

Correct the workspace candidate identity regression test exposed by full CI after Task 0217. Distinguish a changed Git commit revision from changed candidate content, while preserving both freshness invariants and making no production-code change.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- src/cli/cli.test.ts
- src/core/tasks/index.ts
- src/core/workspaces/index.ts

## Files allowed to edit

- src/cli/cli.test.ts
- docs/progress.md

## Files forbidden to edit

- .github/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**

## Steps

1. Reproduce `workspace records bind distinct candidates across revisions` at a clean checkout using Node 22.22.1 and pnpm 10.28.1. Record the test assertion and exact candidate/revision observations; do not attribute the GitHub run's cause beyond what this local reproduction proves.
2. Trace `captureTaskEvidenceSubject` and workspace creation. Confirm that `candidateId` binds the normalized task contract and declared changed-file contents, while `candidateRevision` records the Git HEAD.
3. Correct the test fixture so its distinct-candidate case changes a tracked file that is explicitly included in `changedFiles`; assert that both `candidateId` and `candidateRevision` differ.
4. Add the complementary case where a new commit changes only content outside the declared candidate files: assert that `candidateRevision` differs while `candidateId` remains equal.
5. Keep this test-only. Do not change candidate fingerprinting, workspace recording, evidence freshness, or production source.
6. Run the canonical full release check with the CI-pinned toolchain and confirm committed `dist/` remains clean.

## Acceptance criteria

- The existing workspace candidate test passes without changing production code or candidate freshness semantics.
- A changed commit whose tracked content is declared as candidate input produces a distinct candidate ID and Git revision.
- A new commit that changes only content outside declared candidate inputs produces a distinct Git revision but retains the same candidate ID.
- The fixture no longer expects commit identity alone to change a content-based candidate ID.
- `pnpm release:check` passes locally under Node 22.22.1 and pnpm 10.28.1, and its success is reported only as local evidence, not as a GitHub Actions pass.
- No implementation files outside `src/cli/cli.test.ts` are changed; `docs/progress.md` may change only for task lifecycle bookkeeping.

## Correctness assumptions

- Candidate identity represents task-contract and declared candidate content; workspace candidate revision separately records Git HEAD.
- A reproducible assertion failure can be corrected in the fixture when implementation behavior matches the documented invariant.

## Invariants

- No production implementation changes are included.
- A Git revision change alone is not represented as changed candidate content.
- A real declared candidate-content change remains distinguishable.
- Local verification is never described as hosted CI evidence.

## Required evidence

- Pre-fix exact-SHA reproduction under Node 22.22.1 and pnpm 10.28.1, including the latest red CI commit where available.
- Regression output for both changed-candidate-content and revision-only cases.
- Successful canonical `pnpm release:check` and clean committed-`dist` check.

## Review questions

- Does the distinct-candidate fixture actually change a tracked file included in `changedFiles`?
- Does the revision-only fixture preserve candidate content while advancing Git HEAD?
- Did the patch leave production fingerprinting and freshness behavior untouched?
- Is local success clearly separated from a hosted CI result?

## Counterexample searches

- A commit changes only an unlisted README while `changedFiles` remains empty.
- A declared candidate file changes but the test omits it from `changedFiles`.
- A commit changes only author, message, timestamp, or other revision metadata.
- A declared input changes and later returns to its original content.
- Candidate input is deleted, added, or changes file mode.

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- The latest public failing run for `e012972780ccd93be4678338b7f05061d8a5ff22` (run 39127552538) failed at the aggregate `pnpm release:check` step. Its GitHub annotation only reports exit code 1; job logs are unavailable to this audit. A clean local replay of that exact SHA with Node 22.22.1 and pnpm 10.28.1 passed frozen install and failed 631/632 tests at `src/cli/cli.test.ts:1235` with the same equal-`candidateId` assertion. The fixture supplied no changed candidate files, committed a README change, then expected the content-based candidate ID to differ. This proves the exact-SHA local failure; do not claim the hosted test name as its cause without the unavailable hosted log. The earlier `cc58a39` replay showed the same failure with 628/629 tests.
- This task has no dependency on 0219 or 0220: its only implementation path is `src/cli/cli.test.ts`, while those tasks own task-verification and task-scope validation paths. Their broad `src/cli/**` prohibitions do not represent candidate or provenance dependencies for this test-only fixture correction. `docs/progress.md` is shared lifecycle bookkeeping only.
- Safe same-checkout order: finish any currently doing/review task, then this independent fixture correction can run before or after 0219 and 0220. Keep the repository's one-mutable-task-per-checkout rule; use separate worktrees if independent tasks are intentionally run in parallel.
- Task 0223 depends on this task because it has a real planned overlap on `src/cli/cli.test.ts` and must verify the corrected full release check.
- The full release check executes the task once within its coverage suite; do not run overlapping full test or coverage aggregates alongside it as final verification.
