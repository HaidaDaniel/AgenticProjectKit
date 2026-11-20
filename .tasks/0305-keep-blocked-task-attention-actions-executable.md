# Task 0305 - Keep blocked-task attention actions executable

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

Fix N-001 from the final review: preserve the operator signal for blocked tasks without emitting an impossible CLI action.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/status/attention.ts
- src/core/tasks/review.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/core/status/attention.ts
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

1. Reproduce N-001 from the final independent review: a blocked task with operator-only condition emits nextAction naming apk task decision, which src/core/tasks/review.ts refuses for blocked state.
2. Keep needsHuman=true for structured operator-only conditions but make nextAction lifecycle-compatible and executable for blocked, todo and ownerless states; do not name a doing/review-only command.
3. Restore the specific blocked-missing-review status assertion weakened in 0303 and add a regression that cross-checks emitted nextAction against the state rules of the referenced CLI command.
4. Correct docs/cli-commands.md to describe the operator signal without naming an unusable command for blocked tasks.
5. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- No blocked, todo or ownerless task emits a nextAction that the CLI refuses for that state.
- Blocked tasks with a structured operator-only condition still report needsHuman=true.
- Blocked tasks without operator-only conditions keep needsHuman=false.
- Regression test verifies action/state compatibility rather than only matching action text.
- Attention JSON shape and all existing scenarios remain compatible.

## Correctness assumptions

- Blocker text is presentation only; command state rules are authoritative

## Invariants

- Operator-only conditions are never hidden and every nextAction is executable

## Required evidence

- Original N-001 reproduction and post-fix action/state compatibility

## Review questions

- Does any emitted action name a doing/review-only command for a blocked task

## Counterexample searches

- Blocked plus operator condition

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"action-executability","type":"manual","required":true,"environment":"local","profile":"report","instruction":"For blocked/todo/ownerless attention items with operator-only conditions, confirm needsHuman=true and that the emitted nextAction does not name a CLI command the task state refuses."}`

## Documentation updates

- Correct blocked-task operator action description in docs/cli-commands.md

## Notes

- N-001 from final independent review of candidate 48268db
- 0303 could not modify src/core/tasks/**; this task stays within its allowed scope
- Preserve pre-existing untracked WIP
