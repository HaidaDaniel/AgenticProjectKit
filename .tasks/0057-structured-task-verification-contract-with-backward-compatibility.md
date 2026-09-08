# Task 0057 - Structured task verification contract with backward compatibility

State: done
Owner: codex-20260909
Mode: product
Lane: task-system
Scope: task-system,cli,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: task-system,verification,schema,backward-compatibility,foundation

## Goal

Task verification expresses required checks, execution environments and expected evidence; v0.3.1 task markdown remains readable without migration.

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
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/work/index.ts
- src/core/exporters/index.ts
- src/core/templates/renderer.test.ts
- docs/cli-commands.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/cli/commands/task.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/work/index.ts
- src/core/exporters/index.ts
- src/core/templates/renderer.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend existing ProjectTask/parser/renderer and TaskCreateInput with minimal structured verification representation.
2. Normalize legacy Verification commands; expose new format through task create/templates and prompt/work rendering.
3. Add parse/render, malformed metadata, creation and prompt regression tests; verify backward compatibility.

## Acceptance criteria

- Checks express command or manual instruction, required flag, environment/profile and optional artifact/evidence requirement; automated/manual and live-environment requirements remain explicit.
- Representation distinguishes static/deterministic, CI-safe, local/integration, trusted/live and evidence/report validation concepts; exact labels may stay simpler.
- Legacy task markdown parses unchanged; flat Verification commands normalize predictably without mandatory task migration.
- New-format canonical parse/render round trip preserves semantics; malformed metadata produces actionable errors.
- Task create/template API generates structured verification; prompt/work/export paths preserve all verification requirements.
- Regression tests cover legacy and structured formats, invalid metadata and generated tasks.

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

- Backlog reference: APK-GATE-01. Milestone 1.
- Existing verificationCommands: string[] and canonical renderer live in src/core/tasks/index.ts; template defaults live in src/cli/commands/task.ts.
- Non-goals: executing checks, changing done, policy engine, agent execution or universal workflow DSL. Add mutating/non-mutating metadata only if useful.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
