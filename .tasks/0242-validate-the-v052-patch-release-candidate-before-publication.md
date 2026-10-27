# Task 0242 - Validate the v0.5.2 patch release candidate before publication

State: doing
Owner: codex-release-v052
Mode: production
Lane: release
Type: release
Scope: release,packaging,regression,verification
Risk: high
Parallel: false
Depends on: 0227,0228,0229,0230,0231,0232,0233,0234,0235,0236,0237,0238,0239,0240,0241
Tags: release

## Goal

Prepare and independently validate a frozen v0.5.2 patch candidate for publication, including exact-SHA hosted CI, full local release checks, installed-package smoke, downstream compatibility and regression evidence. Publication and actual-tag validation follow this pre-tag task.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/releases/index.md
- docs/releases/v0.5.1.md
- docs/product/maturity-and-compatibility.md
- package.json
- pnpm-lock.yaml
- .github/workflows/quality.yml
- .tasks/0241-bound-generated-worker-handoff-summaries-after-review.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- dist/**
- CHANGELOG.md
- docs/releases/v0.5.2.md
- docs/releases/index.md
- docs/progress.md

## Files forbidden to edit

- src/**
- scripts/**
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/v0.5.1.md
- docs/delivery/**

## Steps

1. Confirm integrated main, completed corrective dependencies, available next SemVer target, unchanged v0.5.1 tag object and peel, and absence of unrelated dirty state.
2. Prepare version 0.5.2, lockfile if needed, pre-tag-only release notes, candidate index/changelog entry and committed dist. Keep the validated-release sentinel and stable install guidance on v0.5.1.
3. Freeze and commit the complete candidate. Run frozen dependency installation and the full canonical release check once, then confirm committed dist and clean Git state.
4. Audit status/status detail/attention/workers/doctor/lint/tasks/version on representative large backlogs, invalid/incomplete inputs, duplicate bindings, review decisions and concurrent snapshots, using existing instrumented regressions and disposable consumers. Record exact operation counts and platform/availability limits.
5. Inspect packed payload and cold install the exact pushed candidate commit with a fresh store outside Git; validate three aliases, version, portable assets and representative init/lint/sync.
6. Observe hosted Quality success for the exact frozen candidate SHA. Current local checks cannot substitute for hosted CI.
7. Record actual manual evidence, obtain fresh independent review, pass gate and close this pre-tag task. Do not create a release tag until all pre-tag conditions pass.
8. Under the existing user authorization, publication may then create the immutable annotated v0.5.2 tag on this exact reviewed source candidate. Actual published-tag installation and stable-document promotion belong to a subsequent bounded task and separate artifact.

## Acceptance criteria

- Mandatory corrective dependencies are done through APK, and historical blocked Task 0221 is not artificially certified.
- Version 0.5.2 is prepared on integrated main with current committed dist and no added dependencies.
- Local frozen install, release check including full tests/coverage/static/docs/APK checks, dist currency and diff check pass for the frozen candidate.
- Hosted GitHub Actions Quality passes for the exact candidate SHA before tagging.
- Packed payload and cold Git-SHA install demonstrate installed version, all aliases, assets and consumer smoke outside Git.
- Regression and downstream evidence names exact source/consumer SHAs, command outcomes, operation counts and honest unavailable/pre-existing failures.
- Review examines complete candidate and current trusted evidence; gate passes before task completion.
- Tagged candidate notes contain only pre-tag-knowable facts, and the previous validated release remains the stable marker until actual-tag validation.
- v0.5.1 retains its original annotated object and peeled commit.
- This task requires no post-tag evidence before its pre-tag gate; publication and post-tag validation remain explicitly ordered subsequent actions.

## Correctness assumptions

- The user already authorized publication conditionally on successful release requirements.
- Ignored local evidence/session state is not portable to disposable downstream clones; clone checks make that limitation explicit.
- Actual-tag validation can only occur after publication and cannot be backfilled into tagged notes.

## Invariants

- No moving tags, rewriting evidence-bound commits or inventing review/operator approval.
- No source fixes in this release-preparation task; proven regressions require a separately scoped task.
- Never substitute older/local CI for the exact hosted candidate result.
- Do not modify production downstream repositories.

## Required evidence

- Current canonical local results, exact-SHA hosted Quality, actual package/Git-SHA installation and downstream/regression report.
- Fresh independent review of the frozen candidate and complete evidence.

## Review questions

- Are all pre-tag claims actually observed against the frozen candidate?
- Are exact identities, unavailable consumers and pre-existing failures reported honestly?
- Is published-tag validation kept temporally separate?

## Counterexample searches

- Changed candidate using older CI or stale dist, hidden generated artifacts, local-only dependency paths and downstream manifest version confusion.
- False worker readiness, invalid inventories, mixed concurrent diagnostics, missing review completion bypass and genuine budget decisions hidden by truncation.
- Pre-existing downstream lint failures misreported as passes; unavailable repositories or unsupported platforms claimed verified.

## Verification

- `{"id":"frozen-install","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm install --frozen-lockfile"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"package-payload","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Before tagging inspect the packed 0.5.2 payload, all bin aliases, dist and portable assets, and run packaged consumer smoke."}`
- `{"id":"candidate-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Before tagging cold install the exact pushed frozen commit SHA with a fresh store outside Git; validate installed version 0.5.2, all aliases and representative init/lint/sync."}`
- `{"id":"regression-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record instrumented operation counts, regression results and exact-SHA disposable downstream checks, including unavailable repositories and pre-existing failures."}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Before tagging observe successful hosted GitHub Actions Quality for the exact frozen candidate SHA; local results cannot substitute."}`

## Documentation updates

- Record pre-tag-only release facts in docs/releases/v0.5.2.md and the candidate entrypoints.
- Update docs/progress.md at lifecycle transitions.

## Notes

- Publication is allowed only after this task's local/hosted/install/review/gate conditions pass.
- Task 0223 is an unrelated planned opt-in feature; Task 0221 retains its historical blocker.
- Keep post-tag facts and stable marker promotion in a distinct subsequent task; never amend the tagged candidate.
