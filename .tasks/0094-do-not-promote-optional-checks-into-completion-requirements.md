# Task 0094 - Do not promote optional checks into completion requirements

State: done
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

- A required false check never itself becomes a mandatory check
- An optional check does not create an evidence requirement of its own
- An optional check does not cancel independent requirements from risk, task type, classification tags, or explicit policy rules
- deployment plus an optional live check still requires live evidence
- release plus an optional live check still requires release policy evidence when the task is genuinely classified release
- Task 0079 is not blocked by its optional workflow-review because 0079 is correctly not classified as a release operation
- Required checks and legacy tasks keep existing behavior

## Correctness assumptions

- Optional checks are not policy overrides: required false removes only that check's own pass requirement, never an independent risk/type/tag evidence requirement

## Invariants

- Optional verification metadata cannot become mandatory through category aggregation
- Optional verification metadata cannot cancel risk/type/tag evidence requirements through category aggregation
- Required verification and evidence categories remain candidate-bound and fail closed

## Required evidence

- Focused regression proving missing optional live manual evidence does not block completion
- Focused regression proving deployment and release tag live requirements remain blocking when only optional checks declare the category

## Review questions

- Does the change preserve required release evidence while respecting explicit optionality?
- Can any optional check still cancel a tag-derived evidence requirement?

## Counterexample searches

- Required live release check
- Missing required category declaration
- Legacy command-only task
- deployment and release tags with optional-only live declarations

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
