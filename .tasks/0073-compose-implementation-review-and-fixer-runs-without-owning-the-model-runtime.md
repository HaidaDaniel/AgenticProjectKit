# Task 0073 - Compose implementation, review and fixer runs without owning the model runtime

State: done
Owner: codex-20260909
Mode: product
Lane: workflow
Scope: workflow,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0072,0063,0062
Tags: multi-agent,workflow,review,fixer

## Goal

APK coordinates implement -> verify -> review -> fix -> verify -> review -> gate through explicit work packages and recorded external runs.

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
- src/core/work/index.ts
- src/cli/commands/work.ts
- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/agents/index.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/agent-exporters.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md

## Files allowed to edit

- src/core/work/*.ts
- src/core/tasks/*.ts
- src/core/status/*.ts
- src/core/docs/context.ts
- src/core/audit/*.ts
- src/core/agents/*.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/cli/commands/work.ts
- src/cli/commands/task.ts
- src/cli/commands/task-state.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/agent-exporters.md
- README.md
- docs/architecture.md
- docs/progress.md
- docs/decisions.md
- .gitignore
- .tasks/0076-recover-stale-task-mutation-locks-safely.md
- .tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend current CLI-only work loop to select next role/action from recorded outcomes and persist every issued package.
2. Pass findings to fixer, preserve review history and register completed runs through worker contract.
3. Test manual CLI lifecycle with failed review, fix, re-verification, new review and common completion gate.

## Acceptance criteria

- Workflow state machine is vendor-neutral and usable manually via CLI plus any external harness.
- APK persists each issued work package, registers completed runs, and explains the next required role; the next actor explicitly issues the next real package.
- Failed review yields actionable fixer package containing findings.
- Fix preserves earlier review history; new verification and independent review required as policy dictates.
- Implementation agent cannot declare its own mandatory independent review successful.
- Completion always uses common gate; regression tests cover full pass and fail/fix/review cycles.

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"work-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts work --help"}`
- `{"id":"sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts sync"}`

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/agent-exporters.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-HARNESS-02. Milestone 4.
- startWork already claims/continues and prints verify/review/done commands. Extend this surface into role-aware coordination.
- No model runtime ownership, automatic vendor API launch or autonomous swarm.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
