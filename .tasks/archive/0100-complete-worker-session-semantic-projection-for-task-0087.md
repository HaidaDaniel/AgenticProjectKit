# Task 0100 - Complete worker session semantic projection for Task 0087

State: done
Owner: local-agent-0100
Mode: maintenance
Lane: developer-experience
Scope: workers,status,attention,resources,provenance,cli,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: none

## Goal

Complete worker session semantic projection for Task 0087

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- .tasks/0087-worker-attention-and-resource-status.md
- src/core/status/attention.ts
- src/core/work/session.ts

## Files allowed to edit

- src/core/status/attention.ts
- src/core/work/session.ts
- src/cli/cli.test.ts
- docs/progress.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- docs/decisions.md

## Files forbidden to edit



## Steps

1. Project worker semantic state from canonical config plus existing work sessions and task states instead of declared capacity alone.
2. Bind worker to current task and run only when canonical session records prove the association.
3. Add stale and orphaned session handling that fails closed and cannot report a worker ready.
4. Expose bounded capabilities and remaining capacity in human and JSON worker output.
5. Add regressions for unfinished sessions stale sessions orphan mismatch completed and failed runs multi-capacity and scarce frontier occupancy.

## Acceptance criteria

- Worker output includes id model harness capabilities cost class capacity occupied semantic state and a proven current task/run when available.
- A configured free worker with an unfinished or stale canonical session is not reported ready.
- Completed or failed runs do not keep workers permanently busy and origin diagnostics are bounded.
- Capacity greater than one reports correct remaining slots and one occupied frontier worker leaves local workers ready.
- Human and JSON forms stay equivalent runtime-neutral and deterministic with no live process claims.

## Correctness assumptions

- Existing work-session metadata and task state are the canonical binding records.
- Declared worker occupied remains authoritative input rather than a live observation.

## Review questions

- Can any worker be reported ready while an unfinished or stale canonical session exists? Are task and run bindings derived only from proven records without guesses?

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates



## Notes

- Corrective completion of 0087 semantics without editing 0087 or creating a second worker state store. Reuses existing config resources work sessions provenance and task state.
