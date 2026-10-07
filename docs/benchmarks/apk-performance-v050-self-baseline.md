# APK performance v0.5.0 self-dogfood baseline

Generated: 2026-10-07T18:27:45.439Z
Environment: linux/x64, Node v24.21.0
Trace/report schema: v2

This bounded, LLM-free development baseline uses the v2 profiler on AgenticProjectKit and a disposable task-verification fixture. It is decision-quality self evidence for attribution, not a universal Go conclusion and not an absolute release gate.

Coverage: LLM generation, model/API wait, reasoning, user think time, idle/unobserved gaps, and arbitrary unwrapped commands are excluded or unknown. Parent spawn-to-exit is measured independently from Node-observed process lifetime. Raw traces and machine paths are not committed.

## Short APK commands

First-run means the first command group after a session starts. Repeated-run means an identical command group in another session. Neither label claims OS-cache purity.

| Group | repetitions | parent process wall | Node full process | startup residual | instrumented APK internal | Git |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| short first-run group | 5 | min 2.522 s, median 2.529 s, p95 2.845 s, max 2.845 s (n=5) | min 0.428 s, median 0.449 s, p95 0.460 s, max 0.460 s (n=5) | min 0.318 s, median 0.327 s, p95 0.336 s, max 0.336 s (n=5) | min 0.103 s, median 0.112 s, p95 0.118 s, max 0.118 s (n=5) | min 0.007 s, median 0.009 s, p95 0.009 s, max 0.009 s (n=5) |
| short repeated-run group | 10 | min 2.507 s, median 2.539 s, p95 2.576 s, max 2.576 s (n=10) | min 0.436 s, median 0.445 s, p95 0.458 s, max 0.458 s (n=10) | min 0.318 s, median 0.327 s, p95 0.341 s, max 0.341 s (n=10) | min 0.104 s, median 0.108 s, p95 0.120 s, max 0.120 s (n=10) | min 0.007 s, median 0.008 s, p95 0.009 s, max 0.009 s (n=10) |

## Verification-heavy workload

The AgenticProjectKit row runs the same four commands in OFF and ON groups through `apk perf exec`: focused test, lint, typecheck, and build. The disposable fixture row runs the same claimed `apk task verify` command in both modes; its task verification executes an external Node check.

| Workload | repetitions | wall | rewrite-sensitive APK | Git | tests | lint | typecheck | build | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AgenticProjectKit test/lint/typecheck/build | 3 | min 12.685 s, median 12.752 s, p95 12.850 s, max 12.850 s (n=3) | min 0.544 s, median 0.546 s, p95 0.561 s, max 0.561 s (n=3) | 0.000 s | 0.731 s | 4.130 s | 3.976 s | 3.393 s | 0.000 s |
| Disposable task verify | 3 | min 0.325 s, median 0.329 s, p95 0.333 s, max 0.333 s (n=3) | min 0.247 s, median 0.252 s, p95 0.255 s, max 0.255 s (n=3) | 0.049 s | 0.000 s | 0.000 s | 0.000 s | 0.000 s | 0.029 s |

Child duration sum and child wall-clock union remain separate diagnostics. Primary command-kind attribution is disjoint, so overlapping children are not added as wall-clock percentages.

## Instrumentation overhead

OFF and ON use identical command sequences, fixtures, Node version, and environment. Parent process wall is the external overhead comparison; no absolute timing threshold is used.

| Workload | OFF parent wall | ON parent wall | delta ms | delta % |
| --- | ---: | ---: | ---: | ---: |
| short first-run group | 2.529 s | 2.548 s | 19.7 ms | 0.8% |
| short repeated-run group | 2.539 s | 2.548 s | 9.5 ms | 0.4% |
| verification-heavy | 12.705 s | 12.676 s | -28.3 ms | -0.2% |
| disposable task verify | 0.225 s | 0.224 s | -1.4 ms | -0.6% |

## Go ceilings

These are Amdahl-style mathematical scenarios for the measured rewrite-sensitive APK time. They do not claim that Go would deliver any stated factor.

| Workload | APK rewrite-sensitive share | 2x gain | 5x gain | zero-cost maximum |
| --- | ---: | ---: | ---: | ---: |
| short first-run group | 98.1% | 49.0% | 78.5% | 98.1% |
| short repeated-run group | 98.1% | 49.1% | 78.6% | 98.3% |
| verification-heavy | 4.3% | 2.1% | 3.4% | 4.3% |
| disposable task verify | 76.7% | 38.2% | 61.1% | 76.4% |

## Evidence controls and limits

- **Baseline:** this report replaces the v0.4.9 synthetic-only self baseline for v2 self measurement; v0.4.9 remains immutable historical evidence.
- **Comparability:** every OFF/ON pair uses the same fixed command list, fixture, Node version, and working directory. The ON report uses schemaVersion 2; the OFF side is independently observed by the parent because no trace is expected.
- **Process boundary:** parent spawn-to-exit is not required to equal reconstructed Node process lifetime. The two measurements are reported as different observation boundaries.
- **Repetitions:** short first-run groups use at least five runs and repeated-run groups use at least ten in the committed baseline; verification-heavy groups use three bounded runs because they execute real project tooling. The committed tables show min/median/p95/max for repeated workload measurements.
- **Fixture:** the disposable task fixture proves APK orchestration, Git/provenance, and an external verification subprocess. The repository workload exercises test, lint, typecheck, and build through explicit wrappers.
- **Privacy:** the harness fixes commands in source, does not commit stdout/stderr or raw traces, and the profiler stores neither raw argv nor environment values. Temporary fixtures are removed after each run.
- **Holdout:** this self benchmark is not representative downstream evidence. Task 0215 must collect real sessions using the released v0.5.0 package before any Go decision.
- **Release policy:** noisy benchmark milliseconds are not a CI or release threshold; the benchmark is a measurement artifact and methodology check.

Go decision: pending real v0.5.0 downstream evidence. No full rewrite or prototype is authorized by this self benchmark alone.
