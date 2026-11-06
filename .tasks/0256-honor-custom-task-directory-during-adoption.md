# Task 0256 - Honor custom task directory during adoption

State: todo
Owner: none
Mode: maintenance
Lane: adoption
Type: bugfix
Scope: adoption,tasks,config,docs
Risk: medium
Parallel: false
Depends on: 0252,0253
Tags: p2,adoption,custom-task-directory

## Goal

Make adoption create its adoption task links and inspect active and archived task IDs through the repository's configured taskDirectory instead of the hardcoded .tasks path.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/adoption-flow.md
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- .tasks/0252-validate-configured-repository-paths.md
- .tasks/0253-fail-closed-on-task-inventory-errors.md

## Files allowed to edit

- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- docs/adoption-flow.md
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/core/config/**
- src/core/backlog/**

## Steps

1. Reproduce hardcoded .tasks behavior in adopt; read the configured task directory for valid existing repositories; support nested custom directories; include archived IDs from the configured directory; generate correct task path links and progress text; preserve default .tasks behavior; keep preview apply and repeated apply idempotent; ensure custom adoption never creates .tasks accidentally

## Acceptance criteria

- Fresh repositories keep default .tasks behavior; repositories configured with contracts or work/tasks use that directory; active and archived IDs are considered; preview shows real mutations without writing; apply is idempotent; .tasks is not created for custom directories; links and documentation point to the configured path

## Correctness assumptions

- A valid existing config supplies the authoritative taskDirectory; adoption must not migrate a valid custom path to .tasks; archived tasks are optional

## Invariants

- One task storage per repository; no config rewrite on adoption; no accidental .tasks directory; preview read-only; repeated apply no-op

## Required evidence

- Fixtures for .tasks contracts work/tasks and archived IDs; preview/apply/repeated-apply assertions; absence of accidental .tasks

## Review questions

- Can adoption still create .tasks for a custom repository; are archived IDs respected; are task links correct; does preview mutate anything

## Counterexample searches

- contracts directory; work/tasks; archived ID in custom directory; custom directory missing; repeated apply

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document custom task-directory adoption in docs/adoption-flow.md and docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Depends on 0252 for validated directories and 0253 for safe inventory; confirmed at HEAD 5021f2e: adopt hardcodes .tasks
