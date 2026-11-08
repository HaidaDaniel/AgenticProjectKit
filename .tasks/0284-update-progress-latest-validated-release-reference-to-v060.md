# Task 0284 - Update progress latest validated release reference to v0.6.0

State: todo
Owner: none
Mode: maintenance
Lane: documentation
Type: bugfix
Scope: documentation,consistency
Risk: low
Parallel: false
Depends on: 0283
Tags: p3,documentation,consistency

## Goal

Update the stale progress latest-validated-release reference so documentation consistency passes after v0.6.0 publication.

## Context files

- docs/progress.md
- docs/releases/index.md
- docs/delivery/workflow-v0.6.0-post-release.md

## Files allowed to edit

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

1. Replace the stale latest-validated-release prose in docs/progress.md with v0.6.0 and the v0.6.0 post-tag record link.
2. Run documentation consistency, task lint, and diff check.

## Acceptance criteria

- Progress docs point to v0.6.0 and its post-tag record.
- Documentation checks pass and no tagged artifact changes.

## Correctness assumptions

- The v0.6.0 tag is published and the sentinel is v0.6.0.; The tagged release note is immutable and remains historical.

## Invariants

- Only progress documentation changes.; The tagged note and tagged commit are unchanged.

## Required evidence

- Documentation consistency output after the update.

## Review questions

- Does progress point to v0.6.0 and its post-tag record?

## Counterexample searches

- Search remaining non-historical v0.5.2 latest-release claims.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/progress.md.

## Notes

- Follow-up to the v0.6.0 sentinel promotion.
