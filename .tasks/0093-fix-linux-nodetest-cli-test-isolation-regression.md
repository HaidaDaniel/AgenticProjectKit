# Task 0093 - Fix Linux node:test CLI test isolation regression

State: done
Owner: codex-corrective-0093
Mode: production
Lane: quality
Type: bugfix
Scope: cli,tests,quality
Risk: medium
Parallel: false
Depends on: 0078
Tags: bugfix,quality,ci,linux,node-test

## Goal

Fix only the clean-checkout Linux Node test-isolation defect exposed by Task 0079 GitHub Actions run 34574370892.

## Context files

- AGENTS.md
- SPEC.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/progress.md
- src/cli/cli.test.ts
- .tasks/0078-add-first-class-local-quality-guardrails-for-agenticprojectkit-itself.md
- .tasks/0079-add-minimal-clean-checkout-ci-and-release-quality-proof-for-agenticprojectkit.md

## Files allowed to edit

- src/cli/cli.test.ts
- SPEC.md
- docs/progress.md
- .tasks/0093-fix-linux-nodetest-cli-test-isolation-regression.md

## Files forbidden to edit

- src/cli/index.ts
- src/core/**
- .github/**
- package.json
- pnpm-lock.yaml
- scripts/**
- .agentic/config.json
- .tasks/archive/**

## Steps

1. Reproduce Node test cancellation under Linux/Node 22 or the closest available environment and trace the declaration boundary
2. Apply the smallest test-structure fix without production CLI behavior changes
3. Add regression protection that keeps the affected CLI cases as independent top-level tests
4. Run canonical verification and independent review

## Acceptance criteria

- The sync test and six following task-deps/help/error cases all finish as independent top-level PASS tests on Linux Node 22
- No test is skipped retried delayed or masked and global concurrency remains unchanged
- Windows/local behavior remains green
- No production CLI behavior changes

## Correctness assumptions

- GitHub Actions cancellation reflects invalid test registration timing rather than production CLI behavior

## Invariants

- Affected CLI cases register as top-level tests before asynchronous test execution begins
- Test cleanup cannot cancel subsequently declared top-level tests

## Required evidence

- Failing GitHub Actions run 34574370892 plus focused/full passing test output after the fix

## Review questions

- Does the fix remove import-time async test declaration without sleeps skips retries or global concurrency changes?

## Counterexample searches

- Linux scheduling where the async sync test yields before later declarations register; Windows local runner behavior

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/cli/cli.test.ts"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-5","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"check-6","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"check-7","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Record lifecycle in docs/progress.md; backprop the regression into SPEC.md

## Notes

- Keep the fix narrow.
