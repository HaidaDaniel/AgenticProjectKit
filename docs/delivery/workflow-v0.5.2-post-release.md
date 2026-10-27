# v0.5.2 post-release validation

This record was prepared after publication on 2026-10-27. It supplements the
immutable [pre-tag candidate note](../releases/v0.5.2.md). Task 0242 validated the
frozen candidate before tagging; Task 0243 records actual-tag observations and
promotes stable documentation. No post-tag fact was backfilled into the tagged note.

## Immutable identities

| Subject | Identity |
| --- | --- |
| Annotated tag | `v0.5.2` |
| Local/remote tag object | `e5b93b3e7e0c4991fb97d342b5eb31266c0c85a6` |
| Reviewed candidate / tag peel | `c4fa572ebfd38954093d9f58db0caa6f2cbba89b` |
| Candidate tree | `67409578bb68e3f5b00b926847c3052c40f33c35` |
| Tag creation time | `2026-10-27T22:07:19Z` |
| Pre-tag lifecycle closeout | `3f78a5b` |
| Installed package | `agentic-project-kit@0.5.2` |
| Validation toolchain | Node.js `22.22.1`, pnpm `10.28.1` |

The source candidate was pushed before its exact-SHA hosted checks. Its annotated
tag was created only after local checks, external observations, independent review,
gate and pre-tag task completion. Main and tag publication used an atomic push.
Local and remote objects/peels agree. v0.5.1 remains object
`b5e5e12c6cdd4d053953de8afed5749f6538652e`, peeling to
`e45760b8d68c0d5955e99b50a6ac9ca064952524`; neither tag was moved or rewritten.

## Task completion proof

All rows are `done` through APK with passing completion gates. Verification IDs
and review IDs below come from each completion record's bound evidence set.
A dash means independent review was not required by that task's effective policy;
it does not claim an implementation owner's self-review as independent assurance.

| Task | State / candidate | Canonical verification | Independent PASS |
| --- | --- | --- | --- |
| 0227 | done / `2d361d6` | `verify-1792593511602-kpar7q`; 9 bound PASS checks | `evidence-1792593835169-vvpvv7` |
| 0228 | done / `6f153fc` | `verify-1792848766606-rgs7bo`; 8 bound PASS checks | `evidence-1792911332961-488yra` |
| 0229 | done / `7764ac3` | `verify-1793082508187-i2ae8j`; 8 bound PASS checks | `evidence-1793103119816-0nrimv` |
| 0230 | done / `5af3fef` | `verify-1793137005321-2mgasb`; 7 bound PASS checks | — (policy: not required) |
| 0231 | done / `1cbfca5` | `verify-1792589593862-u6nvyk`; 7 bound PASS checks | — (policy: not required) |
| 0232 | done / `46be644` | `verify-1792848120188-6ckpvv`; 7 bound PASS checks | — (policy: not required) |
| 0233 | done / `136e0d2` | `verify-1792556650711-ucbgpc`; 8 bound PASS checks | `evidence-1792556939243-leo3xo` |
| 0234 | done / `c970fcd` | `verify-1792590133502-5vhh8d`; 7 bound PASS checks | — (policy: not required) |
| 0235 | done / `3e436f7` | `verify-1792594259899-1mj37r`; 7 bound PASS checks | — (policy: not required) |
| 0236 | done / `fad1f86` | `verify-1792739648697-keovtc`; 7 bound PASS checks | — (policy: not required) |
| 0237 | done / `bf86cca` | `verify-1792761263652-xu2jhp`; 5 bound PASS checks | `evidence-1792761427163-1xfhdv` |
| 0238 | done / `12a712b` | `verify-1792911499716-i6yzzw`; 8 bound PASS checks | `evidence-1792911669598-pvpk25` |
| 0239 | done / `0f6a308` | `verify-1792824767594-6irpk9`; 8 bound PASS checks | `evidence-1792824910132-r40epr` |
| 0240 | done / `570b8bd` | `verify-1792871236999-fx8tj4`; 8 bound PASS checks | `evidence-1792871403125-62ew6f` |
| 0241 | done / `bc4acc0` | `verify-1793137908475-cgf92b`; 8 bound PASS checks | `evidence-1793138095302-miz2qr` |
| 0242 | done / `c4fa572` | `verify-1793138239501-e3sgce`; 8 bound PASS checks | `evidence-1793138784833-uaerur` |

