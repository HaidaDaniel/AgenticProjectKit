# Task 0102 - Final resource/workspace integration hardening

State: done
Owner: local-agent-0102
Mode: maintenance
Lane: workflow
Scope: workspaces,workers,status,execution,calibration,routing,provenance,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: none

## Goal

Final resource/workspace integration hardening

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/task-system.md
- docs/decisions.md
- src/core/workspaces/index.ts
- src/core/status/attention.ts
- src/core/work/session.ts
- src/core/execution/index.ts
- src/core/execution/calibrate.ts
- src/cli/commands/execution.ts
- src/cli/commands/workspaces.ts

## Files allowed to edit

- src/core/workspaces/index.ts
- src/core/status/attention.ts
- src/core/work/session.ts
- src/core/execution/index.ts
- src/core/execution/calibrate.ts
- src/cli/commands/execution.ts
- src/cli/commands/workspaces.ts
- src/cli/cli.test.ts
- src/core/config/schema.test.ts
- docs/execution-profiles.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- README.md

## Files forbidden to edit



## Steps

1. Make workspace cleanup treat an activated session as active only while its task is open and fail closed to unknown on unreadable or malformed lifecycle state.
2. Include runId and resourceId and verify repository identity branch registration and worktree binding before destructive cleanup.
3. Make worker projection fail closed when canonical session scan fails instead of reporting ready.
4. Integrate current validated calibration into effective execution routing with explicit precedence and stale fallback.
5. Integrate calibration assuranceMinimum as a raise-only preference and keep budgets non-weakening.
6. Surface effective profile and route sources in explain output and update docs to match actual semantics.

## Acceptance criteria

- Terminal activated runs allow safe cleanup while open activated runs and unknown/unreadable session state refuse it.
- Marker record equality covers id taskId runId resourceId worktreeId marker and repository and branch mismatch refuse cleanup.
- Worker projection reports unknown not ready when canonical session state cannot be read.
- Current calibration affects effective route and profile while stale calibration is ignored with an explicit reason.
- Calibration can raise but never lower canonical assurance and cannot weaken mandatory requirements or budgets.
- Explain output shows effective profile and route sources and docs match implemented precedence.

## Correctness assumptions

- Existing listWorkerSessions and task state are the canonical session lifecycle model.
- Task policy and the completion gate remain authoritative over calibration.

## Review questions

- Is there any path where uncertainty leads to destructive cleanup? Does any calibration path weaken canonical task policy or assurance? Is stale calibration ever silently used?

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"integration-safety-regressions","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test","evidence":"workspace cleanup fail-closed, worker scan failure, and calibration routing regression summary"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates



## Notes

- Single bounded corrective for integration/safety gaps A worktree cleanup semantics B worker scan fail-closed C calibration routing participation. No provider SDK runtime scheduler daemon or Herdr integration.
