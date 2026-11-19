# Task 0296 - Profile and reduce repeated task inventory work in status and attention

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: implementation
Type: refactor
Scope: status,performance,tests
Risk: low
Parallel: false
Depends on: none
Tags: performance,measurement,status,attention

## Goal

Measure where status --detail and attention --json spend time and reduce avoidable repeated parsing only where the profile and a safe invalidation strategy justify it.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/benchmarks/apk-performance-harness.md
- src/core/status/index.ts
- src/core/status/attention.ts
- scripts/benchmarks/perf-harness.mjs

## Files allowed to edit

- src/core/status/index.ts
- src/core/status/attention.ts
- scripts/benchmarks/perf-harness.mjs
- docs/benchmarks/apk-performance-self-baseline.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/doctor/**
- src/core/audit/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Record baseline wall-clock measurements for status --detail and attention --json on a small and a large task inventory using the existing harness.
2. Attribute time to inventory parsing, git subprocesses and rendering; do not assume a cache is needed.
3. If a measurable hotspot exists, reduce work within one invocation or skip archived files for active-state queries without changing output.
4. If no cross-invocation cache has a safe invalidation strategy tied to file and HEAD changes, do not add one and say so in the report.
5. Add a bounded advisory benchmark assertion and keep all semantic tests unchanged.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- A measurement report distinguishes APK overhead from git and filesystem cost.
- Any optimization preserves byte-identical human and JSON output for the same repository state.
- No cache is introduced without a measured benefit and an explicit invalidation strategy.
- Archived tasks remain visible wherever current projections require them.

## Correctness assumptions

- Measured cost not intuition drives any change

## Invariants

- Optimization must not alter semantic projections

## Required evidence

- Baseline and post-change benchmark output

## Review questions

- Is any proposed cache safe under concurrent mutation

## Counterexample searches

- Stale projection after task state change; Archive hidden from an operational view

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"performance-measurement","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run the existing benchmark harness on small and large inventories and record attribution and any decision not to cache."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update the performance self-baseline with the measured result

## Notes

- This is an optimization task not a correctness fix
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
