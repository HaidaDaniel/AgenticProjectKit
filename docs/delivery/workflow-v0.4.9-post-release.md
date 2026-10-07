# v0.4.9 post-release tag validation

This record was written after publication on `main`. It is separate from the immutable
`v0.4.9` release note and does not modify the tagged candidate.

## Immutable release identity

- Annotated tag object: `455a2ab38d2f818155145382433b5b59d9046c91`.
- Tag `v0.4.9` peels to candidate commit `719c0ef55134b49987248976b732739bee749327` and
  tree `9ebbb42309b621540802a8676e2a8806ca36b485`.
- Exact-SHA GitHub Actions Quality run
  [37655737267](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/37655737267)
  completed successfully for `719c0ef` before tag creation.
- The tag and tagged release note remain unchanged after validation.

## Actual-tag cold install

- A fresh consumer with a fresh pnpm store installed `github:HaidaDaniel/AgenticProjectKit#v0.4.9`
  using pnpm `10.28.1`.
- Installed metadata reported `agentic-project-kit@0.4.9`; `apkit`, `apk`, and
  `agentic-project-kit` all resolved to `dist/cli/index.js`.
- The installed payload contained `dist/cli/index.js` and `dist/core/perf/index.js`; no local
  `.agentic` runtime data was present in the package payload.

## Installed profiler smoke

From the installed tag CLI in a disposable initialized fixture:

```text
apk perf start --label released-smoke
apk status
apk perf exec --category test -- node -e "setTimeout(() => {}, 5)"
apk perf stop
apk perf report
apk perf report --json
```

The JSON report had `schemaVersion: 1`, 3 APK invocations, 1 wrapped tool, observed tooling
wall `82.7 ms`, APK internal/self `32.4 ms`, and explicit exclusions for LLM generation and
idle/unobserved gaps. The fixture's `.agentic/perf/trace.jsonl` was ignored by Git. The report
was machine-readable and the normal human report rendered successfully.

## Disposable downstream smoke

- The installed tag CLI ran `apk init` in a disposable fixture, followed by `git init`,
  `apk status`, and the profiler lifecycle above.
- The smoke did not modify this repository, the tag, or the tagged release note.
- This is a released-package usability confirmation, not evidence about arbitrary downstream
  project performance or a Go migration decision.

## Temporal boundary

The candidate note contains only pre-tag-known scope and compatibility facts. This file contains
post-tag identity, hosted CI, cold-install, package, profiler, and downstream observations; it is
intentionally stored separately on `main`.
