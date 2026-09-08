# Task 0061 - Introduce risk and task-policy requirements

State: todo
Owner: none
Mode: product
Lane: policy
Scope: policy,cli,tests,docs
Risk: high
Parallel: true
Depends on: 0057,0058
Tags: risk,policy,guardrails,task-types

## Goal

Deterministic effective policy turns task risk and classification into calculated mandatory completion requirements; enforcement starts in 0062.

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
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/commands/task.ts
- src/core/config/types.ts
- src/core/config/schema.ts
- src/core/config/defaults.ts
- src/core/config/schema.test.ts
- src/core/modes/index.ts
- src/core/audit/index.ts
- src/core/status/index.ts
- docs/cli-commands.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md
- .tasks/0058-add-first-class-task-evidence-records.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/config/*.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/architecture.md
- docs/cli-commands.md
- docs/progress.md
- docs/decisions.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Define small policy representation and risk defaults using existing task risk/mode/tags.
2. Resolve additive task-type/tag requirements; diagnose conflicts and render effective requirements.
3. Test risk/tag combinations and safe legacy defaults; document pending enforcement integration.

## Acceptance criteria

- Low risk requires automated verification; medium adds scope and lightweight/independent review requirement; high requires verification, scope, independent review and declared evidence categories.
- Unresolved high-risk required evidence is represented as blocking; downstream gate can enforce all requirements.
- Resolver reports medium/high review requirements without changing done transitions; 0063 provides review capability before 0062 activates final enforcement.
- Task type/tag policy adds requirements to risk defaults; deterministic resolver returns explainable effective policy without LLM.
- Conflicting configuration produces actionable diagnostics; legacy repositories receive documented safe compatible defaults.
- Minimal extension mechanism accommodates migration, async/worker, deployment, benchmark/evaluation, security, provider/integration and release policies without hardcoding dozens of checks.
- Tests cover all risk levels, tag combinations, conflicts and legacy defaults.

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

- Backlog reference: APK-GATE-05. Milestone 1.
- Risk enum and tags already exist; current status displays counts and current audit has static readiness checks. This task supplies policy resolution, not another task classifier UI.
- Policy resolution only: calculated requirements remain explicit, including unmet review requirements. No final completion enforcement until 0062 composes already-available verification, scope, evidence and 0063 review capabilities.
- Non-goals: verification execution, review agents or full domain-template content. Prefer existing dependencies.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
