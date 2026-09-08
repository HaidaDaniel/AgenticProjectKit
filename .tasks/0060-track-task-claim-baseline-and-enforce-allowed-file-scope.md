# Task 0060 - Track task claim baseline and enforce allowed-file scope

State: todo
Owner: none
Mode: product
Lane: task-system
Scope: task-system,cli,tests,docs
Risk: high
Parallel: true
Depends on: 0058
Tags: git,scope,allowed-files,guardrail,provenance

## Goal

Claim captures task baseline; deterministic scope reports attribute subsequent changes and enforce allow/deny contracts without blaming pre-existing user edits.

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
- src/core/audit/index.ts
- src/cli/commands/task.ts
- src/cli/commands/task-state.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0058-add-first-class-task-evidence-records.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/agents/*.ts
- src/cli/commands/task.ts
- src/cli/commands/task-state.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/architecture.md
- docs/progress.md
- docs/decisions.md
- .tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Capture baseline HEAD/commit and dirty-worktree state within claim lifecycle, linked to run/evidence storage.
2. Extend existing git change collection and path matcher to compare against baseline, including committed and working-tree changes.
3. Expose reusable scope result through existing task verify path or coherent diff subcommand; add temporary Git repository regressions.

## Acceptance criteria

- Claim stores baseline commit/HEAD plus enough dirty state to distinguish pre-existing changes from later agent edits, including edits to already-dirty files.
- Modified, new, deleted and renamed files since baseline are analyzed; committed changes after claim remain visible.
- Exact paths, directory patterns and ** behave deterministically; regression covers docs/foo/** versus docs/foobar/**.
- Forbidden paths always violate scope even when allowed; paths outside allowlist violate scope.
- Pre-existing dirty changes do not automatically count as agent violations; attribution limits receive explicit diagnostics.
- Machine-consumable report identifies scope violations; no-git, detached HEAD and unusual states have defined diagnostics.
- No user file is reverted or reset automatically; regression tests cover allow/deny overlap, dirty baseline and rename/delete handling.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk task create --help
- pnpm exec apk doctor

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/architecture.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-GATE-04. Milestone 1.
- verifyTaskFileScope, patternToRegex and listGitChangedFiles already exist in src/core/tasks/index.ts; current comparison has no claim baseline. Reuse and complete them.
- Dependency 0058 supplies baseline/run storage integration. Parallel flag permits independent work only when shared files do not collide.
- Non-goals: filesystem sandbox, editor write interception or automatic git reset.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
