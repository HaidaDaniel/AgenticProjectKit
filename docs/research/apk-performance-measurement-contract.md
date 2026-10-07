# APK performance measurement contract

Status: accepted for implementation by Tasks 0206–0209.

This document defines what APK performance observability may claim. It is a
local measurement contract, not a promise that a future runtime rewrite will
produce a particular speedup.

## Decision in one paragraph

APK may record opt-in, local observations of software activity that occurs
inside an APK invocation or through the explicit `apk perf exec` wrapper. The
profiler uses a monotonic clock and bounded append-only JSONL records. It
excludes LLM generation, model/API wait, reasoning, user think time, and idle
gaps because APK cannot observe those activities. Reports use interval union
and an exclusive attribution view for percentages; they never add parallel
child durations as wall-clock time. Trace data is operational runtime data,
not task evidence, provenance, candidate input, package payload, or generated
instruction content.

## Scope and non-goals

The feature answers two bounded questions:

1. How much observed tooling wall-clock time is spent in APK, Git, external
   project checks launched by APK, and explicitly wrapped repository tools?
2. Given the observed APK internal/self share, what is the mathematical
   maximum and what would hypothetical 25%, 50%, 75%, 2x, 3x, and 5x APK-only
   improvements change at the observed tooling boundary?

It does not measure or infer:

- LLM inference or generation, API/model wait, reasoning, or token time;
- user think time, terminal idle time, or arbitrary gaps between commands;
- direct shell commands that are not launched by APK or `apk perf exec`;
- peak RSS when only a point-in-time process sample exists;
- a universal end-to-end agent-session percentage when coverage is partial;
- a Go speedup, a migration benefit, or a product recommendation without
  comparable evidence.

When activity is outside the observable boundary, the report says
`unobserved` or `excluded`; it is not estimated or subtracted heuristically.

## Observable timing model

Every measured interval has a start and end from an injectable monotonic clock.
The production clock is `process.hrtime.bigint()` or an equivalent monotonic
source. Wall-clock timestamps may identify when a session was created or help a
human correlate a run, but they never calculate duration.

The implementation primitives are intentionally small:

- `PerfSession`: opt-in session identity, label, bounded state, and local
  append destination;
- `PerfInvocation`: one APK process boundary and its child intervals;
- `PerfSpan`: an internal or nested interval with a category and safe metadata;
- `PerfSubprocessSpan`: a child process interval with category, command kind,
  normalized identity when useful, exit status, and no raw arguments.

An invocation records its elapsed process interval relative to its own
monotonic origin. Interval endpoints are serialized in a lossless JSON-safe
form (decimal strings or an equivalent representation); derived millisecond
values are presentation data. A record is finalized once, after in-memory
span collection, rather than synchronously writing every micro-span.

### Required categories

The category vocabulary is closed for the first schema version:

| Category | Meaning |
| --- | --- |
| `apk-process` | Complete observed APK invocation interval. |
| `apk-internal` | APK work not covered by a child subprocess interval. |
| `apk-bootstrap` | Only exact, instrumented startup/CLI initialization boundaries; unknown portions remain unlabelled. |
| `task-config` | Task/config/evidence/baseline/log/generated-instruction parsing. |
| `filesystem` | Directory walking, scanning, hashing, template loading, and other meaningful filesystem work. |
| `git` | Any Git subprocess launched by APK or explicitly wrapped as Git. |
| `external-check` | APK-launched lint, typecheck, tests, coverage, build, package-manager, or project verification subprocesses. |
| `external-other` | A subprocess that cannot be classified honestly. |
| `repo-tool` | A direct repository command intentionally included with `apk perf exec`. |

`apk-internal` is a derived residual, not an additional elapsed interval to
sum with every nested internal span. Internal spans explain the residual and
must not double-count one another.

Subprocess classification uses a safe `commandKind` such as `git`, `test`,
`lint`, `typecheck`, `coverage`, `build`, `package-manager`, or `repo-tool`.
Raw argv, environment values, stdout, stderr, prompts, responses, file
contents, tokens, and secrets are never trace fields. If executable identity
is needed, it is normalized to a safe basename/kind and must not preserve
arguments or shell text.

