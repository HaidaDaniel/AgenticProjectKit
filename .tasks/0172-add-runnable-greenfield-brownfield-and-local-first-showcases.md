# Task 0172 - Add runnable greenfield, brownfield, and local-first showcases

State: doing
Owner: codex-0172
Mode: product
Lane: examples
Type: feature
Scope: examples,adoption,workflow,tests,docs
Risk: medium
Parallel: false
Depends on: 0159,0161,0162,0165,0166
Tags: feature

## Goal

Provide runnable greenfield, brownfield, and local-first examples demonstrating representative public workflows.

## Context files

- AGENTS.md
- README.md
- docs/getting-started.md (future output of prerequisite Task 0159)
- docs/guides/brownfield-adoption.md (future output of prerequisite Task 0161)
- docs/guides/constrained-local-execution.md (future output of prerequisite Task 0162)
- docs/adoption-flow.md
- docs/engineering/testing-strategy.md

## Files allowed to edit

- examples/public-readiness/**
- docs/examples.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Steps

1. Define one minimal outcome per scenario and isolate examples from repository state.
2. Create greenfield init and task-completion example with required evidence.
3. Create brownfield example with existing instructions and review of adoption changes.
4. Create local-first example using exact local dependency and labeling any network setup.
5. Add deterministic smoke commands, expected files, and cleanup steps.

## Acceptance criteria

- All three examples run from clean checkout on documented toolchain.
- Each ends with observable state and can be cleaned safely.
- Brownfield smoke proves user-managed content is not silently overwritten.
- Local-first distinguishes package acquisition from subsequent offline-capable commands.

## Correctness assumptions

- Examples demonstrate representative paths, not every option.
- Documented smoke is sufficient if deterministic and safe to rerun.

## Invariants

- Examples never write into repository root or user home.
- Examples preserve exact pin and require review before accepting generated changes.

## Required evidence

- Three captured smoke outputs show expected state and repeatability.
- Second run leaves no unrelated changes or network surprises.

## Review questions

- Can an external user reproduce each scenario?
- Do they teach inspection and trust boundaries?

## Counterexample searches

- Run each twice, start brownfield with existing files, inspect all resulting changes.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- These scenarios provide runnable public dogfood and release smoke. Keep them isolated and deterministic.
