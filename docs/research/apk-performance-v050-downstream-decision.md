# APK v0.5.0 downstream performance decision

Status: completed downstream evidence for Task 0215

This report uses the installed `v0.5.0` package from the immutable tag, not a
source-tree CLI and not the historical `v0.4.9` profiler. Each measurement ran
in a disposable clone; the source downstream checkouts were not modified.

## Coverage and boundaries

- Available representatives: AgenticProjectKit, resledger, and translator-agent.
- `llama-ops` was not available in the environment and is reported as unavailable,
  not imputed.
- AgenticProjectKit was measured at tag peel
  `5a9e1a150a0715900942e60f47ae215b6fec07f8`.
- resledger was inspected at `06d6d59ef4cfdd6f229dfd2ab619c8d7e83789ba`.
- translator-agent was inspected at `9ba4bf79fcd892dd6d0e0d68e1289e7076de82f7`.
- The downstream repositories still declare older APK pins where applicable;
  those manifests were not changed. The profiler used for every row was the
  separately installed GitHub `github:HaidaDaniel/AgenticProjectKit#v0.5.0`
  package, version `0.5.0`, using a fresh pnpm store.
- APK status/tasks/doctor and Git activity were included where they ran. Direct
  repository checks were wrapped with `apk perf exec`. In resledger, `apk
  tasks` and `apk doctor` failed because its task file has an invalid empty
  section; those setup failures are disclosed and do not invalidate the
  successful Go checks or get replaced by synthetic timings.
- LLM generation, model/API waits, user think time, idle gaps, and arbitrary
  unwrapped commands are excluded. The report warning remains
  `Unwrapped external commands: unknown`.
- RSS values below are process snapshots, not peak RSS.

## Measurements

Durations are observed wall-clock milliseconds from schema v2 reports. `APK
rewrite-sensitive` is startup residual plus instrumented APK internal time; it
is the numerator used for the runtime-rewrite scenarios. The `2x`, `5x`, and
`max` columns are Amdahl-style scenarios, not claims about what Go will achieve.

| Repository | Observed tooling | APK rewrite-sensitive | APK share | Startup residual | Git | Tests | Lint | Typecheck | Build | 2x gain | 5x gain | Zero-cost max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AgenticProjectKit | 13,143.0 ms | 915.1 ms | 7.0% | 813.6 ms | 9.3 ms | 882.5 ms | 4,020.9 ms | 3,979.1 ms | 3,336.2 ms | 3.5% | 5.6% | 7.0% |
| resledger | 49,327.3 ms | 1,048.2 ms | 2.1% | 925.4 ms | 21.6 ms | 40,727.0 ms | 1,246.6 ms | 4,385.3 ms | 1,898.6 ms | 1.1% | 1.7% | 2.1% |
| translator-agent* | 138,105.1 ms | 967.1 ms | 0.7% | 850.0 ms | 8.3 ms | 136,745.9 ms | 137.0 ms | 246.8 ms | unavailable | 0.2% | 0.3% | 0.4% |

`translator-agent*` combines two released-profiler sessions because its test
run was intentionally stopped after recording a real failure, then lint and
compile checks were run in a second session. Its test command completed with
868 passed, 6 skipped, and 2 failures: both failures were
`ModuleNotFoundError: No module named 'scripts'` in the terminal-UI performance
tests. Lint and compile checks passed. No documented local build command was
available, so build is unavailable rather than zero.

The primary command-kind attributions are disjoint. No child-duration sum was
used as wall-clock, and no parallel child was double-counted. The reported
downstream runs had no external parallel overlap; schema v2 still records both
child duration sum and child wall-clock union.

### Short-command and memory observations

AgenticProjectKit's separate v0.5.0 self baseline measured repeated short
commands at approximately 0.445 s median full Node process time, with 0.327 s
startup residual. That is useful evidence for short-command latency, but it is
not a universal cross-machine benchmark.

Downstream v0.5.0 RSS snapshots ranged approximately from 66–76 MiB across the
three sessions. These are comparable observations on this host, not peak-RSS
claims; no Go binary was built, so there is no runtime-footprint comparison.

## Decision

### Workflow-speed case

The verification-heavy AgenticProjectKit and resledger workflows are dominated
by repository tooling. Their theoretical zero-cost APK ceilings are 7.0% and
2.1%, respectively; resledger's Go test alone accounts for about 40.7 s of its
49.3 s observed wall. The translator-agent test run likewise dominates its
combined observation, while its APK share is below 1%.

These released measurements do not justify a full APK rewrite to Go for general
agent workflow speed. The first optimization targets should be the observed
repository checks and, for short commands, local startup/module-loading work.
The heavy verification workflows remain below the prototype guidance. The
short-command evidence is different: the AgenticProjectKit short baseline and
the translator-agent lint/typecheck session are startup-heavy and exceed 20%
rewrite-sensitive share. That repeated fast-path signal justifies a separate
bounded hotspot prototype, not a rewrite.

### Startup / short-command case

Startup is material for short commands: the AgenticProjectKit self baseline saw
about 0.327 s startup residual in a roughly 0.445 s median full process. This
supports investigating targeted startup/module-loading improvements. It does
not prove that a Go rewrite would deliver a specific multiple, because no Go
prototype with identical inputs and semantic output was built.

### Runtime, memory, and distribution case

The runtime-language case is separate from end-to-end workflow speed. A Go
implementation could still be investigated for a standalone binary, avoiding a
Node/pnpm runtime dependency, or different memory/startup characteristics. The
current evidence contains only Node RSS snapshots and no Go artifact, so it
does not establish a memory or packaging win. Task 0125's non-Node installation
research remains relevant background, not new prototype evidence.

### Go outcome

No full rewrite is started. The evidence-based workflow-speed decision is
negative for the heavy representative workflows, while the repeated fast-path
signal meets the bounded-prototype guidance. Task 0216,
`Prototype the measured APK startup hotspot in Go`, was created but not started.
It must compare one selected startup/import hotspot with matched inputs and
semantic output before any migration architecture is considered. Distribution
and runtime-footprint motivations remain separate from the workflow-speed case.

## Reproduction shape

The released CLI sequence used in each disposable repository was:

```bash
apk perf start --label <repo>-v050
apk status
apk tasks
apk doctor
apk perf exec --category test -- <project test command>
apk perf exec --category lint -- <project lint command>
apk perf exec --category typecheck -- <project typecheck command>
apk perf exec --category build -- <project build command>
apk perf stop
apk perf report --json
```

Unavailable or failed project commands were retained as such in the evidence;
they were never replaced with synthetic timings. The two historical
`v0.4.9`/0209 measurements remain preliminary context and are not used for this
decision.
