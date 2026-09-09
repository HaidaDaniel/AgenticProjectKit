# Task 0078 - Add first-class local quality guardrails for AgenticProjectKit itself

State: todo
Owner: none
Mode: production
Lane: quality
Scope: quality,tooling,coverage,hooks,tests,docs
Risk: medium
Parallel: false
Depends on: 0077
Tags: quality,lint,typecheck,coverage,hooks,dogfood

## Goal

AgenticProjectKit repository has explicit fast developer quality checks, measured coverage and local feedback hooks, separate from generic adopted-repository policy.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/engineering/tech-stack.md
- docs/cli-commands.md
- README.md
- package.json
- pnpm-lock.yaml
- tsconfig.json
- tsconfig.build.json
- .gitignore
- src/core/quality/index.ts
- src/core/quality/quality.test.ts
- .tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- eslint.config.*
- .eslintignore
- .prettierignore
- .lintstagedrc.*
- lint-staged.config.*
- .husky/**
- .gitignore
- tsconfig.json
- tsconfig.build.json
- src/**/*.ts
- scripts/**
- docs/architecture.md
- docs/engineering/testing-strategy.md
- docs/engineering/tech-stack.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0078-add-first-class-local-quality-guardrails-for-agenticprojectkit-itself.md

## Files forbidden to edit

- .github/**
- .agentic/config.json
- .tasks/archive/**

## Steps

1. Measure current test coverage and record tool/linter/hook choices plus baseline rationale before setting thresholds.
2. Rename current TypeScript-only `lint` semantics to explicit `typecheck`; add real TypeScript source lint and deterministic coverage report/threshold scripts.
3. Add one fast developer command composing typecheck, source lint and deterministic tests. Keep stronger coverage/build/sync/audit release validation separate.
4. Add fast pre-commit and stronger pre-push hooks for this repository only; document intentional bypass and non-authoritative hook boundary.
5. Fix only mechanical lint/config fallout needed for chosen rules; prove 0077 reports APK capabilities accurately without adding adopted-repository tooling.

## Acceptance criteria

- `typecheck` explicitly runs TypeScript checking. `lint` runs a real source linter and no longer aliases `tsc --noEmit`.
- Linter is maintained, TypeScript-aware and configured with focused rules; no broad formatting churn or arbitrary style migration.
- Coverage command emits human-readable and machine-readable output using existing deterministic tests.
- Coverage thresholds derive from measured baseline, protect meaningful regression and leave justified headroom; rationale and measured values documented. No arbitrary 100% target.
- Fast quality command runs typecheck + source lint + tests and avoids full release/audit/build work.
- Full release command remains separate and includes required quality, coverage, build and APK-specific checks.
- Pre-commit stays fast and scopes work where practical. Pre-push runs stronger checks without publishing or deployment.
- Docs name intentional bypass (`--no-verify` and tool-supported disable path) and state hooks provide developer feedback only.
- Canonical `apk task verify`/gate evidence, independent review, CI and release validation cannot be satisfied by hook success.
- Husky/lint-staged or chosen equivalent applies only to AgenticProjectKit. Adopt/init/templates/detection never install or mandate it for target repositories.
- 0077 detector reports separate APK typecheck, lint, tests, build, coverage, hooks and CI state based on actual repository configuration.
- Existing tests and build remain deterministic. Any source edits are minimal lint compliance changes, not feature work.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"fast-quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`

## Documentation updates

- Update testing strategy and README with fast/full commands, coverage policy and hook bypass/boundary.
- Update architecture/task docs only where quality evidence boundaries change.
- Record tooling/dependency/threshold decisions in docs/decisions.md per repository dependency policy; update docs/progress.md when state changes.

## Notes

- Backlog reference: APK-QUALITY-02. AgenticProjectKit dogfood tooling only.
- Tool selection remains implementation decision constrained by current TypeScript/ESM/node:test stack. Prefer smallest maintained set with reliable pnpm and Windows behavior.
- Coverage output must be ignored unless intentionally committed as release evidence.
- Source glob allowed only for mechanical lint fallout. Adoption/template/export behavior changes remain out of scope even though files share broad lint-fix glob; feature/refactor changes require task amendment or separate contract.
- Do not change APK adoption/init/templates to provision linter, test runner, hooks or CI.
