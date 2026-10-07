# Task 0212 - Implement full-process v2 APK performance attribution

State: todo
Owner: none
Mode: mvp
Lane: implementation
Type: feature
Scope: performance,measurement,compatibility,privacy
Risk: high
Parallel: false
Depends on: 0210,0211
Tags: performance,measurement,compatibility,privacy

## Goal

Add schemaVersion 2 performance tracing and reporting that exposes a truthful Node-observed process lifetime boundary, startup residual, instrumented APK internal time, rewrite-sensitive share, disjoint command-kind attribution, and honest v1 compatibility.

## Context files

- AGENTS.md
- docs/architecture.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/research/apk-performance-measurement-contract.md
- docs/research/apk-performance-v050-corrective-plan.md
- docs/research/non-node-apk-installation-and-distribution.md
- .tasks/archive/0206-implement-opt-in-apk-performance-tracing-and-reporting.md
- .tasks/0210-harden-profiler-legacy-storage-and-multi-session-reporting.md

## Files allowed to edit

- src/core/perf/**
- src/cli/index.ts
- src/cli/commands/perf.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- dist/**
- docs/research/**
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- .agentic/**
- .tasks/archive/**
- .github/**
- package.json
- pnpm-lock.yaml
- AGENTS.md
- CLAUDE.md
- GEMINI.md

## Steps

1. Implement the smallest useful feature slice.
2. Add focused tests.
3. Run verification.

## Acceptance criteria

- New traces use schemaVersion 2; v2 reports distinguish full process observed lifetime
- instrumented invocation wall
- startup residual
- APK internal after instrumentation
- rewrite-sensitive APK time
- Git
- external checks
- wrapped tools
- and disjoint command-kind attribution; v1 traces remain readable with startup/full-process fields explicitly unavailable and a warning; concurrency and Amdahl values remain finite and bounded; privacy/off-by-default/local-storage invariants remain intact; committed dist matches source.

## Correctness assumptions

- A Node-observable monotonic process-start boundary can be reconstructed honestly from supported runtime primitives; exact OS process spawn time remains outside the in-process boundary; existing v1 traces may lack startup data.

## Invariants

- Never use wall-clock timestamps for durations; never fabricate startup from v1; primary attribution is disjoint and bounded by observed wall; no raw argv/env/output/secrets; profiling off leaves no trace and normal workflow behavior unchanged.

## Required evidence

- v2 timing and report tests; v1 compatibility fixture; overlapping command-kind attribution test; privacy/off-path regression; committed dist parity; documented execution-path coverage gaps

## Review questions

- Does the reported full-process boundary match what Node actually observes? Is rewrite-sensitive time defined without double counting startup
- internal
- Git
- or external children? Are v1 limitations explicit rather than backfilled? Does command-kind attribution remain disjoint under concurrency?

## Counterexample searches

- help/status short process; startup-only residual; v1 trace with missing startup; overlapping test and lint children; zero wall denominator; malformed mixed versions; profiling disabled; direct uninstrumented subprocess path; secret in wrapped command

## Verification

- `{"id":"perf-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"pnpm exec tsx --test src/core/perf/index.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"pnpm lint"}`
- `{"id":"source-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"pnpm test:source"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"benchmark","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"git diff --check"}`

## Documentation updates

- Add the v2 measurement contract and decision ADR; update progress.

## Notes

- Avoid unrelated refactors.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
