# Task 0096 - Record externally-observed manual and live verification evidence

State: done
Owner: local-agent-0096
Mode: production
Lane: verification
Scope: verification,evidence,cli,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: verification,evidence,cli

## Goal

A registered operator can explicitly record an externally-observed manual or live check result bound to the exact current candidate, so declared manual/live completion requirements can be satisfied without weakening automated checks or fabricating implicit passes.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/policy.ts
- src/cli/commands/task.ts
- src/cli/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/progress.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/task.test.ts
- src/cli/commands/task.ts
- src/cli/index.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/decisions.md
- README.md
- docs/progress.md
- .tasks/0096-record-externally-observed-manual-and-live-verification-evidence.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Add a core recording function that validates a registered owner, task/check identity, manual-or-live eligibility, an explicit bounded evidence reference, and the current baseline/candidate subject before appending typed gate-eligible evidence.
2. Expose the recording path through the task CLI while keeping default verify execution and automated-check rejection unchanged.
3. Add core and CLI regressions for success, ineligible automated check, missing evidence reference, unregistered owner, and candidate binding.

## Acceptance criteria

- Recording requires a registered agent plus explicit pass or fail and a bounded non-empty evidence reference.
- Only checks declared manual or whose environment is live can be recorded; automated checks are rejected.
- Recorded evidence is typed, candidate-bound, gate-eligible, and flows through the same freshness and completion-gate path as other verification evidence.
- An unregistered or foreign owner and a changed candidate cannot record a gate-eligible pass.
- Default verify execution, policy resolution, and existing evidence behavior remain unchanged.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"record-surface-report","type":"automated","required":true,"environment":"static","profile":"report","command":"pnpm exec apk task evidence 0096","evidence":"manual/live evidence recording transcript"}`

## Documentation updates

- Update docs/task-system.md for the recording contract and examples.
- Update docs/cli-commands.md for the CLI surface.
- Update README.md for the operator workflow.
- Update docs/decisions.md for the evidence-recording decision.
- Update docs/progress.md when task state changes.

## Notes

- Corrective task: required manual/live checks are currently unsatisfiable because verify marks them unavailable and no supported surface records externally-observed results, blocking Task 0075.
- Keep the surface minimal and fail-closed: no automated-check recording, no implicit pass, explicit evidence reference required.
- This task itself must remain gateable with automated-only required checks.
- Independent review found that a `type: manual, environment: live` check declared both the `live` and `manual` evidence categories while its single record can only carry one type, making the `manual` category unsatisfiable. Scope was minimally expanded to `src/core/tasks/policy.ts` so a check declares exactly the category its verifier emits (report > live > manual); `live` remains required and the required per-check pass is unchanged.
- Only the task owner may record manual/live evidence; a registered non-owner and an unregistered agent both fail closed. The advertised evidence-reference bound matches the store's 240-character limit, and record-only flags are rejected unless `--record` is present.
- Known limitation: re-running `apk task verify` after recording appends a fresh `unavailable` record that shadows the recorded pass; record after the final verification run for the candidate.
