# Task 0218 - Design safe historical task provenance recovery

State: todo
Owner: none
Mode: maintenance
Lane: research
Type: research
Scope: provenance,recovery,git,history
Risk: high
Parallel: false
Depends on: none
Tags: research,provenance,recovery

## Goal

Design a safe, evidence-based recovery path for historical tasks that remain blocked when mixed Git history, merge and side-branch commits, and predecessor-contract changes defeat current attribution and epoch proofs. Decide whether recovery can be proven without weakening fail-closed scope enforcement, and document a no-go when available evidence is insufficient.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/index.ts
- src/core/tasks/provenance.ts
- src/core/tasks/gate.ts
- .tasks/0183-add-append-only-verification-epochs-for-stale-task-baselines.md
- .tasks/0184-support-bounded-git-dag-and-merge-attribution-for-task-scope.md
- .tasks/archive/0197-add-explicit-operator-approved-attribution-recovery-for-interrupted-tasks.md
- .tasks/archive/0202-validate-implemented-behavior-and-reconcile-operator-authorized-historical-tasks.md
- docs/delivery/backlog-reassessment-2026-10-07.md

## Files allowed to edit

- docs/task-recovery/**
- experiments/task-provenance-recovery/**
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- docs/research/**
- docs/releases/**
- .tasks/archive/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**

## Steps

1. Trace `validateTaskAttributionApproval`, `startTaskVerificationEpoch`, bounded Git DAG traversal, provenance output, and the completion gate. Record the exact checks and rejection reasons that apply to the InfoWarden Task 0138 history shape.
2. Build a synthetic temporary Git repository in `experiments/task-provenance-recovery/` with a stable historical baseline, a task-owned side branch, a merge associated with downstream Tasks 0137/0142, an intervening contract edit, and a later candidate. Demonstrate why current `accept-attribution` and epoch start cannot prove the full history; do not modify this repository's Git history or task evidence.
3. Compare bounded recovery options, including richer historical contract snapshots, explicit operator-approved exact-commit attribution, a linked successor task, and no-go. For each option, state its proof source, residual ambiguity, auditability, migration cost, and fail-closed behavior.
4. Test each option against foreign-task commits, forbidden paths, unproven branch commits, ambiguous merge-resolution paths, contract edits, missing objects, and over-limit history. Reject any option that turns missing proof into acceptance.
5. Record a comparative design decision and either a safe, bounded implementation plan with required evidence and migration steps or an explicit no-go grounded in evidence.
6. Keep the work research-only: do not change attribution implementation, task lifecycle, task evidence, or Git history.

## Acceptance criteria

- A deterministic synthetic Git DAG reproduces the relevant mixed-history constraints and records current attribution, epoch, provenance, and gate outcomes.
- The design record compares recovery options and selects a safe implementation plan or documents a no-go; it does not recommend an automatic bypass or history rewrite.
- Every viable option preserves fail-closed behavior for foreign-task changes, forbidden paths, incomplete or ambiguous ancestry, changed predecessor contracts, and missing proof.
- The reproducer and report use synthetic identities and temporary Git repositories; no downstream repository or existing task evidence is modified.
- No APK implementation source, release artifact, or Git history is changed.

## Correctness assumptions

- Safe recovery must derive ownership from durable, independently checkable Git and task-contract evidence, or require an explicit operator decision bound to exact objects and paths.
- A task remaining blocked is preferable to accepting foreign, forbidden, or unprovable changes.
- Similarity of author, message, timestamps, or branch names is not proof of ownership.

## Invariants

- No automatic bypass, force acceptance, evidence rewrite, or Git-history rewrite.
- Foreign-task, forbidden, missing, ambiguous, and over-limit changes remain blockers under every recommended design.
- Existing provenance and verification evidence remain append-only and unchanged.
- Research artifacts contain only synthetic DAG data and bounded observations.

## Required evidence

- Runnable synthetic DAG reproducer and captured current outcomes for attribution approval, epoch start, provenance, and gate.
- Comparison matrix for recovery options, including explicit no-go criteria.
- Written decision and, only if safe, an implementation plan with fail-closed regression cases.

## Review questions

- Does the synthetic DAG reproduce the relevant merge, side-branch, and predecessor-contract constraints without relying on downstream private data?
- Can any proposed recovery accept a foreign task's commit or forbidden path without exact, durable proof?
- Does a changed historical contract make the relevant object unverifiable, and does the design fail closed when that cannot be repaired safely?
- Are operator identity, exact commit/path scope, evidence binding, and invalidation requirements explicit for any approval-based option?
- Is a successor task or documented no-go safer than extending the current approval/epoch model?

## Counterexample searches

- A merge whose second parent contains an unrelated task commit.
- A side-branch commit touches a forbidden or out-of-scope path before merging.
- A merge-resolution commit changes a file differently from both parents.
- The predecessor contract changes and is later restored, or the historical contract object is unavailable.
- An approval lists only part of the relevant DAG, names a non-ancestor, or becomes stale after candidate mutation.
- Two tasks could claim the same commit or file.
- Traversal exceeds current commit/file bounds or encounters rewritten, missing, criss-cross, or octopus history.
- A proposed epoch would turn a previously task-owned forbidden path into pre-existing work.

## Verification

- `{"id":"synthetic-dag","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node experiments/task-provenance-recovery/reproduce.mjs"}`
- `{"id":"design-record","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -s docs/task-recovery/historical-provenance-recovery.md","evidenceRef":"docs/task-recovery/historical-provenance-recovery.md"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Write the comparative decision to `docs/task-recovery/historical-provenance-recovery.md`.
- Update docs/progress.md when task state changes.

## Notes

- Primary downstream reproducer: InfoWarden Task 0138 and its mixed history involving merge `f4b91b0` and Tasks 0137/0142. These identifiers are context only; reproduce their structural constraints with synthetic commits.
- Impact: the historical task remains blocked after the v0.5.0 update because neither current attribution approval nor epoch start can prove the complete history. A blocked task must not be treated as passing merely to restore progress.
- The source boundaries to trace are `validateTaskAttributionApproval`, `startTaskVerificationEpoch`, the bounded Git lineage traversal, provenance projection, and the gate in `src/core/tasks/index.ts`, `src/core/tasks/provenance.ts`, and `src/core/tasks/gate.ts`.
- Existing APK Tasks 0183/0184 cover append-only epochs and bounded DAG attribution. Archived Task 0197 and Task 0202 document explicit attribution behavior and historical validation; this task researches the remaining failure shape rather than reimplementing those features.
- Do not authorize or record a real operator decision.
- Lint is static and must not execute task verification commands.
