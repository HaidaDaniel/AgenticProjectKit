# Corrective performance-observability plan for v0.5.0

Status: approved operator-directed corrective milestone.

## Historical boundary

The `v0.4.9` annotated tag remains immutable historical release 1 of the opt-in
profiler. Its package, tag object, release note, candidate, and post-release
evidence are not being rewritten or reclassified as a corrupted release. The
tag introduced working local tracing with `schemaVersion: 1`.

The v0.4.9 measurement surface is insufficient for a runtime-rewrite decision:

- the in-process boundary does not observe the full Node process/startup cost;
- the self harness is not a sufficient verification-heavy workload;
- profiler OFF-versus-ON overhead was not measured as a paired benchmark;
- external tooling attribution is too coarse for a final Go decision.

Therefore the v0.4.9 downstream report is preliminary historical evidence only.
It must not be used as the final Node-versus-Go verdict.

## Current repository state

The local and remote tag checks performed for this milestone found no `v0.5.0`
tag. The current validated release remains `v0.4.9`, package version `0.4.9`,
and the v0.4.9 release documentation remains unchanged.

The operator snapshot described Task 0209 as todo, but the repository already
contained its completed and archived lifecycle before this corrective plan was
started. That completed history is preserved byte-for-byte. A new successor
task is used for the final v0.5.0 downstream decision instead of rewriting the
archived contract or its evidence.

## Corrective dependency graph

```text
0210 legacy storage/session hardening (done)
             ↓
0211 this corrective plan (doing)
             ↓
0212 full-process and schema-v2 attribution
             ↓
0213 OFF/ON and verification-heavy benchmark harness
             ↓
0214 release corrected observability as v0.5.0
             ↓
0215 final downstream Node-vs-Go evidence using released v0.5.0
```

Task 0212 owns the measurement semantics and runtime implementation. It must
make startup residual, instrumented APK internals, rewrite-sensitive time,
command-kind attribution, v1 compatibility, concurrency, and privacy explicit.
Task 0213 owns paired profiler-overhead measurements, parent-observed process
timing, repeated short commands, and real verification-heavy test/lint/
typecheck/build attribution. Task 0214 owns the exact-candidate release and
post-tag validation. Task 0215 is the successor to the historical 0209
decision and cannot use v0.4.9 as its final profiler input.

## v0.5.0 measurement generation

New traces use `schemaVersion: 2` because the meaning of the rewrite-sensitive
metrics changes. v0.5.0 should read valid v1 traces where practical, but must
mark startup/full-process data unavailable for v1 and must not fabricate a
rewrite ceiling from fields v1 never observed.

The v2 report must retain a disjoint primary attribution model. Its runtime
rewrite-sensitive numerator includes the observed startup residual plus
instrumented APK internal time, while Git, external checks, and wrapped tools
remain separately visible. Command-kind slices use the same exclusive sweep as
the category breakdown so overlapping test/lint/build children do not exceed
observed wall time.

The benchmark report must distinguish first/repeated groups honestly, report
repetition statistics, compare identical OFF and ON workloads, and disclose
that LLM generation, idle gaps, and arbitrary unwrapped commands are excluded.
No absolute noisy millisecond value becomes a release gate.

## Decision boundary

No full Go rewrite is authorized by this plan. Self-benchmark results can expose
candidate hotspots but cannot be a universal downstream conclusion. The final
workflow-speed, short-command startup, runtime/memory, and distribution cases
remain separate questions for Task 0215. A bounded Go hotspot prototype is
created only if representative v0.5.0 evidence meets the existing guidance;
otherwise the correct outcome is an evidence-backed no-go for a speed rewrite,
with any distribution rationale recorded independently.
