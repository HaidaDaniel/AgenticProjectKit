# Task 0209 - Measure real downstream workflows and decide whether Go rewrite is justified

State: done
Owner: codex-performance-20261007
Mode: discovery
Lane: architecture
Type: benchmark
Scope: performance,benchmark,downstream,go-decision,research,docs
Risk: high
Parallel: false
Depends on: 0208
Tags: performance,benchmark,downstream,go-decision,research

## Goal

Measure real downstream workflows and decide whether Go rewrite is justified

## Context files

- AGENTS.md
- docs/project.md
- docs/architecture.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/product/maturity-and-compatibility.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/research/apk-performance-measurement-contract.md
- docs/benchmarks/**
- .tasks/0208-release-performance-observability-in-the-next-stable-tag.md
- .tasks/archive/0125-research-non-node-apk-installation-and-distribution.md

## Files allowed to edit

- docs/research/**
- docs/benchmarks/**
- docs/progress.md

## Files forbidden to edit

- src/**
- scripts/**
- package.json
- pnpm-lock.yaml
- dist/**
- .github/**
- .agentic/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .tasks/archive/**

## Steps

1. Use the released profiler on APK self-dogfood and available non-Node downstream repositories

## Acceptance criteria

- Report separates APK runtime/distribution rationale from end-to-end workflow speed rationale

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

- `{"id":"benchmark-report","type":"automated","required":true,"environment":"local","profile":"report","evidenceType":"benchmark","command":"test -f docs/research/apk-performance-downstream-decision.md"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Write the downstream measurement and Node-versus-Go decision report with bounded reproducible evidence

## Notes

- Depends on the released profiler. Do not make synthetic self-benchmark alone a universal Go recommendation.
