# Task 0211 - Plan corrective v0.5.0 performance measurement milestone

State: doing
Owner: codex-performance-20261007
Mode: discovery
Lane: architecture
Type: docs
Scope: performance,planning,release,benchmark
Risk: high
Parallel: false
Depends on: none
Tags: performance,planning,benchmark,release

## Goal

Document the v0.4.9 measurement limitations without rewriting its immutable history, and establish the canonical v0.5.0 corrective task graph before any new downstream Go decision.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/research/apk-performance-measurement-contract.md
- docs/research/apk-performance-downstream-decision.md
- docs/benchmarks/apk-performance-harness.md
- .tasks/archive/0209-measure-real-downstream-workflows-and-decide-whether-go-rewrite-is-justified.md
- .tasks/0210-harden-profiler-legacy-storage-and-multi-session-reporting.md
- .tasks/archive/0125-research-non-node-apk-installation-and-distribution.md

## Files allowed to edit

- docs/research/apk-performance-v050-corrective-plan.md
- docs/research/apk-performance-downstream-decision.md
- docs/progress.md

## Files forbidden to edit

- .tasks/archive/**
- src/**
- dist/**
- scripts/**
- package.json
- pnpm-lock.yaml
- .github/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md

## Steps

1. Read relevant docs.
2. Update documentation.
3. Run verification.

## Acceptance criteria

- Current docs explicitly preserve v0.4.9 as immutable historical profiler release; corrective v0.5.0 gaps and A/B/C successor contracts are documented; the archived 0209 preliminary result is not used as final Go decision evidence; the successor downstream decision must require released v0.5.0.

## Correctness assumptions

- Completed archived task history cannot be rewritten; v0.5.0 remains free at planning time; new substantive task IDs are allocated only by APK.

## Invariants

- Never move or rewrite v0.4.9; never claim v0.4.9 evidence is a final Go verdict; do not create a Go rewrite task from synthetic evidence alone; preserve explicit downstream dependency ordering.

## Required evidence

- v0.4.9 tag/version state; archived 0209 interpretation; v0.5.0 task graph; explicit v0.5.0-before-downstream dependency

## Review questions

- Does the plan preserve historical truth without hiding known limitations? Could the successor graph accidentally let downstream decision run before v0.5.0? Are all corrective measurement gaps assigned to bounded tasks?

## Counterexample searches

- archived 0209 still referenced as final verdict; v0.4.9 release note mutation; v0.5.0 tag collision; dependency cycle; downstream task with only v0.4.9 prerequisite

## Verification

- `{"id":"plan-report","type":"automated","required":true,"environment":"local","profile":"report","evidenceType":"benchmark","command":"test -f docs/research/apk-performance-v050-corrective-plan.md"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"git diff --check"}`

## Documentation updates

- Add the corrective plan, mark the v0.4.9 downstream report as historical preliminary evidence, and add a concise current-state note.

## Notes

- Do not change source code unless explicitly required.
- Add the host repository's documentation/link/example checks when relevant; docs-only work does not require unrelated application tests, coverage, or release checks.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
