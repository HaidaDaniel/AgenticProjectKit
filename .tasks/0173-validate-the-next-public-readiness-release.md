# Task 0173 - Validate the next public-readiness release

State: doing
Owner: codex-public-readiness-20261007
Mode: production
Lane: release
Type: release
Scope: release,public-readiness,distribution,verification
Risk: high
Parallel: false
Depends on: 0145,0146,0147,0148,0151,0152,0153,0154,0155,0156,0157,0158,0159,0160,0161,0162,0163,0164,0165,0166,0167,0168,0169,0170,0171,0172,0175,0178,0179
Tags: release

## Goal

Validate the next public-readiness release

## Context files

- AGENTS.md
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- docs/product/maturity-and-compatibility.md (future output of prerequisite Task 0152)
- docs/engineering/testing-strategy.md
- docs/engineering/apk-upgrade-workflow.md
- LICENSE
- docs/research/non-node-apk-installation-and-distribution.md
- .github/workflows/quality.yml
- .tasks/0145-preserve-multiline-task-list-items-across-parse-render-round-trips.md
- .tasks/0146-make-benchmark-evidence-a-satisfiable-first-class-verification-contract.md
- .tasks/0147-make-manual-verification-artifacts-satisfiable-and-internally-coherent.md
- .tasks/0148-resolve-active-task-baseline-attribution-for-legitimate-intervening-commits.md
- .tasks/0178-separate-release-candidate-version-from-latest-validated-release.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- README.md
- CONTRIBUTING.md
- SECURITY.md
- CHANGELOG.md
- docs/**
- .github/**
- dist/**
- .tasks/0203-avoid-archived-task-id-collisions-during-adoption.md
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts

## Files forbidden to edit

- LICENSE
- .tasks/archive/**

## Steps

1. Resolve the free next SemVer target and confirm existing tags are immutable; never move or rewrite a published tag. Treat `packageVersion` as the package/candidate and `validatedReleaseVersion` as the last published release that passed post-tag validation.
2. Prepare the candidate release note and any required current documentation truthfully. PRE-TAG, `packageVersion` may be newer than `validatedReleaseVersion`; stable install guidance and latest-validated claims remain on the previous release, with no claim that the candidate tag is already published.
3. Freeze the exact candidate SHA/tree from a clean checkout and observe every declared PRE-TAG criterion against that exact SHA, including quality/coverage/build/release checks, committed dist currency, APK lint/sync/doctor/audit, package/bin/asset payload, installed-candidate self-adoption in a disposable copy of the frozen APK tree (preview, apply, diff inspection, and diagnostics), declared compatibility or downstream smoke, and exact-SHA hosted CI.
4. Create the annotated tag only after all PRE-TAG criteria pass, pointing to the validated candidate SHA, and verify the peeled commit equals that SHA.
5. Run POST-TAG checks separately: actual immutable-tag cold install, tag-peel verification, released package/bin identity, downstream install from the tag, and post-release self-adoption. Treat the release-note file inside the tag as pre-tag-only and store post-tag observations in a separate artifact.
6. After successful POST-TAG validation, promote `validatedReleaseVersion` to the published version on `main`. If changing the sentinel/stable docs inside this release task would stale or invalidate candidate-bound evidence/gate proof, create and execute a separate, bounded post-release bookkeeping task after publication. That task must not alter the tag or tagged candidate, and the repository must not remain indefinitely with package ahead of a release that already passed post-tag validation.

## Acceptance criteria

- The next SemVer target is free and all existing tags remain untouched.
- PRE-TAG documentation may show `packageVersion` ahead of `validatedReleaseVersion`, while stable install guidance and latest-validated claims continue to identify the prior published release.
- Every criterion claimed as PRE-TAG evidence actually ran against the exact frozen candidate SHA from a clean checkout before tag creation, including exact-SHA hosted CI.
- Package payload inspection confirms metadata, canonical and compatibility bins, license, templates, and portable assets are present and internally consistent.
- Before tagging, the installed candidate passes self-adoption preview/apply and diagnostics in a disposable copy of the frozen APK tree; working main is not automatically adopted. This smoke does not substitute for actual-tag post-release installation and self-adoption.
- The release is valid under the current AgenticProjectKit product identity and does not require or imply naming/rebrand work; Tasks 0149 and 0150 are not direct or transitive prerequisites.
- The annotated tag peels to the validated candidate SHA and is never moved or rewritten afterward.
- POST-TAG evidence (actual-tag cold install, tag peel, released package/bin identity, downstream install, self-adoption) is recorded separately after publication.
- After successful POST-TAG validation, `validatedReleaseVersion` is promoted on `main` in a separate bookkeeping change if needed; the change is kept outside the immutable tagged candidate and its commit is recorded.
- The release-note file committed inside the tag contains only pre-tag-knowable facts and is never backfilled with post-tag identity or results.
- No candidate mutation occurs after final evidence; a changed candidate forces a new freeze, rerun, and CI.

## Correctness assumptions

- Release evidence must identify the exact immutable candidate SHA/tree.
- Some release checks can only execute after publication and must be recorded as post-tag evidence.
- A release-note file committed inside the tag cannot contain its own commit SHA or the later tag/CI/install identity.

## Invariants

- Pre-tag and post-tag evidence are temporally distinct and never conflated.
- Candidate package identity and last post-tag-validated release remain separate until promotion.
- A published tag is immutable; the tagged artifact and recorded evidence refer to the same candidate tree.
- Tagged release notes contain only facts knowable before tagging.

## Required evidence

- Pre-tag criteria observed against the frozen candidate SHA, exact-SHA hosted CI, annotated tag peel to that SHA, a distinct post-tag cold-install/released-consumer record, and the post-tag validated-version promotion or its completed bounded follow-up task.

## Review questions

- Did every criterion claimed as pre-tag actually run against the exact candidate SHA before tag publication?
- Is post-tag evidence kept separate and never presented as pre-tag?
- Was the published tag left unmoved and the tagged release notes kept free of fabricated future facts?

## Counterexample searches

- Search a release whose downstream or compatibility smoke ran after publication but was claimed pre-tag, a placeholder validation inside the tagged notes, a moved tag, and post-tag install facts written into the immutable tagged file.
- Search a changed candidate that reuses earlier freeze/CI evidence, a tag created on HEAD without an exact-SHA CI pass, and a missing or stale committed dist/asset.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"check-5","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"check-6","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"check-7","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"check-8","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"check-9","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"check-10","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"check-11","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm pack --dry-run"}`
- `{"id":"check-12","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Record the hosted clean-checkout quality workflow result for the exact frozen candidate SHA before tag creation; confirm checkout SHA, green status, and that the candidate tree did not change.","evidence":"hosted CI run URL/status and exact candidate SHA"}`
- `{"id":"check-13","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"After the immutable annotated tag exists, verify it peels to the frozen candidate SHA, install that exact tag in a fresh consumer with a fresh package store, inspect package metadata, license, bins, and portable assets, and run representative downstream adoption smoke; record separately from tagged release notes.","evidence":"post-tag artifact with tag object, peeled SHA, package identity, and cold-install/adoption transcript"}`
- `{"id":"check-14","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-15","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"candidate-self-adoption","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Before tagging, install the exact frozen candidate package in a fresh consumer; run preview and apply in a disposable APK copy, inspect diff, then sync, lint, doctor and status. Preserve working main. Record exact SHA and transcript separately from actual-tag post-release checks.","evidence":"candidate SHA, package identity, preview/diff and diagnostics transcript"}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Treat pre-tag evidence as the gate for tag creation and post-tag evidence as a separate record; never fabricate future facts inside an immutable commit.
- Tasks 0149 and 0150 are optional deferred product-identity work and are outside this release's dependency path. Any future naming/rebrand investigation requires a new explicit human decision before activation and remains a separate optional milestone.
- block: Task 0170 is an explicit prerequisite and remains blocked until GitHub PVR is enabled and verified by an external non-maintainer. Independent technical/package/install checks are being performed separately; they cannot substitute for the security dependency or exact pre-tag/post-tag release chronology. No release/tag is being created while the prerequisite is unmet.
- block: Operator selected GitHub PVR, but Task 0170 remains blocked until the official route is enabled and externally verified. Existing explicit dependency prevents release/tag completion. Technical package/bin/assets, downstream Go adoption, materialization/no-op and exact-candidate self-adoption passed at 040440f; development-package smoke does not claim publication or post-tag validation.
- block: Required candidate self-adoption fails after apply: generated .tasks/0196-document-adopted-repository.md collides with existing archived Task 0196, so exact-candidate lint reports duplicate-task-id. Source correction and regression verification required before release validation can continue.
- note: Completed Task 0203 corrected adoption task-ID allocation. Its exact source, committed dist output, and lifecycle contract remain carried-forward candidate paths so this release task can validate the corrected frozen tree without rewriting prior provenance.
