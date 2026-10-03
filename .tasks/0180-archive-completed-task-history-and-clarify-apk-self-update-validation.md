# Task 0180 - Archive completed task history and clarify APK self-update validation

State: done
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

- .tasks/00*.md
- .tasks/011*.md
- .tasks/016*.md
- .tasks/0100-complete-worker-session-semantic-projection-for-task-0087.md
- .tasks/0101-align-execution-calibration-safety-with-task-assurance-policy.md
- .tasks/0102-final-resourceworkspace-integration-hardening.md
- .tasks/0103-complete-workspace-provenance-binding-and-calibration-sentinel-semantics.md
- .tasks/0104-close-workspace-canonical-resource-and-calibration-sentinel-contract-gaps.md
- .tasks/0106-align-adopt-agentsmd-export-with-canonical-drift-check.md
- .tasks/0107-choose-a-free-adoption-task-id-in-repositories-with-existing-tasks.md
- .tasks/0108-make-review-fields-a-coherent-projection-of-canonical-assurance.md
- .tasks/0121-document-candidate-and-completion-bookkeeping-commit-lifecycle.md
- .tasks/0122-align-repository-readiness-test-findings-with-detected-test-capability.md
- .tasks/0125-research-non-node-apk-installation-and-distribution.md
- .tasks/0126-research-agent-driven-apk-upgrade-workflow.md
- .tasks/0137-add-optional-project-level-grill-skill.md
- .tasks/0138-correct-release-evidence-ordering-in-release-task-template-and-release-docs.md
- .tasks/0139-release-v045-with-project-level-grill.md
- .tasks/0140-clarify-v045-release-evidence-chronology-without-rewriting-the-tag.md
- .tasks/0141-add-local-human-communication-language-preference.md
- .tasks/0142-preserve-decision-context-in-interactive-grill-skills.md
- .tasks/0143-warn-when-legacy-explicit-caveman-remains-configured.md
- .tasks/0144-release-v046-with-communication-and-grill-ux-corrections.md
- .tasks/0151-separate-apk-requirements-from-downstream-project-templates.md
- .tasks/0152-define-public-maturity-and-compatibility-policy.md
- .tasks/0153-make-progressmd-a-concise-current-state-document.md
- .tasks/0154-modernize-scopemd-around-current-and-historical-scope.md
- .tasks/0155-reframe-roadmapmd-as-shipped-current-planned-and-deferred.md
- .tasks/0156-mark-old-delivery-milestones-as-historical.md
- .tasks/0157-clarify-architecture-truth-and-normalize-adr-lifecycle.md
- .tasks/0158-add-a-documentation-home.md
- .tasks/0159-write-a-canonical-getting-started-guide.md
- .tasks/0171-establish-a-release-changelog-and-index-strategy.md
- .tasks/0172-add-runnable-greenfield-brownfield-and-local-first-showcases.md
- .tasks/0174-release-v047-correctness-foundation.md
- .tasks/0175-restore-committed-dist-currency-and-prevent-source-task-dist-divergence.md
- .tasks/0176-make-remaining-public-readiness-task-contracts-internally-satisfiable.md
- .tasks/0177-fix-ci-coverage-failure-and-enforce-checks-before-push.md
- .tasks/0173-validate-the-next-public-readiness-release.md
- .tasks/0179-require-externally-observed-ci-for-every-declared-ci-verification-check.md
- .tasks/0180-archive-completed-task-history-and-clarify-apk-self-update-validation.md
- .tasks/0181-prefer-current-operator-decisions-over-stale-candidate-history.md
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
- `{"id":"archive-integrity","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test \"$(git diff --summary --find-renames=100% 23c2db679b10cc7251449015e2f9320cae0aface HEAD -- .tasks | rg -c '^ rename \\.tasks/\\{ => archive\\}/.* \\(100%\\)$')\" -eq 149"}`

## Documentation updates

- Update canonical archive guidance and APK upgrade workflow plus affected task links and current progress

## Notes

- Final archive preflight retains Task 0178 because unfinished Task 0173 explicitly lists its contract as context. The actual set is 149 moves and 21 retained completed contracts; this refines the preliminary 150 estimate without changing live context paths.
- 2026-10-03: source SHA f9a567ce49c5416d5c3d1cd8ce9ea9aec84f36d8 packed and installed as agentic-project-kit 0.4.7 in a fresh consumer/store; preview preserved 471 source-copy files; apply sync lint doctor and status passed; main checkout unchanged. Log: /tmp/apk-self-update-smoke-qghnsyrt/smoke.log
- 2026-10-03: commit 53024b13e2709c3768d9642d4ddd90bd931a8ddf appeared during the interrupted session and already contains the archive moves and new contracts. It is preserved as-is; archive integrity is compared from this task's original 23c2db6 baseline rather than assuming all moves are in the final candidate's parent commit.
