# Task 0104 - Close workspace canonical-resource and calibration-sentinel contract gaps

State: done
Owner: local-agent-0104
Mode: maintenance
Lane: workflow
Scope: workspaces,resources,execution,calibration,routing,provenance,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: none

## Goal

Close workspace canonical-resource and calibration-sentinel contract gaps

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/task-system.md
- docs/decisions.md
- src/core/workspaces/index.ts
- src/core/work/session.ts
- src/core/execution/index.ts
- src/cli/commands/workspaces.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/core/workspaces/index.ts
- src/core/execution/index.ts
- src/cli/commands/workspaces.ts
- src/cli/cli.test.ts
- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md
- docs/task-system.md
- README.md

## Files forbidden to edit



## Steps

1. Infer canonical resourceId from the matched session when --resource is omitted and persist it on the marker and record
2. Preserve explicit-resource exact-match refusal and legacy resource-less sessions
3. Apply current calibration wait and needs-human sentinels to otherwise-executable deterministic lanes
4. Keep deterministic sentinel restricted to canonically deterministic lanes
5. Document precise hard-override versus soft-preference precedence and update CLI help
6. Add binding inference and sentinel regressions

## Acceptance criteria

- Run-only workspace create persists the canonical resource on marker and record
- Explicit wrong resource still refuses before mutation
- Cleanup detects later canonical resource divergence and fails closed
- Current calibration wait and needs-human apply on deterministic lanes without weakening policy
- deterministic sentinel never bypasses required review assurance
- Hard resource override outranks calibration while soft preferences affect resolver selection only
- Docs and CLI help match implemented semantics

## Review questions

- Can run-only creation lose or misattribute the canonical resource? Can a sentinel bypass canonical failure states or required review assurance? Does a soft preference defeat wait?

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test","evidence":"canonical resource inference and deterministic-lane sentinel regression summary"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md
- docs/task-system.md

## Notes

- Contract closure only. No Herdr PTY SSH provider SDK scheduler daemon remote execution or automatic merge.
