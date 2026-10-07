# Task 0210 - Harden profiler legacy storage and multi-session reporting

State: doing
Owner: codex-performance-20261007
Mode: product
Lane: bugfix
Type: bugfix
Scope: performance,bugfix,compatibility,privacy
Risk: high
Parallel: false
Depends on: 0209
Tags: performance,bugfix,compatibility,privacy

## Goal

Keep opt-in profiler artifacts local and ignored in older downstream checkouts, and report malformed records only for the selected performance session.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/research/apk-performance-measurement-contract.md
- docs/benchmarks/apk-performance-harness.md
- docs/research/apk-performance-downstream-decision.md
- .tasks/0206-implement-opt-in-apk-performance-tracing-and-reporting.md
- .tasks/archive/0209-measure-real-downstream-workflows-and-decide-whether-go-rewrite-is-justified.md

## Files allowed to edit

- src/core/perf/**
- src/core/init/**
- src/cli/commands/perf.ts
- src/core/perf/index.test.ts
- src/core/init/init.test.ts
- src/cli/cli.test.ts
- dist/**
- docs/progress.md

## Files forbidden to edit

- .agentic/**
- .github/**
- package.json
- pnpm-lock.yaml
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .tasks/archive/**

## Steps

1. Capture a failing signal first: reproduce the old behavior and record the exact failing observation before changing implementation.
2. Minimize the reproducer when it is economical; otherwise record why full reproduction is impractical and what was attempted.
3. List competing hypotheses and let evidence from the failing signal choose among them; do not treat the first hypothesis as proven root cause.
4. Add bounded instrumentation only where it distinguishes hypotheses, then remove or justify it.
5. Implement the smallest safe fix; do not refactor unrelated code.
6. Show the failing signal now passes, or state the explicit best-effort limit, and add practical regression protection.

## Acceptance criteria

- Legacy downstream checkout does not expose profiler runtime artifacts to Git scope or APK status; mixed-session trace files report only selected-session malformed records; profiling corruption remains fail-safe; committed dist matches source; regression tests cover both defects

## Correctness assumptions

- Existing downstream checkouts may predate the v0.4.9 .gitignore entry; trace.jsonl may contain valid records from multiple sessions; local Git metadata is available for a repository using the profiler.

## Invariants

- No secrets
- prompts
- responses
- file contents
- or raw argv are persisted; profiling remains opt-in and local; normal APK workflow remains usable when local profiling state is malformed; task provenance and candidate hashing exclude profiler runtime artifacts.

## Required evidence

- reproduction of both downstream observations; focused regression test output; source/dist parity; privacy and scope checks

## Review questions

- Can a legacy checkout still surface .agentic/perf as scope or untracked state? Does a report falsely warn about valid records belonging to another session? Can the compatibility fix mutate tracked project files or leak sensitive data?

## Counterexample searches

- fresh legacy clone with no .gitignore perf rule; multiple sessions sharing one trace file; malformed selected-session record; malformed unrelated-session record; profiler disabled path; non-Git directory; stale session state

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"automated-test","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"automated-test","command":"pnpm typecheck"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"automated-test","command":"pnpm lint"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"automated-test","command":"pnpm test:source"}`
- `{"id":"check-5","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"automated-test","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","evidenceType":"automated-test","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/progress.md with the corrective result and remaining release status.

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
