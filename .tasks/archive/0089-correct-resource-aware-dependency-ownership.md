# Task 0089 - Correct resource-aware dependency ownership

State: done
Owner: codex-resource-docs
Mode: product
Lane: documentation
Type: docs
Scope: tasks,roadmap,architecture
Risk: low
Parallel: false
Depends on: none
Tags: docs

## Goal

Correct the resource-aware task graph and make routing versus assurance ownership unambiguous before implementation.

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/roadmap.md
- docs/delivery/milestones.md
- docs/progress.md
- .tasks/0084-execution-profiles-and-resource-aware-routing.md
- .tasks/0085-adaptive-assurance-and-review-budget.md
- .tasks/0086-resource-detection-and-workflow-calibration.md
- .tasks/0087-worker-attention-and-resource-status.md
- .tasks/0088-optional-isolated-parallel-workspaces.md

## Files allowed to edit

- .tasks/0084-execution-profiles-and-resource-aware-routing.md
- .tasks/0086-resource-detection-and-workflow-calibration.md
- .tasks/0087-worker-attention-and-resource-status.md
- docs/roadmap.md
- docs/delivery/milestones.md
- docs/progress.md

## Files forbidden to edit

- src/**
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .tasks/000*-*.md
- .tasks/001*-*.md
- .tasks/002*-*.md
- .tasks/003*-*.md
- .tasks/004*-*.md
- .tasks/005*-*.md
- .tasks/006*-*.md
- .tasks/007*-*.md
- .tasks/0080-*.md
- .tasks/0081-*.md
- .tasks/0082-*.md
- .tasks/0083-*.md
- .tasks/0085-*.md
- .tasks/0088-*.md
- .tasks/archive/**

## Steps

1. Make 0086 and 0087 depend on canonical adaptive assurance from 0085
2. Restrict 0084 to execution-profile resource eligibility cost capacity routing overrides and wait/queue ownership
3. Update roadmap milestones and progress consistently
4. Run canonical scope and contract verification

## Acceptance criteria

- 0086 depends on 0077 and 0085
- 0087 depends on 0070 0071 and 0085
- 0086 and 0087 remain parallel after 0085
- 0084 explicitly consumes existing policy requirements and does not own assurance levels triggers or review budgets
- 0088 remains downstream of 0087
- Existing release quality dependencies and Task 0082 history remain unchanged

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update roadmap milestone graph and progress note

## Notes

- Follow-up correction only; no runtime or CLI implementation
- Use normal create claim verify gate done lifecycle
