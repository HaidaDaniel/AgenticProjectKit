# APK performance measurement contract v2

Status: implementation contract for Tasks 0212–0215.

## Why the schema changes

`v0.4.9` introduced a useful opt-in profiler, but its `schemaVersion: 1`
invocation boundary begins after Node has loaded the CLI modules. A runtime
rewrite decision needs the observed Node process/startup residual as well as
the instrumented command interval. v2 therefore changes the machine-readable
trace/report meaning instead of silently reinterpreting v1 fields.

The v0.4.9 tag remains immutable. v0.5.0 writes v2 records and reads valid v1
records where possible. A v1 report explicitly sets full-process, startup, and
rewrite-sensitive metrics to `null`, marks the limitation in `warnings`, and
does not calculate an invented Amdahl ceiling.

## Boundaries and fields

Each v2 invocation contains two monotonic intervals:

- `interval`: the instrumented `runWithPerfInvocation` boundary;
- `fullProcessInterval`: a reconstructed Node process-start boundary through
  the same process exit/finalization point.

The second boundary is reconstructed from `process.hrtime.bigint()` minus
`process.uptime()` at module initialization. It is not called `spawn-to-exit`:
the independent benchmark parent owns that exact external boundary. The
benchmark compares parent-observed spawn-to-exit with Node-observed lifetime
without requiring bit-exact equality.

The v2 report exposes:

```text
apkFullProcessUnionMs       full-process union, or null for v1-only data
apkInstrumentedUnionMs      union of instrumented invocation roots
apkStartupResidualMs        full process minus instrumented root, or null
apkInternalInstrumentedMs   APK residual after subprocess union
apkRewriteSensitiveMs       startup residual plus APK internal, or null
```

`apkProcessTotalMs` and `apkInternalMs` are not v2 report fields because their
v1 names imply a boundary they did not observe. The report also includes
`traceSchemaVersions`, `fullProcessAvailable`, full-process statistics, and
explicit `commandKindMs`.

## Disjoint attribution

The primary category and command-kind maps use one deterministic interval
sweep. A slice is assigned to one winner by stable priority and ID. The
command-kind vocabulary includes `apk-startup`, `apk-internal`, `git`,
`test`, `lint`, `typecheck`, `coverage`, `build`, `package-manager`,
`repo-tool`, and `external-other` as applicable. Parallel children retain both
`childDurationSumMs` and `childWallClockUnionMs`, but neither sum is substituted
for observed wall time. Primary command-kind values are disjoint and bounded by
the observed wall union.

The rewrite-sensitive numerator is the disjoint startup residual plus
instrumented APK internal attribution. Amdahl scenarios for 25%, 50%, 75%,
2x, 3x, 5x, and infinite runtime improvements are emitted only when the full
v2 boundary is available. All values remain finite; zero/empty denominators
produce no fabricated percentage or speedup.

## Coverage and privacy

The profiler remains opt-in, local, bounded, daemon-free, database-free,
network-free, and off by default. LLM generation, API wait, reasoning, idle
gaps, and arbitrary unwrapped commands remain excluded or unknown. No raw argv,
environment values, stdout/stderr, prompts, responses, file contents, tokens,
or secrets are stored. Runtime traces stay under `.agentic/perf/`, including a
local Git exclude fallback for legacy downstream checkouts. Malformed data is
ignored with a warning and never blocks ordinary APK work.

## Execution-path coverage

The v2 inventory checked the central boundaries used by task verification,
provenance/Git, doctor, quality, audit, sync, scanners, init, context/docs,
workspaces, and agent/resource helpers. Those paths use the shared
`observedExec`/`observedExecFile` wrappers where APK launches subprocesses;
`apk perf exec` is the explicit `spawn` boundary for direct repository tools.
Any direct `child_process` path outside those wrappers remains an explicit
coverage gap and is not claimed as observed. This inventory is a bounded
coverage statement, not a claim that arbitrary agent shell commands are visible.
