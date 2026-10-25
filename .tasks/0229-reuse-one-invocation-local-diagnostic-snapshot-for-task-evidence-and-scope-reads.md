# Task 0229 - Reuse one invocation-local diagnostic snapshot for task evidence and scope reads

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: status,evidence,gate,provenance,performance,tests
Risk: high
Parallel: false
Depends on: 0228
Tags: status,evidence,gate,provenance,performance,tests

## Goal

Eliminate repeated task, baseline, evidence-journal, run-log, agent-registry, and candidate-comparison reads within one read-only diagnostic invocation. Reuse must be invocation-local, candidate-bound, and fail-closed, never a durable cache that can hide changed evidence or a changed candidate.

## Context files

- src/core/status/attention.ts
- src/core/status/workers.ts
- src/core/agents/index.ts
- src/core/tasks/review.ts
- docs/decisions.md
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

- src/core/status/attention.ts
- src/core/status/workers.ts
- src/core/agents/index.ts
- src/core/tasks/review.ts
- docs/decisions.md
- src/core/status/index.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/tasks/evidence.ts
- src/core/tasks/diagnostics.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/command.test.ts
- dist/**
- docs/engineering/testing-strategy.md
- docs/progress.md

## Files forbidden to edit

- src/cli/cli.test.ts
- src/cli/commands/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Capture an operation-count baseline before editing. Use a disposable Git fixture with several tasks, a shared append-only evidence journal, a run log, and a claimed task. Count reads of task Markdown, `.agentic/evidence.jsonl`, run logs, baselines, the agent registry, and Git comparison subprocesses during one `status --detail` invocation and one `attention --json` invocation.
2. Identify the concrete duplicate sources in `src/core/status/index.ts`, `src/core/tasks/index.ts`, `src/core/tasks/gate.ts`, `src/core/tasks/provenance.ts`, and `src/core/tasks/evidence.ts`. At minimum trace `captureTaskCompletionCandidate`, `readTaskEvidence`, `listAgents`, `allTaskFiles`, `readTaskBaseline`, `readTaskBaselineHistory`, `readRunLog`, `resolveTaskBaselineLineage`, and `currentTaskAttributionApproval`.
3. Introduce a read-only invocation-local snapshot in `src/core/tasks/diagnostics.ts`. It must be created explicitly for one CLI diagnostic invocation and expose lazy memoized loaders for the task inventory, parsed evidence records, run log, registered agent IDs, per-task baseline, per-task candidate capture, and per-task provenance inputs.
4. Keep the snapshot immutable after capture. Do not expose a refresh-through mutation path that could mix two states in one projection. If a caller needs a new state, it must create a new snapshot.
5. Pass the snapshot through the status, gate, provenance, attribution, and baseline-lineage read paths as an optional read-only argument. This requires narrow changes in `src/core/tasks/index.ts` for `currentTaskAttributionApproval` and `resolveTaskBaselineLineage` so they consume the supplied snapshot instead of independently calling `readTaskEvidence`, `allTaskFiles`, and `readRunLog`. Preserve existing default behavior for standalone callers that do not provide a snapshot. Do not create a module-global singleton.
6. Ensure the snapshot key includes the repository root, task directory, task ID, baseline ID, candidate identity, and worktree identity where results depend on them. Results for one worktree, candidate, or task must never be served for another.
7. In `src/core/tasks/index.ts`, change only the read-only snapshot threading needed by `currentTaskAttributionApproval`, `resolveTaskBaselineLineage`, and the candidate/scope helpers that feed them. Do not change attribution decisions, lifecycle transitions, evidence append or locking, baseline writing, review/decision recording, scope rules, or Git safety checks. Mutation paths must not reuse a snapshot across a write and a later read.
8. Preserve candidate-bound freshness. A snapshot is valid only for the invocation and only for the repository state it observed. A new CLI invocation must read the evidence journal, run log, task file, and Git state again.
9. Preserve every fail-closed rule: missing evidence is not a pass; malformed evidence is an error or unavailable state; stale or other-candidate evidence remains stale; out-of-scope or forbidden files remain blockers; missing review remains a blocker.
10. Add tests for shared-journal reuse, changed evidence between invocations, changed candidate commit, changed task contract, missing or malformed evidence, different worktrees, a large append-only journal, and cross-task isolation.
11. Add a concurrent-mutation regression test. Use a test hook or barrier to mutate evidence or Git state after the snapshot captures one component but before the diagnostic projection finishes. Assert that the result never combines incompatible components. The implementation must either fail closed as unavailable/blocked or discard the entire snapshot and restart one complete consistent capture before producing any projection. A partial refresh or a merge of old and new components is forbidden.
12. Record before/after operation counts for the reproducible workload. State relative reductions and absolute counts; do not set a wall-clock threshold.
13. Run the focused tests, typecheck, lint, APK task lint, docs consistency, diff check, and committed-dist check on the final candidate.

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
- A snapshot that observes evidence or Git state changing during the same diagnostic invocation never produces a pass from incompatible components. It fails closed or discards the entire snapshot and restarts one complete consistent capture; partial refresh or merged states are forbidden.
- Tests prove the operation-count reduction, cross-invocation freshness, concurrent-mutation fail-closed behavior, and the absence of behavior changes in attribution, lifecycle, evidence writes, and Git safety checks.

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
- `src/core/tasks/index.ts` changes are limited to read-only snapshot threading; attribution decisions, lifecycle behavior, evidence writes and locking, baseline writes, and Git safety checks remain unchanged.
- No partial refresh and no mixing of snapshot components captured under different repository, candidate, worktree, or evidence identities.
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
- Evidence or Git state changes while one diagnostic invocation is between snapshot capture and projection completion.
- A snapshot component from one candidate is combined with evidence or scope from another candidate or worktree.

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
- `src/core/tasks/index.ts` is allowed only for read-only snapshot plumbing into `currentTaskAttributionApproval`, `resolveTaskBaselineLineage`, and their candidate/scope inputs. It is not permission to alter attribution, lifecycle, evidence writes, locks, baselines, or Git checks. If a proposed change would alter one of those behaviors, stop and document a no-go or split a follow-up task.
- Do not combine this task with Task 0227 (selection) or Task 0230 (needsHuman classification).
- Candidate-bound freshness and fail-closed evidence behavior are more important than any operation-count target. If a safe snapshot boundary cannot be established, document the no-go and retain repeated reads.
- Todo Task 0223 also allows `src/cli/command.test.ts`. Sequence 0229 before 0223 or use separate worktrees; do not edit that file concurrently.

- Pre-claim scope clarification: attention and worker projection may only thread the optional diagnostic snapshot; standalone workers must retain its lightweight path without creating a snapshot. Agent registry/run-log and review-list readers may accept the same optional read-only snapshot. These changes must not alter classification, lifecycle, writing or trust rules. Record the new invocation boundary in docs/decisions.md.
