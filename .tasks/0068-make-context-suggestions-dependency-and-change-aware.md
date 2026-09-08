# Task 0068 - Make context suggestions dependency- and change-aware

State: todo
Owner: none
Mode: product
Lane: context
Scope: context,cli,tests,docs
Risk: medium
Parallel: true
Depends on: 0067
Tags: context,dependencies,git,suggestions

## Goal

Context suggestions rank affected dependencies and tests using local changes and task scope, with a reason for each recommendation.

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
- src/core/scanners/index.ts
- src/core/docs/adopt.test.ts
- src/core/docs/context.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/commands/suggest-context.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0067-generate-budgeted-task-context-packs.md

## Files allowed to edit

- src/core/context-suggestions/*.ts
- src/core/scanners/index.ts
- src/core/docs/context.ts
- src/core/docs/adopt.test.ts
- src/core/tasks/task.test.ts
- src/cli/commands/suggest-context.ts
- src/cli/cli.test.ts
- docs/context-system.md
- docs/cli-commands.md
- docs/progress.md
- docs/decisions.md
- .tasks/0068-make-context-suggestions-dependency-and-change-aware.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend existing heuristic candidate selection with bounded import/dependency, test and git-change signals.
2. Apply task allowed/forbidden scope and architecture boundaries; explain ranking reasons.
3. Test deterministic fixture graphs, related tests, changed files and forbidden implementation targets.

## Acceptance criteria

- Suggestions consider imports/dependencies, tests for affected modules, git changes, task allowed scope, relevant recent files and architecture boundaries.
- Every suggestion includes reason; dependency-related files rank above unrelated docs and relevant tests accompany production code.
- Forbidden file is never suggested as implementation target; context-only relevance remains distinct from edit permission.
- Algorithm and tie-breaking deterministic; unsupported language/project shapes have documented heuristic fallback.
- Small fixture tests cover dependency ranking, change signals, related tests, scope filtering and repeated identical results.
- No LLM or external service required.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk context --help
- pnpm exec apk suggest-context --help

## Documentation updates

- Update docs/context-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-CONTEXT-02. Milestone 3.
- Current ContextSuggestionResult has contextFiles/allowedFiles without reasons. Git helper currently lives in src/core/tasks/index.ts; reuse available helper through read-only import.
- Extend 0067 pack signals; do not add full compiler-grade multi-language graph infrastructure.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
