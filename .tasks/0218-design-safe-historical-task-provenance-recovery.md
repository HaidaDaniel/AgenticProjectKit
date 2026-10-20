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
2. Create one integrated synthetic temporary Git DAG reproducing the mixed-history shape: a stable historical baseline, a task-owned side branch, a merge associated with downstream Tasks 0137/0142, an intervening contract edit, and a later candidate.
3. In addition to the integrated reproducer, create four independent minimal scenarios, each isolating one condition: (a) merge attribution rejection, (b) side-branch attribution rejection, (c) predecessor-contract mismatch rejection during epoch start, and (d) previously carried mode-only paths whose content hashes are unchanged but whose Git index and worktree modes differ. Keep unrelated history out of each minimal scenario so its result identifies the responsible proof boundary.
4. For scenario (d), vary only file mode identity across a synthetic baseline and candidate: identical bytes with `100644` versus `100755` in the baseline, index, or worktree. Record whether the current implementation can prove that a mode-only path is pre-existing, whether it treats the path as task-owned or out of scope, and whether any existing approval or epoch operation can separate mode identity from content identity without weakening attribution.
5. Execute only the existing APK behavior against these synthetic scenarios. Record the observed `accept-attribution`, epoch-start, provenance, scope, and gate outcomes. Do not present a design-level argument or hypothetical future behavior as an executable test result.
6. For each not-yet-implemented recovery option, write design-level proof obligations: the evidence it would need, the exact ambiguity it must reject, how that evidence would be invalidated, and a counterexample that would make the option unsafe. These obligations are analysis, not executable proof of a proposed implementation.
7. Compare bounded recovery options, including richer historical contract snapshots, explicit operator-approved exact-commit attribution, mode-only separation, a linked successor task, and no-go. For each, state proof source, residual ambiguity, auditability, migration cost, and fail-closed behavior. A linked successor may own new work and reference the old task, but does not prove historical attribution of the old task's commits and cannot satisfy its gate.
8. For mode-only paths, state the exact conditions under which content identity and mode identity can be proven separately and bound to the same path and candidate. If those conditions cannot be established, state that the old task must remain blocked and that a clean successor task is the only correct outcome.
9. Record a comparative design decision and either a safe, bounded implementation plan with required evidence and migration steps or an explicit no-go grounded in evidence.
10. Keep the work research-only: do not change attribution implementation, task lifecycle, task evidence, file modes, the Git index, or Git history.

## Acceptance criteria

- A deterministic integrated synthetic Git DAG reproduces the mixed-history shape and records current attribution, epoch, provenance, and gate outcomes.
- Four independently runnable minimal synthetic scenarios isolate merge rejection, side-branch rejection, predecessor-contract mismatch rejection, and mode-only carried-path rejection.
- The mode-only scenario proves which exact file path, content hash, Git index mode, and worktree mode combinations are distinguishable under current behavior and under any proposed recovery option.
- Executable results describe only behavior observed from the current implementation; future recovery proposals are evaluated separately through explicit design-level proof obligations.
- The design record compares recovery options and selects a safe implementation plan or documents a no-go; it does not recommend an automatic bypass or history rewrite.
- Every viable option preserves fail-closed behavior for foreign-task changes, forbidden paths, incomplete or ambiguous ancestry, changed predecessor contracts, mode-only ambiguity, and missing proof.
- A linked successor task is not treated as proof of the old task's commit attribution, completion, or gate eligibility.
- The report states when a clean successor is the only correct outcome because the historical task cannot be proven complete without weakening scope or mode identity.
- The reproducer and report use synthetic identities and temporary Git repositories; no downstream repository or existing task evidence is modified.
- No APK implementation source, release artifact, file mode, Git index, or Git history is changed.

## Correctness assumptions

