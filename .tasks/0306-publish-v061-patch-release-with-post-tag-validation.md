# Task 0306 - Publish v0.6.1 patch release with post-tag validation

State: done
Owner: release-engineer-0306
Mode: production
Lane: release
Type: release
Scope: release,candidate,version,release-notes,documentation,pre-tag-validation,publication,post-tag-validation
Risk: high
Parallel: false
Depends on: 0290,0291,0292,0293,0294,0295,0296,0297,0298,0299,0300,0301,0302,0303,0304,0305
Tags: release,v0.6.1,publication

## Goal

Prepare, validate, publish and post-validate the v0.6.1 patch release of AgenticProjectKit from the completed 0290-0305 corrective milestone

## Context files

- AGENTS.md
- docs/engineering/testing-strategy.md
- docs/engineering/documentation-maintenance.md
- docs/decisions.md
- docs/releases/index.md
- docs/releases/v0.6.0.md
- docs/delivery/workflow-v0.6.0-post-release.md
- src/core/templates/task-templates.ts
- package.json
- .tasks/0302-restore-clean-checkout-release-validation.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- docs/releases/v0.6.1.md
- docs/releases/index.md
- docs/delivery/workflow-v0.6.1-post-release.md
- CHANGELOG.md
- README.md
- docs/getting-started.md
- docs/index.md
- docs/roadmap.md
- docs/progress.md
- docs/scope.md
- docs/product/maturity-and-compatibility.md
- docs/project-map.md
- dist/**
- .tasks/0306-*

## Files forbidden to edit

- .agentic/**
- .github/**
- src/**
- scripts/**
- docs/reviews/**
- docs/adoption-report.md
- .tasks/0285-document-adopted-repository.md
- .tasks/0149-*
- .tasks/0150-*
- .tasks/0216-*
- .tasks/0218-*
- .tasks/0221-*
- .tasks/0223-*

## Steps

1. Resolve the free next SemVer target and confirm every existing tag is immutable
2. Bump package metadata and write the pre-tag v0.6.1 candidate note without advancing the validated sentinel
3. Freeze the exact candidate SHA and run clean-checkout pre-tag validation including release check and exact-SHA hosted CI
4. Obtain independent release review and pass the APK gate before any tag exists
5. Create the annotated tag and publish commits and tag with ordinary non-force pushes
6. Run post-tag validation from the published tag and disposable downstream copies
7. Promote the validated sentinel and stable claims in a separate bookkeeping commit

## Acceptance criteria

- v0.6.1 is free and all pre-existing tags remain untouched
- Candidate note contains only pre-tag facts and the sentinel stays at v0.6.0 until post-tag validation succeeds
- Every pre-tag criterion ran against the exact frozen candidate including hosted CI
- Independent PASS and APK gate precede tag creation
- Annotated tag peels to the validated candidate and local and remote identities agree
- Post-tag and downstream validation pass and are recorded separately from the immutable note
- No unrelated untracked WIP is committed or lost

## Correctness assumptions

- Release evidence must identify the exact immutable candidate SHA/tree.
- Some release checks can only execute after publication and must be recorded as post-tag evidence.
- A release-note file committed inside the tag cannot contain its own commit SHA or the later tag/CI/install identity.

## Invariants

- Pre-tag and post-tag evidence are temporally distinct and never conflated.
- A published tag is immutable; the tagged artifact and recorded evidence refer to the same candidate tree.
- Tagged release notes contain only facts knowable before tagging.

## Required evidence

- Pre-tag criteria observed against the frozen candidate SHA, exact-SHA hosted CI, annotated tag peel to that SHA, and a distinct post-tag cold-install/released-consumer record.

## Review questions

- Did every criterion claimed as pre-tag actually run against the exact candidate SHA before tag publication?
- Is post-tag evidence kept separate and never presented as pre-tag?
- Was the published tag left unmoved and the tagged release notes kept free of fabricated future facts?

## Counterexample searches

- Search a release whose downstream or compatibility smoke ran after publication but was claimed pre-tag, a placeholder validation inside the tagged notes, a moved tag, and post-tag install facts written into the immutable tagged file.
- Search a changed candidate that reuses earlier freeze/CI evidence, a tag created on HEAD without an exact-SHA CI pass, and a missing or stale committed dist/asset.

## Verification

- `{"id":"frozen-install","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm install --frozen-lockfile"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"NODE_OPTIONS=--max-old-space-size=4096 pnpm release:check"}`
- `{"id":"clean-checkout-release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"package-payload","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Before tagging inspect the packed 0.6.1 payload, all bin aliases, dist and portable assets, and run a packaged consumer smoke."}`
- `{"id":"candidate-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Before tagging cold install the exact pushed frozen commit SHA with a fresh store outside Git; validate installed version 0.6.1, all aliases and representative init/lint/sync."}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Before tagging observe successful hosted GitHub Actions Quality for the exact frozen candidate SHA; local results cannot substitute."}`
- `{"id":"independent-review","type":"manual","required":true,"environment":"local","profile":"trusted","instruction":"A separate registered reviewer with fresh context inspects the exact candidate diff, metadata and evidence and records a PASS before tag creation."}`
- `{"id":"post-tag-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"After publication cold install the immutable v0.6.1 tag in a fresh environment; verify tag object and peel, package version, bin aliases and CLI smoke including doctor, lint, status, attention and workers."}`
- `{"id":"downstream-smoke","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"After publication install the tag into disposable copies of translator-agent, media-core and one additional downstream repository; never modify production downstream trees; record exact SHAs."}`

## Documentation updates

- Update docs/progress.md when task state changes
- Create docs/releases/v0.6.1.md with pre-tag-only facts
- Create docs/delivery/workflow-v0.6.1-post-release.md after post-tag validation

## Notes

- Preserve pre-existing untracked WIP for task 0285 and docs/reviews
- Never advance the validated sentinel before post-tag validation succeeds
- Never force push amend or move a published annotated tag
- Keep implementation, candidate, publication and bookkeeping commits logically separate
