# Task 0070 - Add end-to-end task execution provenance

State: todo
Owner: none
Mode: product
Lane: observability
Scope: observability,cli,tests,docs
Risk: medium
Parallel: true
Depends on: 0058,0060,0062,0063
Tags: provenance,traceability,commits,runs,evidence

## Goal

Task provenance traces implementation runs, baseline, commits/diff, revision-bound verification/review and exact completion evidence set, including current/stale and superseded history.

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
- src/core/agents/index.ts
- src/core/analytics/index.ts
- src/core/analytics/analytics.test.ts
- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/status/index.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md

## Files allowed to edit

- src/core/agents/*.ts
- src/core/analytics/index.ts
- src/core/analytics/analytics.test.ts
- src/core/tasks/*.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/architecture.md
- docs/cli-commands.md
- docs/progress.md
- docs/decisions.md
- .tasks/0070-add-end-to-end-task-execution-provenance.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Connect existing claim baseline, run identity, evidence and completion records into queryable chain.
2. Expose per-task human/machine provenance output including multiple implementation/fixer runs, evidence subject revisions, current/stale status and superseded evidence links.
3. Test failed-review/fix history, final gate evidence references and non-code work without commits.

## Acceptance criteria

- Query by task ID answers who worked, which agent/harness, baseline, resulting commits/diff, checks, review and completion evidence.
- Chain task -> implementation run -> commits/diff -> verification -> review -> completion is traceable.
- Multiple implementation runs supported; fixer after failed review preserves prior history.
- Final completion references exact evidence set and candidate identity used by gate, retaining freshness at decision time alongside current freshness.
- Each evidence entry exposes subject revision/baseline/worktree identity, current/stale status and superseded links; stale/superseded entries remain visible rather than deleted.
- Regression covers A evidence becoming stale after B changes, superseding verification/review and reconstruction of final exact completion evidence set.
- Absent commits do not break non-code tasks; missing links are explicit.
- Output supports humans and automation without dumping raw logs; regression tests cover chain integrity and multi-run history.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk task create --help
- pnpm exec apk doctor

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/architecture.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-PROVENANCE-01. Milestone 3.
- Existing run log records lifecycle events and analytics aggregates them; add linkage/query semantics rather than duplicate telemetry storage.
- Reporting only: reuse evidence freshness semantics and gate decision records. Completion enforcement stays in 0062; provenance adds no parallel policy/gate layer.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
