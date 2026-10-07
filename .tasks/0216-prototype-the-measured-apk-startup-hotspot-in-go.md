# Task 0216 - Prototype the measured APK startup hotspot in Go

State: todo
Owner: none
Mode: discovery
Lane: research
Type: benchmark
Scope: performance,benchmark,go-prototype
Risk: high
Parallel: false
Depends on: 0215
Tags: performance,benchmark,go-prototype

## Goal

Compare one measured APK startup and module-loading hotspot implemented in Go against the released Node path using identical inputs and semantic output. This is a bounded prototype only and must not become a full APK rewrite.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/research/apk-performance-v050-downstream-decision.md
- docs/research/apk-performance-measurement-contract-v2.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/benchmarks/apk-performance-v050-self-baseline.md

## Files allowed to edit

- experiments/apk-go-startup/**
- docs/research/**
- docs/benchmarks/**

## Files forbidden to edit

- src/**
- scripts/**
- dist/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**

## Steps

1. Select one startup/import hotspot from released v0.5.0 evidence
2. Build a minimal Go prototype in the disposable experiment path
3. Run matched Node and Go repetitions with the same fixture and environment
4. Measure wall clock startup RSS and runtime footprint where honest
5. Publish an evidence-based prototype comparison and stop without migration work

## Acceptance criteria

- Same fixture inputs and semantic output are used for both paths
- Node baseline is identified from released v0.5.0 evidence
- Go prototype is limited to one measured hotspot
- Results include repetitions median p95 or range and environment metadata
- No full APK rewrite or downstream mutation is performed
- Decision separates workflow speed from startup memory and distribution

## Correctness assumptions

- The v0.5.0 downstream report identifies a bounded startup-heavy hotspot
- Go toolchain is available or its absence is reported without imputed results
- The prototype does not represent whole-APK maintenance cost

## Invariants

- No LLM generation or idle gaps are measured
- No raw secrets argv or repository contents are stored
- Node and Go outputs remain semantically comparable
- The prototype cannot change the v0.5.0 tag

## Required evidence

- matched Node and Go benchmark report
- prototype source or fixture
- environment and availability record

## Review questions

- Is the selected hotspot directly supported by released evidence?
- Are Node and Go inputs and outputs genuinely matched?
- Are measurements repeated and memory claims honest?
- Does the scope remain a bounded prototype rather than a rewrite?

## Counterexample searches

- different fixtures or warm states
- unreported Go toolchain failure
- semantic output drift
- peak RSS claimed from a snapshot
- prototype changes outside allowed paths

## Verification

- `{"id":"prototype-report","type":"automated","required":true,"environment":"local","profile":"report","command":"test -f docs/research/apk-go-startup-hotspot.md","evidenceType":"benchmark"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check","evidenceType":"benchmark"}`

## Documentation updates

- docs/research/**
- docs/benchmarks/**

## Notes

- This task exists because released v0.5.0 evidence crossed the prototype guidance on short startup-heavy paths while heavy workflows remained below the rewrite threshold.
