# Task 0184 - Support bounded Git DAG and merge attribution for task scope

State: todo
Owner: none
Mode: product
Lane: workflow
Type: refactor
Scope: git,scope,baseline,provenance,merge,verification
Risk: critical
Parallel: false
Depends on: 0183
Tags: git,merge,provenance,scope,invariant,correctness

## Goal

Stop treating every merge commit or nonlinear Git history as an automatic task-scope failure. Extend the existing fail-closed attribution engine from a single-parent chain to a bounded Git DAG while preserving exact ownership proof and rejecting ambiguous conflict-resolution changes.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/gate.ts
- .tasks/0183-add-append-only-verification-epochs-for-stale-task-baselines.md

## Files allowed to edit

- src/core/tasks/**
- src/core/status/**
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- dist/**
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- .tasks/0184-support-bounded-git-dag-and-merge-attribution-for-task-scope.md

## Files forbidden to edit

- src/core/scanners/**
- src/core/audit/**
- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce the current nonlinear-history failure with a normal two-parent merge between a task baseline and candidate.
2. Replace the single-parent walk with a bounded DAG traversal rooted at the current verification epoch/baseline and candidate HEAD.
3. Preserve the existing proven-other-task attribution rules for every traversed commit/path; author/message/branch naming remains non-proof.
4. For merge commits, distinguish ancestry already proven on parents from merge-resolution deltas. Accept only merges whose resulting changed paths can be attributed without guessing; ambiguous conflict-resolution edits fail closed with a precise diagnostic.
5. Keep hard commit/file traversal caps and deterministic ordering.
6. Add provenance output explaining included/excluded branches, merge nodes, and the first ambiguity when attribution fails.
7. Regress linear history so its behavior/performance does not materially worsen.
8. Regenerate committed dist and update docs.

## Acceptance criteria

- A normal merge of independently proven completed-task history no longer blocks an unrelated active task solely because the commit has two parents.
- A merge containing an unproven or ambiguous path still fails closed.
- Merge conflict-resolution edits cannot be silently attributed to a parent branch.
- DAG traversal is bounded by explicit commit/file limits and cannot walk repository history without a cap.
- Same-file overlap, dirty-file ambiguity, forbidden paths, and incomplete other-task completion provenance remain blockers.
- Candidate/evidence/epoch binding from Task 0183 remains authoritative.
- Linear histories produce the same scope result as before.
- Diagnostics identify the merge/parent/path that made proof impossible instead of only saying nonlinear history unsupported.

## Correctness assumptions

- Git DAGs are normal repository history and should be supportable when path ownership can be proven.
- A merge commit's existence is not proof of scope ownership.

## Invariants

- Fail closed on ambiguity.
- No author/message heuristics.
- No force acceptance of conflict resolutions.
- Bounded traversal and deterministic results.

## Required evidence

- Passing clean-merge fixture.
- Failing conflict-resolution/ambiguous merge fixture.
- Regression comparison for existing linear attribution fixtures.

## Review questions

- Does the algorithm accidentally count the same commit/path twice through multiple parents?
- Can a merge hide a forbidden modification?
- Are traversal caps enforced before expensive expansion?

## Counterexample searches

- Octopus merge.
- Criss-cross ancestry.
- Merge with rename/delete.
- Same file changed on both parents.
- Completed task candidate plus lifecycle-only child commit on one branch.
- Merge beyond attribution commit cap.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Replace the current blanket nonlinear-history limitation with the bounded DAG attribution contract and fail-closed cases.

## Notes

- translator-agent Task 0136 was blocked solely because APK 0.4.7 rejected nonlinear merge ancestry before checks.
- Do not solve this by following only first-parent history; that can hide branch changes. The accepted behavior must account for all relevant ancestry or reject it explicitly.
