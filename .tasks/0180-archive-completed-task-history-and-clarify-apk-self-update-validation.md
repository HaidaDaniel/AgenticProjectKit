# Task 0180 - Archive completed task history and clarify APK self-update validation

State: doing
Owner: codex-maintenance-20261003
Mode: maintenance
Lane: maintenance
Type: docs
Scope: tasks,docs,maintenance
Risk: medium
Parallel: false
Depends on: 0178
Tags: docs,maintenance

## Goal

Reduce top-level task noise without rewriting completed contracts or breaking live context and dependencies; document development versus released APK self-validation and preserve the planned hosted-CI corrective backlog.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- docs/roadmap.md
- docs/history/progress-history.md
- docs/delivery/milestones.md
- docs/engineering/apk-upgrade-workflow.md
- docs/engineering/documentation-maintenance.md
- .tasks/0173-validate-the-next-public-readiness-release.md

## Files allowed to edit

- .tasks/*.md
- .tasks/archive/*.md
- docs/architecture.md
- docs/roadmap.md
- docs/progress.md
- docs/history/progress-history.md
- docs/delivery/milestones.md
- docs/task-system.md
- docs/engineering/apk-upgrade-workflow.md
- docs/engineering/documentation-maintenance.md

## Files forbidden to edit

- src/**
- dist/**
- package.json
- pnpm-lock.yaml
- .github/**
- docs/releases/**
- docs/decisions.md
- .tasks/0170-publish-a-truthful-security-reporting-policy.md
- .tasks/0109-prepare-v041-downstream-codexopencode-dogfood-release.md
- .tasks/0133-release-v044-and-adopt-released-workflow-rules-in-apk-itself.md
- .tasks/0124-make-caveman-explicitly-user-opt-in-instead-of-an-automatic-default.md
- .tasks/0120-preserve-actionable-task-transition-reasons-and-truncate-only-presentation.md
- .tasks/0150-implement-a-human-approved-project-rebrand.md
- .tasks/0149-research-and-recommend-a-public-project-name.md

## Steps

1. Create the previously planned hosted-CI corrective contract and record the observed decision-selection follow-up separately
2. Register and claim this maintenance task
3. Compute the archive set from done state excluding explicit unfinished-task context immutable note links and source-fixture references
4. Move eligible tasks with APK archive while preserving contents
5. Update current and historical documentation links without rewriting completed task contracts
6. Update Task 0173 to retain its prerequisites and require 0179; document candidate self-adoption before publication as distinct from actual-tag post-release smoke
7. Document source executable versus generated metadata versus installed release self-updates and record the isolated tarball smoke observed on 2026-10-03
8. Commit the candidate then verify contract lint documentation consistency whitespace and exact archive integrity
9. Pass the completion gate and commit lifecycle bookkeeping separately

## Acceptance criteria

- 149 eligible done contracts move byte-identically to .tasks/archive
- Explicit live context and source-fixture paths stay present
- Dependencies remain resolvable across archive
- Current documentation links and task state rows pass the checker
- Task 0173 retains all prerequisites and adds 0179
- Development build and pre-tag versus actual-tag self-validation are explained
- No self-dependency or automatic main adoption is added
- Observed diagnostic self-adoption smoke and limits are recorded
- The two corrective follow-up contracts stay todo

## Invariants

- Archive only done contracts with byte-identical contents.
- Keep explicit completed-task context required by unfinished contracts and literal source-fixture references at their existing paths.
- Preserve immutable versioned release notes and tags.
- Update current documentation links for moved tasks; preserve historic completed-task text.
- No package self-dependency or automatic main-checkout adoption.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"archive-integrity","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test \"$(git diff --summary --find-renames=100% HEAD^ HEAD -- .tasks | rg -c '^ rename \\.tasks/\\{ => archive/\\}/.* \\(100%\\)$')\" -eq 149"}`

## Documentation updates

- Update canonical archive guidance and APK upgrade workflow plus affected task links and current progress

## Notes

- Final archive preflight retains Task 0178 because unfinished Task 0173 explicitly lists its contract as context. The actual set is 149 moves and 21 retained completed contracts; this refines the preliminary 150 estimate without changing live context paths.
- 2026-10-03: source SHA f9a567ce49c5416d5c3d1cd8ce9ea9aec84f36d8 packed and installed as agentic-project-kit 0.4.7 in a fresh consumer/store; preview preserved 471 source-copy files; apply sync lint doctor and status passed; main checkout unchanged. Log: /tmp/apk-self-update-smoke-qghnsyrt/smoke.log
