# Task 0183 - Add append-only verification epochs for stale task baselines

State: todo
Owner: none
Mode: product
Lane: workflow
Type: refactor
Scope: tasks,baseline,scope,provenance,evidence,verification,reclaim
Risk: critical
Parallel: false
Depends on: 0182
Tags: baseline,provenance,verification,invariant,correctness

## Goal

Allow a long-lived task to recover from an unusable stale claim baseline without creating a duplicate successor task or erasing provenance.

Introduce an explicit append-only verification-epoch model. A new epoch may establish a fresh repository-history anchor, but it must carry forward the task-owned candidate/path identity from the previous epoch so a baseline refresh cannot launder already-made out-of-scope changes into pre-existing state.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/status/**
- .tasks/0182-raise-bounded-review-loop-headroom-without-increasing-frontier-spend.md

## Files allowed to edit

- src/core/tasks/**
- src/core/status/**
- src/cli/commands/task.ts
- src/cli/commands/task-state.ts
- src/cli/cli.test.ts
- dist/**
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- .tasks/0183-add-append-only-verification-epochs-for-stale-task-baselines.md

## Files forbidden to edit

- src/core/scanners/**
- src/core/audit/**
- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce a released/reclaimed task whose earliest claim baseline is no longer practically attributable because many unrelated repository commits landed after it.
2. Design one explicit epoch-start transition that is append-only and visible in provenance; do not overwrite or delete the original claim/baseline records.
3. Bind each epoch to its predecessor and carry forward already-attributed task files/candidate hashes so the new history anchor cannot convert prior task changes into pre-existing files.
4. Define strict eligibility for starting an epoch: task identity/contract continuity, known committed candidate or carried-forward file set, no forbidden-path laundering, and explicit reason/provenance.
5. Make verify/gate/review/status/provenance select the current epoch while retaining older epoch evidence as stale historical evidence.
6. Preserve release/reclaim history and make ordinary clean linear tasks behave exactly as before.
7. Add migration/backward compatibility for legacy baseline records with no epoch field.
8. Document the recovery workflow and regenerate committed dist.

## Acceptance criteria

- A task can continue under the same task ID after a stale-baseline recovery; no successor task is required solely to obtain a fresh attribution anchor.
- Starting a new epoch never deletes, rewrites, or marks earlier failed verification/review evidence as passing.
- Previous task-owned changes are carried into the new epoch's scope/candidate identity; they do not become invisible pre-existing work.
- Forbidden or out-of-scope files from the previous candidate remain blockers after epoch start.
- The new epoch has a stable ID, predecessor reference, reason, anchor HEAD, and carried-forward attribution sufficient for audit/provenance.
- Current verify/review/gate evidence is epoch-bound. Evidence from an earlier epoch is retained and reported stale/non-current.
- Legacy tasks with only claim/release/block baseline records continue to work without migration.
- A normal release -> reclaim with provable lineage does not create an epoch automatically.
- Epoch creation cannot be used as a generic force/reset bypass.

## Correctness assumptions

- A fresh Git anchor is sometimes necessary after long-lived tasks, but provenance loss is not acceptable.
- The task contract and known task-owned candidate/path set are more durable than an arbitrarily old repository commit chain.

## Invariants

- Append-only provenance.
- No scope laundering.
- No silent baseline reset.
- Candidate/evidence freshness remains exact.
- One task ID continues to represent one logical deliverable.

## Required evidence

- Reproducer modeled on translator-agent's stale baseline failure.
- Regression proving an out-of-scope carried-forward file remains blocked after epoch creation.
- Backward-compatibility fixture for legacy baselines.

## Review questions

- Could an agent make an existing bad change disappear by starting an epoch?
- Is every current evidence record unambiguously tied to one epoch?
- Is operator/user intervention required only where provenance cannot otherwise be proven, rather than for ordinary recoverable cases?

## Counterexample searches

- Dirty worktree at epoch start.
- Candidate commit absent/unreachable.
- Changed task contract between epochs.
- Released task reclaimed by another owner.
- Earlier forbidden-file modification.
- Non-Git repository.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document epoch semantics, recovery boundaries, provenance display, and legacy behavior.

## Notes

- Current main deliberately treats the earliest claim as permanently authoritative. Release/reclaim appends markers but never rebases it. That protects provenance but caused real downstream tasks to be blocked after hundreds of unrelated commits.
- This task fixes stale-baseline recovery only. Merge/DAG attribution is Task 0184 and must build on the epoch model rather than inventing a second recovery mechanism.
