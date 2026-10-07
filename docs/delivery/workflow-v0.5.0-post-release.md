# v0.5.0 post-release tag validation

This record was written after publication on `main`. It is separate from the immutable
`v0.5.0` release note and does not modify the tagged candidate or the historical `v0.4.9`
release.

## Immutable release identity

- Annotated tag object: `9992ca013d71c8fdd1c2bd845d622200cec98db6`.
- Tag `v0.5.0` peels to candidate commit `5a9e1a150a0715900942e60f47ae215b6fec07f8`.
- The candidate tree is `55bfa0507ec2e629c2afe58936dc43b493c6cc8c`.
- Exact-SHA GitHub Actions Quality run
  [37667916448](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/37667916448)
  completed successfully for the exact candidate SHA before tag creation.
- The remote tag object and peeled commit match the local immutable tag; `v0.4.9` was not
  moved, deleted, or rewritten.

## Actual-tag cold install

- A fresh consumer with a fresh pnpm store installed
  `github:HaidaDaniel/AgenticProjectKit#v0.5.0` using pnpm `10.28.1`.
- Installed metadata reported `agentic-project-kit@0.5.0`; `apkit`, `apk`, and
  `agentic-project-kit` all resolved to the packaged `dist/cli/index.js` entrypoint.
- The packaged/released payload contained `dist/core/perf/index.js` and no `.agentic/perf/`
  trace artifact.

## Installed v2 profiler smoke

From the installed actual tag CLI in a disposable initialized Git fixture:

```bash
apk perf start --label v050-smoke
apk status
apk perf exec --category test -- node -e "process.exit(0)"
apk perf stop
apk perf report
apk perf report --json
```

The JSON report had `schemaVersion: 2`, `fullProcessAvailable: true`, a non-null startup
residual and rewrite-sensitive metric, finite Amdahl scenarios, and command-kind attribution
including `test`. The observed smoke included startup residual `324.931777 ms` and
rewrite-sensitive APK time `354.426104 ms`. The local `.agentic/perf/trace.jsonl` was ignored
by Git and remained outside the package payload.

## Installed v1 compatibility smoke

A bounded schemaVersion 1 fixture was written into the disposable consumer after stopping a
separate local session, then read by the installed v0.5.0 CLI:

- report schema remained `2`, with `traceSchemaVersions: [1]`;
- `fullProcessAvailable` was `false`;
- startup residual and rewrite-sensitive metrics were `null`;
- Amdahl scenarios were empty;
- the report carried the explicit schemaVersion 1 limitation warning.

No full-process or Go rewrite ceiling was fabricated for legacy data.

## Benchmark and disposable downstream smoke

- The committed v2 self baseline records short first/repeated groups, OFF/ON parent-wall
  overhead, verification-heavy test/lint/typecheck/build attribution, child sum versus union,
  and finite Amdahl scenarios. It remains self evidence, not a downstream Go verdict.
- The actual-tag consumer served as a disposable downstream smoke fixture. No downstream
  repository was rewritten and no LLM generation or idle gap was measured.

## Temporal boundary

The candidate note contains only pre-tag-known scope and compatibility facts. This file contains
post-tag identity, hosted CI, cold-install, package, profiler, compatibility, benchmark, and
disposable-consumer observations; it is intentionally stored separately on `main`.
