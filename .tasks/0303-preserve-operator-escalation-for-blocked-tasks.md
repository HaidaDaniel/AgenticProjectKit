# Task 0303 - Preserve operator escalation for blocked tasks

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: status,attention,lifecycle,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix,lifecycle,attention,invariant,agent-harness

## Goal

Fix attention so a blocked task with an exhausted review budget or another operator-only condition reports needsHuman=true with an executable operator action, while blocked tasks without such conditions keep lifecycle-derived actions.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/status/attention.ts
- src/core/status/index.ts
- src/cli/cli.test.ts
- docs/reviews/2026-11-19-a110cb4-pre-release-review.md

## Files allowed to edit

- src/core/status/attention.ts
- src/core/status/index.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/tasks/**
- src/core/exporters/**
- src/core/doctor/**
- src/core/audit/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce R-001: blocked task with eight changes_requested review records shows needsHuman=false while gate blocker requests an explicit operator decision.
2. Use structured gate/review budget and decision fields to decide operator escalation before or alongside the blocked-state lifecycle action; do not infer human need from blocker text.
3. Ensure blocked tasks without operator-only conditions do not escalate and retain a valid resolve action.
4. Cover blocked, doing and review states combined with exhausted budget, pending approval, missing evidence and unknown status in attention tests.
5. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- A blocked task with exhausted non-passing review budget reports needsHuman=true and an executable operator decision action.
- A blocked task without operator-only conditions reports needsHuman=false and a lifecycle action.
- Operator need is derived from structured gate/review information not blocker message text.
- Every emitted nextAction remains executable for the reported state.
- Attention human/JSON output remains compatible and all existing scenarios pass.

## Correctness assumptions

- Blocker text is presentation only

## Invariants

- Operator-only conditions are never hidden by lifecycle state

## Required evidence

- Original R-001 reproducer output before and after

## Review questions

- Can a blocked task still suppress a structured operator signal

## Counterexample searches

- Blocked plus exhausted budget; Blocked plus pending approval; Unknown review status

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document blocked-task operator escalation in docs/cli-commands.md

## Notes

- R-001 from docs/reviews/2026-11-19-a110cb4-pre-release-review.md
- Preserve pre-existing untracked WIP
