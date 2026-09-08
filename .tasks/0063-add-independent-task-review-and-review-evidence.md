# Task 0063 - Add independent task review and review evidence

State: todo
Owner: none
Mode: product
Lane: review
Scope: review,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0058,0061,0062
Tags: review,independent-review,audit,evidence

## Goal

Independent review has separate reviewer/run identity, findings and evidence that satisfy policy and control completion.

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
- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/agents/index.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/cli/commands/prompt.ts
- src/cli/commands/task-state.ts
- src/core/work/index.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/agents/*.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/work/index.ts
- src/cli/commands/prompt.ts
- src/cli/commands/task-state.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend existing review transition with separately identified reviewer run and structured outcomes.
2. Render review-oriented prompt; persist findings for fixer and integrate review evidence with common gate.
3. Test owner/reviewer identity, failed review, fix iteration and superseding review history.

## Acceptance criteria

- Medium/high-risk policy can require independent review; reviewer run is identified separately from implementation run.
- Implementation run cannot certify its own mandatory independent review; tests cover implementation owner versus reviewer identity.
- Review evidence stores reviewer identity and pass or changes_requested/fail; failed review blocks completion.
- New review after fixes may supersede failure while retaining earlier outcomes/findings and their run links.
- Fixer can retrieve findings; review prompt differs from implementation prompt and tells reviewer to inspect rather than continue implementation.
- Review prompt checks acceptance criteria, hidden assumptions, failure paths and scope; asks for counterexamples and rejects green tests alone as correctness proof.
- Workflow uses no required Codex/OpenCode/vendor API; different harness/model can perform review.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk task create --help
- pnpm exec apk doctor

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/context-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-REVIEW-01. Milestone 2.
- Reuse existing review state and registered-agent/run infrastructure. Separate review role/run semantics from task implementation ownership.
- No automatic model execution. New review after changes must identify reviewed work so unrelated evidence cannot satisfy current gate.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
