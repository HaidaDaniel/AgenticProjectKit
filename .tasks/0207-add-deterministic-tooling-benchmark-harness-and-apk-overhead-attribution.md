# Task 0207 - Add deterministic tooling benchmark harness and APK overhead attribution

State: todo
Owner: none
Mode: production
Lane: verification
Type: benchmark
Scope: performance,benchmark,tooling,verification,docs
Risk: high
Parallel: false
Depends on: 0205,0206
Tags: performance,benchmark,attribution,self-dogfood,verification

## Goal

Add deterministic tooling benchmark harness and APK overhead attribution

## Context files

- AGENTS.md
- package.json
- docs/architecture.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/research/apk-performance-measurement-contract.md
- .tasks/0205-define-apk-performance-measurement-contract.md
- .tasks/0206-implement-opt-in-apk-performance-tracing-and-reporting.md
- src/core/perf/**
- src/cli/commands/perf.ts
- src/core/tasks/index.ts
- src/core/quality/index.ts
- src/core/audit/index.ts
- src/core/status/index.ts

## Files allowed to edit

- scripts/benchmarks/**
- docs/benchmarks/**
- docs/research/**
- src/core/perf/**
- src/cli/commands/perf.ts
- src/core/perf/*.test.ts
- docs/progress.md
- dist/**

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .github/**

## Steps

1. Create a deterministic disposable-fixture harness with cold and warm repetitions

## Acceptance criteria

- Harness is LLM-free
- repeatable and distinguishes child sum from wall-clock union

## Correctness assumptions

- The fixture represents the decision boundary and remains stable across runs.

## Invariants

- Baseline and candidate use identical measurement semantics.

## Required evidence

- Baseline, comparability, fixture, metric, leakage, holdout, and budget report.

## Review questions

- Could the apparent improvement come from leakage, fixture drift, or a changed budget?

## Counterexample searches

- Search holdout leakage, fixture edge cases, metric gaming, and production-budget overruns.

## Verification

- `{"id":"benchmark-harness","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/benchmarks/perf-harness.mjs --check"}`
- `{"id":"perf-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/perf/*.test.ts"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Add bounded benchmark harness documentation and commit self-dogfood summary without raw traces

## Notes

- No absolute millisecond release gate; benchmark evidence must state platform and coverage.
