# APK performance v0.5.0 self-dogfood baseline

Generated: 2026-10-07T18:14:29.140Z
Environment: linux/x64, Node v24.21.0

This bounded, LLM-free development baseline uses the v2 profiler on AgenticProjectKit and a disposable task-verification fixture. It is decision-quality self evidence for attribution, not a universal Go conclusion and not an absolute release gate.

Coverage: LLM generation, model/API wait, reasoning, user think time, idle/unobserved gaps, and arbitrary unwrapped commands are excluded or unknown. Parent spawn-to-exit is measured independently from Node-observed process lifetime. Raw traces and machine paths are not committed.

## Short APK commands

First-run means the first command group after a session starts. Repeated-run means an identical command group in another session. Neither label claims OS-cache purity.

| Group | repetitions | parent process wall | Node full process | startup residual | instrumented APK internal | Git |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| short first-run group | 5 | 2.482 s (n=5, p95 2.497 s) | 0.438 s (n=5, p95 0.452 s) | 0.323 s (n=5, p95 0.333 s) | 0.108 s (n=5, p95 0.117 s) | 0.008 s (n=5, p95 0.008 s) |
| short repeated-run group | 10 | 2.451 s (n=10, p95 2.465 s) | 0.443 s (n=10, p95 0.459 s) | 0.325 s (n=10, p95 0.342 s) | 0.108 s (n=10, p95 0.115 s) | 0.008 s (n=10, p95 0.010 s) |

## Verification-heavy workload

The AgenticProjectKit row runs the same four commands in OFF and ON groups through `apk perf exec`: focused test, lint, typecheck, and build. The disposable fixture row runs the same claimed `apk task verify` command in both modes; its task verification executes an external Node check.

| Workload | repetitions | wall | rewrite-sensitive APK | Git | tests | lint | typecheck | build | other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AgenticProjectKit test/lint/typecheck/build | 3 | 12.807 s (n=3, p95 12.909 s) | 0.555 s (n=3, p95 0.562 s) | 0.000 s | 0.736 s | 4.128 s | 3.993 s | 3.399 s | 0.000 s |
| Disposable task verify | 3 | 0.331 s (n=3, p95 0.332 s) | 0.248 s (n=3, p95 0.253 s) | 0.052 s | 0.000 s | 0.000 s | 0.000 s | 0.000 s | 0.030 s |

Child duration sum and child wall-clock union remain separate diagnostics. Primary command-kind attribution is disjoint, so overlapping children are not added as wall-clock percentages.

## Instrumentation overhead

OFF and ON use identical command sequences, fixtures, Node version, and environment. Parent process wall is the external overhead comparison; no absolute timing threshold is used.

| Workload | OFF parent wall | ON parent wall | delta ms | delta % |
| --- | ---: | ---: | ---: | ---: |
| short first-run group | 2.482 s | 2.477 s | -4.5 ms | -0.2% |
| short repeated-run group | 2.451 s | 2.467 s | 15.0 ms | 0.6% |
| verification-heavy | 12.682 s | 12.733 s | 50.6 ms | 0.4% |
| disposable task verify | 0.226 s | 0.228 s | 1.6 ms | 0.7% |

## Go ceilings

These are Amdahl-style mathematical scenarios for the measured rewrite-sensitive APK time. They do not claim that Go would deliver any stated factor.

| Workload | APK rewrite-sensitive share | 2x gain | 5x gain | zero-cost maximum |
| --- | ---: | ---: | ---: | ---: |
| short first-run group | 98.2% | 49.1% | 78.6% | 98.2% |
| short repeated-run group | 98.0% | 49.1% | 78.6% | 98.2% |
| verification-heavy | 4.3% | 2.2% | 3.5% | 4.4% |
| disposable task verify | 74.9% | 37.6% | 60.2% | 75.3% |

## Evidence controls and limits

- **Baseline:** this report replaces the v0.4.9 synthetic-only self baseline for v2 self measurement; v0.4.9 remains immutable historical evidence.
- **Comparability:** every OFF/ON pair uses the same fixed command list, fixture, Node version, and working directory. The ON report uses schemaVersion 2; the OFF side is independently observed by the parent because no trace is expected.
- **Process boundary:** parent spawn-to-exit is not required to equal reconstructed Node process lifetime. The two measurements are reported as different observation boundaries.
- **Repetitions:** short first-run groups use at least five runs and repeated-run groups use at least ten in the committed baseline; verification-heavy groups use three bounded runs because they execute real project tooling. Min/median/p95/max are retained in the generator payload, while the compact report shows median and p95.
- **Fixture:** the disposable task fixture proves APK orchestration, Git/provenance, and an external verification subprocess. The repository workload exercises test, lint, typecheck, and build through explicit wrappers.
- **Privacy:** the harness fixes commands in source, does not commit stdout/stderr or raw traces, and the profiler stores neither raw argv nor environment values. Temporary fixtures are removed after each run.
- **Holdout:** this self benchmark is not representative downstream evidence. Task 0215 must collect real sessions using the released v0.5.0 package before any Go decision.
- **Release policy:** noisy benchmark milliseconds are not a CI or release threshold; the benchmark is a measurement artifact and methodology check.

Go decision: pending real v0.5.0 downstream evidence. No full rewrite or prototype is authorized by this self benchmark alone.
