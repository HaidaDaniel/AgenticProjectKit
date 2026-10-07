# APK performance self-dogfood baseline

Generated: 2026-10-07T16:22:28.751Z
Environment: linux/x64, Node v24.21.0

This bounded development baseline uses the released-in-tree profiler on a disposable initialized fixture and on AgenticProjectKit itself. It is evidence for attribution, not a universal performance claim and not an absolute release gate. Cold means the first command group after session start; warm repeats the same command group with the same semantics. The fixture and repository commands are LLM-free.

Coverage: LLM generation and idle/unobserved gaps are excluded; arbitrary commands not wrapped by `apk perf exec` remain unknown; raw local traces are not committed.

| Workload | Observed wall | APK self | Git | external checks | wrapped tools | APK % | theoretical max gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixture-cold | 0.086 s | 0.066 s | 0.020 s | 0.000 s | 0.000 s | 76.4% | 76.4% |
| fixture-warm | 0.217 s | 0.168 s | 0.049 s | 0.000 s | 0.000 s | 77.5% | 77.5% |
| fixture-wrapped-tool | 0.064 s | 0.003 s | 0.000 s | 0.000 s | 0.061 s | 5.1% | 5.1% |
| self-cold | 0.343 s | 0.336 s | 0.008 s | 0.000 s | 0.000 s | 97.7% | 97.7% |
| self-warm | 1.040 s | 1.017 s | 0.023 s | 0.000 s | 0.000 s | 97.8% | 97.8% |

## Contract evidence

- **Baseline:** this report is the current AgenticProjectKit self-dogfood baseline produced by the committed `dist` CLI; raw JSONL traces remain local and ignored.
- **Comparability:** fixture cold, fixture warm, wrapped-tool, self cold, and self warm rows use the same schemaVersion 1 profiler, category mapping, exclusive attribution, and report formulas. Only root directory and repetition phase differ.
- **Fixture:** a disposable directory is initialized with `apk init`; its read-only status/task-list/doctor commands and one explicit wrapped test process are the controlled workload.
- **Metric:** observed tooling wall is the union of invocation intervals; APK self, Git, external checks, and wrapped tools are reported as exclusive categories. Child sum and child union are both retained.
- **Leakage control:** no LLM, prompts, responses, environment values, secrets, raw argv, stdout/stderr, or file contents enter the report; commands are fixed in this script and arbitrary unwrapped work remains unknown.
- **Holdout:** this synthetic fixture is not a holdout for real agent workflows. No product or Go decision is made from it; Task 0209 supplies the downstream holdout evidence.
- **Budget:** each check run uses one repetition; the committed baseline uses cold=1 and warm=3 with five bounded workloads and no absolute millisecond acceptance threshold.

## Method and interpretation

Each row is one profiler session. APK subprocess intervals are attributed exclusively, while `child duration sum` and `child wall-clock union` are retained separately so parallel work cannot be presented as wall time. The deterministic harness checks the invariant that union is no greater than duration sum; the profiler unit suite covers overlapping intervals directly.

The fixture uses `apk init`, status/task listing/doctor commands, and explicit `apk perf exec --category test` for a short non-APK process. The self rows use read-only help/status/task-list/doctor/lint commands. No task lifecycle mutation or external agent session is inferred from this synthetic run.

No Go speed claim is made from this fixture. The data is a self-dogfood baseline for instrumentation and attribution; Task 0209 must collect real downstream workflows before a runtime decision.

