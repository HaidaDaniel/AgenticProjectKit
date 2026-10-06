# Task 0193 - Make verification proportional and remove redundant quality runs

State: doing
Owner: codex-fast-workflow-20261006
Mode: maintenance
Lane: quality
Type: refactor
Scope: quality,tests,templates,prompts,docs
Risk: high
Parallel: false
Depends on: none
Tags: refactor

## Goal

Remove repeated full tests in APK local verification and CI; speed fresh-source CLI integration tests; prevent exported policy and task authoring from imposing redundant full pipelines on host repositories; preserve candidate freshness, mandatory assurance, coverage thresholds and package currency.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- package.json
- .github/workflows/quality.yml
- src/cli/cli.test.ts
- src/core/templates/task-templates.ts
- src/core/exporters/index.ts
- src/core/tasks/review.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts

## Files allowed to edit

- package.json
- .github/workflows/quality.yml
- scripts/test-reporter.mjs
- scripts/test-source.mjs
- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs
- src/cli/cli.test.ts
- src/core/templates/task-templates.ts
- src/core/templates/renderer.test.ts
- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/exporters/index.ts
- src/core/tasks/review.ts
- src/core/tasks/task.test.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- AGENTS.md
- dist/**
- docs/engineering/testing-strategy.md
- docs/research/fast-proportional-verification.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- .tasks/0191-materialize-apk-skills-into-standards-based-project-skill-directories.md

## Files forbidden to edit

- pnpm-lock.yaml
- src/core/tasks/gate.ts
- src/core/tasks/evidence.ts
- .tasks/archive/**
- docs/releases/**

## Steps

1. Research authoritative testing and CI guidance
2. Replace redundant CI and release composition
3. Compile source tests and integration CLI once with consistent coverage source maps
4. Make exported implementation and review guidance proportional
5. Remove blanket host tests from docs tasks and document host command selection
6. Run coverage and downstream generation regressions
7. Commit and obtain independent candidate-bound review
8. Complete the gate and commit lifecycle bookkeeping

## Acceptance criteria

- Full CI and release run source tests once with unchanged coverage thresholds
- CLI integration tests execute a fresh source build and retain actual source-versus-shipped parity smoke
- Reviewer guidance reuses only current trusted evidence and requires focused counterexamples instead of automatic full reruns
- Generated docs tasks do not run unrelated host source tests
- Packaged task authoring selects host commands without overlapping aggregate checks
- Current task verification has no overlapping quality and coverage suite
- Research records measured timings and remaining limitations
- No dependency or completion gate weakening is introduced

## Correctness assumptions

- Coverage must include compiled CLI subprocesses mapped to current TypeScript
- Task-local evidence never substitutes for hosted CI or another candidate

## Invariants

- Required checks and independent review remain candidate-bound
- Committed dist is generated and current
- Failed checks and missing evidence cannot become passes

## Required evidence

- Focused regressions and full source coverage plus measured command timings

## Review questions

- Do compiled CLI tests exercise current source rather than stale committed dist
- Does coverage include subprocess execution after temporary build cleanup
- Do templates preserve required domain assurance while avoiding duplicate broad tests

## Counterexample searches

- Search boundary inputs, failure paths, and concurrency-sensitive callers.

## Verification

- `{"id":"static-quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality:static"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- docs/engineering/testing-strategy.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- docs/research/fast-proportional-verification.md

## Notes

- Do not change public behavior unless the task says so.
