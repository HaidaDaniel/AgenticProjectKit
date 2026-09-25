# Task 0154 - Modernize scope.md around current and historical scope

State: todo
Owner: none
Mode: maintenance
Lane: documentation
Type: docs
Scope: scope,current-truth,docs
Risk: low
Parallel: true
Depends on: none
Tags: docs

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/roadmap.md
- docs/architecture.md
- docs/decisions.md
- docs/releases/v0.4.6.md

## Files allowed to edit

- docs/scope.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Goal

Replace stale scope-era statements with a clear account of APK’s current boundary, shipped capabilities, and explicit exclusions.

## Steps

1. Read current implementation, project description, architecture, ADRs, and current release notes before editing scope claims.
2. Organize scope into current scope, current non-goals, next milestone, and historical scope.
3. Preserve accepted exclusions such as model-runtime ownership and cloud control plane unless a source decision changed.
4. Cross-check each implemented claim against source or tagged release.

## Acceptance criteria

- The document has distinct current scope, current non-goals, next milestone, and historical scope sections.
- Readers can distinguish current behavior from historical v0.1-v0.3 plans and later backlog ideas.
- The product boundary agrees with current architecture and accepted ADRs.
- Stale future-tense statements are removed or labeled historical.
- No new capability is claimed without evidence.

## Correctness assumptions

- Current implementation and accepted decisions outrank old planning prose.
- Scope documentation is not a substitute for task contracts.

## Invariants

- Historical scope stays recognizable as history.
- No deferred capability is described as implemented.

## Required evidence

- Claim-by-claim source review covers capabilities, boundaries, and exclusions.

## Review questions

- Are historical and current scope visibly separate?
- Does any sentence imply APK launches models or owns external runtime?

## Counterexample searches

- Stale future, next-release, or planned claims refer to already shipped or abandoned work.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This sets product boundaries for public explanations. Do not edit source, ADR history, or release notes.
