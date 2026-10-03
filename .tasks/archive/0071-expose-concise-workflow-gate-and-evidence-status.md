# Task 0071 - Expose concise workflow, gate and evidence status

State: done
Owner: codex-20260909
Mode: product
Lane: developer-experience
Scope: developer-experience,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0062,0070
Tags: status,gate,ux,observability

## Goal

Compact status exposes active-task completion blockers and actionable next steps using actual gate and provenance results.

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
- src/core/status/index.ts
- src/core/doctor/index.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/tasks/index.ts
- src/core/agents/index.ts
- src/cli/commands/status.ts
- src/cli/commands/doctor.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0070-add-end-to-end-task-execution-provenance.md

## Files allowed to edit

- src/core/status/*.ts
- src/core/doctor/index.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/cli/commands/status.ts
- src/cli/commands/doctor.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/task-system.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0071-expose-concise-workflow-gate-and-evidence-status.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend existing project status with concise active-task policy/verification/scope/review/evidence summary.
2. Render blockers and recommended next actions from common gate; add detail option where useful.
3. Add output regressions proving consistency with gate outcomes and bounded rendering.

## Acceptance criteria

- Active-task output shows state, owner, risk/effective policy, dependencies, verification progress, scope, review, evidence, gate blockers and next action.
- Default remains concise; detailed output optional and bounded, without huge run logs.
- Blocker reasons agree with actual gate engine; UI contains no duplicated policy resolution.
- Pending live evidence and missing independent review remain visible as blockers.
- Existing status/doctor/audit conventions remain coherent; preserve machine-readable mode if present by implementation time.
- Regression tests cover ready/blocked tasks, detail mode and gate/status consistency.

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"status","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts status"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts doctor"}`

## Documentation updates

- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/task-system.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-UX-01. Milestone 3.
- Current status reports counts, next task, export drift and latest run. Extend that implementation; current CLI output is text, so no invented existing JSON flag.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
