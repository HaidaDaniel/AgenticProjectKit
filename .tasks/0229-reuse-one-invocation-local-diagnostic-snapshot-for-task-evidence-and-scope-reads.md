# Task 0229 - Reuse one invocation-local diagnostic snapshot for task evidence and scope reads

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: status,evidence,gate,provenance,performance,tests
Risk: high
Parallel: true
Depends on: 0228
Tags: status,evidence,gate,provenance,performance,tests

## Goal

Eliminate repeated task, baseline, evidence-journal, run-log, agent-registry, and candidate-comparison reads within one read-only diagnostic invocation. Reuse must be invocation-local, candidate-bound, and fail-closed, never a durable cache that can hide changed evidence or a changed candidate.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- src/core/status/index.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/tasks/evidence.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/command.test.ts

## Files allowed to edit

- src/core/status/index.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/tasks/evidence.ts
- src/core/tasks/diagnostics.ts
- src/core/tasks/task.test.ts
- src/cli/command.test.ts
- dist/**
- docs/engineering/testing-strategy.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/index.ts
- src/core/status/attention.ts
- src/cli/cli.test.ts
- src/cli/commands/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Capture an operation-count baseline before editing. Use a disposable Git fixture with several tasks, a shared append-only evidence journal, a run log, and a claimed task. Count reads of task Markdown, `.agentic/evidence.jsonl`, run logs, baselines, the agent registry, and Git comparison subprocesses during one `status --detail` invocation and one `attention --json` invocation.
2. Identify the concrete duplicate sources in `src/core/status/index.ts`, `src/core/tasks/gate.ts`, `src/core/tasks/provenance.ts`, and `src/core/tasks/evidence.ts`. At minimum trace `captureTaskCompletionCandidate`, `readTaskEvidence`, `listAgents`, `allTaskFiles`, `readTaskBaseline`, `readTaskBaselineHistory`, `readRunLog`, and `currentTaskAttributionApproval`.
3. Introduce a read-only invocation-local snapshot in `src/core/tasks/diagnostics.ts`. It must be created explicitly for one CLI diagnostic invocation and expose lazy memoized loaders for the task inventory, parsed evidence records, run log, registered agent IDs, per-task baseline, per-task candidate capture, and per-task provenance inputs.
4. Keep the snapshot immutable after capture. Do not expose a refresh-through mutation path that could mix two states in one projection. If a caller needs a new state, it must create a new snapshot.
5. Pass the snapshot through the status, gate, and provenance read paths as an optional argument. Preserve existing default behavior for standalone callers that do not provide one. Do not create a module-global singleton.
6. Ensure the snapshot key includes the repository root, task directory, task ID, baseline ID, candidate identity, and worktree identity where results depend on them. Results for one worktree, candidate, or task must never be served for another.
7. Do not change evidence append, evidence locking, task lifecycle, baseline writing, or review/decision recording. Mutation paths must not reuse a snapshot across a write and a later read.
8. Preserve candidate-bound freshness. A snapshot is valid only for the invocation and only for the repository state it observed. A new CLI invocation must read the evidence journal, run log, task file, and Git state again.
9. Preserve every fail-closed rule: missing evidence is not a pass; malformed evidence is an error or unavailable state; stale or other-candidate evidence remains stale; out-of-scope or forbidden files remain blockers; missing review remains a blocker.
10. Add tests for shared-journal reuse, changed evidence between invocations, changed candidate commit, changed task contract, missing or malformed evidence, different worktrees, a large append-only journal, and cross-task isolation.
11. Record before/after operation counts for the reproducible workload. State relative reductions and absolute counts; do not set a wall-clock threshold.
12. Run the focused tests, typecheck, lint, APK task lint, docs consistency, diff check, and committed-dist check on the final candidate.

## Acceptance criteria

- One read-only status/attention invocation parses the shared evidence journal at most once, reads the run log at most once, and reads the agent registry at most once.
- Each task Markdown file is parsed at most once per invocation; each task baseline is read at most once per invocation.
- Gate and provenance for the same task, candidate, worktree, and baseline share the same captured task, scope, and evidence data instead of recomputing them.
- Gate and provenance outputs remain semantically identical to the pre-refactor behavior on the same fixtures, including blockers and diagnostics.
- A new CLI invocation observes evidence appended after the previous invocation; no result survives process exit.
- Changing the candidate commit invalidates prior candidate-bound assumptions, and the new invocation reports the new candidate identity.
- Changing the task contract between invocations is observed, and a malformed or missing contract fails closed.
- Missing, malformed, stale, or other-candidate evidence never becomes a pass.
- Results are isolated per task, worktree, candidate, and baseline; one task cannot consume another task's cached evidence or provenance.
- A large append-only journal is parsed once per invocation and does not cause per-task repeated full-file parsing.
- No global, on-disk, or release-persistent cache is introduced.
- Mutation paths such as claim, verify, review, done, block, release, decision, and epoch are unaffected.
- Tests prove the operation-count reduction and the freshness/fail-closed behavior.

## Correctness assumptions

- Within one read-only CLI process, repeated reads of an unchanged repository can safely share one captured state if the state is explicitly bounded to that invocation.
- Reusing a parsed append-only journal is safe only when the projection does not require observing writes made by another process during the same invocation.
- A snapshot must be rejected or bypassed whenever its repository, task, baseline, worktree, or candidate identity does not match the request.
- Reducing reads must not change the meaning of freshness, assurance, scope, or evidence eligibility.

## Invariants

- No durable or cross-invocation cache.
- No cache of a pass result independent of candidate and evidence identity.
- No weakening of provenance, scope, review, evidence, or completion-gate checks.
- No mutation of append-only evidence, baselines, task files, or lifecycle state.
- No sharing of results across tasks, worktrees, candidates, or baselines.
- No change to evidence append locking or the single-terminal-result rule.
- No unbounded retention beyond one invocation.
- Concurrent or subsequent independent invocations must always observe current files.

## Required evidence

- Pre-fix operation counts for the reproducible workload.
- Post-fix operation counts for the same workload, with the exact commands and fixture description.
- Regression output for cross-invocation evidence changes, candidate changes, contract changes, missing or malformed evidence, multiple worktrees, and a large journal.
- A statement that gate/provenance results are semantically unchanged.
- Focused tests, typecheck, lint, APK lint, docs consistency, diff check, and committed-dist result.

## Review questions

- Where exactly were the duplicate reads, and does the snapshot cover each proven source rather than an assumed one?
- Can any result be reused across a different task, worktree, candidate, or baseline?
- Does a new invocation always observe newly appended evidence and a changed candidate?
- Are malformed or missing evidence, stale evidence, out-of-scope paths, and missing review still fail-closed?
- Is any cache persisted across process boundaries or reused after a mutation?
- Do gate and provenance still produce the same blockers and diagnostics for the same fixture?
- Does the operation-count test measure real eliminated work rather than only wall-clock time?

## Counterexample searches

- Several tasks read the same evidence journal in one invocation.
- Evidence is appended between two CLI invocations.
- The candidate commit changes between two invocations.
- The task contract changes between two invocations.
- Evidence is missing, malformed, truncated, or belongs to another candidate.
- The same task ID exists in two worktrees with different baselines.
- An evidence journal grows to include many records for unrelated tasks.
- One task has no evidence while another task has a current pass.
- A mutation command runs between two diagnostic commands.
- A stale review or exhausted review budget is present.

## Verification

- `{"id":"operation-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record the pre-fix and post-fix operation counts and the cross-invocation freshness observations for the shared-journal fixture as manual evidence."}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts src/cli/command.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the invocation-local diagnostic snapshot, its freshness boundary, and the operation-count verification approach in `docs/engineering/testing-strategy.md`.
- Update `docs/progress.md` when the task state changes.

## Notes

- Confirmed defect in APK v0.5.1: `evaluateTaskCompletionGate` captures a candidate, reads task evidence, lists all task files for dependencies, lists agents, and then reads task evidence again for attribution approval. `buildTaskProvenance` independently captures the same candidate and reads the same evidence and run log. `summarizeStatus` lists active and archived tasks before this work.
- The downstream audit observed about 85,100 `readFile` attempts, 1,894 unique paths, 140 evidence-journal requests, and 94 to 96 reads of individual task files during one workers call. Workers is addressed by Task 0228; this task addresses the remaining status/gate/provenance duplication.
- This task depends on Task 0228 because it changes the same status diagnostic surfaces and must not compete with the workers refactor.
- Do not combine this task with Task 0227 (selection) or Task 0230 (needsHuman classification).
- Candidate-bound freshness and fail-closed evidence behavior are more important than any operation-count target. If a safe snapshot boundary cannot be established, document the no-go and retain repeated reads.
- Todo Task 0223 also allows `src/cli/command.test.ts`. Sequence 0229 before 0223 or use separate worktrees; do not edit that file concurrently.
