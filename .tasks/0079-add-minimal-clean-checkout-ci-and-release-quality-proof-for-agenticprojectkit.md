# Task 0079 - Add minimal clean-checkout CI and release-quality proof for AgenticProjectKit

State: review
Owner: codex-corrective-0077
Mode: production
Lane: release
Scope: ci,quality,release,docs
Risk: high
Parallel: false
Depends on: 0078
Tags: ci,quality,clean-checkout

## Goal

AgenticProjectKit has one minimal CI signal proving frozen-lockfile installation and canonical release-quality checks from clean Git checkout.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/delivery/milestones.md
- docs/roadmap.md
- docs/cli-commands.md
- README.md
- package.json
- pnpm-lock.yaml
- .gitignore
- .tasks/0078-add-first-class-local-quality-guardrails-for-agenticprojectkit-itself.md

## Files allowed to edit

- .github/workflows/quality.yml
- package.json
- pnpm-lock.yaml
- README.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- docs/engineering/testing-strategy.md
- docs/delivery/milestones.md
- docs/roadmap.md
- docs/progress.md
- docs/decisions.md
- .tasks/0079-add-minimal-clean-checkout-ci-and-release-quality-proof-for-agenticprojectkit.md

## Files forbidden to edit

- src/**
- scripts/**
- .husky/**
- src/core/templates/minimal-docs/**
- src/core/exporters/**
- .agentic/config.json
- .tasks/archive/**

## Steps

1. Add one GitHub Actions workflow for pull requests and main-branch activity using supported Node/pnpm versions and frozen lockfile install.
2. Run 0078 canonical quality/release surface plus APK contract-lint, sync/audit consistency and package build checks from clean checkout.
3. Make failures deterministic/visible and reject tracked drift produced by checks; keep workflow single-platform/single-version unless evidence requires more.
4. Document local-hook, APK verify/gate, CI and frozen release-validation boundaries plus exact-SHA CI evidence handoff to 0075.

## Acceptance criteria

- Workflow triggers on pull requests and main branch push or equivalent protected-main activity.
- Job uses supported Node and pnpm versions, dependency caching where safe and `pnpm install --frozen-lockfile`.
- One bounded job runs canonical typecheck, source lint, tests, coverage, build and release-quality checks supplied by 0078.
- Job runs required APK read-only contract lint/sync checks and audit consistency. Any report-writing audit occurs in disposable checkout and produced tracked drift fails visibly.
- Workflow does not use a large matrix, Docker orchestration, external SaaS, deployment credentials, npm publish or automated release.
- CI result binds checkout commit SHA. Failures expose failing command without nondeterministic retry or success masking.
- Successful CI never substitutes for current APK task verification evidence, independent review, task gate or release-candidate evidence.
- Local hook = developer feedback; APK verify/gate = task-level canonical proof; CI = clean-checkout reproducibility; 0075 = frozen release-candidate proof.
- GitHub Actions is AgenticProjectKit repository tooling only. APK remains CI-platform neutral and adopted repositories receive no generated workflow.
- 0075 can record run URL/status and exact candidate SHA as separate release evidence without APK GitHub API coupling.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"ci","profile":"report","command":"pnpm release:check","evidence":"clean-checkout command output"}`
- `{"id":"workflow-review","type":"manual","required":false,"environment":"live","profile":"trusted","instruction":"Record GitHub Actions run URL, status and exact commit SHA when repository access permits.","evidence":"GitHub Actions run URL/status/SHA"}`

## Documentation updates

- Document CI command sequence, trigger and clean-checkout purpose in README/testing docs.
- Document four proof boundaries and no-substitution rule in architecture/task docs.
- Record CI scope and platform-neutral adopted-repository boundary in docs/decisions.md; update roadmap/milestones/progress when state changes.

## Notes

- Backlog reference: APK-QUALITY-03. Minimal repository CI.
- GitHub Actions chosen only for AgenticProjectKit hosting context; no generic CI provider abstraction.
- Prefer one workflow/job and versions already declared by package/tooling contracts. Package changes limited to version metadata or canonical script correction strictly needed by CI.
- Green hosted run may require later push authority. Local implementation can prove workflow contract; 0075 records hosted status for exact release candidate where available.