- Safe recovery must derive ownership from durable, independently checkable Git and task-contract evidence, or require an explicit operator decision bound to exact objects and paths.
- A task remaining blocked is preferable to accepting foreign, forbidden, or unprovable changes.
- Similarity of author, message, timestamps, or branch names is not proof of ownership.
- An unchanged content hash does not by itself prove that a path is pre-existing, because Git index and worktree mode identity are part of the candidate state.
- A previously carried path does not automatically become pre-existing on a later epoch merely because its content did not change.

## Invariants

- No automatic bypass, force acceptance, evidence rewrite, or Git-history rewrite.
- Foreign-task, forbidden, missing, ambiguous, and over-limit changes remain blockers under every recommended design.
- No automatic exclusion of mode-only paths, automatic chmod, index mutation, or file-mode normalization.
- Existing provenance and verification evidence remain append-only and unchanged.
- Research artifacts contain only synthetic DAG data and bounded observations.

## Required evidence

- Runnable integrated synthetic DAG reproducer and captured current outcomes for attribution approval, epoch start, provenance, and gate.
- Four independent minimal reproducer outcomes for merge, side-branch, predecessor-contract mismatch, and mode-only carried paths.
- Exact mode-only outcome matrix covering identical content with differing baseline, index, and worktree modes, including cases where `core.filemode` is disabled.
- Comparison matrix for recovery options, including explicit no-go criteria and the successor-task condition.
- Design-level proof-obligation matrix for unimplemented options, clearly distinguished from executable results.
- Written decision and, only if safe, an implementation plan with fail-closed regression cases.

## Review questions

- Does the synthetic DAG reproduce the relevant merge, side-branch, and predecessor-contract constraints without relying on downstream private data?
- Can any proposed recovery accept a foreign task's commit or forbidden path without exact, durable proof?
- Does a changed historical contract make the relevant object unverifiable, and does the design fail closed when that cannot be repaired safely?
- Can mode-only changes be separated from task-owned content changes with exact path, content, index-mode, and worktree-mode evidence, or does the proposal merely assume they are unrelated?
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
- A mode-only path has identical bytes but a different executable bit in the baseline commit, the index, and the worktree.
- A mode-only path is also content-changed in the candidate, or its mode change appears after the baseline was captured.
- `core.filemode` is disabled, so a mode change is visible only through explicit index or tree inspection.
- A mode-only path is listed as carried scope, then its mode is reverted, re-applied, or changed together with a content edit.
- A proposed recovery treats unchanged content as sufficient proof while ignoring mode identity, or treats a mode-only path as task-owned without path-binding evidence.

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
- Supplementary downstream case for scenario (d): translator-agent Task 0225 retained 25 previously inventoried mode-only paths as carried task scope after an operator amendment. The project documented unchanged content hashes and `100644` index versus `100755` worktree identity, but the installed CLI could not express a safe pre-existing treatment. The work continued through successor Task 0226 in a clean worktree. Treat this only as a shape to reproduce synthetically; do not inspect or modify the downstream repository from this task.
- The downstream case is not evidence of a new v0.5.1 regression. It is a historical attribution and scope-boundary problem that this research task must classify.
- Conditions for the successor outcome: when the old task's carried path cannot be bound to exact path, content, index mode, worktree mode, candidate, and a valid operator authorization, the old task must remain blocked and a clean successor must own new work. A successor does not prove or complete the old task's provenance.
- Impact: the historical task remains blocked after the v0.5.0 update because neither current attribution approval nor epoch start can prove the complete history. A blocked task must not be treated as passing merely to restore progress.
- The source boundaries to trace are `validateTaskAttributionApproval`, `startTaskVerificationEpoch`, the bounded Git lineage traversal, provenance projection, and the gate in `src/core/tasks/index.ts`, `src/core/tasks/provenance.ts`, and `src/core/tasks/gate.ts`.
- Existing APK Tasks 0183/0184 cover append-only epochs and bounded DAG attribution. Archived Task 0197 and Task 0202 document explicit attribution behavior and historical validation; this task researches the remaining failure shape rather than reimplementing those features.
- Do not authorize or record a real operator decision.
- Lint is static and must not execute task verification commands.
