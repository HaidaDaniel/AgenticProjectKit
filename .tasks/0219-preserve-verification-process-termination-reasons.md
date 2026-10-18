# Task 0219 - Preserve verification process termination reasons

State: todo
Owner: none
Mode: maintenance
Lane: verification
Type: bugfix
Scope: verification,process,diagnostics
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Preserve the process outcome that caused each task verification command to fail. The current runner converts command execution errors into a numeric result and later reports a generic nonzero exit, which hides whether the process returned a nonzero code, timed out, ended from a signal, or could not be spawned. Keep `DEFAULT_TASK_COMMAND_TIMEOUT_MS` at ten minutes.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- .tasks/0188-add-stable-self-apk-verification-checks-without-shell-path-coupling.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/gate.ts
- src/core/tasks/evidence.ts
- src/core/tasks/provenance.ts
- src/core/audit/**
- src/cli/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Capture the current command result and agent-facing diagnostic for four deterministic observations: numeric nonzero exit, timeout, signal termination, and spawn failure.
2. Inspect the `observedExec` error/result shape and `verifyTask` command-result projection. Classify timeout only from authoritative timeout metadata supplied by the runner; `killed: true` or a signal alone is not evidence of timeout.
3. Preserve the existing `runCommand` injection contract that returns a numeric exit code: zero passes and nonzero fails as before. Existing callers and tests using this numeric form must continue to work unchanged.
4. Add a bounded process-outcome model that preserves a known termination category and relevant detail without changing successful command behavior. For ambiguous or unknown runner errors, report an unknown process outcome and a truthful generic failure reason; do not guess timeout, signal, spawn failure, or an observed numeric exit code.
5. Preserve the existing external result fields and types (`command`, numeric `exitCode`, optional `apkOperation`, and optional `resolvedApkIdentity`). Any new outcome or reason fields must be optional and additive. If a numeric compatibility projection is required where no actual process exit code exists, distinguish it from an observed exit code in the new metadata and agent-facing message.
6. Render clear diagnostics that tell an agent whether the command exited, timed out, was terminated by a named signal, failed to start, or has an unknown outcome; include only details actually observed.
7. Add deterministic tests for numeric `runCommand` compatibility and process errors using injected outcomes or an equivalent controlled seam. Do not rely on wall-clock sleeps, scheduler timing, or platform-specific real signals for category coverage.
8. Verify that `apk lint` remains static and does not execute task commands, and that the ten-minute timeout, gate semantics, and candidate freshness are unchanged.
9. Regenerate committed dist and update verification-process documentation only as needed to describe the result categories.

## Acceptance criteria

- A failing signal is captured before any implementation change, or its objective reproduction limits (flaky/UI/provider/unavailable) are documented with attempts, environment, and unknowns.
- The old failing behavior no longer reproduces after the fix, and untested hypotheses are not reported as root-cause facts.
- Minimization and instrumentation are proportional, and regression protection is added where the host project supports it.
- No unrelated refactor is included.
- Verification results distinguish ordinary nonzero exit, timeout, signal termination, and spawn failure in structured output and human-readable reasons.
- Existing callers of `runCommand` that return a numeric exit code remain source- and behavior-compatible: zero passes and nonzero fails.
- Deterministic regression tests cover each termination category, success, ambiguous/unknown errors, and the numeric callback contract without timing-dependent process control.
- Ambiguous errors remain explicitly unknown; no timeout, signal, spawn, or numeric-exit classification is invented from insufficient fields.
- Existing result fields and types remain intact; any additions are optional and backward-compatible.
- Timeout is classified only from an authoritative timeout indication, never solely from `killed: true` or a signal value.
- `DEFAULT_TASK_COMMAND_TIMEOUT_MS` remains 10 minutes; no global timeout setting is changed.
- Verification gate eligibility, lifecycle enforcement, evidence subject, and freshness semantics are unchanged.
- APK lint remains read-only with respect to task commands and never starts declared shell commands.
- Committed dist matches the source implementation.

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No implementation patch precedes a documented failing-signal attempt; objective reproduction limits stay explicit.
- No forced red test is required for unsupported, flaky, UI-only, or provider-dependent cases.
- The fix preserves behavior outside the reported defect.
- Numeric `runCommand` callbacks remain a supported compatibility path.
- Unknown runner failures fail verification without being mislabeled as a known process termination category.

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.
- Candidate-bound regression output for success, nonzero exit, timeout, signal termination, and spawn failure, with the resulting agent-facing messages.
- Regression output showing numeric `runCommand` results retain their existing pass/fail behavior and result shape.
- Regression output showing ambiguous runner errors are reported as unknown and timeout is not inferred from only `killed: true` or signal metadata.
- Evidence that the timeout constant remains 600000 ms and that lint did not execute a sentinel verification command.

## Review questions

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does timeout classification take precedence over the signal used to stop a timed-out child?
- Is timeout backed by an authoritative timeout field/code from the runner rather than `killed` or `signal` alone?
- Can an ENOENT/ENOTDIR or other spawn error be mistaken for an ordinary numeric exit code?
- Do numeric `runCommand` implementations continue to work with the same zero/nonzero behavior?
- Do unknown or contradictory runner errors stay unclassified instead of being coerced into one of the four known outcomes?
- Are signal name and exit code preserved only when present, without inventing a process status?
- Are all existing external result fields preserved with only optional additions?
- Did gate pass/fail rules, freshness, evidence binding, or the ten-minute timeout change?
- Can lint or another static preflight accidentally execute a task command after this change?

## Counterexample searches

- Exit code 1 and another nonzero code with no timeout or signal metadata.
- Timeout whose child is terminated by SIGTERM, then timeout escalation to SIGKILL.
- Signal termination with no exit code and no timeout evidence.
- Spawn failure with string `code` such as ENOENT, with no child exit event.
- An error object exposing both `killed` and `signal`; do not misclassify without timeout evidence.
- An error with both timeout-like and spawn-like fields, or malformed contradictory fields; report unknown unless a documented authoritative runner field resolves it.
- Legacy injected `runCommand` returning 0 and a nonzero integer.
- Successful exit code 0 and an unexpected thrown runner error.
- Repeated verification and required versus optional checks.
- A task command that would create a sentinel file; run lint and confirm the sentinel is absent.

## Verification

- `{"id":"task-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document the structured command termination categories and agent-facing diagnostics in docs/task-system.md if the public result contract changes.
- Update docs/progress.md when task state changes.

## Notes

- Keep the existing ten-minute command timeout; no evidence in this task authorizes changing it.
- Current source gap: `defaultRunCommand` in `src/core/tasks/index.ts` reduces runner errors to a number, `TaskVerifyCommandResult` exposes only `exitCode`, and `verifyTask` can report a generic `command exited with code 1` for timeout or spawn failure. Existing numeric-runner tests do not provide deterministic coverage for all four process outcomes.
- Impact: agents cannot tell whether to fix the command, wait for a longer-running operation, inspect signal termination, or repair the executable/environment.
- Downstream evidence includes translator-agent commits `c0aff6b7`, `32be79b9`, `5638c641`, `2164698a`, and `79fc65ab`.
- `src/core/tasks/index.ts` and `dist/**` are shared with Task 0220; do not run this task concurrently with that task.
- Lint must inspect contracts only and must not execute verification commands.
