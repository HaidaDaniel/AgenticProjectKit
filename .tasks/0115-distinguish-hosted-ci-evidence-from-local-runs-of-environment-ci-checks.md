# Task 0115 - Distinguish hosted CI evidence from local runs of environment ci checks

State: todo
Owner: none
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: verification,evidence,gate,docs
Risk: medium
Parallel: false
Depends on: none
Tags: evidence,ci

## Goal

Distinguish hosted CI evidence from a local apk task verify run of a check declared environment: ci so a local run cannot be mistaken for hosted CI proof and hosted CI evidence is explicit and candidate-bound.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/index.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/index.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/work/**
- .github/workflows/**

## Steps

1. Separate the evidence recorded by local verification of environment ci checks from hosted CI evidence
2. Add an explicit candidate-bound recording path for hosted CI results
3. Surface the distinction in status and the completion gate without weakening freshness
4. Add regression tests and run verification

## Acceptance criteria

- Local verification of environment ci checks no longer produces hosted CI proof
- Hosted CI evidence is recorded explicitly with a bounded external reference and candidate binding
- Status and the gate surface the distinction while candidate freshness is unchanged

## Correctness assumptions

- A local execution cannot prove the hosted CI result
- Local verification currently records environment ci checks with the hosted ci evidence type

## Invariants

- Candidate-bound freshness and append-only evidence semantics are unchanged
- Hosted CI evidence requires an explicit candidate-bound record
- Local deterministic checks still run and remain required

## Required evidence

- Regression test output contrasting a local verify run with recorded hosted CI evidence
- Gate behavior when hosted CI evidence is missing or stale

## Review questions

- Can a local verify run still satisfy a hosted CI requirement?
- Is the hosted CI recording path candidate-bound and owner-checked?

## Counterexample searches

- environment ci check executed locally
- Recorded CI evidence on a stale candidate
- Missing CI record
- Mixed-revision candidate
- Automated check passing locally

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/task-system.md and record the decision in docs/decisions.md
- Update docs/progress.md

## Notes

- Do not add GitHub API coupling or a CI service dependency. Keep the change bounded to the existing evidence and gate model.
