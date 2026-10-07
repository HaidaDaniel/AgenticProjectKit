# Task 0204 - Promote validated v0.4.8 release documentation

State: done
Owner: codex-public-readiness-20261007
Mode: production
Lane: release
Type: release
Scope: release,docs,public-readiness
Risk: high
Parallel: false
Depends on: none
Tags: release,post-tag

## Goal

Record the separate post-tag v0.4.8 validation artifact and promote stable public documentation after the immutable release passed.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/releases/index.md
- docs/releases/v0.4.8.md
- docs/delivery/workflow-v0.4.7-self-dogfood.md
- README.md
- CHANGELOG.md
- docs/roadmap.md
- docs/progress.md

## Files allowed to edit

- README.md
- CHANGELOG.md
- docs/releases/index.md
- docs/delivery/workflow-v0.4.8-post-release.md
- docs/product/maturity-and-compatibility.md
- docs/scope.md
- docs/index.md
- docs/roadmap.md
- docs/progress.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- src/**
- docs/releases/v0.4.8.md
- .tasks/archive/**

## Steps

1. Record exact tag peel
2. hosted run
3. cold install
4. payload identity
5. downstream and self-adoption observations in a separate delivery artifact
6. Promote the validated-release sentinel and release index without editing the tagged release note
7. Update stable README
8. changelog
9. roadmap
10. and progress claims to v0.4.8
11. Run documentation consistency
12. APK lint
13. diff
14. and review/gate verification

## Acceptance criteria

- Post-tag observations are recorded outside the immutable tagged release note
- v0.4.8 is the validated-release sentinel and release index latest validated row
- Stable README and changelog installation claims identify v0.4.8
- No tag
- package metadata
- lockfile
- source
- or tagged release note changes
- Post-tag evidence remains distinct from PRE-TAG candidate evidence

## Correctness assumptions

- Release evidence must identify the exact immutable candidate SHA/tree.
- Some release checks can only execute after publication and must be recorded as post-tag evidence.
- A release-note file committed inside the tag cannot contain its own commit SHA or the later tag/CI/install identity.

## Invariants

- Pre-tag and post-tag evidence are temporally distinct and never conflated.
- A published tag is immutable; the tagged artifact and recorded evidence refer to the same candidate tree.
- Tagged release notes contain only facts knowable before tagging.

## Required evidence

- posttag-record
- promotion-report

## Review questions

- Does the separate artifact preserve pre-tag/post-tag chronology?
- Are stable claims promoted only after immutable tag validation?
- Did any edit touch the immutable tagged note or tag?

## Counterexample searches

- Search post-tag facts inside docs/releases/v0.4.8.md
- Search stable docs still pinned to v0.4.7
- Search tag mutation or candidate metadata edits

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs","evidenceRef":"docs-consistency"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint","evidenceRef":"apk-lint"}`
- `{"id":"posttag-record","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Inspect the committed separate v0.4.8 post-tag artifact and compare its tag peel, exact-SHA hosted run, cold install, payload, downstream, and self-adoption observations with the immutable release.","evidence":"post-tag v0.4.8 artifact"}`
- `{"id":"promotion-report","type":"manual","required":true,"environment":"live","profile":"report","instruction":"Confirm the validated-release sentinel, stable install docs, changelog, and release index were promoted only after post-tag validation and do not modify the tagged candidate.","evidence":"promotion commit and tag immutability"}`

## Documentation updates

- Update post-tag release artifact and stable release navigation.

## Notes

- Created only after Task 0173 gate and POST-TAG check-13 passed; keep tagged candidate immutable.
