# Task 0077 - Add repository quality capability detection and policy contracts

State: doing
Owner: codex-resource-aware
Mode: product
Lane: quality
Scope: quality,scanning,policy,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0074
Tags: quality,capabilities,detection,policy,adoption

## Goal

APK detects and evaluates repository quality capabilities through vendor-neutral contracts without installing, replacing or running repository toolchains.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/adoption-flow.md
- docs/engineering/scanner-system.md
- docs/engineering/testing-strategy.md
- docs/cli-commands.md
- package.json
- src/core/scanners/index.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/doctor/index.ts
- src/core/status/index.ts
- src/core/config/types.ts
- src/core/config/schema.ts
- src/core/config/defaults.ts
- src/core/config/schema.test.ts
- src/core/config/index.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/tasks/policy.ts
- src/core/audit/lint.ts
- src/cli/index.ts
- src/cli/commands/adopt.ts
- src/cli/commands/audit.ts
- src/cli/commands/doctor.ts
- src/cli/cli.test.ts
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md

## Files allowed to edit

- src/core/quality/*.ts
- src/core/scanners/index.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/doctor/index.ts
- src/core/status/index.ts
- src/core/config/types.ts
- src/core/config/schema.ts
- src/core/config/defaults.ts
- src/core/config/schema.test.ts
- src/core/config/index.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/cli/index.ts
- src/cli/commands/quality.ts
- src/cli/commands/adopt.ts
- src/cli/commands/audit.ts
- src/cli/commands/doctor.ts
- src/cli/cli.test.ts
- docs/architecture.md
- docs/adoption-flow.md
- docs/engineering/scanner-system.md
- docs/engineering/testing-strategy.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .github/**
- .husky/**
- scripts/**
- src/core/templates/minimal-docs/**
- src/core/exporters/**
- .agentic/config.json
- .tasks/archive/**

## Steps

1. Define stable capability IDs and result/policy types for static analysis/typecheck, lint, automated tests, build/package validation, coverage, local hooks and CI/clean-checkout validation.
2. Detect bounded repository scripts, manifests and configuration markers without command execution, dependency installation or file mutation; classify evidence as detected, missing or unknown with source and confidence/reason.
3. Add optional config-driven required/recommended capability policy. Omitted policy keeps existing repositories usable and never turns recommendations into global failures.
4. Expose one smallest coherent read-only surface, preferably `apk quality detect [directory] [--json]`; reuse same ordered result in doctor/audit and keep it suitable for later status/task-verification consumers.
5. Add cross-tool fixtures and conservative fallback regressions; document detect -> report -> recommend -> explicit opt-in setup boundary.

## Acceptance criteria

- Capability model uses stable vendor-neutral IDs; implementation details remain evidence metadata, not policy identity.
- Detection recognizes TypeScript/pnpm projects plus bounded alternative lint/test commands and common non-Node configuration markers without treating one vendor as canonical.
- `lint` containing only `tsc --noEmit` counts as typecheck/static analysis, not both typecheck and source lint.
- Coverage, hooks and CI remain distinct capabilities. CI detection is platform-neutral and does not equate CI with GitHub Actions only.
- Missing optional capability yields deterministic recommendation and successful diagnostic status; missing/unknown required capability fails policy evaluation with explicit reason.
- Required capabilities come only from explicit repository policy/config. Default policy does not require Husky, ESLint, a test framework, GitHub Actions or any other concrete tool.
- Existing/legacy config remains readable. Detection never installs packages, writes config, creates hooks/workflows or rewrites scripts.
- Human and JSON output contain same sorted capabilities, status, discovered command/config evidence, policy disposition and diagnostics.
- Doctor/audit consume or summarize shared result without duplicating vendor-specific inference. Status integration may remain deferred if shared result is directly reusable.
- Tests cover TypeScript/pnpm, alternative lint/test commands, missing coverage, missing CI/hooks and unsupported/unknown repository behavior that stays conservative rather than inventing capabilities.
- APK task verification can later consume detected capability IDs/commands as evidence without matching vendor names; task does not wire that future enforcement prematurely.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"quality-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts quality --help"}`
- `{"id":"quality-json","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts quality detect --json"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts doctor"}`

## Documentation updates

- Document capability model, policy/default semantics and non-mutating detection in architecture/task/adoption docs.
- Document chosen CLI surface and stable JSON contract in docs/cli-commands.md and README.md.
- Record capability-versus-tooling decision in docs/decisions.md; update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-QUALITY-01. Pre-release quality foundation.
- Reuse scanner facts where sound, but keep capability evaluation in dedicated core module rather than expanding readiness booleans into hidden policy.
- Exact CLI shape must remain small. Dedicated read-only detector is preferred because it supplies reusable human/JSON output; doctor/audit stay projections.
- No AST-wide tool detection, network lookup, package installation, command execution, plugin engine, CI abstraction or toolchain migration.
- Config addition optional and backward compatible. No schema-version bump without explicit compatibility rationale and regressions.
- 0074 precedes this task so legacy adoption behavior exists before optional quality policy appears.
