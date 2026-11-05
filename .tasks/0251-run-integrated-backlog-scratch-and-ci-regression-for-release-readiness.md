# Task 0251 - Run integrated backlog scratch and CI regression for release readiness

State: todo
Owner: none
Mode: maintenance
Lane: quality
Type: test
Scope: integration,release-readiness,regression,performance,docs
Risk: high
Parallel: false
Depends on: 0244,0245,0246,0247,0248,0249
Tags: p1,integration,release-readiness,regression,performance,docs

## Goal

Exercise the new scratch backlog planning and CI-policy behavior together on realistic greenfield brownfield and downstream-shaped fixtures then record one bounded integration-readiness decision with evidence and a separate recommendation for the next release without creating a tag or changing implementation behavior.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/roadmap.md
- docs/engineering/testing-strategy.md
- docs/progress.md
- package.json
- scripts/test-source.mjs
- scripts/check-docs-consistency.test.mjs
- src/cli/command.test.ts
- src/cli/cli.test.ts
- src/core/tasks/task.test.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.test.ts
- .tasks/0244-fix-stale-installation-guidance-for-the-validated-release.md
- .tasks/0245-add-canonical-repository-local-agent-scratch-directory.md
- .tasks/0246-make-ci-planning-maturity-aware-and-proportional.md
- .tasks/0247-add-lightweight-backlog-storage-and-cli.md
- .tasks/0248-promote-backlog-items-into-canonical-apk-tasks-safely.md
- .tasks/0249-integrate-backlog-awareness-into-agent-planning-workflows.md

## Files allowed to edit

- docs/delivery/backlog-integration-readiness.md
- docs/progress.md
- docs/roadmap.md
- docs/engineering/testing-strategy.md
- src/cli/backlog-integration.test.ts
- src/cli/command.test.ts
- src/cli/cli.test.ts
- src/core/tasks/task.test.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.test.ts
- scripts/check-docs-consistency.test.mjs
- package.json

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- .github/**
- pnpm-lock.yaml
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/backlog/**
- src/core/init/index.ts
- src/core/docs/adopt.ts
- src/core/templates/**
- src/cli/commands/**

## Steps

1. Build a fixture matrix for a new empty repository init backlog create task verify done; an existing repository adopt preview and apply; deferred backlog items during ordinary work; valid and invalid promotion contracts; scratch files and Git ignore semantics; a simple MVP with no CI requirement and an explicit quality.required CI exception; backlog versus blocked-task separation; task ID allocation and archive behavior; generated agent instructions; snapshot provenance and worker projection regressions; and Go Python and Node downstream-shaped fixtures; run the representative scenarios and compare workers status --detail attention and next-task work against the baseline without adding expensive checks to every CLI call; verify installation instructions and generated files are current and that no snapshot provenance or worker projection regression appears; record the integration result and a release-readiness recommendation with remaining limitations; file separate corrective tasks for any discovered defect instead of changing feature implementation here

## Acceptance criteria

- The greenfield path init to backlog to task to verify to done is exercised.
- adopt preview and apply are exercised on an existing repository.
- Deferred backlog items do not affect ordinary work.
- Valid promotion succeeds and invalid promotion fails safely.
- Scratch files remain ignored and out of task scope.
- A simple MVP is not forced to add CI and an explicit CI requirement is honored.
- Backlog items are not treated as blocked tasks.
- Task ID allocation and archive remain correct.
- Generated agent instructions are current.
- Snapshot provenance and worker projections do not regress.
- workers, status --detail, attention, and next-task performance is measured against the baseline with no new per-command expensive check.
- Current installation instructions match the validated release.
- Realistic Go, Python, and Node downstream-shaped fixtures are covered.
- Readiness is recorded separately from any tag or release decision.
- All checks use local disposable fixtures and do not require a live paid LLM, paid service, or unavailable external service.
- Migration acceptance remains Task 0250's separate responsibility and is not duplicated here.
- The integration readiness decision does not gate a standalone patch release containing only Task 0244.

## Correctness assumptions

- The feature tasks provide their own focused tests and this task composes them rather than reimplementing each feature; disposable fixtures can represent downstream shapes without private repositories; release tagging and publication are separate operator actions

## Invariants

- No new expensive check on every CLI invocation; no duplicate full-suite aggregate inside one verification run; no implementation behavior change in this task; no tag push or publication; no rewriting of task evidence or history; no live paid LLM or unavailable external service; a standalone Task 0244 patch release is not conditioned on this readiness task

## Required evidence

- Composed integration test output for every scenario group; measured baseline comparison for workers status --detail attention and next-task; readiness record with limitations; explicit list of corrective tasks opened for any defect

## Review questions

- Do the individual feature tests actually compose or does this task duplicate them; can deferred backlog items distort status or performance; can promotion or scratch ignore break scope attribution; are invalid promotion and blocked-task cases distinguishable; is the readiness claim scoped to what was actually run

## Counterexample searches

- Empty repository with no tasks; existing repository with customized instructions; deferred item present during status; promotion with missing dependency or malformed card; scratch file during active task; MVP with no CI; quality.required includes ci; blocked task mistaken for backlog; ID collision during promotion; archived promoted task; Go and Python repositories with APK tooling only

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"readiness-report","type":"automated","required":true,"environment":"local","profile":"report","command":"grep -q \"Integration readiness decision\" docs/delivery/backlog-integration-readiness.md"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Add docs/delivery/backlog-integration-readiness.md; update docs/engineering/testing-strategy.md when integration coverage changes; update docs/roadmap.md and docs/progress.md when readiness state changes

## Notes

- Depends on the behavior-bearing tasks 0244 through 0249 because it composes installation guidance, scratch, CI policy, backlog, promotion, and planning behavior. It does not depend on Task 0250: migration acceptance is a separate documentation and fixture track with its own evidence, and making readiness depend on it would force a false ordering and duplicate downstream fixtures.
- Release tagging, publication, and deployment remain outside this task. A standalone patch release containing only Task 0244 does not require this task. Do not introduce a new CI engine or a new mandatory gate for every CLI call. If a defect is found, create a separate scoped corrective task.
- Active todo Task 0223 shares CLI test registry decisions progress and dist paths with the integration fixtures; run 0223 acceptance separately or in an isolated worktree and do not fold its opt-in CI parity result into this readiness decision
