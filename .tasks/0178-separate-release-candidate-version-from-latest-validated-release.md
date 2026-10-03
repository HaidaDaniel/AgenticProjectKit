# Task 0178 - Separate release-candidate version from latest validated release

State: doing
Owner: codex-0178
Mode: maintenance
Lane: quality
Type: bugfix
Scope: release,docs-consistency,correctness,quality,tests,verification
Risk: high
Parallel: false
Depends on: 0168,0177
Tags: release,docs-consistency,correctness

## Goal

Make documentation consistency distinguish the current package/candidate version from the last published and validated release, so an ordinary pre-tag candidate passes without making false publication claims.

## Context files

- AGENTS.md
- package.json
- docs/scope.md
- docs/task-system.md
- docs/progress.md
- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs
- docs/engineering/documentation-maintenance.md
- docs/releases/index.md
- docs/product/maturity-and-compatibility.md
- README.md
- docs/index.md
- docs/roadmap.md
- CHANGELOG.md
- .tasks/0173-validate-the-next-public-readiness-release.md

## Files allowed to edit

- .tasks/0178-separate-release-candidate-version-from-latest-validated-release.md
- .tasks/0173-validate-the-next-public-readiness-release.md
- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs
- docs/releases/index.md
- docs/engineering/documentation-maintenance.md
- README.md
- docs/index.md
- docs/roadmap.md
- docs/progress.md
- docs/product/maturity-and-compatibility.md
- docs/scope.md
- CHANGELOG.md

## Files forbidden to edit

