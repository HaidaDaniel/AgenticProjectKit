# Task 0192 - Make pre-push feedback fast while preserving full CI quality

State: done
Owner: codex-diagnose-push
Mode: maintenance
Lane: quality
Type: bugfix
Scope: hooks,quality,ci,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix,hooks,quality,ci,developer-experience

## Goal

Make local pre-push feedback fast while preserving full quality, coverage, build, sync, audit, and task-lint validation in CI and release workflows.

## Context files

- AGENTS.md
- docs/decisions.md
- docs/task-system.md
- docs/progress.md
- .husky/pre-push
- package.json
- .github/workflows/quality.yml

## Files allowed to edit

- .husky/pre-push
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- package.json
- .github/workflows/quality.yml

## Steps

1. Inspect the current hook and authoritative CI checks
2. replace the redundant full release gate with fast local checks
3. document the proof boundary
4. run focused and full verification
5. commit the candidate
6. and push the branch.

## Acceptance criteria

- Pre-push no longer runs the full release check or task lint
- pre-push still runs typecheck
- source lint
- diff validation
- and committed-dist drift checks
- CI/release scripts remain unchanged
- policy warnings are not treated as errors
- no unrelated files change.

## Correctness assumptions

- Hosted CI runs the full release and task-quality checks for the pushed commit
- committed dist must remain current
- local hook checks must stay deterministic and bypassable.

## Invariants

- A successful push cannot be presented as full release validation until CI passes
- committed dist drift remains blocked locally
- the repository package manager remains pnpm
- no task policy warning is silently converted into a pass.

## Required evidence

- report

## Review questions

- Does the hook remain fast and deterministic
- are all authoritative CI checks preserved
- does the hook still catch stale dist and working-tree drift
- are only task-owned files changed?

## Counterexample searches

- Change a source file without rebuilding dist
- run the hook from a clean tree
- run the full CI-equivalent release check
- inspect the final push output.

## Verification

- `{"id":"regression-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`

## Documentation updates

- docs/decisions.md
- docs/progress.md

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
