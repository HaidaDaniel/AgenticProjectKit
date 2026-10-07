# APK performance benchmark harness

`scripts/benchmarks/perf-harness.mjs` is the deterministic, LLM-free v2 harness for APK performance attribution. It creates a disposable initialized fixture with a real claimed task-verification check, pairs profiling OFF and ON, measures parent spawn-to-exit independently, exercises short APK commands, and runs verification-heavy test/lint/typecheck/build commands against AgenticProjectKit itself.

Run the verification-only fixture with:

```bash
node scripts/benchmarks/perf-harness.mjs --check
```

Generate the bounded self-dogfood report with:

```bash
node scripts/benchmarks/perf-harness.mjs
```

The committed v2 report is [`apk-performance-v050-self-baseline.md`](apk-performance-v050-self-baseline.md). It records platform metadata, first/repeated repetition policy, parent process wall, Node-observed full-process lifetime, startup residual, instrumented APK internal time, disjoint command-kind attribution, OFF/ON delta, rewrite-sensitive APK share, and finite Amdahl scenarios. It does not record raw traces. The benchmark never treats absolute milliseconds as a release threshold.

Each report carries the required evidence sections: baseline and comparability (the same schema, categories, attribution, and formulas), fixture (disposable `apk init` directory), metric (invocation union and exclusive category accounting), leakage controls (no LLM or sensitive/raw command data), holdout boundary (synthetic data is not downstream evidence), and budget (bounded repetition counts with no absolute timing gate).

The harness uses the committed `dist` CLI, so `pnpm build` must be run before a fresh benchmark. First-run and repeated-run are labels for identical command groups in separate sessions; they are not claims about a universal cache state. The v0.4.9 report remains historical; Task 0215 is responsible for real downstream agent sessions using released v0.5.0.

For every row, `child duration sum` and `child wall-clock union` remain distinct in the profiler JSON. A sum of overlapping children is not used as observed wall time. Primary command-kind attribution uses the same disjoint interval model, and the profiler's deterministic unit tests separately exercise overlapping intervals and exclusive attribution.
