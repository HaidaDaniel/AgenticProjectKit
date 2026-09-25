# Task 0162 - Document constrained and local-first execution

State: todo
Owner: none
Mode: product
Lane: documentation
Type: docs
Scope: local-first,resources,execution,docs
Risk: low
Parallel: true
Depends on: 0152,0157
Tags: docs

## Context files

- AGENTS.md
- README.md
- docs/project.md
- docs/execution-profiles.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/engineering/testing-strategy.md
- docs/cli-commands.md
- docs/progress.md

## Files allowed to edit

- docs/guides/constrained-local-execution.md
- docs/progress.md

## Files forbidden to edit

- README.md
- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Goal

Explain constrained, air-gapped, and local-first workflows with precise network and support limits.

## Steps

1. Inventory network-dependent operations, local state, hosted CI, package acquisition, and exporter behavior from source.
2. Describe local-first use with an already available exact package and lockfile.
3. Separate local task planning/execution from registry, Git remote, hosted CI, and current web research requirements.
4. Link to distribution research without promoting unvalidated installers.

## Acceptance criteria

- The guide explains deterministic, local, constrained-resource, and frontier execution as alternatives that do not require two paid subscriptions.
- The guide distinguishes fully local actions from networked operations.
- The example preserves exact repository-local pin and lockfile behavior.
- OS and runtime claims match maturity policy or are labeled unknown.
- No full air-gap guarantee exceeds the dependency inventory.

## Correctness assumptions

- A package already present with dependencies may work offline, but release and registry operations do not.
- APK does not provide model execution.

## Invariants

- No network access is claimed for commands that require external services.
- No global runtime replaces the exact local dependency.

## Required evidence

- A command-by-command table records network, filesystem, and service requirements.

## Review questions

- Can an operator identify which stages remain possible without internet?
- Are acquisition and local execution separated?

## Counterexample searches

- An undocumented registry or remote call appears in a claimed offline path.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This is an operations boundary guide, not an installer or certified air-gap claim.
