# Task 0293 - Resolve blocked-task attention actions using lifecycle semantics

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: status,attention,lifecycle,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix,attention,lifecycle,invariant,agent-harness

## Goal

Ensure attention never recommends an action that the CLI refuses for the reported task state, and replace blocker-string matching with structured state signals.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/status/attention.ts
- src/core/status/index.ts
- src/core/tasks/review.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/core/status/attention.ts
- src/core/status/index.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/audit/**
- src/core/doctor/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce audit F-004 on this repository by reading attention --json for blocked tasks 0150 and 0221 and confirming apk review refuses them.
2. Branch next-action selection on structured task state and ownership before any review-derived action; a blocked task must receive a blocker-resolution action.
3. Replace regex matching on blocker text with a structured next-action signal in the status or gate projection; keep textual blockers for display only.
4. Preserve existing correct behaviors for doing and review tasks with missing stale changes-requested or budget-exhausted review.
5. Update the test scenario that currently asserts a blocked task should request independent review and add blocked plus scope plus dependency cases.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- No attention item in state blocked returns a nextAction that the CLI refuses for that state.
- nextAction is derived from structured state owner dependency and review fields rather than regular expressions over blocker strings.
- A doing or review task with review-only blockers still receives the existing review or fixer action.
- The corrected test no longer encodes the impossible action as expected behavior.
- Human and JSON attention output remain structurally compatible.

## Correctness assumptions

- Blocker text is presentation and cannot be treated as a policy signal

## Invariants

- Every emitted nextAction must be executable for the task state that emitted it

## Required evidence

- Observed attention output on a repository with blocked tasks

## Review questions

- Does any remaining branch select an action from blocker text

## Counterexample searches

- Blocked with owner none; Blocked with scope violation and blocked dependency; Review status unknown on a blocked task

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document state-aware next actions in docs/cli-commands.md

## Notes

- Trust boundary: lifecycle semantics not message wording decide executable actions
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