## Concurrency and attribution

For child intervals `C` in an invocation:

- `child duration sum` is the sum of each child duration and is diagnostic
  only;
- `child wall-clock union` is the duration of the union of all child
  intervals;
- APK internal/self is the invocation interval minus the child union;
- category unions are calculated from intervals, never from sums of parallel
  children.

The report explicitly labels these two child values. Parallel checks therefore
cannot turn a one-second wall interval into two seconds of claimed wall time.

The session's observed tooling wall is the union of root observable intervals.
Nested child intervals remain nested and are attributed within the parent
rather than added as a second copy of the same wall interval. Where multiple
root invocations overlap, the report creates a deterministic, disjoint primary
attribution view by sweeping interval boundaries and assigning each slice to
the most specific observed category; ties use stable invocation order. The
report may additionally show non-additive diagnostic unions, but percentages
and the primary breakdown use the disjoint view and are bounded by observed
tooling wall.

`apk perf exec --category <kind> -- <command...>` is the honest visibility
boundary for arbitrary repository commands. The wrapper records the direct
child as `repo-tool` or the requested specific category. Normal APK workflows
do not require the wrapper, and APK cannot claim to see commands an agent runs
directly outside it.

## Session and trace representation

The first schema version is append-friendly JSONL in the canonical ignored
runtime location `.agentic/perf/`. A session may contain a small bounded state
file while active and one finalized record per invocation/wrapped command.
There is no daemon, database, telemetry server, network upload, or LLM call.

Every record contains at least:

```json
{
  "schemaVersion": 1,
  "recordType": "invocation",
  "sessionId": "opaque-local-id",
  "invocationId": "opaque-local-id",
  "commandKind": "task.verify",
  "interval": {"startNs": "...", "endNs": "..."},
  "durationMs": 7400,
  "spans": [
    {"category": "git", "commandKind": "git", "interval": {"startNs": "...", "endNs": "..."}},
    {"category": "external-check", "commandKind": "test", "interval": {"startNs": "...", "endNs": "..."}}
  ]
}
```

The exact field names may evolve only with an explicit schema version. Session
labels are bounded user-provided labels and must be treated as display text,
not as a place for secrets. Session metadata may include APK version, Node
version, platform, and a coarse environment description needed to compare
benchmarks, but not environment values or machine paths.

Writes are bounded by record count/size policy and use append/finalization
semantics. A crash can leave an incomplete line or an active session marker.
Readers skip malformed/incomplete records, report a concise corruption or
incomplete-coverage warning, and never make ordinary APK commands fail. The
profiler itself must fail open for normal workflow behavior: inability to
record a trace is diagnostic, not a task/provenance failure.

## CLI contract

The bounded user-facing surface is:

```text
apk perf start --label <label>
apk perf status
apk perf stop
apk perf report
apk perf report --json
apk perf exec --category <repo-tool|test|lint|build|git> -- <command...>
```

While a session is active, APK invocations record automatically. `start`
prints this coverage statement:

```text
APK invocations are recorded automatically.
Use `apk perf exec -- ...` for non-APK repository commands you want included.
LLM generation and idle/unobserved gaps are not measured.
```

Starting an already active session, stopping an absent session, malformed
categories, missing `--`, and malformed trace input have deterministic,
actionable behavior. `report --json` is machine-readable and carries the same
coverage and exclusion semantics as the human report.

The human report must include:

- session label and invocation/wrapped-tool counts;
- observed tooling wall;
- APK process total and APK internal/self;
- Git, APK-launched external checks, and explicitly wrapped repository tools;
- child duration sum versus child wall-clock union where children exist;
- category breakdown and meaningful min/median/p95/max statistics;
- cold/warm labels only when the harness supplied those observations;
- observed-command count and an explicit unwrapped/unknown warning;
- `LLM generation: excluded` and `idle/unobserved gaps: excluded`;
- APK share of observed tooling wall, with the word `observed` in the claim;
- theoretical zero-cost bound and hypothetical Amdahl scenarios.

