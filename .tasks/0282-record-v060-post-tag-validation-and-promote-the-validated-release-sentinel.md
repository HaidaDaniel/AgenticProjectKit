# Task 0282 - Record v0.6.0 post-tag validation and promote the validated release sentinel

State: done
Owner: opencode-milestone
Mode: maintenance
Lane: release
Type: audit
Scope: release,documentation,validation,sentinel
Risk: low
Parallel: false
Depends on: 0281
Tags: p2,post-tag-validation,documentation,bookkeeping

## Goal

Record the published v0.6.0 tag and post-tag validation evidence and promote the validated-release sentinel from v0.5.2 to v0.6.0 without modifying the immutable tagged release note.

## Context files

- AGENTS.md
- docs/releases/index.md
- docs/releases/v0.6.0.md
- docs/delivery/workflow-v0.5.2-post-release.md
- docs/product/maturity-and-compatibility.md
- README.md
- CHANGELOG.md
- docs/index.md
- docs/getting-started.md

## Files allowed to edit

- docs/delivery/workflow-v0.6.0-post-release.md
- docs/releases/index.md
- docs/product/maturity-and-compatibility.md
- docs/index.md
- docs/getting-started.md
- README.md
- CHANGELOG.md
- docs/roadmap.md
- docs/delivery/document-proposals-readiness.md
- docs/progress.md

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/v0.6.0.md
- docs/releases/v0.5.2.md
- package.json
- pnpm-lock.yaml
- .github/**
- src/**
- dist/**

## Steps

1. Create docs/delivery/workflow-v0.6.0-post-release.md with exact tag object SHA, peeled candidate SHA, remote tag identity, hosted CI run/result, cold-install source and result, CLI alias/version smoke, proposal add/list/show/validate and proposal-only commit smoke, init/task/backlog/sync smoke, self-adoption, Go/Python/Node fixtures, and explicit limitations.
2. Promote the APK_VALIDATED_RELEASE sentinel from v0.5.2 to v0.6.0 in docs/releases/index.md and add the v0.6.0 release-table row with the tagged source and post-tag record link.
3. Update README, CHANGELOG, docs/index.md, docs/getting-started.md, and maturity/compatibility claims to the new validated release as required by documentation consistency.
4. Update progress/roadmap/readiness references without backfilling the tagged release note.
5. Run documentation consistency, task lint, and diff check; record evidence and complete the task.

## Acceptance criteria

- The post-tag report records the actual published tag object, peeled SHA, remote identity, CI result, cold-install result, and smoke coverage.
- The validated-release sentinel is v0.6.0 and stable install guidance points to v0.6.0.
- The tagged release note and tagged commit are unchanged.
- No GitHub Release is claimed because the project does not publish one.
- Documentation checks pass and no downstream repository is modified.

## Correctness assumptions

- The annotated tag v0.6.0 is published at tag object d83d069f5309ca2b963f8939a2626d771265979a peeling to 88fc21e0b6523808cb627d2707354f1d8d2128db.; Cold installation and CLI smoke succeeded from the actual GitHub tag.; The project does not publish GitHub Releases.

## Invariants

- The tagged commit and docs/releases/v0.6.0.md are not modified.; The sentinel changes only after successful post-tag validation.; Post-tag evidence distinguishes observed facts from limitations.; No downstream repository is modified.

## Required evidence

- Exact tag object and peeled SHA
- remote tag identity
- hosted CI run/result
- cold-install log
- CLI alias/version output
- proposal and task/backlog smoke
- self-adoption
- and Go/Python/Node fixtures.

## Review questions

- Is the post-tag report consistent with the actual tag and CI evidence?; Was the tagged note left immutable?; Does the sentinel promotion pass documentation consistency?

## Counterexample searches

- Search a sentinel promotion without cold install
- a modified tagged note
- a claimed GitHub Release that does not exist
- and a downstream repository mutation.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Create the post-tag validation report.
- Promote the sentinel and update stable release/install documentation.
- Update progress and readiness references.

## Notes

- Operate on main after the immutable tag; do not rewrite tagged history.
- Push the separate bookkeeping commit with a fast-forward push.
