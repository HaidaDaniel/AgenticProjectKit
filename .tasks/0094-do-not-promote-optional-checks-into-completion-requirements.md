# Task 0094 - Do not promote optional checks into completion requirements

State: doing
Owner: codex-corrective-0094
Mode: production
Lane: quality
Type: bugfix
Scope: tasks,policy,gate,tests,docs
Risk: medium
Parallel: false
Depends on: 0085
Tags: bugfix,policy,gate,evidence

## Goal

Do not promote optional checks into completion requirements

## Context files

- AGENTS.md
- SPEC.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- .tasks/0079-add-minimal-clean-checkout-ci-and-release-quality-proof-for-agenticprojectkit.md

## Files allowed to edit

- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/task.test.ts
- SPEC.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- src/cli/**
- .github/**
- package.json
- pnpm-lock.yaml
- scripts/**
- .agentic/config.json
- .tasks/archive/**

## Steps

1. Reproduce optional evidence promotion in policy and gate
2. Define required-only evidence category semantics
3. Add focused policy and completion-gate regression tests
4. Run canonical verification and independent review

## Acceptance criteria

- A required false check never creates a verification or evidence gate requirement
- Tag-required evidence remains enforced unless that category is declared only by optional checks
- Required checks and legacy tasks keep existing behavior
- Task 0079 can omit workflow-review without an independent gate blocker

## Correctness assumptions

- Optional-only category declaration is an explicit opt-out from an additive tag category requirement

## Invariants

- Optional verification metadata cannot become mandatory through category aggregation
- Required verification and evidence categories remain candidate-bound and fail closed

## Required evidence

- Focused regression proving missing optional live manual evidence does not block completion

## Review questions

- Does the change preserve required release evidence while respecting explicit optionality?

## Counterexample searches

- Required live release check
- Missing required category declaration
- Legacy command-only task

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/tasks/task.test.ts"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-5","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"check-6","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"check-7","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Backprop SPEC.md and document optional-check gate semantics
- Record lifecycle in docs/progress.md

## Notes

- Keep the correction bounded to policy and gate semantics
