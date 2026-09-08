# Task 0066 - Add built-in repository and task-contract linting

State: todo
Owner: none
Mode: product
Lane: quality
Scope: quality,cli,tests,docs
Risk: high
Parallel: true
Depends on: 0057,0060,0061
Tags: lint,audit,task-graph,paths,consistency

## Goal

One built-in read-only command validates generic task graph, path/policy contracts and generated instruction consistency.

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
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/doctor/index.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/core/exporters/index.ts
- src/cli/commands/audit.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md
- .tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md

## Files allowed to edit

- src/core/audit/*.ts
- src/core/doctor/index.ts
- src/core/tasks/*.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/cli/commands/audit.ts
- src/cli/commands/lint.ts
- src/cli/index.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0066-add-built-in-repository-and-task-contract-linting.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Compose existing dependency validation, parser, scope matcher and check-only sync into stable findings.
2. Complete duplicate/self-dependency, path contradiction and policy/state-owner checks; add deterministic implied-file checks only where supportable.
3. Expose apkit lint or read-only audit equivalent with CI exit code and structured output; add graph/path/drift regressions.

## Acceptance criteria

- Command covers missing dependencies, duplicate IDs, self-dependency, cycles and malformed metadata, including archived prerequisites.
- Path checks diagnose malformed patterns, allow/deny contradictions and invalid exact paths where decidable; explicitly planned new output files remain valid.
- Required files implied by steps are checked only when deterministic; no NLP/LLM guesses.
- State/owner invariants and invalid policy combinations are reported.
- Existing stale/missing exporter and sync drift checks feed same result; no repository mutation or report writes in read-only mode.
- Stable structured or machine-readable output and non-zero CI exit code reflect failures.
- Regression tests cover graph cycles, sibling-prefix path matching, stale exports and no-write behavior.
- Design permits stricter release profile without implementing a generic plugin system.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk task create --help
- pnpm exec apk doctor

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-LINT-01. Milestone 2.
- Dependency missing/cycle checks already exist; status detects duplicate IDs and sync detects drift. Reuse these mechanisms.
- Current audit always writes docs/audit-report.md and docs/project-map.md; this task explicitly adds/composes a no-write surface. New src/cli/commands/lint.ts is allowed only if that CLI shape is chosen.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
