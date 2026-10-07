# APK performance v0.5.0 self-dogfood baseline

Generated: 2026-10-07T18:23:52.134Z
Environment: linux/x64, Node v24.21.0
Trace/report schema: v2

This bounded, LLM-free development baseline uses the v2 profiler on AgenticProjectKit and a disposable task-verification fixture. It is decision-quality self evidence for attribution, not a universal Go conclusion and not an absolute release gate.

Coverage: LLM generation, model/API wait, reasoning, user think time, idle/unobserved gaps, and arbitrary unwrapped commands are excluded or unknown. Parent spawn-to-exit is measured independently from Node-observed process lifetime. Raw traces and machine paths are not committed.

## Short APK commands

First-run means the first command group after a session starts. Repeated-run means an identical command group in another session. Neither label claims OS-cache purity.

| Group | repetitions | parent process wall | Node full process | startup residual | instrumented APK internal | Git |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| short first-run group | 5 | min 2.504 s, median 2.512 s, p95 2.837 s, max 2.837 s (n=5) | min 0.449 s, median 0.451 s, p95 0.456 s, max 0.456 s (n=5) | min 0.322 s, median 0.332 s, p95 0.337 s, max 0.337 s (n=5) | min 0.109 s, median 0.110 s, p95 0.121 s, max 0.121 s (n=5) | min 0.007 s, median 0.008 s, p95 0.008 s, max 0.008 s (n=5) |
| short repeated-run group | 10 | min 2.478 s, median 2.509 s, p95 2.546 s, max 2.546 s (n=10) | min 0.431 s, median 0.444 s, p95 0.459 s, max 0.459 s (n=10) | min 0.315 s, median 0.321 s, p95 0.333 s, max 0.333 s (n=10) | min 0.104 s, median 0.108 s, p95 0.122 s, max 0.122 s (n=10) | min 0.007 s, median 0.008 s, p95 0.008 s, max 0.008 s (n=10) |

## Verification-heavy workload

The AgenticProjectKit row runs the same four commands in OFF and ON groups through `apk perf exec`: focused test, lint, typecheck, and build. The disposable fixture row runs the same claimed `apk task verify` command in both modes; its task verification executes an external Node check.

| Workload | repetitions | wall | rewrite-sensitive APK | Git | tests | lint | typecheck | build | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AgenticProjectKit test/lint/typecheck/build | 3 | min 12.799 s, median 12.842 s, p95 12.852 s, max 12.852 s (n=3) | min 0.547 s, median 0.555 s, p95 0.562 s, max 0.562 s (n=3) | 0.000 s | 0.743 s | 4.116 s | 3.984 s | 3.418 s | 0.000 s |
| Disposable task verify | 3 | min 0.325 s, median 0.326 s, p95 0.332 s, max 0.332 s (n=3) | min 0.248 s, median 0.249 s, p95 0.253 s, max 0.253 s (n=3) | 0.049 s | 0.000 s | 0.000 s | 0.000 s | 0.000 s | 0.029 s |

Child duration sum and child wall-clock union remain separate diagnostics. Primary command-kind attribution is disjoint, so overlapping children are not added as wall-clock percentages.

## Instrumentation overhead

OFF and ON use identical command sequences, fixtures, Node version, and environment. Parent process wall is the external overhead comparison; no absolute timing threshold is used.

| Workload | OFF parent wall | ON parent wall | delta ms | delta % |
| --- | ---: | ---: | ---: | ---: |
| short first-run group | 2.512 s | 2.543 s | 30.2 ms | 1.2% |
| short repeated-run group | 2.509 s | 2.521 s | 11.5 ms | 0.5% |
| verification-heavy | 12.701 s | 12.764 s | 62.7 ms | 0.5% |
| disposable task verify | 0.227 s | 0.223 s | -3.3 ms | -1.5% |

## Go ceilings

These are Amdahl-style mathematical scenarios for the measured rewrite-sensitive APK time. They do not claim that Go would deliver any stated factor.

| Workload | APK rewrite-sensitive share | 2x gain | 5x gain | zero-cost maximum |
| --- | ---: | ---: | ---: | ---: |
| short first-run group | 98.3% | 49.2% | 78.7% | 98.3% |
| short repeated-run group | 98.3% | 49.1% | 78.6% | 98.3% |
| verification-heavy | 4.3% | 2.2% | 3.5% | 4.3% |
| disposable task verify | 76.1% | 38.0% | 60.9% | 76.1% |

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
