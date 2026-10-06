# Task 0195 - Prove completed multi-commit task chains in stale-baseline scope exclusion

State: todo
Owner: none
Mode: product
Lane: bugfix
Type: bugfix
Scope: git,scope,baseline,provenance,attribution
Risk: critical
Parallel: false
Depends on: none
Tags: bugfix,attribution

## Goal

Make the fail-closed attribution engine exclude completed-task history that the current single-commit proof rule misses, so a long-lived task whose claim baseline predates later completed work can pass scope again without laundering anyone else's files.

Two gaps in `resolveTaskCandidateCommit` block real history in this repository. Task 0191 is blocked on them, and Tasks 0120, 0133, 0149, 0150, and 0170 carry the same class of stale-baseline scope violation:

1. Multi-commit completed tasks are never provable. The exclusion proof requires the proven commit to be a direct child of the task's claim/epoch baseline, but the completion record is bound to the task's final commit. A task whose work spans more than one implementation commit therefore has no provable commit, and every file it touched stays attributed to any older open task.
2. Task files created inside their own first candidate commit are never provable. The contract proof reads the task file at the candidate commit's parent; for a new task the file is absent there (it is created by the task's own first commit), so the proof fails closed even when every other condition holds. This is the standard workflow for new tasks in this repository.

Prove the entire bounded single-parent commit chain of a completed task as that task's attribution, and accept task files created during the chain when the chain's contract is otherwise stable. Every existing fail-closed behavior must be preserved.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- .tasks/0191-materialize-apk-skills-into-standards-based-project-skill-directories.md
- .tasks/0193-make-verification-proportional-and-remove-redundant-quality-runs.md
- .tasks/0194-move-cli-behavior-matrices-to-isolated-command-layer-tests.md

## Files allowed to edit

- src/core/tasks/**
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/cli/**
- src/core/templates/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Capture failing fixtures first: (a) an open task's baseline predates a completed two-implementation-commit task, and its commits are not excluded; (b) a completed single-commit task whose task file was created inside its own first commit is not excluded because the parent-commit contract proof fails. Record the exact failing attribution observations before changing implementation.
2. Extend commit proof so a done task's bounded single-parent chain from its claim/epoch baseline to its completion-bound final commit is proven as that task's attribution when the chain is contiguous inside the traversed DAG, the completion record, done run event, owner, and evidence-set checks pass against the chain head, and every chain commit's non-bookkeeping paths fit the task's allowed/forbidden scope with the existing dirty-fingerprint exclusion.
3. Accept task files created during the chain: the task file may be absent at the chain base and must first appear in a chain commit; from first appearance through the chain head its normalized contract (state/owner excluded) must equal the current task file's normalized contract.
4. Preserve every fail-closed path: ambiguous dual ownership of a commit or chain, same-file overlap with active-task-owned, pre-existing, handoff-dirty, or current working-tree files, release/reclaim interval checks, first-parent merge checks, bookkeeping-commit proof, and bounded output commit/file limits must all still fail closed.
5. Keep author, message, timestamp, and branch naming non-proof; attribution remains derived only from Git structure, baseline records, completion evidence, run events, and task files.
6. Update docs/task-system.md's scope-attribution section with the chain-proof rule, the first-commit task-file rule, and the unchanged fail-closed cases.
7. Regenerate committed dist and run the full task test suite.

## Acceptance criteria

- A completed task with two or more implementation commits on top of an open task's baseline is excluded from that baseline's scope when the chain, scope, contract, completion, and done-event proofs all hold.
- A completed task whose task file was created inside its own first candidate commit is provable when the file is absent at the chain base and the chain contract is stable.
- A fixture mirroring the real Task 0191 history shape (open baseline, then a four-implementation-commit completed task with completion bound to the fourth commit plus its bookkeeping commit, then a single-commit completed task whose task file was created in its first commit plus its bookkeeping commit) resolves the open task's scope to clean with the other tasks' files reported as excluded.
- Existing single-commit, bookkeeping, merge, release/reclaim, dirty-fingerprint, and fail-closed attribution fixtures pass without semantic edits.
- No CLI surface, lifecycle state machine, evidence record schema, epoch semantics, or provider behavior changes.
- docs/task-system.md describes the chain-proof and first-commit task-file rules.

## Correctness assumptions

- A completion record bound to a final commit plus a contiguous Git chain from the task's baseline is sufficient structural proof that every commit in the chain belongs to that task.
- A task file absent at the chain base but present and contract-stable from first appearance is the task's own file, not foreign content.
- Fail-closed ambiguity remains correct even at the cost of leaving some real history unexcluded.

## Invariants

- Fail closed on ambiguity.
- No author/message heuristics.
- No out-of-scope or forbidden path becomes excludable through chain proof.
- Overlap, dirty-fingerprint, and merge safety checks apply to chain attributions exactly as to single-commit attributions.
- Bounded traversal and deterministic results.

## Required evidence

- Pre-fix failing fixtures for both gaps.
- Post-fix passing fixtures for both gaps.
- A real-history-shape fixture mirroring the blocked Task 0191 scenario (0193 four-commit chain plus 0194 first-commit task file).
- Fail-closed counterexample fixtures: out-of-scope chain commit, non-lifecycle contract edit inside the chain, ambiguous dual chain ownership, and chain commit overlapping an active-task-owned file.

## Review questions

- Can chain proof attribute a commit the task did not actually make, such as history that slipped between the baseline and the task's first commit?
- Does the first-commit task-file rule let a task rewrite its own contract mid-chain and still be proven?
- Do the overlap, dirty-fingerprint, release/reclaim, and merge fail-closed paths still fire for chain attributions?
- Do the bounded output limits still cap chain expansion before attribution is accepted?

## Counterexample searches

- A two-commit task whose second commit touches an out-of-scope path.
- A two-commit task whose second commit makes a non-lifecycle task-file edit.
- Two completed tasks whose chains could both claim the same commit.
- A chain whose first commit also modifies an active-task-owned file.
- A chain commit matching a pre-existing dirty fingerprint at the active task's baseline.
- A task file first appearing in the chain's second commit rather than its first.
- A chain exceeding the attribution commit or file output limit.
- A bookkeeping commit after the chain head, plus a further non-bookkeeping commit after the head.
- Existing single-commit tasks and task files present at the baseline (behavior must not change).

## Verification

- `{"id":"static-quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality:static"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/task-system.md's scope-attribution section with the chain-proof rule, the first-commit task-file rule, and the unchanged fail-closed cases.
- Update docs/progress.md when task state changes.

## Notes

- Motivation: Task 0191's completion gate is blocked because Tasks 0193 and 0194 completed on top of its open baseline and their seven commits are unprovable (0193 completion bound to a non-baseline child of a four-commit chain; both 0193's and 0194's task files were created inside their own first candidate commit). Tasks 0120, 0133, 0149, 0150, and 0170 are blocked on the same class of scope violation.
- Do not resolve the block by attributing other tasks' files to the active task, widening the active task's allowed files, or relaxing the scope check; the proof must come from Git structure, baseline records, completion evidence, run events, and task files.
- Epoch semantics intentionally preserve out-of-scope predecessor paths as blockers; this task does not change epoch carry-forward behavior.
- After this task lands, Task 0191 can be released, reclaimed, re-verified, re-reviewed, and completed through the normal gate.
