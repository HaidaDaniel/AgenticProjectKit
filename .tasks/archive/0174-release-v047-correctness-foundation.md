# Task 0174 - Release v0.4.7 correctness foundation

State: done
Owner: codex-0174
Mode: production
Lane: release
Type: release
Scope: release,correctness,verification,provenance
Risk: high
Parallel: false
Depends on: 0145,0146,0147,0148
Tags: release,correctness,patch,v047

## Goal

Publish an immutable, installable v0.4.7 patch release for the completed correctness foundation from Tasks 0145-0148. Keep AgenticProjectKit as the product identity and keep unfinished public-readiness work out of the release.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- .tasks/0144-release-v046-with-communication-and-grill-ux-corrections.md
- .tasks/0145-preserve-multiline-task-list-items-across-parse-render-round-trips.md
- .tasks/0146-make-benchmark-evidence-a-satisfiable-first-class-verification-contract.md
- .tasks/0147-make-manual-verification-artifacts-satisfiable-and-internally-coherent.md
- .tasks/0148-resolve-active-task-baseline-attribution-for-legitimate-intervening-commits.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- README.md
- docs/releases/v0.4.7.md
- docs/delivery/workflow-v0.4.7-self-dogfood.md
- docs/progress.md
- docs/audit-report.md
- dist/**
- .tasks/0174-release-v047-correctness-foundation.md

## Files forbidden to edit

- src/**
- .github/**
- docs/releases/v0.4.0.md
- docs/releases/v0.4.1.md
- docs/releases/v0.4.2.md
- docs/releases/v0.4.4.md
- docs/releases/v0.4.5.md
- docs/releases/v0.4.6.md
- .tasks/archive/**

## Steps

1. Recheck local and remote tags, current package version, and completed prerequisite Tasks 0145-0148; stop if `v0.4.7` is already occupied or the actual version is not `0.4.6`.
2. Bump `package.json` from `0.4.6` to `0.4.7` with the repository's canonical version primitive and keep `pnpm-lock.yaml` consistent without changing dependency versions.
3. Write `docs/releases/v0.4.7.md` with the 0145 parser integrity, 0146 typed benchmark evidence, 0147 manual artifact/reference semantics, and 0148 provenance-backed Git-lineage attribution; include compatibility and upgrade notes plus only pre-tag-known validation claims.
4. Update stable-install/current-release references in README and the minimal current progress entry. Do not create a release index before Task 0171 establishes its strategy, and never rewrite historical release notes.
5. Build and commit current `dist/**`; inspect the package payload for `apkit`, `apk`, and `agentic-project-kit`, LICENSE, and required portable assets. Do not edit source or pull implementation work from Tasks 0151-0173 into this patch.
6. Commit the release candidate, freeze its exact SHA/tree, and run every PRE-TAG check against that exact candidate, including the declared local checks and package/version/release-note inspection.
7. Push that candidate to `main` and wait for successful hosted Quality on its exact SHA. Any candidate change makes prior candidate checks and CI stale and requires a new freeze and rerun.
8. Only after the exact-SHA CI and all PRE-TAG checks pass, create annotated tag `v0.4.7`, then verify the tag object and peeled commit. Never move, delete, replace, or force-update a published tag.
9. Install from the actual immutable tag in a fresh consumer with a fresh pnpm store and no build-script allowlist; invoke `apkit --help` and compatibility aliases and perform the declared downstream brownfield smoke.
10. Record POST-TAG results only in `docs/delivery/workflow-v0.4.7-self-dogfood.md`, then record release evidence, pass the APK gate, mark the task done, and commit lifecycle bookkeeping separately.

## Acceptance criteria

- The next SemVer target is free and all existing tags remain untouched.
- `package.json` identifies version `0.4.7`; `pnpm-lock.yaml` remains valid for the manifest and dependency versions are unchanged (pnpm v9 does not store a root package-version field); CLI bin names are unchanged.
- The release note describes only Tasks 0145-0148 and committed supporting fixes already on the candidate; it does not claim unfinished public-readiness work or a product rebrand.
- Current release references in README and progress identify v0.4.7 without changing historical release notes or creating a premature release index.
- The package payload contains `apkit`, `apk`, and `agentic-project-kit`, LICENSE, committed current `dist`, and required portable assets.
- Every criterion claimed as PRE-TAG evidence actually ran against the exact frozen candidate SHA before tag creation, including exact-SHA hosted CI.
- The annotated tag peels to the validated candidate SHA and is never moved or rewritten afterward.
- POST-TAG evidence (actual-tag cold install, tag peel, released package/bin identity, downstream install, self-adoption) is recorded separately after publication.
- The release-note file committed inside the tag contains only pre-tag-knowable facts and is never backfilled with post-tag identity or results.
- Tasks 0149 and 0150 remain blocked/deferred, and no implementation from unfinished Tasks 0151-0173 is intentionally included.
- No candidate mutation occurs after final evidence; a changed candidate forces a new freeze, rerun, and CI.

## Correctness assumptions

- Release evidence must identify the exact immutable candidate SHA/tree.
- Some release checks can only execute after publication and must be recorded as post-tag evidence.
- A release-note file committed inside the tag cannot contain its own commit SHA or the later tag/CI/install identity.
- The current project name remains AgenticProjectKit; `apkit` and the compatibility aliases retain their existing package entrypoint.

## Invariants

- Pre-tag and post-tag evidence are temporally distinct and never conflated.
- A published tag is immutable; the tagged artifact and recorded evidence refer to the same candidate tree.
- Tagged release notes contain only facts knowable before tagging.
- The release contains the completed correctness foundation but no unfinished public-readiness implementation.

## Required evidence

- Pre-tag criteria observed against the frozen candidate SHA/tree, package/version inspection, exact-SHA hosted CI, annotated tag peel to that SHA, and a distinct post-tag cold-install/released-consumer record.

## Review questions

- Did every criterion claimed as pre-tag actually run against the exact candidate SHA before tag publication?
- Is post-tag evidence kept separate and never presented as pre-tag?
- Was the published tag left unmoved and the tagged release notes kept free of fabricated future facts?

## Counterexample searches

- Search a release whose downstream or compatibility smoke ran after publication but was claimed pre-tag, a placeholder validation inside the tagged notes, a moved tag, and post-tag install facts written into the immutable tagged file.
- Search a changed candidate that reuses earlier freeze/CI evidence, a tag created on HEAD without an exact-SHA CI pass, and a missing or stale committed dist/asset.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"full-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"docs/releases/v0.4.7.md"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"apk-sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk sync"}`
- `{"id":"apk-audit","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm exec apk audit","artifact":"docs/audit-report.md"}`
- `{"id":"apk-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk doctor"}`
- `{"id":"package-payload","type":"automated","required":true,"environment":"local","profile":"report","command":"npm pack --dry-run --json"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"pretag-hosted-ci","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Before tag creation, observe GitHub Actions Quality completed successfully for the exact frozen release candidate SHA. Record the candidate SHA, run id and URL, conclusion, and start/completion times; a local run or CI for another SHA does not satisfy this check.","evidence":"exact-SHA GitHub Actions Quality run URL and observed run identity"}`
- `{"id":"pretag-release-validation","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Before tag creation, verify the exact frozen candidate SHA and tree, version and lockfile consistency, release notes, npm package payload and all bins/license/assets, exact-SHA hosted Quality success, candidate immutability, and annotated tag availability. Record observed URLs, IDs, times, and results.","evidence":"candidate SHA/tree, package inspection result, exact-SHA CI URL/run, and pre-tag validation result"}`
- `{"id":"posttag-release-validation","type":"manual","required":true,"environment":"local","profile":"report","instruction":"After publication, verify annotated tag peel; install actual #v0.4.7 in a fresh consumer with a fresh pnpm store and no build-script allowlist; verify package version, bins, LICENSE, and assets; invoke apkit --help and compatibility aliases; run a disposable downstream brownfield adoption, lint, sync, audit, status, and basic task parsing/verification workflow. Record all post-tag facts only in docs/delivery/workflow-v0.4.7-self-dogfood.md.","evidence":"actual-tag cold-install and downstream smoke report artifact"}`

## Documentation updates

- Update README.md stable-install/current-release references, docs/releases/v0.4.7.md, docs/progress.md, and docs/delivery/workflow-v0.4.7-self-dogfood.md.
- Do not create docs/releases/index.md until Task 0171 establishes its policy; do not alter historical release notes.

## Notes

- Treat pre-tag evidence as the gate for tag creation and post-tag evidence as a separate record; never fabricate future facts inside an immutable commit.
- Tasks 0149 and 0150 remain deferred and blocked; Task 0170 remains blocked absent a verified, operator-confirmed private vulnerability reporting route.
- The release must not wait for or absorb the documentation/product changes in Tasks 0151-0173.
