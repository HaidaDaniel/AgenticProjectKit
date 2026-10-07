# APK performance downstream decision report

## Scope and evidence boundary

This report uses the released `v0.4.9` CLI and `schemaVersion: 1` profiler from the immutable
tag. It is evidence from disposable local clones, not a universal benchmark or a claim about
LLM time. LLM generation, model/API waiting, reasoning, user think time, idle gaps, and arbitrary
unwrapped commands are excluded. No downstream repository was modified.

Available downstream repositories were checked on 2026-10-07:

- `AgenticProjectKit`: available and measured from a disposable self clone.
- `resledger`: available, Go application with an APK pin to `v0.4.6`; measured from disposable
  clones with the released `v0.4.9` CLI.
- `translator-agent`: available, Python application with an APK pin to `v0.4.7`; the bounded
  `python -m pytest -q` command exited immediately with status 1 and produced no test output,
  so it is retained as a failed setup/coverage observation, not a valid external-workload timing
  result.
- `llama-ops`: not available in the current environment.

The valid non-Node holdout is the `resledger` Go test workflow. The APK self and translator rows
are short-command context, not evidence that all real agent sessions have the same ratio.

## Method

Every measured row used the same released profiler, category semantics, exclusive attribution,
monotonic timing, and Amdahl formulas. APK commands were recorded automatically after
`apk perf start`; direct project commands were included only through
`apk perf exec --category ... -- ...`. Each result came from a fresh disposable clone/session.

The controlled APK self workflow ran `status`, `doctor`, `lint --json`, and a Git wrapper. The
`resledger` workflow ran APK status/doctor and a wrapped `go test ./...` in separate fresh
sessions. The translator workflow ran status and a wrapped pytest command. No raw JSONL traces,
stdout, prompts, responses, environment values, secrets, or file contents are committed.

## Measurements

| Repository/workload | Observed tooling wall | APK internal/self | Git | external checks | wrapped repo tools | APK % | theoretical max gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AgenticProjectKit self, lightweight commands | 357.6 ms | 342.7 ms | 14.9 ms | 0.0 ms | 0.0 ms | 95.8% | 95.8% |
| resledger, status/doctor | 131.7 ms | 109.8 ms | 21.8 ms | 0.0 ms | 0.0 ms | 83.5% | 83.5% |
| resledger, `go test ./...` | 43.762 s | 3.1 ms | 0.0 ms | 0.0 ms | 43.758 s | 0.007% | 0.007% |
| translator-agent, status + failed pytest setup | 5.8 ms | 3.4 ms | 0.0 ms | 0.0 ms | 2.4 ms | 58.8% | 58.8% |

The self and status/doctor rows are short APK-heavy command latency observations. The valid
verification-heavy Go row shows the opposite boundary: project test execution dominates and an
infinitely fast APK would not materially change end-to-end workflow wall time.

## Required evidence controls

- **Baseline:** released `v0.4.9` tag, candidate `719c0ef`, and post-release record
  `docs/delivery/workflow-v0.4.9-post-release.md`.
- **Comparability:** all rows use the same profiler schema, interval accounting, categories,
  report formulas, and explicit wrapper policy; only repository/workload differs.
- **Fixture:** disposable Git clones preserve each source repository; no source downstream
  checkout was changed.
- **Metric:** observed tooling wall is measured software activity only; subprocess duration sum is
  never substituted for subprocess wall-clock union.
- **Leakage:** no LLM timing, prompts, responses, secrets, raw argv, full output, or file contents
  enter the committed report.
- **Holdout:** `resledger` is the non-Node holdout. The unavailable `llama-ops` repository and
  failed translator test setup are not silently imputed.
- **Budget:** one bounded session per valid workload, with a separate fresh session for the
  43.762-second Go test. No noisy absolute-millisecond threshold gates a release.

## Node versus Go decision

### End-to-end agent workflow speed

Do not start a full Go rewrite for workflow speed. The valid non-Node verification-heavy result
measured APK internal time at `0.007%` of observed tooling wall. Its theoretical zero-cost APK
bound is also `0.007%`; a 2x or 5x APK speedup would be smaller still. The self-clone's `95.8%`
ratio is a short-command latency result with no external test/build workload and cannot override
the downstream holdout.

No conditional Go prototype is justified by the current valid downstream evidence: the `>15%`
guidance is not reproduced across a real verification-heavy workflow, and the `>20%` consistent
threshold is not met.

### Runtime and distribution case

This report does not measure binary size, cold-install dependency footprint, peak RSS, or a Go
prototype. Go could still be investigated for a single static binary, reduced Node/pnpm
installation requirements, startup, or runtime-memory reasons. Those are independent of the
end-to-end workflow-speed conclusion and require a separate bounded prototype with equivalent
inputs and semantic output before any migration decision.

## Observability gap found during dogfood

Existing downstream repositories pinned to older APK releases did not all have the new
`.agentic/perf/*` ignore rule. In those clones, the released profiler's local
`.agentic/perf/session.json` and `trace.jsonl` appeared as untracked files and were surfaced by
`apk status` as scope inputs while a session was active. New `v0.4.9` initialization includes the
canonical ignore rule, but upgrade compatibility for older adopted repositories needs a bounded
follow-up before broad profiler dogfood. This report does not count that artifact visibility as
agent workflow time or hide it from the decision.

## Conclusion

The evidence supports two separate conclusions: APK self overhead can dominate short commands,
but it is negligible beside a real Go verification workload; and Go remains an optional
distribution/runtime-footprint investigation, not a justified full rewrite for agent wall-clock
speed. The next engineering action is to close the legacy ignore compatibility gap, then collect
more real sessions if a broader migration decision is needed.
