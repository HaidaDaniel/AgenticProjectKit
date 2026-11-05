# Task 0250 - Validate safe downstream upgrade and legacy migration guidance

State: done
Owner: opencode-0244-0251
Mode: maintenance
Lane: adoption
Type: migration
Scope: upgrade,migration,installation,compatibility,docs
Risk: high
Parallel: false
Depends on: 0244
Tags: p1,upgrade,migration,installation,compatibility,docs

## Goal

Re-verify how APK upgrades pinned installations and legacy repositories using the existing doctor adopt compatibility and installation diagnostics then deliver one bounded reproducible safe-upgrade and migration-acceptance guidance with fixture tests and no new migration engine or downstream repair.

## Context files

- AGENTS.md
- docs/engineering/apk-upgrade-workflow.md
- docs/adoption-flow.md
- docs/task-system.md
- docs/product/maturity-and-compatibility.md
- docs/decisions.md
- docs/progress.md
- docs/releases/v0.5.2.md
- docs/delivery/workflow-v0.5.2-post-release.md
- src/core/doctor/installation.ts
- src/core/doctor/doctor.test.ts
- src/core/config/compatibility.ts
- src/core/config/schema.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/init/index.ts
- src/cli/command.test.ts
- .tasks/0234-diagnose-unreproducible-apk-installations-and-launcher-mismatches.md
- .tasks/0235-report-legacy-task-incompatibilities-and-a-safe-manual-migration-plan.md
- .tasks/0236-expose-tracked-apk-operational-artifacts-in-doctor-with-migration-guidance.md
- .tasks/0244-fix-stale-installation-guidance-for-the-validated-release.md

## Files allowed to edit

- docs/engineering/apk-upgrade-workflow.md
- docs/adoption-flow.md
- docs/task-system.md
- docs/product/maturity-and-compatibility.md
- docs/decisions.md
- docs/progress.md
- docs/delivery/downstream-upgrade-acceptance.md
- src/core/doctor/installation.ts
- src/core/doctor/doctor.test.ts
- src/core/config/compatibility.ts
- src/core/config/schema.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/init/index.ts
- src/cli/command.test.ts
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .tasks/0223-add-opt-in-exact-commit-local-ci-parity-before-push.md
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/core/backlog/**
- src/cli/commands/**

## Steps

1. Recheck the recorded downstream version observations against current immutable release and delivery records and label every claim observed inferred or unverified; separate simple pinned-tag upgrade legacy config and task-contract migration and unpinned external installation; exercise existing doctor and adopt preview on disposable fixtures representing v0.3.1 and current v0.5.x repository shapes; inspect task-contract compatibility archived IDs dependencies ignored operational state generated instructions lockfile and launcher identity; fix only real bounded diagnostic or test gaps rather than adding a migration engine or rewriting task history; write one reproducible safe upgrade walkthrough with stop recovery and rollback conditions and explicit private-repository availability limits; include read-only detection of legacy agentStyle caveman without changing preferences; record acceptance results separately from unverified downstream claims

## Acceptance criteria

- The guidance distinguishes pinned-tag upgrade, legacy config and task-contract migration, and unpinned external installation.
- Existing doctor and adopt diagnostics are reused; any new test coverage is fixture-based.
- The walkthrough is reproducible and states required version, lockfile, launcher, and compatibility checks plus stop and rollback conditions.
- Private or unavailable downstream repositories are named as unavailable rather than claimed validated.
- No downstream repository is modified.
- No automatic task-history rewrite or migration engine is introduced.
- Legacy agentStyle caveman is only reported read-only and never changed automatically.
- The acceptance record separates observed facts from hypotheses and unverified versions.
- The task does not depend on backlog planning integration and does not claim to validate it.
- All checks use local fixtures and do not require a live paid LLM or unavailable external service.

## Correctness assumptions

- The current doctor adopt and compatibility surfaces may already cover most migration facts; a disposable fixture can represent the relevant repository shapes without accessing private projects; a tag pin upgrade is materially simpler than a legacy contract migration

## Invariants

- Do not rewrite task history or evidence; do not change user preferences; do not claim end-to-end validation when only local fixtures ran; do not repair downstream repositories in this task; published tags and release records remain immutable

## Required evidence

- Fixture-based acceptance results for pinned legacy and unpinned shapes; doctor and adopt preview output; computed or explicitly unverified downstream version observations; the documented safe walkthrough and its stop conditions

## Review questions

- Does the walkthrough confuse a declared pin with an installed CLI or a config schema version with a package version; can it cause an operator to rewrite task history or skip evidence revalidation; are unavailable private repositories honestly marked; does the guidance add an unnecessary migration command

## Counterexample searches

- v0.3.1 config without schema marker; current pin with stale launcher; lockfile and manifest disagree; unsupported newer schema; archived task IDs and dependencies; generated instructions customized by the user; legacy agentStyle caveman; private repository unavailable; unpinned external installation

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"upgrade-acceptance-report","type":"automated","required":true,"environment":"local","profile":"report","command":"test -s docs/delivery/downstream-upgrade-acceptance.md","artifact":"docs/delivery/downstream-upgrade-acceptance.md"}`

## Documentation updates

- Update the upgrade workflow adoption flow task-system maturity compatibility and decision docs; add the downstream upgrade acceptance record under docs/delivery; update docs/progress.md when task state changes

## Notes

- Depends on task 0244 because the migration acceptance checks current installation guidance against the validated-release source of truth. It deliberately does not depend on backlog planning integration (Task 0249), which is not an API or semantic prerequisite for upgrade and legacy migration.
- Tasks 0234, 0235, and 0236 already provide installation, compatibility, and tracked-operational diagnostics and must not be duplicated; downstream observations dated 2026-11-05 are inputs to recheck, not proof of current installations.
- Tasks 0245, 0246, and 0249 also edit src/core/init/index.ts or src/core/docs/adopt.ts; this task is not dependent on them because migration acceptance is not their API prerequisite. Sequence shared init/adopt, docs, and dist edits or use an isolated worktree.
- Active todo Task 0223 also edits docs/decisions.md docs/progress.md and dist; blocked Task 0150 would touch AGENTS.md README and broad docs if it were ever unblocked. Do not start those mutable tasks in the same checkout without sequencing or an isolated worktree.
