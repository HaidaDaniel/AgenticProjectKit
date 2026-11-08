# Task 0280 - Align proposal publication and identity documentation with implemented behavior

State: todo
Owner: none
Mode: maintenance
Lane: documentation
Type: bugfix
Scope: proposals,documentation,accuracy
Risk: low
Parallel: false
Depends on: 0279
Tags: p3,proposals,documentation,accuracy

## Goal

Correct proposal documentation so the prospective-tree identity scan, pre-publication cleanup behavior, and malformed-unrelated-proposal refusal match the implemented code exactly.

## Context files

- docs/proposals.md
- docs/decisions.md
- src/core/proposals/git.ts
- src/core/proposals/index.ts
- docs/delivery/document-proposals-readiness.md
- .tasks/0277-prevent-duplicate-proposal-identity-in-prospective-commit-trees.md
- .tasks/0278-publish-new-proposal-files-with-crash-safe-exclusive-linking.md

## Files allowed to edit

- docs/proposals.md
- docs/decisions.md
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

1. Read the implemented prospective-tree scan and exclusive-publication cleanup paths.
2. Update ADR-0103 to describe a bounded tree listing followed by per-proposal blob reads, not a single Git search.
3. Update docs/proposals.md to say pre-publication cleanup is attempted and a cleanup failure can leave a temporary file alongside the original failure, while post-publication cleanup failure is reported.
4. Document that the prospective identity scan refuses a commit when any committed proposal file in the configured proposals directory cannot be parsed, as a conservative fail-closed behavior.
5. Update docs/progress.md and run documentation consistency and task lint.

## Acceptance criteria

- Documentation matches the implemented tree listing and per-blob identity scan.
- Pre-publication cleanup failure and malformed-unrelated-proposal refusal are stated accurately.
- No runtime code or behavior changes are introduced.
- Documentation checks pass.

## Correctness assumptions

- The final milestone review found documentation wording that overstates a single Git search and unconditional pre-publication temp cleanup.; Documentation accuracy is part of release truth.

## Invariants

- No runtime code or behavior changes.; No claim of directory fsync durability is added.

## Required evidence

- Documentation consistency output and task lint after the wording correction.

## Review questions

- Does the documentation distinguish tree listing plus blob reads from one Git search?; Does it qualify pre-publication cleanup failure?; Is malformed-unrelated-proposal refusal documented?

## Counterexample searches

- Search wording that promises one Git command
- unconditional temp cleanup
- or successful commits despite malformed unrelated proposals.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Correct docs/proposals.md and docs/decisions.md.
- Update docs/progress.md when task state changes.

## Notes

- Docs-only correction from the final v0.6.0 milestone review.
