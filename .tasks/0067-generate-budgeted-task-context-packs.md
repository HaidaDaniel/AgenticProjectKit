# Task 0067 - Generate budgeted task context packs

State: todo
Owner: none
Mode: product
Lane: context
Scope: context,cli,tests,docs
Risk: medium
Parallel: true
Depends on: 0057
Tags: context,prompt,tokens,relevance,agent-efficiency

## Goal

Deterministic context packs fit explicit size budgets while preserving required task contracts and instructions.

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
- src/core/context-suggestions/index.ts
- src/core/docs/context.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/scanners/index.ts
- src/core/docs/adopt.test.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/exporters/index.ts
- src/cli/commands/context.ts
- src/cli/commands/prompt.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md

## Files allowed to edit

- src/core/docs/context.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/context-suggestions/*.ts
- src/core/scanners/index.ts
- src/core/tasks/task.test.ts
- src/cli/commands/context.ts
- src/cli/commands/prompt.ts
- src/cli/cli.test.ts
- docs/context-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0067-generate-budgeted-task-context-packs.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend current level-based file selection with stable budget units and required/relevant/optional tiers.
2. Rank local task/path/dependency signals; retain required contracts and diagnose oversized required context.
3. Expose context --budget equivalent and prompt integration; test small local fixture repositories.

## Acceptance criteria

- Budgeted CLI accepts stable token estimate or documented approximate size unit; successful context pack stays within budget.
- Required tier retains active task, agent instructions, explicit context and relevant architecture/contracts; optional files cannot evict required files.
- Required context exceeding budget yields explicit oversized diagnostic, never silent loss of mandatory contracts.
- Relevant tier considers affected source/tests, available imports/dependencies and recent relevant decisions; optional tier covers secondary docs/history.
- Ordering and size accounting are deterministic; signals use task paths, explicit declarations, dependency graph, changed files and path relationships.
- Implementation prompts can consume packs; representation supports review prompts without depending on later review implementation.
- Legacy --level behavior remains usable; operational run/registry/lock exclusions remain intact.
- No network/model/embedding dependency; small-fixture tests cover selection, ordering and budget overflow.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk context --help
- pnpm exec apk suggest-context --help

## Documentation updates

- Update docs/context-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-CONTEXT-01. Milestone 3.
- Current context returns level-based file lists; suggest-context ranks filename/path keywords. Scanner detects stack/readiness, not import graph.
- Scope here is bounded pack construction and existing signals; 0068 deepens dependency/change-aware relevance. No RAG, vector store or embedding system.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
