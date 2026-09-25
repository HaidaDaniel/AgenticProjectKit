# Task 0166 - Simplify first-run acquisition while keeping exact pins

State: todo
Owner: none
Mode: product
Lane: distribution
Type: feature
Scope: installation,bootstrap,distribution,docs,tests
Risk: medium
Parallel: false
Depends on: 0165
Tags: feature

## Context files

- AGENTS.md
- package.json
- pnpm-lock.yaml
- README.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/engineering/testing-strategy.md
- docs/cli-commands.md
- .github/workflows/quality.yml

## Files allowed to edit

- scripts/**
- src/cli/**
- src/core/**
- package.json
- pnpm-lock.yaml
- README.md
- docs/cli-commands.md
- docs/progress.md

## Files forbidden to edit

- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md
- .agentic/**

## Goal

Reduce first-run acquisition friction while installing an exact repository-local APK version and keeping normal commands pinned locally.

## Steps

1. Measure current friction and inspect package metadata, tag availability, package-manager behavior, platforms, and Task 0125.
2. Compare registry install, one-shot bootstrap, lightweight installer, exact tag helper, and package-manager wrapper.
3. Implement the smallest evidence-supported option or record a documented no-go recommendation.
4. Ensure bootstrap writes or updates an exact local dependency and lockfile before handing off to the local binary.
5. Test in a disposable repository with existing package metadata and document recovery.

## Acceptance criteria

- Task 0125 exact local pin plus lockfile remains canonical.
- A tested bootstrap reaches the exact local dependency or gives a source-backed no-go.
- Subsequent commands resolve the repository-pinned binary, not a global install.
- Support claims match maturity policy and no unsupported OS installer ships.

## Correctness assumptions

- Global tooling may bootstrap only if it installs a pinned local package and exits the normal path.
- Distribution capability must be confirmed at execution time.

## Invariants

- No latest/unbounded dependency replaces exact local pin.
- Existing package scripts and lockfiles are not silently overwritten.

## Required evidence

- A disposable repository records before/after files, exact pin, lockfile, and local command resolution.
- A small option comparison documents rejected alternatives and support limits.

## Review questions

- Can users verify which version normal commands run?
- Does bootstrap preserve existing project choices?

## Counterexample searches

- Test global-binary precedence, existing lockfile, unsupported runtime, and interrupted bootstrap.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Simplify acquisition while preserving Task 0125. Prefer a no-go over an unsupported installer.
