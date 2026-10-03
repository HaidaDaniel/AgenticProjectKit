# Task 0171 - Establish a release changelog and index strategy

State: done
Owner: codex-0171
Mode: maintenance
Lane: release
Type: docs
Scope: releases,changelog,history,docs
Risk: low
Parallel: true
Depends on: none
Tags: docs

## Goal

Establish a navigable changelog strategy that preserves release artifacts and avoids fabricated unreleased changes.

## Context files

- AGENTS.md
- package.json
- docs/roadmap.md
- docs/progress.md
- docs/releases/v0.4.6.md
- docs/engineering/testing-strategy.md

## Files allowed to edit

- CHANGELOG.md
- docs/releases/index.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/v0.4.0.md
- docs/releases/v0.4.1.md
- docs/releases/v0.4.2.md
- docs/releases/v0.4.4.md
- docs/releases/v0.4.5.md
- docs/releases/v0.4.6.md
- docs/decisions.md

## Steps

1. Inspect release-note files, release process, tags, and package version policy.
2. Choose a concise CHANGELOG.md structure and clarify whether it summarizes or links to detailed release notes.
3. Create an index to existing release artifacts without editing those files.
4. Document where unreleased changes belong and what can be known before tagging.

## Acceptance criteria

- Historical docs/releases/v* files remain unchanged.
- Top-level changelog and index do not duplicate long notes or claim an unreleased version.
- Each release has one canonical detailed artifact.
- Pre-tag facts are distinct from post-tag evidence.

## Correctness assumptions

- Per-release artifacts remain detailed evidence records.
- A compact changelog can route users to those artifacts.

## Invariants

- No post-tag result is added to historical immutable notes.
- No unreleased version is presented as shipped.

## Required evidence

- All existing release artifacts are linked and labels agree with package/tag evidence.

## Review questions

- Can users find changes for a release?
- Does the strategy prevent post-tag evidence contamination?

## Counterexample searches

- Untagged version heading, duplicate details, or missing release link.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Create a forward-looking index. Preserve every historical release note exactly.
