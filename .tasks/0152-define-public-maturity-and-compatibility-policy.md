# Task 0152 - Define public maturity and compatibility policy

State: done
Owner: codex-0152
Mode: product
Lane: documentation
Type: docs
Scope: maturity,compatibility,release,product,docs
Risk: medium
Parallel: true
Depends on: none
Tags: docs

## Goal

Publish a bounded, evidence-based maturity and compatibility policy for users evaluating APK.

## Context files

- AGENTS.md
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- docs/project.md
- docs/task-system.md
- docs/agent-exporters.md
- docs/engineering/testing-strategy.md
- docs/releases/v0.4.6.md
- .github/workflows/quality.yml
- docs/progress.md

## Files allowed to edit

- docs/product/maturity-and-compatibility.md
- docs/progress.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .agentic/**
- docs/releases/**
- .github/workflows/**

## Steps

1. Inventory package engines, package manager pin, tested release workflow, CI platform, exporter surfaces, task/config formats, and documented compatibility commitments.
2. Write policy covering maturity wording, supported Node and pnpm versions, OS expectations, harness/export surfaces, task/config compatibility, deprecation, migration, and release support window.
3. Label unverified support explicitly and avoid guarantees beyond release evidence.

## Acceptance criteria

- Every requested compatibility dimension has a current support statement or an explicit unknown.
- Each version, platform, and surface claim traces to metadata, CI, tests, or release evidence.
- Task/config compatibility is distinguished from package semver where behavior differs.
- No unsupported semver or long-term support promise is introduced.

## Correctness assumptions

- Package engine and CI declarations are evidence but do not prove every platform is tested.
- Compatibility includes persisted task/config behavior, not just install success.

## Invariants

- Unverified support remains labeled unknown or unverified.
- The policy makes no stronger compatibility promise than APK can uphold.

## Required evidence

- A compact matrix or equivalent covers versions, platforms, exporters, formats, deprecation, migration, and support window with evidence links.

## Review questions

- Would users know if their combination is supported or merely expected to work?
- Could wording imply stronger guarantees than the evidence supports?

## Counterexample searches

- A claimed OS or harness lacks CI or smoke evidence.
- A format change has no stated migration expectation.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This is the compatibility source for public docs and release planning. Do not change package engines or CI in this docs task.