- .github/workflows/**
- .tasks/archive/**
- docs/releases/v*.md
- package.json
- pnpm-lock.yaml
- dist/**
- src/**

## Steps

1. Before changing the checker, reproduce its current failure for a package candidate newer than the validated release while stable documentation remains pinned to the older release. Record the exact output and distinguish this observed behavior from the root-cause explanation.
2. Store the last published and validated release in one unique, strict, machine-readable sentinel in `docs/releases/index.md`; reject missing, duplicate, or malformed sentinel state.
3. Model `packageVersion` from `package.json` separately from `validatedReleaseVersion` from that sentinel. Validate numeric `major.minor.patch` versions and reject a package version lower than the validated release.
4. Compare stable/latest-validated claims and the README stable tag pin to `validatedReleaseVersion`. Use `packageVersion` for package identity and the candidate release-note path/heading.
5. Require the current validated release note when both versions are equal. When package version is greater, require its candidate note and heading, but do not require or invent a published tag row for it.
6. Add deterministic regressions for released and candidate states, missing candidate note, validated version ahead, malformed/duplicate sentinel, stable pin during candidate state, false future-publication claim, promotion after publication, and historical-note exemption.
7. Update documentation-maintenance and release chronology guidance to explain the legal pre-tag state and the separate post-tag promotion on `main`. Update Task 0173's dependencies and release chronology while preserving every existing prerequisite, especially 0170 and 0175.
8. Commit the candidate before final verification. Run local checks, record exact-SHA hosted Quality success as externally observed `environment: ci` evidence, obtain fresh independent review, and pass the task gate before completion.

## Acceptance criteria

- `packageVersion` and `validatedReleaseVersion` have distinct deterministic canonical sources.
- The canonical validated-release source is tracked, unique, parseable, and fail-closed on malformed or duplicate state.
- A released state with equal package and validated versions passes.
- A newer pre-tag package version passes with a matching candidate note while stable claims and install pins still name the previous validated release.
- A missing/malformed candidate note, invalid or lower package version, malformed/duplicate validated sentinel, or false future-publication claim fails with an actionable diagnostic.
- Numeric SemVer checks are limited to `major.minor.patch`; no full npm SemVer parser or release database is introduced.
- Historical release notes remain exempt from current-value checks.
- Task 0173 depends on 0178 and retains all existing dependencies, including 0170 and 0175. Its contract explains pre-tag candidate state and post-tag validated-version promotion outside the immutable tag.
- Task verification includes an externally observed, required `environment: ci` hosted Quality record bound to the exact candidate SHA.

## Correctness assumptions

- `package.json.version` identifies the package being prepared and may advance before publication.
- The validated-release sentinel identifies the most recently published release that passed post-tag validation.
- Candidate documentation can know its version and changes before publication but cannot truthfully claim the candidate tag is already published or validated.

## Invariants

- Stable install guidance continues to point at the last validated release until promotion.
- Existing immutable tags and historical release evidence are not changed.
- The local documentation checker does not query GitHub, the network, or Git tags.
- Candidate freshness and hosted-CI evidence semantics are not weakened.

## Required evidence

- Pre-fix candidate-state failure output and post-fix released/candidate fixture results.
- Regression results for all acceptance cases, including historical release-note exemption.
- Exact candidate SHA and successful hosted Quality run URL or ID.
- Fresh independent review and passing completion gate.
- Read-only confirmation that annotated tag `v0.4.7` and its peeled candidate remain identical to preflight.

## Review questions

- Can a newer package candidate pass while stable release claims and install pins remain on the validated tag?
- Does malformed or duplicated canonical release state fail closed?
- Can a candidate note imply publication before its tag exists?
- Does post-tag promotion remain outside the immutable tagged candidate?

## Counterexample searches

- Package candidate below, equal to, and above the validated version.
- Missing, duplicated, malformed, and leading-zero version/sentinel values.
- Candidate note missing or with the wrong heading.
- Stable README tag on the previous validated release during candidate preparation.
- Current candidate note falsely calling itself published, available, or shipped before validation.
- Historical release notes containing intentionally stale release/version prose.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Observe the hosted Quality workflow for the exact committed candidate SHA and record its successful conclusion.","evidence":"exact candidate SHA and hosted Quality run URL or ID with success conclusion"}`
- `{"id":"tag-v047-stability","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"After committing the candidate, re-read the annotated v0.4.7 tag object and peeled commit; confirm both match their preflight values and were not moved or rewritten.","evidence":"v0.4.7 tag object SHA and peeled candidate SHA compared with preflight"}`

## Documentation updates

- Update README and current docs that make latest validated release claims so they use the canonical validated version rather than the package candidate version.
- Explain package/candidate versus validated-release semantics in `docs/engineering/documentation-maintenance.md` and release chronology in `docs/releases/index.md`.
- Update `docs/progress.md` when task state changes.

## Notes

- A third independent inspection reproduced an adjacent numeric-subject bypass without `v`, including `0.5.0 has shipped.` and its code/link forms. The expanded wrapper regression failed before making `v` optional. A wrapped-conditional regression also failed before retaining prefix whitespace across Markdown lines. All 21 documentation tests now pass; direct affirmative claims remain rejected with or without `v` in all supported wrappers.
- A second independent inspection on 2026-10-03 reproduced Markdown-wrapper bypasses: a linked candidate version in a latest-validated-tag claim and an inline-code candidate version in an availability claim passed while their bare-version equivalents failed. The new wrapper regression failed before the fix. Bounded numeric-version label unwrapping preserves original diagnostic offsets; all 20 documentation tests pass with affirmative and conditional cases across inline-code, link, and code-in-link forms.
- Independent review on 2026-10-03 reproduced three truthful-note false positives: `Once v0.5.0 is published, consumers can install its tag.`, `When the v0.5.0 release is available, use that version.`, and `The release v0.5.0 is not yet published; v0.4.7 is available now.` The new regression failed before the fix. Adjacent subject/predicate matching with bounded conditional-prefix exemption now passes the five-case regression and all 19 documentation tests; direct affirmative publication claims remain rejected.
- Post-publication validated-version promotion belongs to a separate bookkeeping change on `main`; it is not written back into the immutable tagged candidate.
- Tasks 0149/0150 remain deferred and outside this release path.
- Pre-fix candidate-state reproduction: replayed the original checker from baseline `8b21762a1feccec11db1225fd7c723889a3f4a1b` after advancing only `package.json.version` to `0.5.0` and adding a matching candidate note. The checker exited 1 with the captured output below. The first seven diagnostics show stable release claims and the install pin were coupled to the package candidate; the CLI-reference diagnostic is additional baseline drift independent of release-version selection.
  ```text
  README.md:36: validated release and note link must match package.json version 0.5.0
  docs/product/maturity-and-compatibility.md:7: latest validated release must match package.json version 0.5.0
  docs/roadmap.md:9: latest roadmap release and note link must match package.json version 0.5.0
  docs/index.md:40: documentation-home latest release and note link must match package.json version 0.5.0
  docs/releases/index.md:3: current package version and validated tag must match package.json version 0.5.0
  docs/releases/index.md:1: versioned release table is missing the package tag v0.5.0
  README.md:12: quickstart install command must be exactly: pnpm add -D agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.5.0
  docs/cli-commands.md:35: CLI reference is stale; regenerate it from src/cli/command-registry.ts
  EXIT 1
