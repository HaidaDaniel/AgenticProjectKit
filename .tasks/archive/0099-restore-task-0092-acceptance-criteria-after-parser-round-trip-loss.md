# Task 0099 - Restore Task 0092 acceptance criteria after parser round-trip loss

State: done
Owner: local-agent-0099
Mode: maintenance
Lane: task-system
Scope: tasks,docs
Risk: medium
Parallel: false
Depends on: none
Tags: none

## Goal

Restore Task 0092 acceptance criteria after parser round-trip loss

## Context files

- AGENTS.md
- docs/task-system.md
- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md

## Files allowed to edit

- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md
- docs/progress.md

## Files forbidden to edit



## Steps

1. Restore the exact 13 acceptance criteria from pre-loss revision f82ac50 into the authoritative 0092 task file.
2. Confirm the current parser/renderer round-trip preserves every restored criterion item.
3. Revalidate the 0092 implementation against the restored criteria with current verification evidence and fresh independent review.

## Acceptance criteria

- The 0092 task file lists exactly the 13 original acceptance criteria with original wording.
- No other 0092 section content is altered beyond the restored criteria.
- Current verification (lint, test, build) passes against the restored contract.
- Fresh independent review inspects the 0092 exporter/adoption/sync implementation against the restored criteria.

## Correctness assumptions

- The pre-loss revision f82ac50 contains the authoritative original criteria.
- Task file edits are bookkeeping and do not change implementation candidates.

## Review questions

- Are all 13 criteria present with exact original wording and no invented content? Does the 0092 implementation satisfy each restored criterion?

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates



## Notes

- References lost-content revision f82ac50 and parser fix Task 0098. Do not reopen or edit 0092 state manually.