## Amdahl-style analysis

Let `T` be observed tooling wall and `A` be the disjoint APK internal/self
share. If APK internal time became zero instantaneously:

```text
maximum improvement = A / T
maximum speedup = T / (T - A)
```

The report must also calculate the new wall estimate for APK internal time
scaled by 75%, 50%, 25%, 1/2, 1/3, and 1/5 of its observed value. These are
hypothetical scenarios, not claims about Go. A zero/non-positive denominator
is handled explicitly rather than producing Infinity/NaN. Rounding is applied
only after calculation and the unrounded JSON values remain bounded and
finite.

## Secondary metrics

Wall-clock attribution is primary. Where the platform and boundary make it
honest, the implementation may sample:

- process RSS at an explicitly named observation point;
- heap used at an explicitly named observation point;
- cold/warm startup observations from the controlled harness;
- installed package/runtime footprint.

A snapshot is named `RSS sample`, never `peak RSS`. Cross-platform peak
measurement is out of scope for the first version. Linux-only external
measurement may appear in benchmark evidence when its platform and method
are stated separately.

## Coverage and privacy guarantees

Each report must distinguish:

```text
Observed commands: <count>
Unwrapped external commands: unknown
LLM generation: excluded
Idle/unobserved gaps: excluded
```

The report may say “APK internal time was 4% of observed tooling wall time.” It
must not say “APK consumed 4% of the entire agent session” unless the entire
session is independently observed, which this feature does not attempt.

Trace artifacts are local operational data. They are excluded from task
provenance, evidence, candidate hashing, sync-managed generated files, npm
payload, release tarballs, and Git by the ignore contract. Profiling is off by
default and has no required workflow step.

## Verification and benchmark methodology

Implementation tests use an injectable fake monotonic clock; no sleep-based
assertion is allowed. Minimum deterministic coverage:

- disabled profiling produces no trace;
- start/status/stop lifecycle and automatic one/multiple invocation records;
- malformed/incomplete record recovery;
- nested spans, subprocess category attribution, Git attribution, and
  `perf exec` argument boundary;
- concurrent interval union, no double counting, and child sum versus union;
- human/JSON report schema, coverage wording, privacy redaction, ignored
  storage, provenance/hash non-contamination, and normal task compatibility;
- finite zero-cost, 2x, 3x, and 5x Amdahl calculations.

The deterministic harness is LLM-free and uses disposable fixtures. It covers
safe cold/light APK commands, repository-analysis commands, a bounded task
workflow where mutation semantics permit it, and a verification-heavy path.
Cold and warm groups use multiple repetitions (target five cold and ten to
twenty warm when affordable) and report median, p95, range, and environment
metadata. Profiling OFF versus ON is reported as instrumentation overhead;
no noisy absolute CI millisecond threshold gates release.

The AgenticProjectKit baseline is development evidence, not a universal
conclusion. Downstream decision work requires real agent sessions after the
profiler release, APK self-dogfood, and at least one non-Node repository when
available. Synthetic evidence alone cannot justify a Go migration.

## Decision guidance after measurement

These thresholds guide investigation and are not automatic product policy:

| Observed APK internal share | Interpretation |
| --- | --- |
| `<5%` | A zero-cost APK gives at most about 5% tooling improvement; do not rewrite for workflow speed. |
| `5–15%` | Optimize scans, parsing, Git calls, process spawning, and orchestration before considering a rewrite. |
| `>15%` | A bounded Go hotspot investigation may be reasonable if reproduced across repositories and short workflows. |
| `>20% consistently` | Create a separate measured prototype task, not a full rewrite. |

Runtime/distribution reasons (static binary, no Node/pnpm requirement, startup,
RSS, packaging) are evaluated separately from end-to-end agent wall-clock.

## Known first-version gaps

The first implementation must list any execution paths that do not use the
central subprocess boundary. Direct agent shell commands remain invisible
unless wrapped. Startup attribution is exact only inside the instrumented
boundary; process time before that boundary is not relabelled as measured
bootstrap. Platform-specific RSS peak and full-session coverage remain
unclaimed.
