# Task 0187 - Design a lower-noise task lifecycle without losing distributed state

State: todo
Owner: none
Mode: discovery
Lane: architecture
Type: research
Scope: task-lifecycle,state,git,provenance,collaboration,bookkeeping
Risk: high
Parallel: true
Depends on: 0184
Tags: research,task-lifecycle,git,provenance,dogfood

## Goal

Resolve the recurring Git-history noise caused by candidate commits followed by lifecycle-only task-state commits, without preselecting an unsafe storage design.

Research whether APK can reduce or eliminate separate "State: doing -> done" bookkeeping commits while preserving distributed repository truth, exact candidate evidence, collaboration, fresh-clone behavior, archive semantics, and offline/local-first operation.

Do not implement a new task-state store in this task. Finish with one explicit recommendation and the exact follow-up implementation contract if change is justified.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- .tasks/archive/0121-document-candidate-and-completion-bookkeeping-commit-lifecycle.md
- .tasks/0183-add-append-only-verification-epochs-for-stale-task-baselines.md
- .tasks/0184-support-bounded-git-dag-and-merge-attribution-for-task-scope.md
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts

## Files allowed to edit

- .tasks/0187-design-a-lower-noise-task-lifecycle-without-losing-distributed-state.md
- docs/research/task-lifecycle-state-and-git-noise.md
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Measure current behavior in APK, translator-agent, and ResLedger: candidate commit, verify/review/gate, apk done, lifecycle-only commit.
2. State why simply moving State/Owner to another tracked file does not reduce commit count, and why moving shared state to an untracked machine-local file can lose distributed/fresh-clone truth.
3. Compare at least: current tracked Markdown lifecycle; immutable task contract plus tracked append-only lifecycle journal; Git-notes/refs; derived state from committed evidence/run records; local runtime state plus explicit published completion snapshot; and a combined candidate/completion commit model that preserves candidate-bound SHA evidence.
4. Evaluate fresh clone, multi-user collaboration, offline/local-first use, archives, task dependencies, status/next-task, evidence freshness, merge/rebase behavior, and repository readability.
5. Determine whether lifecycle state can be derived from existing append-only evidence without creating a second source of truth.
6. Quantify migration/backward-compatibility cost for existing task files.
7. End with exactly one recommendation: KEEP TRACKED MARKDOWN, TRACKED LIFECYCLE JOURNAL, DERIVED LIFECYCLE, or another clearly named single design.
8. If change is recommended, specify one bounded implementation task contract and migration/rollback rules; do not create or implement it in this research task.

## Acceptance criteria

- The research explains the distributed-state tradeoff rather than assuming an untracked sidecar is automatically better.
- It uses Task 0121 and real downstream commit history as evidence.
- Candidate SHA/evidence integrity remains non-negotiable; no amend/squash trick is presented as a safe default after evidence binding.
- Every option is evaluated for fresh clones and collaboration, not only single-machine UX.
- The recommendation states whether lifecycle-only commits can actually be removed, merely consolidated, or should remain.
- If a new state store is recommended, there is exactly one authoritative lifecycle source and a backward-compatible legacy projection.
- Archive/dependency/status semantics and Tasks 0183/0184 epoch/DAG design are accounted for.
- The output names the follow-up implementation scope but this task itself changes no runtime behavior.

## Correctness assumptions

- Git-history noise is undesirable, but shared task state has real persistence requirements.
- A cosmetic relocation that preserves the same required commit is not a meaningful fix.

## Invariants

- No provenance weakening.
- No hidden machine-local completion truth as the sole source for shared repositories.
- Existing repositories remain readable until an explicit migration.

## Required evidence

- Current lifecycle trace from at least APK plus one downstream repository.
- Comparison matrix with commit/no-commit and fresh-clone behavior.

## Review questions

- Does the preferred design genuinely reduce commits or only move the diff?
- Can a fresh clone know which tasks are done without trusting unavailable local state?
- Can evidence remain bound to the immutable candidate?

## Counterexample searches

- Two developers complete different tasks concurrently.
- Fresh clone with no .agentic runtime files.
- Archived done task.
- Task completed offline then pushed later.
- Candidate rejected after review and fixed.

## Verification

- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Add the accepted research artifact and decision reference only.

## Notes

- Task 0121 intentionally documented the two-commit lifecycle and deferred any storage redesign. This task is that deferred design investigation.
- Do not pre-create an implementation task before this research chooses an architecture; doing so would lock in the answer and risk conflicting with the provenance changes in 0183/0184.
