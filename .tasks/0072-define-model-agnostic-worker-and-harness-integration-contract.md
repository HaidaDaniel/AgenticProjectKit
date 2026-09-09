# Task 0072 - Define model-agnostic worker and harness integration contract

State: done
Owner: codex-20260909
Mode: product
Lane: integration
Scope: integration,cli,tests,docs
Risk: medium
Parallel: true
Depends on: 0063,0067,0070
Tags: agents,harness,opencode,codex,interoperability

## Goal

Vendor-neutral worker packages and results let different coding harnesses implement, review, fix or verify one APK task without losing contracts or provenance.

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
- src/core/exporters/index.ts
- src/core/templates/renderer.test.ts
- src/core/templates/exporters/codex.md.hbs
- src/core/templates/exporters/opencode.md.hbs
- src/core/agents/index.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/docs/context.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/core/work/index.ts
- docs/agent-exporters.md
- docs/cli-commands.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0070-add-end-to-end-task-execution-provenance.md

## Files allowed to edit

- src/core/work/*.ts
- src/core/agents/*.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/exporters/index.ts
- src/core/templates/exporters/*.hbs
- src/core/templates/renderer.test.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/core/tasks/task.test.ts
- src/cli/commands/work.ts
- src/cli/commands/prompt.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .codex/instructions.md
- .opencode/AGENTS.md
- .cursor/rules/*.mdc
- docs/agent-exporters.md
- docs/task-system.md
- docs/architecture.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Define minimal shared work-package/result representation with role independent of vendor.
2. Adapt one or two existing exporter paths as proof; preserve all existing exports and sync behavior.
3. Test cross-harness implementation/review handoff, evidence validation and provenance continuity.

## Acceptance criteria

- Worker receives task context, implement/review/fix/verify role, constraints and output/evidence expectations.
- Worker returns run identity, status, optional commit/diff identity, evidence, review findings and completion/failure reason.
- Role is separate from vendor; same task can be implemented by one agent and reviewed by another.
- Core requires no Codex/OpenCode/Claude SDK; exporter-specific formatting stays outside core task model.
- Run provenance survives export/import; one or two existing exporter paths demonstrate common contract.
- Existing exports remain compatible and generated instruction drift tests pass; regression tests cover role and result round trips.

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"work-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts work --help"}`
- `{"id":"sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts sync"}`

## Documentation updates

- Update docs/agent-exporters.md for implemented behavior and examples.
- Update docs/task-system.md for implemented behavior and examples.
- Update docs/architecture.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-HARNESS-01. Milestone 4.
- NeutralAgentPolicy and six prompt targets already exist. Build on exporter/prompt/work/run boundaries; no vendor-specific redesign.
- Non-goals: autonomous agent runtime, all-vendor API integrations, remote execution daemon or arbitrary plugin system. Generated instruction edits only from neutral source/templates.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
