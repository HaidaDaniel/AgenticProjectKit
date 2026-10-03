# Task 0161 - Document safe brownfield adoption

State: done
Owner: codex-0161
Mode: product
Lane: documentation
Type: docs
Scope: brownfield,adoption,docs
Risk: low
Parallel: true
Depends on: 0151,0152,0165
Tags: docs

## Goal

Document a safe APK adoption path for an existing repository with local changes and established conventions.

## Context files

- AGENTS.md
- README.md
- docs/adoption-flow.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/scope.md
- docs/project.md
- docs/progress.md

## Files allowed to edit

- docs/guides/brownfield-adoption.md
- docs/progress.md

## Files forbidden to edit

- README.md
- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Steps

1. Inspect init, adoption, sync, and audit behavior and identify exact reviewed-file and overwrite boundaries.
2. Describe preflight checks for working tree, version control, repository mode, backup, and generated files.
3. Give ordered adoption, diff inspection, conflict resolution, sync, and verification commands using the canonical package-local invocation.
4. Explain recovery for partial or conflicting adoption and when to stop for human review.

## Acceptance criteria

- A user can follow a repeatable sequence with expected effects and explicit review points.
- The guide accurately describes current non-destructive behavior and operations that may update files.
- Recovery steps are actionable and do not promise untested preservation.

## Correctness assumptions

- Brownfield users may have valuable local instructions and uncommitted changes.
- CLI behavior is authoritative over old prose.

## Invariants

- No mutating command is described as harmless if it can overwrite user content.
- Human review remains explicit before generated instruction changes are accepted.

## Required evidence

- A disposable repository with existing files demonstrates the steps and resulting diff.

## Review questions

- What must users inspect before and after each mutating command?
- Are backup and recovery steps actionable?

## Counterexample searches

- A sequence overwrites or stages files without an inspection point.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This covers the riskiest adoption path. Do not change adoption implementation.
