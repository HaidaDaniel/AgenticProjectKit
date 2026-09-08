# Task 0065 - Add typed task templates with domain-specific guardrails

State: done
Owner: codex-20260909
Mode: product
Lane: task-authoring
Scope: task-authoring,cli,tests,docs
Risk: medium
Parallel: true
Depends on: 0061,0064
Tags: templates,task-create,guardrails,developer-experience

## Goal

Typed task creation generates compact, editable contracts linked to policy and reusable domain guardrails.

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
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/modes/index.ts
- src/core/modes/mode.test.ts
- src/core/templates/index.ts
- src/core/templates/renderer.test.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md

## Files allowed to edit

- src/cli/commands/task.ts
- src/core/tasks/*.ts
- src/core/templates/task-*.ts
- src/core/templates/renderer.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0065-add-typed-task-templates-with-domain-specific-guardrails.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend existing --template defaults and explicit-override behavior; persist type or deterministic policy mapping.
2. Provide complete initial template set using structured verification and correctness contract.
3. Add generated-task parse/snapshot tests and domain-specific guardrail assertions.

## Acceptance criteria

- Initial types cover feature, bugfix, refactor, migration, async-worker, provider/integration, deployment, benchmark, security and release.
- Existing bugfix/feature/refactor/docs/audit/test templates and explicit flags remain supported; user can edit generated task.
- Type persists explicitly or maps deterministically to policy; CLI uses --type or existing --template equivalent.
- Bugfix includes reproducer failing on old behavior, root cause and no unrelated refactor; refactor preserves behavior.
- Migration covers compatibility, data integrity, failure, rollback/recovery and idempotency where applicable.
- Async-worker covers idempotency, retry, cancellation, concurrency bounds, graceful shutdown, partial commit and all-fail path.
- Provider/integration covers timeout, unavailable provider, fallback, malformed response, error propagation and capability mismatch.
- Deployment covers clean install, restart, upgrade, readiness, permissions, configuration persistence and rollback/recovery.
- Benchmark covers baseline, comparability, deterministic fixture, metric definition, leakage, relevant holdout and production-budget semantics.
- Security covers negative paths, fail closed, secret leakage and privilege/auth boundaries.
- Release covers candidate SHA/tree, CI evidence, post-bump validation and no mutation after evidence where relevant.
- Low-risk feature output stays compact; generated templates parse and snapshot/semantic tests verify all required guardrails.

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

- Backlog reference: APK-TEMPLATE-01. Milestone 2.
- Task 0054 already added six generic templates in src/cli/commands/task.ts. Extend that surface instead of introducing a second authoring system.
- Single capability boundary: existing framework plus declarative template content. No separate policy execution engine in template code.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
