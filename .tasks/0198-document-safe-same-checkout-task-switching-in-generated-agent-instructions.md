# Task 0198 - Document safe same-checkout task switching in generated agent instructions

State: doing
Owner: codex-main-20261007
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: docs,exporters,templates,generated-instructions
Risk: low
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Add a short generated/default instruction that requires releasing the current doing or review task before claiming another mutable task in the same checkout, and recommends a separate Git worktree for true parallel work.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/agent-exporters.md
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/templates/renderer.test.ts

## Files allowed to edit

- AGENTS.md
- src/core/exporters/**
- src/core/templates/exporters/**
- src/core/templates/renderer.test.ts
- docs/task-system.md
- docs/agent-exporters.md
- dist/core/exporters/**
- dist/core/templates/exporters/**
- dist/**

## Files forbidden to edit



## Steps

1. Capture a failing signal first: reproduce the old behavior and record the exact failing observation before changing implementation.
2. Minimize the reproducer when it is economical; otherwise record why full reproduction is impractical and what was attempted.
3. List competing hypotheses and let evidence from the failing signal choose among them; do not treat the first hypothesis as proven root cause.
4. Add bounded instrumentation only where it distinguishes hypotheses, then remove or justify it.
5. Implement the smallest safe fix; do not refactor unrelated code.
6. Show the failing signal now passes, or state the explicit best-effort limit, and add practical regression protection.

## Acceptance criteria

- A failing signal is captured before any implementation change, or its objective reproduction limits (flaky/UI/provider/unavailable) are documented with attempts, environment, and unknowns.
- The old failing behavior no longer reproduces after the fix, and untested hypotheses are not reported as root-cause facts.
- Minimization and instrumentation are proportional, and regression protection is added where the host project supports it.
- No unrelated refactor is included.

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

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does the fix address the root cause rather than only the symptom?

## Counterexample searches

- Search a UI-only defect, an intermittent race, an inaccessible provider, a host without a test framework, and an expensive reproducer.
- Search adjacent inputs, error paths, and repeated execution.

## Verification

- `{"id":"static-quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality:static"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Pre-fix signal on Node 24.21.0: generated switching-rule regression failed because DEFAULT_AGENT_POLICY lacked release-before-claim/worktree rules. After updating the neutral source and canonical sync, all 34 renderer tests passed, including exact generated-file equivalence. The agents.md.hbs template remains the shared policy renderer; no duplicate rule source was added.

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
