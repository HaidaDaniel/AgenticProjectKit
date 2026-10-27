# Task 0243 - Validate published v0.5.2 and promote stable documentation

State: doing
Owner: codex-validate-v052
Mode: maintenance
Lane: docs
Type: docs
Scope: release-validation,docs
Risk: low
Parallel: false
Depends on: 0242
Tags: docs

## Goal

Validate the actual immutable published v0.5.2 tag through a fresh Git-tag installation and disposable self-adoption, then record exact release evidence and promote stable documentation without changing the tagged candidate.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/releases/index.md
- docs/releases/v0.5.2.md
- docs/delivery/workflow-v0.5.1-post-release.md
- .tasks/0242-validate-the-v052-patch-release-candidate-before-publication.md

## Files allowed to edit

- README.md
- CHANGELOG.md
- docs/index.md
- docs/roadmap.md
- docs/scope.md
- docs/product/maturity-and-compatibility.md
- docs/releases/index.md
- docs/delivery/workflow-v0.5.2-post-release.md
- docs/progress.md

## Files forbidden to edit

- src/**
- scripts/**
- dist/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/v0.5.1.md
- docs/releases/v0.5.2.md

## Steps

1. Confirm published local/remote annotated v0.5.2 object and peel match the exact reviewed pre-tag candidate, and v0.5.1 remains immutable.
2. Cold install from the actual published v0.5.2 Git tag with a fresh store and explicitly pinned Node22.22.1/pnpm10.28.1 consumer outside Git. Check lockfile commit resolution, package identity, all aliases and six portable skill assets.
3. Run representative installed init/sync/lint/doctor/workers/attention/status/tasks smoke in a disposable Git project; use isolated exact-tag checkout for preview/apply self-adoption and preserve source/package/lock/dist.
4. Record identities, pre-tag local/hosted/review evidence, post-tag observations, task results, operation counts, downstream outcomes and honest limitations in the separate delivery artifact.
5. Promote the validated-release sentinel and stable entrypoints to v0.5.2 only after actual-tag validation. Do not backfill the immutable tagged candidate note.
6. Commit the documentation candidate, run canonical docs checks and observe exact-SHA hosted Quality before gate/done. Commit lifecycle bookkeeping separately and push main.

## Acceptance criteria

- Actual-tag cold install proves 0.5.2, all three aliases, six assets and exact candidate resolution with the pinned toolchain and a fresh store.
- Local and remote annotated tag object and peel match the reviewed pre-tag candidate; v0.5.1 is unchanged.
- Disposable installed consumer and self-adoption smoke pass without production downstream changes or source/package/lock/dist drift.
- Post-tag facts are recorded separately from the unchanged tagged note.
- Stable release marker, installation pins and documented release claims consistently name validated v0.5.2.
- Task/evidence/CI identities, operation counts, pre-existing downstream failures and unavailable scenarios are reported precisely.
- Canonical documentation checks, exact-SHA hosted Quality and gate pass before completion.

## Correctness assumptions

- The pre-tag task completed all release conditions before the already-authorized publication.
- Installed consumer and self-adoption checks are disposable and do not transfer ignored operational trust records.

## Invariants

- Never move tags or rewrite evidence-bound history.
- Never edit the v0.5.2 tagged candidate note or source/package/dist under this docs task.
- Never claim unavailable downstream or platform scenarios passed.

## Required evidence

- Actual published-tag install and tag identity report, disposable self-adoption report and exact-SHA hosted docs candidate Quality.

## Review questions

- Are publication, pre-tag and post-tag observations ordered and identified honestly?
- Do all stable claims agree without mutating the tagged artifact?

## Counterexample searches

- Installation from working directory or SHA mistaken for actual-tag validation.
- Consumer using Corepack default rather than pinned pnpm.
- Moved or mismatched tag, missing portable assets, downstream manifest version masking and ignored evidence copied as trust.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"tag-validation","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Observe actual published v0.5.2 cold install with fresh store, pinned toolchain, exact tag peel, three aliases, six assets and disposable consumer/self-adoption smoke; preserve v0.5.1 and tagged source."}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Observe successful hosted Quality for the exact committed documentation candidate SHA before task completion."}`

## Documentation updates

- Record post-tag evidence in docs/delivery/workflow-v0.5.2-post-release.md.
- Promote stable version claims and update docs/progress.md at lifecycle transitions.

## Notes

- This low-risk docs task does not change release runtime behavior or the immutable tagged candidate.
- The user already authorized conditional release publication; no additional release authorization is inferred here.
