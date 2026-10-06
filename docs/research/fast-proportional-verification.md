# Fast proportional verification

Date: 2026-10-06
Task: 0193
Status: implemented policy and pipeline changes; measurements recorded below

## Evidence before changes

Read-only observations from APK evidence and Codex command/session logs on this development host:

| Operation | Observed duration |
| --- | --- |
| Typecheck or ESLint | Usually 4-14 seconds each |
| Build | 3-5 seconds |
| Source suite, 569 tests | 189.3 seconds |
| CLI suite alone, 148 tests | 173.3 seconds |
| Canonical verify for Task 0191 | 471, 502, 489 seconds |
| Task 0189, four canonical verifies | 30.7 minutes total |
| Task 0189, four independent reviews | 43.9 minutes total |

These are historical wall times, not controlled hardware benchmarks. The host had four CPUs,
multiple concurrent project runtimes, load around 5-6, and about 3.6 GiB occupied swap. That can
affect measurements, but does not explain away the confirmed repeated command graph.

`quality` executed tests and `test:coverage` executed them again. Implementers sometimes ran full
tests before canonical verify; reviewers repeated them afterward. CI invoked quality, coverage,
build, then release:check (which repeated those), totaling four source suites. CLI tests created
hundreds of processes that each loaded the TypeScript source graph. Successful test output also
expanded review context without adding new proof. Reviews found real behavior defects, so merely
removing review or lowering assurance would not address the problem safely.

## Primary sources and conclusions

- [Node.js 22.22.1 test runner](https://nodejs.org/download/release/v22.22.1/docs/api/test.html#test-runner-execution-model) documents process isolation and file-level concurrency. Concurrency is not a substitute for eliminating repeated process startup; keep resource use bounded and preserve test isolation.
- [c8 source-map support](https://github.com/bcoe/c8#source-map-support) supports coverage remapping from generated JavaScript to original TypeScript. The compiled integration CLI must have maps, capture V8 source-map data, and filter coverage after remapping; otherwise ignored temporary JavaScript can disappear from measurement.
- [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) explains the cost of broad integration/end-to-end tests and the value of focused tests. Apply the smallest check that proves the changed behavior while retaining the final boundary's declared guarantees.
- [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) permits cancellation of superseded runs in a group. Cancel only older runs for the same branch/PR; preserve independent branches and never interpret cancellation as success.

The decision is one non-overlapping full verification set per candidate and boundary. Local
feedback, independent semantic review, hosted clean-checkout CI, and frozen release proof remain
distinct; a local pass never manufactures hosted proof or evidence for a different candidate.

## Applied changes

1. `quality:static` runs typecheck, lint, documentation tests and consistency; `quality:ci` adds
   source coverage once. `release:check` adds one build plus built-CLI lint, sync and audit. CI calls
   that aggregate once, retains SHA/currency/drift guards and cancels superseded branch/PR runs.
2. CLI tests compile current source once into a unique ignored workspace, copy template assets,
   and execute that fresh CLI. Direct source-versus-shipped help/init and asset parity remain.
   Source maps, enabled subprocess map capture, and c8 `--exclude-after-remap` preserve coverage
   after temporary output cleanup. A focused CLI-only coverage probe covered `src/cli/index.ts`
   (which the test's imports do not execute), proving subprocess remapping works.
3. Compact source-test output retains failures, errors, diagnostics, captured output and totals.
4. Neutral generated policy, implementation/review prompts, init/adopt task guides, and packaged
   author/split assets require focused feedback, one canonical final verification, and current
   trusted evidence reuse with targeted review counterexamples. Missing/stale/failed proof still
   requires verification. The active 0191 contract uses static quality plus covered source tests
   instead of running the same suite through quality and coverage.
5. Docs templates default to APK contract lint instead of unrelated full application tests.
   Authors add applicable host links/content/examples. All templates explain adaptation of
   command examples through `--verification-json`, avoiding overlapping aggregates while keeping
   required domain, hosted-CI, package-currency, and independent-review evidence.
6. Migration, async-worker, provider-integration and security templates formerly ran the same
   `pnpm test` separately for regression and report checks. They now declare one required
   automated report check; authors adapt its command to run relevant tests and produce the
   declared artifact. Behavioral criteria, report category and artifact remain required.

## Verification and measurements

Focused regressions cover single-pass script composition, compact failure reporting, exported
policy, docs-task creation, init/adopt guides, review guidance and CLI parity. Full candidate-bound
coverage, compiler/lint/docs checks, contract lint, package currency, diff validation, independent
review and the completion gate are required by the task. Exact full-run results are recorded in
the task evidence; the completion handoff reports measured final verification time.

## Limits and follow-up

- Existing customized downstream docs are preserved by init/adopt; consumers must explicitly
  upgrade their APK pin and sync generated policy. Existing task contracts are not silently
  rewritten. Legacy/default code-task commands remain examples, not host-tool detection.
- Required release/domain evidence is not dropped. If a suite is required explicitly by a host
  contract, it still runs; authors should remove overlap before execution rather than expecting
  APK to understand arbitrary shell composition.
- Verification remains sequential for arbitrary commands because they may share mutable build,
  coverage, report or database output. A generic parallel verifier or persistent evidence cache
  would need separately proven isolation and candidate/environment/command identity.
- Splitting more CLI assertions into core unit tests may improve feedback further, but deleting
  integration coverage or aggressive parallelism is not needed for this fix.
- Hosted timing cannot be claimed from a local run. No publication or change to another
  repository is included in this task.
