# Task 0088 - Optional Isolated Parallel Workspaces

State: todo
Owner: none
Mode: product
Lane: workflow
Scope: workspaces,worktrees,workers,provenance,git,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0070,0073,0084,0087
Tags: worktrees,workspaces,parallelism,provenance,safety

## Goal

Add optional safe Git worktree lifecycle for parallel top-level workers while preserving the default single-worktree workflow and task provenance.

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- src/core/work/index.ts
- src/core/work/session.ts
- src/core/tasks/provenance.ts
- src/core/tasks/workflow.ts
- .tasks/0070-add-end-to-end-task-execution-provenance.md
- .tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md
- .tasks/0084-execution-profiles-and-resource-aware-routing.md
- .tasks/0087-worker-attention-and-resource-status.md

## Files allowed to edit

- src/core/workspaces/*.ts
- src/core/work/*.ts
- src/core/tasks/provenance.ts
- src/core/tasks/workflow.ts
- src/core/status/*.ts
- src/cli/index.ts
- src/cli/commands/workspaces.ts
- src/cli/commands/work.ts
- src/cli/commands/status.ts
- src/cli/cli.test.ts
- .gitignore
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0088-optional-isolated-parallel-workspaces.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Define an APK-owned workspace record binding task, run, worker/resource, repository, branch, Git worktree path/identity, baseline, and candidate revision.
2. Add explicit create/list/status/cleanup lifecycle around Git worktrees with ownership markers, path validation, collision checks, and dry-run where destructive cleanup is possible.
3. Integrate workspace identity with existing worker sessions, claim ownership, same-worktree warnings, provenance, status, and attention output while keeping the default single-worktree path unchanged.
4. Add isolated Git fixture regressions for create/use/cleanup, ambiguous or dirty state, user-created worktrees, concurrent requests, stale metadata, and recovery guidance.


## Acceptance criteria

- Workspaces are optional. Existing single-worker/single-worktree commands behave as before when no workspace option is selected.
- An APK-managed workspace binds task ID, run ID, worker/resource ID, branch, absolute worktree identity/hash, baseline, and candidate revision through existing session/provenance records.
- Creation validates repository root, target path, branch/ref, task ownership, existing worktrees, and collisions before mutation; partial failure leaves actionable recoverable state.
- Cleanup removes only an exact APK-owned workspace whose marker, Git registration, path, task/run binding, and safe state all match. It never deletes an unmarked/user-created worktree, a dirty/active workspace, repository root, or ambiguous path.
- Destructive cleanup is explicit and supports dry-run/preview. Unknown ownership, foreign metadata, path escape, live/active run, unmerged/dirty work, and Git errors fail closed.
- Parallel workers no longer share attribution when isolated workspaces are used. Candidate/review/evidence freshness remains bound to the exact workspace and revision; no cross-worktree PASS can satisfy another candidate.
- Task claiming and resource capacity remain authoritative; workspace creation does not create an autonomous swarm, scheduler, implicit merge, automatic conflict resolver, or background worker.
- Status/attention can distinguish managed workspace state and surface cleanup/merge/human actions without exposing broad absolute paths in persisted analytics.
- Tests use temporary repositories and prove user-worktree preservation, path containment, idempotent listing, refused unsafe cleanup, concurrent collision handling, single-worktree compatibility, and provenance continuity.


## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"workspace-safety-regressions","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test","evidence":"isolated Git workspace lifecycle and destructive-safety regression summary"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Update execution-profile, architecture, task-system, CLI, README, decisions, and progress docs for implemented optional workspace lifecycle and safety boundary.


## Notes

- Priority: later/future; depends on worker status so ownership and attention are visible before parallel workspace automation.
- Use native Git worktrees and existing APK locks/session/provenance contracts. No custom VCS, automatic merge, remote execution, cloud workspace service, or autonomous top-level swarm.
- Treat every cleanup operation as destructive: resolve and verify exact absolute targets inside the intended repository/workspace area before removal, and preserve user worktrees on uncertainty.
