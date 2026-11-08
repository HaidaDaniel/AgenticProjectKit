# Task 0264 - Audit corrective provenance for tasks 0252, 0256, 0260, and 0261

State: canceled
Owner: none
Mode: audit
Lane: audit
Type: audit
Scope: provenance,audit,release-readiness,tasks,docs
Risk: medium
Parallel: false
Depends on: none
Tags: p1,provenance,audit,release-readiness

## Goal

Establish and document the factual claim, contract, candidate, evidence, and completion chronology for tasks 0252, 0256, 0260, and 0261, classify any post-claim contract changes, and identify the operator decisions or authorized recovery paths needed for honest release readiness.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/progress.md
- .tasks/0252-validate-configured-repository-paths.md
- .tasks/0256-honor-custom-task-directory-during-adoption.md
- .tasks/0260-support-task-ids-beyond-9999-consistently.md
- .tasks/0261-fail-closed-on-invalid-config-in-compatibility-and-adoption.md

## Files allowed to edit

- docs/delivery/corrective-provenance-audit.md
- docs/progress.md
- docs/index.md

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/**

## Steps

1. Establish per-task creation commit, claim baseline head and contract hash, candidate commits and changed files, completion evidence, review evidence, gate decisions, and current material contract hash for tasks 0252, 0256, 0260, and 0261 using Git and read-only APK provenance commands.
2. Compare each baseline contract hash with the current material contract hash and separate lifecycle-only changes (state, owner, notes) from material changes (dependencies, allowed files, scope, acceptance).
3. Determine whether any material change happened after claim, whether an audited amendment epoch exists, and whether the actual changed files fit the allowed scope at the relevant stage.
4. Classify every finding into: correct history, documented limitation, required audited amendment epoch, explicit operator decision, or unrecoverable without forbidden history rewrite.
5. Write docs/delivery/corrective-provenance-audit.md with task and commit SHAs, baseline/current hashes, findings, evidence limits, authorized recovery paths, confirmed facts, operator acceptance requests, and release-readiness impact.
6. Update docs/progress.md and any required documentation index link; do not rewrite historical contracts, baselines, evidence, or Git history.

## Acceptance criteria

- The audit report records facts and SHA references rather than declaring unproven history fully restored.
- Each finding is classified and backed by the specific Git or APK evidence that establishes it.
- Any required operator decision is stated explicitly with what it would and would not prove.
- No historical evidence, baseline hash, task contract, or Git commit is rewritten.
- Release-readiness impact is stated without weakening APK policy for a cosmetic PASS.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Create docs/delivery/corrective-provenance-audit.md.
- Link the report from docs/index.md if the documentation index requires it.
- Update docs/progress.md when task state changes.

## Notes

- This is a read-only provenance audit plus a documented report, not permission to rewrite history.
- Tasks 0256 and 0260 show post-claim material contract changes in their completion commits; classify them only after checking all evidence.
- cancel: Contract omitted evidence declaration needed for high-assurance provenance audit; canceled before implementation and superseded by corrected successor.
