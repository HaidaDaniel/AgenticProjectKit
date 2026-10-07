# Task 0199 - Fail closed on ambiguous direct candidate ownership

State: done
Owner: codex-main-20261007
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: tasks,provenance
Risk: high
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Use one unresolved competing ownership predicate for direct and chain foreign proofs; cover ambiguous legacy lifecycle in direct and chain cases without weakening active or released semantics.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- dist/**
- docs/progress.md

## Files forbidden to edit



## Steps

1. Capture a failing signal first: reproduce the old behavior and record the exact failing observation before changing implementation.
2. Minimize the reproducer when it is economical; otherwise record why full reproduction is impractical and what was attempted.
3. List competing hypotheses and let evidence from the failing signal choose among them; do not treat the first hypothesis as proven root cause.
4. Add bounded instrumentation only where it distinguishes hypotheses, then remove or justify it.
5. Implement the smallest safe fix; do not refactor unrelated code.
6. Show the failing signal now passes, or state the explicit best-effort limit, and add practical regression protection.

## Acceptance criteria

- Direct candidate with ambiguous active lifecycle is not proven as foreign ownership
- Chain ambiguous lifecycle remains fail closed
- Active overlap and explicit release intervals retain existing semantics

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No implementation patch precedes a documented failing-signal attempt; objective reproduction limits stay explicit.
- No forced red test is required for unsupported, flaky, UI-only, or provider-dependent cases.
- The fix preserves behavior outside the reported defect.

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.

## Review questions

- Can completed tasks swallow active authoritative commits
- Do direct and chain ambiguity fail closed
- Do release intervals and approval preserve anti-laundering checks

## Counterexample searches

- Search a UI-only defect, an intermittent race, an inaccessible provider, a host without a test framework, and an expensive reproducer.
- Search adjacent inputs, error paths, and repeated execution.

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"coverage/coverage-summary.json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
