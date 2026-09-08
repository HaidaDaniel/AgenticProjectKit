# Task 0076 - Recover stale task mutation locks safely

State: todo
Owner: none
Mode: product
Lane: task-system
Scope: task-system,locking,cli,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: locking,concurrency,recovery,task-system,reliability

## Goal

Task mutation locks recover safely after owner crashes without manual deletion of .tasks/.apk.lock, preserving exclusive mutual exclusion and deterministic diagnostics.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- docs/progress.md
- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/doctor/index.ts
- src/core/status/index.ts
- src/cli/commands/task-state.ts
- src/cli/commands/task.ts
- src/cli/commands/doctor.ts
- src/cli/commands/status.ts
- src/cli/cli.test.ts
- package.json

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/doctor/index.ts
- src/core/status/index.ts
- src/cli/commands/task-state.ts
- src/cli/commands/task.ts
- src/cli/commands/doctor.ts
- src/cli/commands/status.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/progress.md
- docs/decisions.md
- .tasks/0076-recover-stale-task-mutation-locks-safely.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .agentic/config.json
- .tasks/archive/**
- src/core/templates/**
- src/core/exporters/**

## Steps

1. Extend existing workflow/task mutation lock paths with ownership metadata and shared live/dead/unknown classification; preserve exclusive acquisition.
2. Provide race-safe normal crash recovery and actionable malformed/unknown-owner recovery path; align doctor/status diagnostics.
3. Add deterministic process/concurrency regressions for normal release, crashed owner, live owner, malformed locks and competing recoverers; document recovery.

## Acceptance criteria

- Lock metadata includes owner PID/process identity and creation timestamp; hostname/process-start identity and command/task ID recorded where needed to establish ownership or improve diagnostics.
- Live local owner lock is neither stolen nor deleted; diagnostic identifies live owner even when lock is old.
- Confirmed dead owner lock is recoverable through mutation retry or explicit deterministic CLI recovery path; normal crash recovery needs no manual rm .tasks/.apk.lock.
- TTL is secondary safeguard only; age alone never authorizes stealing a live lock. PID reuse, foreign-host ownership or uncertain liveness cannot be treated as confirmed dead.
- Malformed metadata fails with actionable diagnostic and documented explicit recovery path; no blind automatic deletion.
- Concurrent stale recovery preserves mutual exclusion: two contenders cannot simultaneously acquire ownership; old-owner cleanup cannot delete a successor's lock.
- Normal acquisition/release and concurrent mutations remain mutually exclusive across workflow transitions and task create/archive mutation paths.
- Doctor/status distinguish live, stale/dead, malformed and uncertain lock state using same semantics rather than age-only claims.
- Tests cover normal acquisition/release, crashed/dead owner, old live owner, malformed metadata, concurrent stale recovery and normal concurrent mutation exclusion.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk doctor
- pnpm exec apk status

## Documentation updates

- Update docs/task-system.md with ownership, recovery and TTL semantics.
- Update docs/cli-commands.md with actual diagnostics/recovery path.
- Record locking choices in docs/decisions.md; update docs/progress.md when task state changes.

## Notes

- Milestone 1 - Reliability / Foundation; included in 0075 planned release. No evidence/policy prerequisite.
- Existing withTaskLock in src/core/tasks/workflow.ts and withTaskMutationLock in src/core/tasks/index.ts both use exclusive open plus pid/created metadata; EEXIST currently requires manual removal. Complete both paths without changing task ownership semantics.
- Current doctor/status use five-minute age threshold; align with process ownership rather than TTL-only stale diagnosis.
- Parallel: false because allowed task/workflow and doctor/status files overlap other planned work. Independence of dependencies does not imply concurrent edits are safe.
- Non-goals: distributed locking, Redis, database lock services, network consensus or cross-machine orchestration.
- Use existing test files wired into pnpm test. Recovery regression fixtures stay isolated from repository's actual task lock; no new dependency required.