Task 0237 is bounded portability research, not a trusted handoff importer. Tasks
0238–0241 are additional proven fixes: unreadable discovered session directories,
long generated task goals, current attribution/identity for external verification,
and long generated fix-worker handoffs. The operator-approved 0238 and 0241
amendments used exact preview digests and append-only epochs. Task 0241's amendment
only added the canonical clean-build prefix; implementation scope did not change.
Task 0221 remains blocked historical attribution; Task 0223 remains planned.

The main changed files are `src/core/status/workers.ts`, `attention.ts` and
`index.ts`; `src/core/tasks/diagnostics.ts`, `index.ts`, `gate.ts`, `provenance.ts`,
`evidence.ts`, `review.ts` and `archive-git-safety.ts`; `src/core/work/contract.ts`,
`index.ts` and `session.ts`; `src/cli/index.ts`, `version.ts` and the CLI regression
files; and doctor/installation/init/adoption/quality diagnostics. Committed dist
matches those sources. No dependency was added or lock resolution changed.

## Pre-tag validation

Canonical `verify-1793138239501-e3sgce` ran frozen dependency installation, the full
`pnpm release:check`, committed-dist currency and `git diff --check` on the frozen
SHA. All four automated commands passed: TypeScript, ESLint, documentation
consistency, 25 docs-checker tests, 744 source tests under coverage, build, APK lint,
sync and audit. Coverage was 92.37% lines/statements, 98.42% functions and 82.88%
branches. The worktree remained clean except subsequent lifecycle-only task state.
The initial aggregate correctly remained incomplete while four external checks
awaited real observations; these were subsequently recorded as current PASS.

Hosted [Quality 40591140148](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/40591140148)
was a push run for exact `c4fa572ebfd38954093d9f58db0caa6f2cbba89b`, completed
successfully at `2026-10-27T22:00:54Z`, before tagging. It used the pinned toolchain,
frozen install, full release checks, dist guard and clean-tree guard. Independent
reviewer `codex-review-v052` separately confirmed the public API result and recorded
PASS `evidence-1793138784833-uaerur`; all eight required checks and gate passed.

The packed payload had 107 files, all three bin aliases and six portable skill
templates, excluding source and operational history. Tarball SHA-256:
`64e0f25ed65c55395f31851f6459ad42d9b8dcc644fe1f0708ebab1ec1295679`.
Packed and Git-SHA fresh-store consumers passed aliases outside Git and installed
init/sync/lint/doctor/workers/attention/status/tasks smoke. The Git lock resolved
exactly to the frozen candidate. Independent comparison found all 107 Git-installed
files byte-identical to the candidate; 106 packed files matched, with only pnpm's
manifest normalization (key order/packageManager removal). Package name/version/bin
identity remained correct.

The first packed smoke asserted a bare version string; the CLI's documented output
includes the package name. The corrected smoke passed on the unchanged candidate;
that original failed attempt remains recorded and was not treated as product failure
or passing evidence. An earlier 0229 verification had one unreproduced test failure;
unchanged-candidate reruns, its hosted CI and this final full source/coverage/hosted
run passed. No root cause is claimed for that earlier failure.

## Regression and operation counts

The final suite covers actionable-state selection/truncation, duplicate active/archive
IDs and ambiguous bindings, completed unique slots, malformed/missing/unreadable
inventories/journals, discovered-session failures, snapshot concurrency and worktree
identity, review-budget/decision boundaries, archive Git-ignore safety, compatibility,
installation diagnostics and all version aliases. Focused 0230 coverage includes
20 real CLI scenarios; 0241 adds 22 producer cases, five malformed-source refusals
and six fresh independent counterexamples. A missing review still blocks completion.

Counts are instrumented API operations, not every kernel syscall or a universal
wall-time guarantee. Instrumented and ordinary outputs were compared byte-for-byte.
The observer preserved execFile's custom promisified result. Earlier invalid probe
numbers were superseded before Task 0228 closure.

| Fixture / operation | Before | After |
| --- | ---: | ---: |
| 0228: 100 tasks, declared registry, worker task reads | 9800 | 100 |
| Same workers: evidence reads | 128 | 0 |
| Same workers: run-log reads / Git subprocesses | 33 / 546 | 0 / 0 |
| Same workers: status / gate / provenance calls | 1 / 32 / 32 | 0 / 0 / 0 |
| 0229: six tasks, status / attention task reads | 63 / 69 | 6 / 6 |
| Same diagnostics: baseline / evidence reads | 10 / 21 | 1 / 1 |
| Same diagnostics: registry / run-log physical reads | 22 / 8 | 2 / 2 |
| Same diagnostics: Git subprocesses | 53 | 39 |
| Same diagnostics: metadata API calls | 4 | 252 |

