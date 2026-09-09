# Task 0074 - Provide safe adoption path for the new gated task workflow

State: doing
Owner: codex-20260909
Mode: production
Lane: release
Scope: release,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0062,0065,0066,0071,0072
Tags: upgrade,migration,backward-compatibility,release

## Goal

Existing v0.3.1-style projects can adopt gated workflow safely, with readable legacy tasks and explicit migration preview.

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
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/config/types.ts
- src/core/config/schema.ts
- src/core/config/defaults.ts
- src/core/config/schema.test.ts
- src/core/audit/index.ts
- src/core/doctor/index.ts
- src/core/status/index.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/cli/commands/task.ts
- scripts/clean-dist.mjs
- scripts/copy-template-assets.mjs
- src/cli/cli.test.ts
- docs/adoption-flow.md
- docs/cli-commands.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0065-add-typed-task-templates-with-domain-specific-guardrails.md
- .tasks/0066-add-built-in-repository-and-task-contract-linting.md
- .tasks/0071-expose-concise-workflow-gate-and-evidence-status.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md

## Files allowed to edit

- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/tasks/*.ts
- src/core/tasks/fixtures/**
- src/core/config/*.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/doctor/index.ts
- src/core/status/index.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/cli/commands/task.ts
- src/cli/commands/adopt.ts
- src/cli/commands/init.ts
- src/cli/cli.test.ts
- docs/adoption-flow.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Define schema/version detection and compatibility behavior using current init/adopt/config/task contracts.
2. Provide dry-run migration preview/report and explicit idempotent apply path where migration is needed.
3. Add self-contained v0.3.1-style repository fixture and upgrade regressions; document safe upgrade steps.

## Acceptance criteria

- Old project can install new version and run doctor, lint/read-only audit and status without mass task rewrite.
- Legacy tasks remain readable; version/schema detection distinguishes old and gated contracts.
- Migration preview reports exact proposed changes; migration application is explicit and idempotent.
- No destructive rewrite or overwrite of customized instructions without explicit user-selected path/action.
- Upgrade guidance covers compatibility, optional migration and safe adoption of mandatory gates.
- Regression fixture covers v0.3.1 tasks, customized instructions, dry-run no-write and repeated apply.

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"task-create-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk task create --help"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk doctor"}`
- `{"id":"adoption-report","type":"automated","required":false,"environment":"local","profile":"report","command":"pnpm exec apk adopt --preview"}`
- `{"id":"adoption-live","type":"automated","required":false,"environment":"live","profile":"trusted","command":"pnpm exec apk adopt --preview"}`

## Documentation updates

- Update docs/adoption-flow.md for implemented behavior and examples.
- Update docs/task-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-RELEASE-01. Milestone 5.
- init/adopt already preserve existing files; package version is 0.3.1 and release scripts build/check before version bump. Extend compatibility without redesigning release scripts here.
- Harness phase is included in this planned release, hence dependency 0072.
- src/core/tasks/fixtures/** is a planned new fixture location, not an existing file to read. New upstream fixture only; no downstream repository audit.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
