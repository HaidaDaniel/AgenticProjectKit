# CLI test layering and the next feedback-speed improvement

Date: 2026-10-06
Task: 0194
Baseline: `b20b942` (Task 0193 completed)

## Change

Move 44 existing scenarios from `src/cli/cli.test.ts` to `src/cli/command.test.ts`:
handler help-option coverage, parameter/error matrices, calibration precedence, pure execution
routing, documentation-style warnings, task filtering and archive failure paths. Scenario bodies
and assertions are unchanged except `runCli(...)` becomes `runCommand(...)`.

The command layer invokes the real public dispatcher, command handlers, and core services with
real disposable repository fixtures. Its adapter serializes calls in the isolated test-file
process, captures stdout/stderr console messages, and restores cwd and console in `finally`.
Unexpected exceptions, invalid cwd and missing exit codes fail visibly; they are not translated
into synthetic success or expected-refusal evidence. No domain service or environment is mocked.

The process layer still checks every public command through the real CLI entrypoint, plus global
help and unknown-command streams/exits, shipped/source parity, full worker/review/gate handoffs,
concurrent terminal append, live lock/worktree behavior and developer-local language/environment
isolation. The new process-dispatch smoke replaces repeated process startup for every handler
help variant, not the handler's option coverage. Keep a scenario here whenever fresh process,
module lifetime, concurrent process or environment isolation is what it proves.

Both files are selected once by `test:source`; the same fresh compiler and unchanged
90% lines/statements, 95% functions and 78% branches thresholds apply. No production files,
dependencies, CI policy, completion gate or packaged output change.

## Measurements

On Node.js 22.22.1, the same bounded pattern
`command-handler help|CLI execution explain|deterministic calibration|CLI task create`
selected 30 tests before and after migration:

| Measurement | Before | After |
| --- | --- | --- |
| Selected tests passing | 30 | 30 |
| Wall time including fresh integration build | 23.63 seconds | 7.71 seconds |

All 47 command-layer tests, including three adapter regressions, passed in 1.70 seconds wall
time without a CLI build. This focused run uses tsx; authoritative coverage still compiles both
layers together. AST comparison against the baseline proves all 148 prior test names and bodies
remain in one of the layers, normalizing only the invocation helper; five new boundary/adapter
tests are added. The three adapter tests cover stream/nonzero results, overlapping calls, and
cleanup after unexpected throws, invalid cwd and missing exit codes.

These are observational developer-host measurements, not controlled benchmarks or hosted CI
timings. Final full verification, coverage and independent review are recorded against the exact
committed candidate in Task 0194 evidence and the completion handoff. Task 0193's final canonical
run was 148.48 seconds; compare only with the separately measured final run, not focused times.

## Guidance

Use fast direct core tests for pure domain behavior, command-layer tests for handler parameter,
formatting and repository-fixture matrices, and real CLI subprocesses for wiring and actual
process/environment/concurrency boundaries. Do not replace process assertions with mocks or
delete edge cases just to improve a runtime number. This is APK's own test organization; no new
mandatory testing tools or stages are exported to adopted repositories.