Registry/run-log physical counts represent one pass over legacy and sharded
locations. Snapshot consistency adds metadata work. Fresh invocations see new state;
there is no cross-invocation cache. The witness remains an optimistic metadata/Git
check, not a filesystem transaction or a guarantee for every filesystem/platform.

## Downstream compatibility

Before tagging, exact candidate c4fa572 and v0.5.1 ran workers, attention, compact
and detailed status, doctor, lint, tasks --all and version in disposable clones.
Ignored local evidence/session records were excluded by cloning. All instrumented
and ordinary outputs matched and clones stayed clean. After tagging, the actual
Git-tag-installed CLI repeated those eight commands against the same clones.

| Repository / exact clone HEAD | Actual-tag result | Worker task reads v0.5.1 → candidate | Detailed status task reads | Evidence reads |
| --- | --- | ---: | ---: | ---: |
| resledger / `616e92c7f5f80466490977eb180889d593111100` | All eight commands passed | 395 → 0 | 264 → 131 | 5 → 1 |
| translator-agent / `7d6ff46ded552eb53841ac78631633fd1bf65192` | All eight commands passed | 4344 → 309 | 4035 → 309 | 54 → 1 |
| llama-ops | Unavailable in local workspace; not claimed tested | — | — | — |
| context-forge / `68ece46ea1a41d030f23cf339c48e5d30ad354df` | Seven pass; pre-existing lint conflict reproduced | 2379 → 0 | 2142 → 237 | 30 → 1 |

All candidate worker evidence, run-log, Git, status, gate and provenance operations
were zero. Without a declared worker registry, task/session inventories are skipped.
Context-forge's existing Task 0232 allows a path below forbidden release/** and both
allows/forbids package.json; its lint exits 1 on both versions. This is not an APK
regression. v0.5.1 also lacks --version; only the candidate/tag CLI supports it.

Observed single-run detailed-status times (under concurrent local verification)
are not controlled benchmarks; the primary performance proof is operation counts.

- resledger: ordinary CLI 750 → 826 ms.
- translator-agent: ordinary CLI 4144 → 965 ms.
- context-forge: ordinary CLI 2165 → 660 ms.

## Actual-tag cold install

After publication, a new consumer and fresh store installed exactly:

```bash
pnpm add -D agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.5.2
```

The run started at `2026-10-27T22:08:06.339Z` and completed at `2026-10-27T22:08:15.442Z`. The consumer explicitly pinned pnpm10.28.1 and asserted Node22.22.1; it was outside
Git with its own 0.0.0 manifest. The Git lock resolved the published tag to exact
c4fa572. Installed APK metadata was 0.5.2; apk, apkit and agentic-project-kit all
printed `agentic-project-kit 0.5.2`, and help and six portable skills were present.
A disposable Git project passed init, sync --write, check-only sync, lint, doctor,
workers, attention, status detail, tasks --all and version.

## Disposable self-adoption

The actual-tag-installed CLI ran against an isolated detached c4fa572 checkout.
Adopt --preview left it clean. Adopt --apply, sync, lint, doctor, workers, attention,
status detail and version passed. Source, package metadata, lockfile and dist stayed
unchanged. Only a disposable adoption task and docs/adoption-report.md appeared in
ordinary Git status; the generated project map was ignored. No files or operational
trust records were imported into main or a production downstream repository.

## Limits and retained work

The checked release environment is Node22.22.1, pnpm10.28.1 and the Ubuntu hosted
runner/local Linux environment. End-to-end macOS/Windows, other runtime versions,
other filesystems and SSH-host installations are not claimed verified. llama-ops
was unavailable locally. Context-forge's existing contract needs its own downstream
correction. Ignored baseline/evidence/agent/session state remains local; portable
handoff and historical provenance recovery are research/separate work, not trusted
imports supplied by this patch. Implementation done still does not imply production
deployment. Task0221 remains blocked; unrelated Task0223 remains planned.

Raw session artifacts include /tmp/apk-v052-{canonical-verification,release-command-output}.log,
/tmp/apk-v052-hosted-quality.json, /tmp/apk-v052-task-proof.json, packed/Git-SHA/tag
consumer report directories, /tmp/apk-v052-pretag-downstream-audit/report.json,
/tmp/apk-v052-post-tag-downstream-report.json and the independent review reports.
These local paths supplement the committed identities/results; they are not promised
as permanent downloadable evidence. Canonical local journals retain the bound IDs.
