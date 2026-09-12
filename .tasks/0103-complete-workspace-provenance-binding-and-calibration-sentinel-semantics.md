# Task 0103 - Complete workspace provenance binding and calibration sentinel semantics

State: done
Owner: local-agent-0103
Mode: maintenance
Lane: workflow
Scope: workspaces,workers,resources,execution,calibration,routing,provenance,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: none

## Goal

Complete workspace provenance binding and calibration sentinel semantics

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/task-system.md
- docs/decisions.md
- src/core/workspaces/index.ts
- src/core/work/session.ts
- src/core/execution/index.ts
- src/core/execution/calibrate.ts
- src/cli/commands/execution.ts
- src/cli/commands/workspaces.ts

## Files allowed to edit

- src/core/workspaces/index.ts
- src/core/work/session.ts
- src/core/execution/index.ts
- src/cli/commands/execution.ts
- src/cli/commands/workspaces.ts
- src/cli/cli.test.ts
- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md
- docs/task-system.md
- README.md

## Files forbidden to edit



## Steps

1. Prove canonical task/run/resource binding at workspace creation before mutation
2. Re-validate canonical resource binding during cleanup and fail closed
3. Implement explicit calibration sentinel semantics for wait needs-human and deterministic
4. Add binding and sentinel regressions
5. Update docs to match implemented precedence and semantics

## Acceptance criteria

- Workspace creation refuses unproven or mismatched canonical task/run/resource bindings
- Cleanup refuses when canonical run/resource identity diverges
- wait and needs-human sentinels produce calibration-sourced routes
- deterministic sentinel never bypasses canonical review assurance
- Stale calibration and explicit overrides keep documented precedence
- Docs match implemented semantics

## Review questions

- Can any unproven run/resource identity allow destructive cleanup? Can generated calibration force a weaker path than canonical task policy?

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test","evidence":"workspace canonical task/run/resource binding and calibration sentinel regression summary"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md
- docs/task-system.md

## Notes

- Bounded final provenance and sentinel semantics. No provider SDK runtime scheduler daemon PTY SSH or Herdr integration.
