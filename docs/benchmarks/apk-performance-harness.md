# APK performance benchmark harness

`scripts/benchmarks/perf-harness.mjs` is the deterministic, LLM-free harness for APK performance attribution. It creates a disposable initialized fixture, runs bounded cold and warm command groups, exercises an explicitly wrapped repository tool, and repeats the read-only group against AgenticProjectKit itself.

Run the verification-only fixture with:

```bash
node scripts/benchmarks/perf-harness.mjs --check
```

Generate the bounded self-dogfood report with:

```bash
node scripts/benchmarks/perf-harness.mjs
```

The report records platform metadata, repetition policy, observed tooling wall, APK internal/self time, Git, external checks, wrapped tools, APK share, and the theoretical zero-cost APK bound. It does not record raw traces. The benchmark never treats absolute milliseconds as a release threshold.

Each report carries the required evidence sections: baseline and comparability (the same schema, categories, attribution, and formulas), fixture (disposable `apk init` directory), metric (invocation union and exclusive category accounting), leakage controls (no LLM or sensitive/raw command data), holdout boundary (synthetic data is not downstream evidence), and budget (bounded repetition counts with no absolute timing gate).

The harness uses the committed `dist` CLI, so `pnpm build` must be run before a fresh benchmark. Cold and warm are labels for the first and repeated command groups under the same fixture and command semantics; they are not claims about a universal cache state. Task 0209 is responsible for real downstream agent sessions.

For every row, `child duration sum` and `child wall-clock union` remain distinct in the JSON report. A sum of overlapping children is not used as observed wall time. The profiler's deterministic unit tests separately exercise overlapping intervals and exclusive attribution.
