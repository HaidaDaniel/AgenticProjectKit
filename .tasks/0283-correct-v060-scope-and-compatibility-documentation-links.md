# Task 0283 - Correct v0.6.0 scope and compatibility documentation links

State: todo
Owner: none
Mode: maintenance
Lane: documentation
Type: bugfix
Scope: release,documentation,consistency
Risk: low
Parallel: false
Depends on: 0282
Tags: p3,documentation,release,consistency

## Goal

Fix the scope latest-release reference and compatibility anchors so documentation consistency passes after the v0.6.0 sentinel promotion.

## Context files

- docs/scope.md
- docs/product/maturity-and-compatibility.md
- docs/releases/v0.6.0.md
- docs/delivery/workflow-v0.6.0-post-release.md
- docs/releases/index.md

## Files allowed to edit

- docs/scope.md
- docs/product/maturity-and-compatibility.md
- docs/progress.md

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/**
- dist/**

## Steps

1. Update docs/scope.md latest validated release reference to v0.6.0 and its release note.
2. Remove the nonexistent Installation anchor from the v0.6.0 note link in the compatibility matrix, or link the note without an anchor.
3. Point the cold-install evidence link to the actual post-tag heading slug.
4. Update docs/progress.md and run documentation consistency, task lint, and diff check.

## Acceptance criteria

- Documentation consistently points to v0.6.0 and its post-tag record.
- No link points to a nonexistent anchor.
- The tagged note and tagged commit remain unchanged.
- Documentation checks pass.

## Correctness assumptions

- The tagged v0.6.0 release note is immutable and has no Installation heading.; The post-tag report heading slug is actual-tag-cold-install-and-smoke.

## Invariants

- The tagged release note and tagged commit are not modified.; Only documentation links/version references change.

## Required evidence

- Documentation consistency output after the corrections.

## Review questions

- Do all latest-release claims and anchors resolve to v0.6.0 documentation?

## Counterexample searches

- Search stale v0.5.2 scope claims and anchors that do not exist in the tagged note or post-tag report.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Correct docs/scope.md and docs/product/maturity-and-compatibility.md.
- Update docs/progress.md when task state changes.

## Notes

- Follow-up to the v0.6.0 post-tag bookkeeping check.
