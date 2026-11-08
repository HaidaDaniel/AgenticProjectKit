# Task 0281 - Record explicit operator provenance decisions for v0.6.0

State: done
Owner: opencode-milestone
Mode: audit
Lane: audit
Type: audit
Scope: provenance,audit,release-readiness,docs
Risk: low
Parallel: false
Depends on: 0280
Tags: p1,provenance,operator-decision,release-readiness

## Goal

Record the operator explicit acceptance of historical Tasks 0256 and 0260 with documented limitations and the acknowledgment of cross-task attribution limits, using a documented decision note rather than a fabricated APK decision event.

## Context files

- AGENTS.md
- docs/delivery/corrective-provenance-audit.md
- docs/delivery/document-proposals-readiness.md
- docs/progress.md
- .tasks/0256-honor-custom-task-directory-during-adoption.md
- .tasks/0260-support-task-ids-beyond-9999-consistently.md

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

1. Record the exact operator choices and the date/source in the corrective provenance audit as a documented decision note, not an APK task decision event.
2. State that accepting 0256 and 0260 accepts procedural deviations with limitations; it does not create an epoch, prove prior authorization, or authenticate identity.
3. Record acknowledgment of the cross-task attribution limitations and the 0268/0275 retained-predecessor limitation.
4. Update the readiness record from publication-blocked to READY_WITH_DOCUMENTED_LIMITATIONS while keeping the validated sentinel at v0.5.2 until post-tag validation.
5. Update docs/progress.md and run documentation consistency and task lint.

## Acceptance criteria

- The operator choices are recorded exactly with date/source and exact commit/hash references.
- The note does not create fake APK decision events or epochs and does not claim clean provenance.
- The readiness record reflects that publication may proceed with documented limitations.
- No historical artifact is rewritten and documentation checks pass.

## Correctness assumptions

- The operator explicitly answered ACCEPT_WITH_DOCUMENTED_LIMITATION for 0256 and 0260 and ACKNOWLEDGE for the attribution limitations in the release session.; APK task decision records do not support this historical provenance-acceptance type
- so a dated documented decision note is the truthful mechanism.

## Invariants

- No historical task
- baseline
- evidence
- or Git commit is rewritten.; No epoch or approval is invented.; Acceptance does not authenticate identity or prove prior authorization.; No clean-provenance claim is made.

## Required evidence

- Exact operator choices
- date/source
- commit SHAs
- material hashes
- and documentation consistency output.

## Review questions

- Are the operator choices recorded exactly?; Is the source and limitation stated?; Are no fake APK decision events created?

## Counterexample searches

- Search a claim of clean provenance
- an invented epoch
- or an acceptance attributed to someone other than the explicit operator response.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Append the recorded decisions to docs/delivery/corrective-provenance-audit.md.
- Update docs/delivery/document-proposals-readiness.md and docs/progress.md.

## Notes

- Operator source: explicit answers in the v0.6.0 release session on 2026-11-08.
- This task records decisions; it does not validate a tag or promote the sentinel.
