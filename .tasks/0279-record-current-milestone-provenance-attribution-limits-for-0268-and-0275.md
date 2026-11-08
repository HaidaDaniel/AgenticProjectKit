# Task 0279 - Record current-milestone provenance attribution limits for 0268 and 0275

State: todo
Owner: none
Mode: audit
Lane: audit
Type: audit
Scope: provenance,audit,docs,release-readiness
Risk: low
Parallel: false
Depends on: 0278
Tags: p2,provenance,audit,documentation

## Goal

Add a concise audit note documenting which commits and evidence belong to canceled Task 0268 versus successor Task 0275, without rewriting task contracts, baselines, evidence, or Git history.

## Context files

- AGENTS.md
- docs/delivery/corrective-provenance-audit.md
- docs/delivery/document-proposals-readiness.md
- docs/progress.md
- .tasks/0268-contain-all-agentic-runtime-mutations-inside-the-repository.md
- .tasks/0275-contain-remaining-agentic-runtime-mutations-inside-the-repository.md

## Files allowed to edit

- docs/delivery/corrective-provenance-audit.md
- docs/delivery/document-proposals-readiness.md
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

1. Read the recorded 0268 cancellation, 0275 contract notes, claim epoch, completion subject, and Git history.
2. Append a bounded note to the corrective provenance audit that records: 0268 was canceled after implementation; cc290a9 contains retained containment work but is before the 0275 epoch baseline; 0275 candidate evidence covers only changes from its own baseline and carried-forward delta; the limitation is documented rather than repaired by history rewrite.
3. Record the same limitation in the release-readiness document for release consumers.
4. Update docs/progress.md without changing completed tasks, baselines, evidence, or commits.
5. Run documentation consistency and task lint; do not claim clean provenance.

## Acceptance criteria

- The audit note accurately identifies retained predecessor work and successor candidate evidence.
- No completed task contract, baseline, evidence record, or Git commit is rewritten.
- The note states the attribution limitation without claiming clean provenance.
- Documentation checks pass.

## Correctness assumptions

- The successor baseline was captured after the retained implementation commit
- so that commit is not part of 0275 candidate-bound evidence.; Documenting the limitation is preferable to rewriting completed history.

## Invariants

- Completed task files
- baselines
- evidence
- and commits are not modified.; The note distinguishes attribution facts from proof of authorization.; No clean-provenance claim is made.

## Required evidence

- Documentation consistency output and exact provenance fields for 0268 and 0275.

## Review questions

- Are retained predecessor commits distinguished from successor candidate evidence?; Is the limitation stated without hiding or rewriting history?

## Counterexample searches

- Search a claim that 0275 newly implemented cc290a9
- a claim that 0268 completed
- and a clean-provenance claim.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Append the current-milestone attribution note to docs/delivery/corrective-provenance-audit.md.
- Reference the limitation in docs/delivery/document-proposals-readiness.md and docs/progress.md.

## Notes

- This is a docs-only audit note, not a new lifecycle or recovery mechanism.
