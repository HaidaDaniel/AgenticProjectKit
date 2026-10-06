# Task 0194 - Move CLI behavior matrices to isolated command-layer tests

State: doing
Owner: codex-cli-tests-20261006
Mode: maintenance
Lane: quality
Type: refactor
Scope: tests,cli,docs
Risk: medium
Parallel: false
Depends on: 0193
Tags: refactor,tests,semantic-diff

## Goal

Reduce covered test runtime by moving repeated CLI behavior matrices to isolated in-process command tests while preserving assertions and representative real-process, source/dist parity, concurrency, stream, exit and environment boundaries.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/research/fast-proportional-verification.md
- src/cli/cli.test.ts
- src/cli/index.ts
- src/cli/command-registry.ts
- src/cli/commands/execution.ts
- package.json
- scripts/test-source.mjs

## Files allowed to edit

- src/cli/cli.test.ts
- src/cli/command.test.ts
- package.json
- scripts/check-docs-consistency.test.mjs
- docs/engineering/testing-strategy.md
- docs/research/cli-test-layering.md
- docs/progress.md

## Files forbidden to edit

- src/core/**
- src/cli/index.ts
- src/cli/command-registry.ts
- src/cli/commands/**
- pnpm-lock.yaml
- dist/**
- .github/**
- .tasks/archive/**

## Steps

1. Measure bounded baseline subset and process counts
2. Define retained process boundaries and migrate scenario matrices
3. Prove harness restores cwd and output on success and failure
4. Run focused regressions then commit and canonical coverage once
5. Obtain independent review and pass gate
6. Commit lifecycle bookkeeping

## Acceptance criteria

- Existing scenario assertions are preserved across both test layers
- Each public command retains real-process smoke and global help dispatch parity remains
- Concurrent worker results and source-versus-dist parity remain process tests
- In-process harness serializes and restores cwd and console even on throws
- Full source coverage passes unchanged thresholds and source suite still runs once
- Measured runtime and process counts document observational comparison
- No production behavior or dependencies change

## Correctness assumptions

- Process boundaries cannot be replaced by in-process assertions
- Node test files run isolated and process-global harness calls must serialize

## Invariants

- No tests are skipped or replaced with mocks of core behavior
- Mandatory evidence and independent review remain candidate-bound

## Required evidence

- Before/after test output and public behavior comparison.

## Review questions

- Did any moved scenario depend on fresh module or env or process isolation
- Does the retained CLI smoke exercise every registered command
- Do stdout stderr exception and cwd restoration tests prevent harness laundering

## Counterexample searches

- Search concurrent invocations throwing handlers and environment dependent cases

## Verification

- `{"id":"static-quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality:static"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/engineering/testing-strategy.md
- docs/research/cli-test-layering.md
- docs/progress.md

## Notes

- Do not change public behavior unless the task says so.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
