# Task 0112 - Detect pyproject-based Python repositories during adoption

State: todo
Owner: none
Mode: maintenance
Lane: adoption
Type: bugfix
Scope: scanner,adoption,python,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Detect Python from modern repository markers so adoption of a pyproject-based project does not omit Python because a control-plane package.json exists; keep detection evidence-based and deterministic.

## Context files

- AGENTS.md
- docs/architecture.md
- src/core/scanners/index.ts
- src/core/docs/adopt.test.ts
- src/core/docs/adopt.ts

## Files allowed to edit

- src/core/scanners/index.ts
- src/core/docs/adopt.test.ts
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/workspaces/**
- src/core/tasks/**
- .github/workflows/**

## Steps

1. Capture a reproducer that fails on the old behavior.
2. Identify and document the root cause before changing code.
3. Implement the smallest safe fix; do not perform unrelated refactors.
4. Add regression coverage and run verification.

## Acceptance criteria

- Python is detected from pyproject.toml; requirements.txt; requirements-*.txt; requirements-*.lock; uv.lock; setup.py; setup.cfg; a mixed repo with pyproject plus a pnpm package.json reports Python plus Node.js plus pnpm; a normal Node repo is unchanged; a minimal repo keeps existing behavior; adoption report and project map show the corrected stack; committed dist stays current

## Correctness assumptions

- the real translator-agent is Python 3.12 with pyproject.toml and requirements-dev.lock and a control-plane package.json; detectPackageStack currently reads package.json only

## Invariants

- detection is evidence-based and deterministic; no package manager or runtime hierarchy is inferred beyond evidence; existing sorted ordering remains deterministic

## Required evidence

- regression test output covering each marker plus adoption report and project map stack lines

## Review questions

- Can Python still be omitted when package.json exists; is detection ordering deterministic; do adoption report and project map reflect the corrected stack

## Counterexample searches

- pyproject-only repo; pnpm tooling package.json plus pyproject; requirements-dev.lock without requirements.txt; setup.cfg plus package.json; repository with no markers

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/progress.md

## Notes

- Keep the fix narrow.
