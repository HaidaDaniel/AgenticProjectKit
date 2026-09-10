# Task 0082 - Document resource-aware execution architecture and backlog

State: done
Owner: codex-resource-docs
Mode: product
Lane: documentation
Type: docs
Scope: architecture,docs,tasks,roadmap
Risk: low
Parallel: false
Depends on: none
Tags: docs

## Goal

Record the approved resource-aware execution architecture in repository documentation and create six implementation-ready task contracts without implementing runtime capabilities.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/roadmap.md
- docs/progress.md
- docs/modes.md
- docs/improvements.md
- docs/delivery/milestones.md
- .agentic/config.json
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0068-make-context-suggestions-dependency-and-change-aware.md
- .tasks/0070-add-end-to-end-task-execution-provenance.md
- .tasks/0071-expose-concise-workflow-gate-and-evidence-status.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md
- .tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md
- .tasks/0075-validate-next-agenticprojectkit-release-against-gated-workflow.md
- .tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md
- .tasks/0078-add-first-class-local-quality-guardrails-for-agenticprojectkit-itself.md
- .tasks/0079-add-minimal-clean-checkout-ci-and-release-quality-proof-for-agenticprojectkit.md
- .tasks/0080-resolve-task-0073-independent-review-reliability-findings.md
- .tasks/0081-allow-automatic-independent-review-orchestration.md

## Files allowed to edit

- docs/execution-profiles.md
- docs/modes.md
- docs/roadmap.md
- docs/improvements.md
- docs/architecture.md
- docs/delivery/milestones.md
- docs/progress.md
- docs/decisions.md
- .tasks/0083-resource-and-worker-registry.md
- .tasks/0084-execution-profiles-and-resource-aware-routing.md
- .tasks/0085-adaptive-assurance-and-review-budget.md
- .tasks/0086-resource-detection-and-workflow-calibration.md
- .tasks/0087-worker-attention-and-resource-status.md
- .tasks/0088-optional-isolated-parallel-workspaces.md

## Files forbidden to edit

- src/**
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .tasks/0001-*.md
- .tasks/0002-*.md
- .tasks/0003-*.md
- .tasks/0004-*.md
- .tasks/0005-*.md
- .tasks/0006-*.md
- .tasks/0007-*.md
- .tasks/0008-*.md
- .tasks/0009-*.md
- .tasks/001*-*.md
- .tasks/002*-*.md
- .tasks/003*-*.md
- .tasks/004*-*.md
- .tasks/005*-*.md
- .tasks/006*-*.md
- .tasks/007*-*.md
- .tasks/0080-*.md
- .tasks/0081-*.md
- .tasks/archive/**

## Steps

1. Document the approved architecture in one primary execution-profiles document and add focused cross-references
2. Create six dependency-ordered implementation task contracts after the current maximum task ID
3. Validate task graph paths links and documentation consistency

## Acceptance criteria

- Project mode task risk and executionProfile are documented as independent axes
- Resource model profiles adaptive assurance deterministic-first review budgets calibration status and worktree boundaries are documented with a constrained reference example
- Six todo unowned implementation tasks have concrete scope dependencies acceptance criteria verification and non-goals
- Existing completed task history and pending quality release task contracts remain unchanged
- Repository contract lint and git diff check pass

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Create docs/execution-profiles.md
- Update modes roadmap improvements architecture milestones decisions and progress

## Notes

- Documentation and planning only; no runtime CLI schema or provider integration implementation
- Existing 0074 ownership and lifecycle remain untouched
- Resource-aware tasks do not block independent 0077-0079 deterministic quality work
