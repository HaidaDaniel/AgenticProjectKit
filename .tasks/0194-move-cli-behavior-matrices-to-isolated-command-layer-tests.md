# Task 0194 - Move CLI behavior matrices to isolated command-layer tests

State: done
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
- Completed implementation candidate: `3215f99589e302869906a64f03b038f0c2430d29`; completion bookkeeping is a separate commit and does not replace the reviewed candidate.
- Canonical run `verify-1791308233852-b7isye`: all four required checks passed in 123.77 seconds, with clean scope attribution. Coverage: 91.89% lines/statements, 98.06% functions, 81.69% branches; thresholds remain 90/90/95/78.
- Independent fresh-context review `work-1791308417182-zxpc6h` passed without findings; registered review evidence `evidence-1791308734991-pzpzbw`. The completion gate passed before `apk done`.
- Independent AST comparison preserved all 148 original test names and callback/options bodies after only runner-call normalization; 44 scenarios moved and six copied fixtures/constants matched. All 47 command-layer tests passed in 1.70 seconds; the same selected 30-test group took 23.63 seconds before and 7.71 seconds after.
- Observed raw c8 traces before/after: 423/329 records, 382/287 fresh compiled CLI processes, and 1,104,174,711/845,415,861 bytes. Process counts identify trace records executing the fresh source-test compilation's CLI entrypoint; they are not syntactic call counts. The reviewer independently recounted the current artifacts, not the prior baseline.
- Runtime and trace comparisons are local observations, not a controlled benchmark or hosted-CI/cross-platform timing claim. Task 0193's 148.48-second canonical run also included build-current; Task 0194 is test/docs-only and has four checks, so these full verification durations are not identical-command comparisons.
