# Task 0059 - Execute task verification profiles and record evidence

State: todo
Owner: none
Mode: product
Lane: verification
Scope: verification,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0057,0058
Tags: verification,runner,evidence,cli

## Goal

Existing task verification executes selected environment-compatible profiles and records per-check evidence with truthful outcomes.

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
- src/cli/index.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/core/agents/index.ts
- src/core/doctor/index.ts
- src/core/audit/index.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md
- .tasks/0058-add-first-class-task-evidence-records.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/agents/*.ts
- src/cli/commands/task.ts
- src/cli/index.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0059-execute-task-verification-profiles-and-record-evidence.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend existing verifyTask/defaultRunCommand and task verify CLI; retain current command compatibility.
2. Resolve requested profiles, execute eligible automated checks, record every outcome and explain unavailable mandatory checks.
3. Add deterministic command fixtures for success, failure, timeout, spawn/shell failure and repeat execution.

## Acceptance criteria

- Existing pnpm exec apk task verify remains supported; preferred apkit verify surface may delegate to same engine, with apk alias retained.
- User can run all available checks or select profile; load task and resolve declared requirements before execution.
- Only eligible automated checks run; mandatory unavailable/live/manual checks remain unresolved, never implicit pass.
- Statuses distinguish pass, fail, pending/not-run and unavailable; not-applicable only with explicit semantics.
- Successful commands persist pass evidence; failures persist fail evidence; required failure/unavailable returns non-zero.
- Optional failures do not block completion solely for being optional; required skipped checks remain visible.
- Timeouts, execution exceptions and shell/process failures never become success; command output bounded.
- Verification reruns safely preserve history; tests use deterministic fixture commands and exercise real process failure paths.

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

- Backlog reference: APK-GATE-03. Milestone 1.
- Task 0049 already implemented command execution, whole-worktree scope checking and aggregate verify run events; this task adds structured profiles/evidence and robust execution semantics.
- Non-goals: automatic task completion, policy engine or independent AI review.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
