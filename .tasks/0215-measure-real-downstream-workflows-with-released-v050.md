# Task 0215 - Measure real downstream workflows with released v0.5.0

State: done
Owner: codex-performance-20261007
Mode: discovery
Lane: architecture
Type: benchmark
Scope: performance,benchmark,downstream,go-decision,research
Risk: high
Parallel: false
Depends on: 0214
Tags: performance,benchmark,downstream,go-decision

## Goal

Use only the released v0.5.0 profiler to collect representative downstream evidence and make the final quantitative Node-versus-Go decision; the archived v0.4.9/0209 result remains historical preliminary context.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/product/maturity-and-compatibility.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/research/apk-performance-v050-corrective-plan.md
- docs/research/apk-performance-measurement-contract-v2.md
- docs/benchmarks/apk-performance-v050-self-baseline.md
- docs/delivery/workflow-v0.5.0-post-release.md
- .tasks/0214-release-corrected-performance-observability-as-v050.md
- .tasks/archive/0209-measure-real-downstream-workflows-and-decide-whether-go-rewrite-is-justified.md
- .tasks/archive/0125-research-non-node-apk-installation-and-distribution.md

## Files allowed to edit

- docs/research/**
- docs/benchmarks/**
- docs/progress.md

## Files forbidden to edit

- src/**
- scripts/**
- dist/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .tasks/archive/**

## Steps

1. Record a baseline with the same deterministic fixture and metric definition.
2. Run comparable candidate and baseline measurements.
3. Check leakage, relevant holdout behavior, and production-budget semantics.
4. Publish the bounded benchmark report before changing the candidate.

## Acceptance criteria

- Every final measurement uses an actual released v0.5.0 CLI; report includes APK rewrite-sensitive share
- startup
- Git
- disjoint test/lint/typecheck/build attribution
- 2x/5x/infinite scenarios
- coverage and unavailable repos; separates workflow-speed
- startup/short-command
- memory/runtime
- and distribution cases; no full Go rewrite is started; a bounded Go hotspot prototype is created only if representative evidence meets the stated guidance.

## Correctness assumptions

- AgenticProjectKit and at least one non-Node downstream are available; unavailable repos and failed setup are reported rather than imputed; LLM generation and idle gaps remain excluded.

## Invariants

- Do not use v0.4.9 traces as final decision evidence; do not claim arbitrary unwrapped work observed; do not double-count concurrency; do not modify source downstream repositories silently; do not create a full Go rewrite backlog from synthetic data.

## Required evidence

- released v0.5.0 identity; APK self real session; one non-Node real session; preferably representative additional repos; coverage/holdout/budget controls; quantitative decision report

## Review questions

- Are all final traces from exact released v0.5.0? Is at least one non-Node workflow valid and verification-heavy? Are failed/unavailable repos disclosed? Does the report keep runtime/distribution independent from workflow speed? Are thresholds used as guidance rather than automatic policy?

## Counterexample searches

- v0.4.9 CLI accidentally used; source-tree CLI used instead of tag; synthetic fixture presented as real agent work; wrapped child sum treated as wall; unavailable repo imputed; one repo universalized; Go prototype created without >15% evidence

## Verification

- `{"id":"decision-report","type":"automated","required":true,"environment":"local","profile":"report","evidenceType":"benchmark","command":"test -f docs/research/apk-performance-v050-downstream-decision.md"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"git diff --check"}`

## Documentation updates

- Write v0.5.0 downstream decision report and update progress.

## Notes

- Do not treat a single aggregate score as correctness proof.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
