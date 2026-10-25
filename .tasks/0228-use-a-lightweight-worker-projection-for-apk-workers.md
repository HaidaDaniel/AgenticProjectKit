# Task 0228 - Use a lightweight worker projection for apk workers

State: done
Owner: codex-corrective-0228
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: workers,attention,performance,diagnostics,tests
Risk: high
Parallel: true
Depends on: 0227
Tags: workers,attention,performance,diagnostics,tests

## Goal

Make `apk workers` use a bounded projection of declared resources, canonical worker sessions, and task states instead of the full status gate, provenance, evidence, and run-log pipeline. Preserve every existing readiness and occupancy semantic, including fail-closed behavior.

## Context files

- AGENTS.md
- docs/task-system.md
- src/cli/commands/workers.ts
- src/core/status/attention.ts
- src/core/work/session.ts
- src/core/config/index.ts

## Files allowed to edit

- src/core/status/attention.ts
- src/core/status/workers.ts
- src/cli/commands/workers.ts
- src/cli/command.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/status/index.ts
- src/core/tasks/**
- src/cli/cli.test.ts
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Capture a pre-fix operation-count baseline before editing. Use a disposable fixture with at least 100 tasks, one evidence journal, and a worker registry. Instrument only in test or temporary diagnostic code and count task-file reads, evidence-journal reads, run-log reads, Git subprocesses, and calls to `summarizeStatus`, `evaluateTaskCompletionGate`, and `buildTaskProvenance` during one `workers --json` invocation.
2. Repeat the baseline with no resource registry and with the same backlog. Record whether the expensive pipeline still runs.
3. Extract the worker-only projection from `src/core/status/attention.ts` into `src/core/status/workers.ts`. The projection needs configuration resources, `listWorkerSessions`, and the task-state map only. It must not call `summarizeStatus`, `evaluateTaskCompletionGate`, `buildTaskProvenance`, `readTaskEvidence`, or the run log.
4. Keep task-state discovery bounded and fail-closed. Parse the task inventory once per invocation. A malformed or unreadable task inventory must produce a diagnostic and must not report a worker as free when session ownership cannot be established.
5. Update `src/cli/commands/workers.ts` to call the worker-only projection. Preserve the existing `--json` schema exactly: `workers` entries and `diagnostics`. Do not add live process, PID, terminal, or SSH claims.
6. Preserve occupancy semantics exactly: declared occupancy is combined with active APK-recorded runs by `max`; terminal tasks release slots; unactivated or orphaned sessions never prove readiness; malformed sessions force `unknown`; unreadable canonical sessions force `unknown` for otherwise available workers; a worker at capacity is `busy`.
7. Keep diagnostics for unconfigured resources, stale or orphaned sessions, ambiguous multiple active sessions, malformed sessions, unavailable session state, and an absent resource registry.
8. Do not introduce a process-wide or on-disk cache. Every CLI invocation must read current session and task state. If an internal observer or counter hook is added for tests, keep it optional and out of the public JSON.
9. Add command-layer regression tests for all scenarios in this contract and an operation-count test proving that evidence, gate, provenance, and run-log work is not performed. Do not use wall-clock thresholds as the acceptance signal.
10. Run the focused command-layer tests, typecheck, lint, APK task lint, docs consistency, diff check, and committed-dist check on the final candidate.

## Acceptance criteria

- `workers --json` with no resource registry returns the same empty `workers` array and an explicit no-registry diagnostic without calling `summarizeStatus`, evaluating any task gate, building any provenance, or reading the evidence journal.
- One ready worker is reported `ready` when declared capacity is free and no conflicting session exists.
- One busy worker is reported `busy` when declared occupancy reaches capacity or an active non-terminal APK run occupies a slot.
- A stale or unactivated session makes an otherwise free worker `unknown`, and the stale condition is diagnosed.
- An orphaned session whose task is missing makes an otherwise free worker `unknown`, and the orphan condition is diagnosed.
- Multiple active sessions for one worker make the current task/run ambiguous; the worker is not reported with a misleading single current run.
- An invalid or unreadable resource registry produces a bounded diagnostic; a worker is never reported `ready` from unknown session state.
- A large task inventory without registered workers completes without evidence, gate, provenance, or run-log reads; the operation-count test asserts this directly.
- The public worker JSON and human rendering remain byte-compatible for the existing fields and states.
- The task inventory is parsed at most once per workers invocation; the worker session store is read at most once.
- No persistent cache or cross-invocation reuse is introduced.
- All eight regression scenarios are covered by automated tests.

## Correctness assumptions

- Worker occupancy is a semantic projection of declared resources and canonical APK sessions, not a live process observation.
- Task state is needed only to decide whether a recorded session still owns a slot; full task diagnostics are irrelevant to that decision.
- An absent resource registry is a supported configuration and must remain cheap.
- Unknown session state must fail closed even when declared capacity appears free.
- Existing worker JSON fields are a public contract and must not be renamed or removed.

## Invariants

- Never report a worker `ready` when canonical session state is unknown or ambiguous.
- Never hide malformed, stale, or orphaned sessions.
- Never replace session-derived occupancy with declared occupancy alone.
- Never call gate, provenance, evidence-journal, or run-log evaluation from `workers`.
- Never cache occupancy across independent CLI invocations.
- Never mutate resource configuration, sessions, tasks, or evidence.
- Never add an external service, dependency, daemon, or process probe.

## Required evidence

- Pre-fix operation counts for one large-backlog `workers` invocation with and without a worker registry.
- Post-fix operation counts for the same fixtures showing zero evidence-journal, gate, provenance, and run-log work.
- Regression output for the eight worker scenarios.
- Focused tests, typecheck, lint, APK lint, docs consistency, diff check, and committed-dist result.

## Review questions

- Does the workers path still reach `summarizeStatus` or any gate/provenance/evidence/run-log code through an indirect import?
- Are ready, busy, stale, orphaned, ambiguous, unknown, and unavailable outcomes identical to the pre-fix behavior for equivalent fixtures?
- Can an unknown or malformed session state ever produce a ready worker?
- Is the task inventory parsed once, and is there any cache that can go stale between invocations?
- Does the public JSON remain compatible for existing consumers?
- Is the operation-count test measuring the expensive behavior rather than only elapsed time?

## Counterexample searches

- Empty worker registry with a large backlog and a malformed evidence journal.
- One free worker, one worker at declared capacity, and one worker with an active APK run.
- An unactivated session, a session whose task was archived or deleted, and a session with a malformed identity.
- Two active sessions for the same worker, including different tasks and run IDs.
- A session that references an unconfigured resource ID.
- `listWorkerSessions` throwing an unreadable or corrupt-store error.
- A task inventory that fails to parse while sessions exist.
- A repeated invocation after a session is created or completed.
- A worker registry with zero workers but non-empty models or harnesses.

## Verification

- `{"id":"operation-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record the pre-fix and post-fix operation counts for the large-backlog workers fixtures, including task-file reads, evidence-journal reads, run-log reads, Git subprocesses, and gate/provenance calls."}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/command.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the worker-only projection, its fail-closed states, and the absence of live process claims in `docs/task-system.md`.
- Update `docs/progress.md` when the task state changes.

## Notes

- Confirmed defect in APK v0.5.1: `src/cli/commands/workers.ts` calls `buildAttentionView`, which calls `summarizeStatus` at `src/core/status/attention.ts`; each selected task then evaluates a completion gate and, for non-`todo` states, provenance.
- The downstream audit reported roughly 22 seconds and 85,100 `readFile` attempts for a translator-agent workers call. Those numbers are context only and depend on host load, repository size, and instrumentation. Reproduce operation counts locally; do not encode wall-clock thresholds.
- The audit's evidence journal was requested about 140 times and many task files about 94 to 96 times in one call. Use those observations only to choose instrumentation targets.
- Depends on Task 0227 because both tasks change status/attention projection semantics and must not be implemented concurrently.
- Do not combine this task with the broader evidence snapshot reuse in Task 0229. This task must first stop `workers` from entering the diagnostic pipeline.
- Todo Task 0223 also allows `src/cli/command.test.ts`. Do not edit that file concurrently with 0223; sequence the tasks or use separate worktrees. Blocked Task 0221 also lists the command registry but does not touch this file set.
