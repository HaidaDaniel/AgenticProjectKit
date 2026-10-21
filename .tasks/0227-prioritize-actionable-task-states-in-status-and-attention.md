# Task 0227 - Prioritize actionable task states in status and attention

State: doing
Owner: codex-fixes-0227
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: status,attention,diagnostics,cli,tests
Risk: high
Parallel: false
Depends on: none
Tags: status,attention,diagnostics,tests

## Goal

Make `status` and `attention` select actionable `doing`, `review`, and `blocked` tasks before `todo` under a bounded deterministic diagnostic budget. The diagnostic projection must not lose current work merely because older `todo` IDs sort first.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- src/core/status/index.ts
- src/core/status/attention.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/core/status/index.ts
- src/core/status/attention.ts
- src/cli/cli.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/**
- src/cli/commands/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce the defect with the installed or built CLI before changing code: create a disposable Git repository, `init` APK, register an owner, create 32 `todo` tasks with lower IDs, and claim one later task. Record that `tasks --state doing` shows the claimed task while `status --detail` omits it and `attention --json` returns `items: []`.
2. Record the same evidence for a `review` task and a `blocked` task, using valid owners and states allowed by the task contract.
3. Trace the selection at `summarizeStatus` and `buildAttentionView`. Confirm that `activeFiles.slice(0, MAX_ACTIVE_TASKS)` runs before state priority and that `attention` consumes the already-truncated `summary.activeTasks`.
4. Introduce one deterministic selection rule in `src/core/status/index.ts`: rank `doing` before `review` before `blocked` before `todo`; within a rank sort by numeric task ID and then by task path. Do not raise `MAX_ACTIVE_TASKS` as the fix.
5. Keep the detailed per-task gate/provenance work bounded to the selected tasks. Do not perform detailed work for omitted tasks in the same invocation.
6. Expose bounded coverage metadata rather than silently dropping tasks. The status warnings and the attention diagnostics must state that the detailed projection is incomplete and how many actionable tasks were omitted. Do not report a normal truncation as if every task were represented.
7. Keep `status` and `attention` derived from the same selection. `attention` must not independently re-truncate a different task set or infer an empty queue when actionable tasks exist.
8. Preserve authoritative `taskCounts`, archived count, `nextTask`, compact rendering, detail rendering, and existing warning text where still true. `tasks` and `next-task` behavior must remain unchanged.
9. Handle an empty backlog, a missing task directory, and malformed or unavailable evidence safely. A malformed task or evidence record must produce a bounded diagnostic and an unknown/unavailable gate, never a pass and never a crash.
10. Add CLI regression tests covering all required scenarios in this contract. Prefer a small fixture helper over duplicating 32 task files inline.
11. Run the focused test, typecheck, lint, APK task lint, docs consistency, diff check, and committed-dist check on the final candidate. Record the pre-fix and post-fix observations in the task notes or required evidence.

## Acceptance criteria

- A fixture with 32 `todo` tasks and one later `doing` task shows the `doing` task in both compact and detailed `status`, and its `attention` item is present.
- The same assertion passes for one later `review` task and one later `blocked` task.
- A fixture with more than 32 actionable `doing`/`review`/`blocked` tasks returns a bounded deterministic projection and explicitly reports the number of omitted actionable tasks.
- Selection ranks `doing`, then `review`, then `blocked`, then `todo`; ties are deterministic by task ID and path.
- `taskCounts` still count every active and archived task correctly, independent of the detailed projection limit.
- `status` and `attention` agree on the tasks that require attention; `attention` is not empty when the selected set contains actionable tasks.
- An empty backlog renders `none` and does not emit a false truncation warning.
- Malformed or unavailable evidence yields a bounded warning plus an unknown or unavailable gate, not a pass or an exception.
- Compact and detailed status remain available and internally consistent.
- `tasks`, `tasks --state`, and `next-task` do not regress.
- No new dependency, persistent cache, unbounded read, or higher diagnostic limit is introduced.
- The focused tests fail on the pre-fix implementation and pass on the candidate.

## Correctness assumptions

- Task state priority is a read-only diagnostic selection policy, not a lifecycle transition or a claim that a task is ready to finish.
- All task counts and the `nextTask` selection come from the complete parsed task inventory, not from the display-limited projection.
- A lower task ID is not evidence of greater operational urgency; only lifecycle state establishes priority.
- An explicit omitted count is required whenever detailed coverage is incomplete.
- `attention` can safely derive from the shared status projection once that projection contains prioritized actionable tasks.

## Invariants

- Do not fix the defect by increasing `MAX_ACTIVE_TASKS`, removing the bound, or loading detailed gate/provenance work for the whole backlog.
- Do not mutate task files, evidence, baselines, or task lifecycle state.
- Do not weaken any verification, scope, evidence, review, or completion-gate check.
- Do not change the meaning of task counts, `nextTask`, `tasks`, or `next-task`.
- Do not let a truncated projection be presented as complete coverage.
- Do not add a global cache or reuse results across independent CLI invocations.

## Required evidence

- Pre-fix reproduction output for 32 `todo` plus one `doing` task showing the missing task in `status` and `attention`.
- Post-fix output for `doing`, `review`, and `blocked` fixtures.
- Output or test assertion for more than 32 actionable tasks showing the explicit omitted count.
- Focused test output, typecheck, lint, APK lint, docs consistency, diff check, and committed-dist result.

## Review questions

- Does the selection prioritize every actionable state before `todo`, and is the order deterministic for equal states?
- Can a current `doing` or `review` task still disappear because of an older `todo` backlog or a second independent slice?
- Is detailed diagnostic cost still bounded, and is incomplete coverage visible with an exact omitted count?
- Are counts, `nextTask`, compact status, detailed status, and attention mutually consistent?
- Do malformed evidence and missing task data fail closed rather than produce a false pass?
- Did the change avoid raising the limit or adding an unbounded or persistent cache?

## Counterexample searches

- 32 `todo` tasks followed by one `doing`, one `review`, or one `blocked` task with owner records present.
- More than 32 `doing`/`review`/`blocked` tasks with mixed numeric IDs and archive entries.
- Actionable tasks with non-sequential IDs, leading-zero IDs, duplicate titles, or paths that sort differently from IDs.
- An empty backlog, a missing task directory, and a task file that fails to parse.
- Evidence that is missing, malformed, stale, or unavailable while a task is in `review`.
- A claim or review transition that happens between two independent CLI invocations.
- A task whose detailed gate throws while other selected tasks are healthy.

## Verification

- `{"id":"diagnostic-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record the pre-fix and post-fix status and attention outputs for the doing, review, blocked, over-limit, and empty fixtures as manual evidence, including the exact omitted count."}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the prioritized, bounded status/attention selection and the omitted-task warning in `docs/task-system.md`.
- Update `docs/progress.md` when the task state changes.

## Notes

- Confirmed downstream defect in APK v0.5.1: `src/core/status/index.ts` slices non-terminal tasks before prioritization at the current `MAX_ACTIVE_TASKS = 32`; `src/core/status/attention.ts` builds from the truncated `summary.activeTasks`.
- The audit reproduction used 32 `todo` tasks plus a valid claimed `0033`; `tasks --state doing` showed `0033` while `status --detail` and `attention --json` did not.
- Do not use the downstream repositories for this task. Use synthetic temporary Git fixtures only.
- This task must land before any task that relies on the new status/attention selection.
- Keep the fix narrow. Do not combine it with worker projection, evidence read reuse, review classification, Python detection, or CLI version work.
- Todo Task 0223 also allows `src/cli/cli.test.ts`. Do not implement 0223 concurrently with this task in one checkout; sequence them or use separate worktrees and rebase the later candidate.
