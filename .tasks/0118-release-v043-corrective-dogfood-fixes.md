# Task 0118 - Release v0.4.3 corrective dogfood fixes

State: todo
Owner: none
Mode: production
Lane: release
Type: release
Scope: release,version,dist,docs
Risk: high
Parallel: false
Depends on: none
Tags: release

## Goal

Bump to 0.4.3, keep committed dist fresh, update README stable tag, run full quality/release checks, require exact-SHA hosted CI success, tag v0.4.3 only after CI passes, and prove cold install from the actual tag.

## Context files

- AGENTS.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- README.md

## Files allowed to edit

- package.json
- README.md
- dist/**
- docs/**
- src/**
- scripts/**
- .tasks/**

## Files forbidden to edit



## Steps

1. Freeze and record the candidate SHA/tree.
2. Collect CI evidence and run post-bump validation.
3. Perform release smoke checks and rollback/recovery review.
4. Do not mutate the candidate after evidence is captured.

## Acceptance criteria

- Candidate SHA/tree is recorded and matches the evaluated release.
- CI evidence and post-bump validation pass.
- Release smoke and recovery paths are verified.
- No candidate mutation occurs after final evidence.

## Correctness assumptions

- Release evidence must identify the exact immutable candidate.

## Invariants

- Published artifacts and recorded evidence refer to the same candidate tree.

## Required evidence

- Candidate SHA/tree, CI, post-bump, smoke, and recovery evidence.

## Review questions

- Can the release artifact, evidence, and evaluated tree diverge?

## Counterexample searches

- Search dirty-tree, post-evidence mutation, partial publish, and rollback paths.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"release-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run pnpm release:check after the version bump and record the exact result.","evidence":"release:check output summary"}`
- `{"id":"exact-sha-hosted-ci","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Observe the hosted Quality workflow on the exact release-candidate SHA and confirm head_sha/conclusion for that SHA only.","evidence":"workflow run URL, head_sha, conclusion"}`
- `{"id":"cold-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Cold-install the built package from the actual v0.4.3 tag in a fresh directory with a fresh pnpm store and run apk --help/doctor and a brownfield adopt.","evidence":"cold-install transcript reference"}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Treat evidence capture as the final mutation boundary.
