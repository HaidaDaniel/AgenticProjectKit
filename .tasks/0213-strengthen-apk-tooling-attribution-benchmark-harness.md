# Task 0213 - Strengthen APK tooling attribution benchmark harness

State: doing
Owner: codex-performance-20261007
Mode: mvp
Lane: architecture
Type: benchmark
Scope: performance,benchmark,tooling,measurement
Risk: high
Parallel: false
Depends on: 0212
Tags: performance,benchmark,tooling,measurement

## Goal

Replace the v0.4.9 synthetic-only baseline with a repeatable v2 harness that measures profiler OFF versus ON overhead, parent-observed process wall, short-command startup, and verification-heavy test/lint/typecheck/build attribution.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/research/apk-performance-measurement-contract.md
- docs/research/apk-performance-v050-corrective-plan.md
- docs/benchmarks/apk-performance-harness.md
- docs/benchmarks/apk-performance-self-baseline.md
- .tasks/0212-implement-full-process-v2-apk-performance-attribution.md
- .tasks/archive/0207-add-deterministic-tooling-benchmark-harness-and-apk-overhead-attribution.md

## Files allowed to edit

- scripts/benchmarks/perf-harness.mjs
- src/cli/commands/perf.ts
- src/core/perf/index.ts
- src/core/perf/index.test.ts
- src/cli/cli.test.ts
- dist/**
- docs/cli-commands.md
- docs/benchmarks/**
- docs/research/**
- docs/progress.md

## Files forbidden to edit

- .agentic/**
- .github/**
- package.json
- pnpm-lock.yaml
- AGENTS.md
- CLAUDE.md
- GEMINI.md

## Steps

1. Record a baseline with the same deterministic fixture and metric definition.
2. Run comparable candidate and baseline measurements.
3. Check leakage, relevant holdout behavior, and production-budget semantics.
4. Publish the bounded benchmark report before changing the candidate.

## Acceptance criteria

- Harness uses identical commands/fixtures/environment for OFF and ON; reports delta ms and percent without noisy absolute release thresholds; includes parent spawn-to-exit versus Node-observed metrics
- short-command first/repeated groups
- verification-heavy test/lint/typecheck/build attribution
- truthful repetition counts and min/median/p95/max; command-kind attribution is disjoint and child union is distinct from duration sum; committed report supersedes v0.4.9 synthetic baseline for self measurement but makes no universal Go verdict.

## Correctness assumptions

- Bounded local repetitions are sufficient for development evidence when methodology and limits are explicit; full cache isolation is not claimed unless controlled; verification-heavy workload cost remains bounded.

## Invariants

- OFF and ON command sequences are identical; no LLM time is measured; raw traces and machine-sensitive details are not committed; no benchmark milliseconds become strict CI acceptance thresholds; synthetic/self data is not final downstream Go evidence.

## Required evidence

- OFF/ON paired measurements; parent-vs-Node comparison; verification-heavy report; repetition statistics; leakage/holdout/budget controls; self-dogfood report

## Review questions

- Are OFF and ON truly identical workloads? Does the verification-heavy fixture actually execute external test/lint/typecheck/build commands? Are cold/warm or first/repeated labels honest? Could overlapping command-kind unions exceed wall? Does report avoid a universal Go conclusion?

## Counterexample searches

- OFF accidentally shorter command list; warm-only vs first-run comparison; missing external checks; one-run statistics presented as p95; parallel test/lint double counting; raw trace leakage; CI timing gate; self report interpreted as downstream verdict

## Verification

- `{"id":"harness-check","type":"automated","required":true,"environment":"local","profile":"report","evidenceType":"benchmark","command":"node scripts/benchmarks/perf-harness.mjs --check"}`
- `{"id":"typecheck-category","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"pnpm typecheck && pnpm exec tsx --test src/core/perf/index.test.ts src/cli/cli.test.ts"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"benchmark-report","type":"automated","required":true,"environment":"local","profile":"report","evidenceType":"benchmark","command":"test -f docs/benchmarks/apk-performance-v050-self-baseline.md"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"git diff --check"}`

## Documentation updates

- Update benchmark harness docs
- v2 self baseline
- and progress.

## Notes

- Do not treat a single aggregate score as correctness proof.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
