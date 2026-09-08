# Task 0075 - Validate next AgenticProjectKit release against gated workflow

State: todo
Owner: none
Mode: production
Lane: release
Scope: release,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0057,0058,0059,0060,0061,0062,0063,0064,0065,0066,0067,0068,0069,0070,0071,0072,0073,0074
Tags: release,e2e,dogfood,gated-workflow

## Goal

Release candidate has reproducible end-to-end gated-workflow evidence from APK itself and at least one self-contained fixture/adopted example.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- package.json
- README.md
- src/cli/cli.test.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.test.ts
- src/core/agents/index.ts
- src/core/work/index.ts
- src/core/status/index.ts
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts
- scripts/clean-dist.mjs
- scripts/copy-template-assets.mjs
- docs/engineering/testing-strategy.md
- docs/delivery/milestones.md
- docs/roadmap.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0059-execute-task-verification-profiles-and-record-evidence.md
- .tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md
- .tasks/0065-add-typed-task-templates-with-domain-specific-guardrails.md
- .tasks/0066-add-built-in-repository-and-task-contract-linting.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0068-make-context-suggestions-dependency-and-change-aware.md
- .tasks/0069-add-bounded-agent-dogfooding-evidence.md
- .tasks/0070-add-end-to-end-task-execution-provenance.md
- .tasks/0071-expose-concise-workflow-gate-and-evidence-status.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md
- .tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md

## Files allowed to edit

- src/cli/cli.test.ts
- src/core/tasks/task.test.ts
- src/core/tasks/fixtures/**
- src/core/init/init.test.ts
- src/core/docs/adopt.test.ts
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts
- docs/delivery/gated-workflow-release-evidence.md
- docs/analytics/gated-workflow-dogfood.md
- docs/delivery/milestones.md
- docs/roadmap.md
- docs/engineering/testing-strategy.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0075-validate-next-agenticprojectkit-release-against-gated-workflow.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Identify exact candidate version/tree/SHA and validate package build/checks; consume upgrade fixture from 0074.
2. Exercise real CLI success and rejection scenarios in isolated repositories, including cross-harness handoff and review/fix loop.
3. Record bounded real dogfood session on APK plus fixture/adopted example; attach candidate-specific evidence and update release-readiness docs.

## Acceptance criteria

- All selected milestone tasks 0057-0074 complete before final release gate.
- Low-risk scenario covers claim, fixture implementation, verification and done.
- High-risk scenario covers claim, verification, scope, independent review, evidence and done.
- Scope violation and failed required verification each reject completion.
- Missing live/manual evidence rejects completion when policy requires it; fixture pass cannot substitute for live evidence.
- Failed review rejects completion; fixer iteration, re-verification and new independent review can then pass while preserving history.
- v0.3.1-style fixture upgrades and old tasks remain readable.
- Alternate agent/export format preserves task/context/review contract.
- Deterministic automated tests, release checks and package build pass; real CLI workflow evidence accompanies unit fixtures.
- Bounded dogfood session is recorded; failure cannot be relabeled as pass.
- Evidence references actual candidate tree/version/SHA; post-bump or later candidate mutation requires fresh relevant validation.
- Docs accurately describe implemented behavior; release evidence records commands, outcomes, candidate identity and fixture versus real-session limits.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm release:check
- pnpm exec apk doctor
- pnpm exec apk status

## Documentation updates

- Update docs/delivery/milestones.md for implemented behavior and examples.
- Update docs/roadmap.md for implemented behavior and examples.
- Update docs/engineering/testing-strategy.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-RELEASE-02. Milestone 5.
- Release validation task only; feature defects return to owning task with explicit scope update rather than expanding this task into implementation.
- Existing pnpm release:check runs lint/test/build/sync/audit; it does not bump version. No publish, push or version bump authorized by this task.
- Evidence report paths are planned new outputs. Audit report/project map are disposable runtime artifacts, not release evidence by themselves.
- No downstream repository re-audit; use APK and controlled fixture/adopted example.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
