# APK performance self-dogfood baseline

Generated: 2026-10-07T16:20:49.580Z
Environment: linux/x64, Node v24.21.0

This bounded development baseline uses the released-in-tree profiler on a disposable initialized fixture and on AgenticProjectKit itself. It is evidence for attribution, not a universal performance claim and not an absolute release gate. Cold means the first command group after session start; warm repeats the same command group with the same semantics. The fixture and repository commands are LLM-free.

Coverage: LLM generation and idle/unobserved gaps are excluded; arbitrary commands not wrapped by `apk perf exec` remain unknown; raw local traces are not committed.

| Workload | Observed wall | APK self | Git | external checks | wrapped tools | APK % | theoretical max gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixture-cold | 0.079 s | 0.062 s | 0.017 s | 0.000 s | 0.000 s | 78.5% | 78.5% |
| fixture-warm | 0.212 s | 0.165 s | 0.047 s | 0.000 s | 0.000 s | 77.7% | 77.7% |
| fixture-wrapped-tool | 0.063 s | 0.003 s | 0.000 s | 0.000 s | 0.060 s | 5.2% | 5.2% |
| self-cold | 0.337 s | 0.330 s | 0.007 s | 0.000 s | 0.000 s | 97.8% | 97.8% |
| self-warm | 1.058 s | 1.035 s | 0.023 s | 0.000 s | 0.000 s | 97.8% | 97.8% |

## Method and interpretation

Each row is one profiler session. APK subprocess intervals are attributed exclusively, while `child duration sum` and `child wall-clock union` are retained separately so parallel work cannot be presented as wall time. The deterministic harness checks the invariant that union is no greater than duration sum; the profiler unit suite covers overlapping intervals directly.

The fixture uses `apk init`, status/task listing/doctor commands, and explicit `apk perf exec --category test` for a short non-APK process. The self rows use read-only help/status/task-list/doctor/lint commands. No task lifecycle mutation or external agent session is inferred from this synthetic run.

No Go speed claim is made from this fixture. The data is a self-dogfood baseline for instrumentation and attribution; Task 0209 must collect real downstream workflows before a runtime decision.

