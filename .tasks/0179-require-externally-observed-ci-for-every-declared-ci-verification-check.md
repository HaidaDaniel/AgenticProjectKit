# Task 0179 - Require externally observed CI for every declared CI verification check

State: done
Owner: codex-0179
Mode: maintenance
Lane: quality
Type: bugfix
Scope: tasks,gate,evidence,verification,quality
Risk: high
Parallel: false
Depends on: 0178
Tags: correctness,verification,quality

## Goal

Prevent a required environment:ci check from satisfying completion through local execution or a lower-precedence profile/manual category; require a current externally observed hosted result while preserving coherent report and artifact semantics.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- docs/engineering/testing-strategy.md
- src/core/tasks/index.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/task.test.ts
- .tasks/0173-validate-the-next-public-readiness-release.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/task.test.ts
- dist/**
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/decisions.md
- docs/progress.md
- docs/roadmap.md
- .tasks/0173-validate-the-next-public-readiness-release.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/v*.md

## Steps

1. Reproduce local completion for a required CI check with profile report and probe manual CI declarations
2. Align CI classification local diagnostic eligibility external recording and per-check gate matching through existing primitives
3. Keep candidate freshness owner and check identity strict without claiming that free-text observer evidence authenticates GitHub
4. Regress missing failed stale wrong-check and local-only evidence alongside an actual hosted pass
5. Update Task 0173 dependencies without removing any prerequisite
6. Build and commit current dist before final verification and independent review

## Acceptance criteria

- A local CI-labeled command cannot complete its required hosted check regardless of profile
- Manual CI and report CI declarations remain externally satisfiable
- Unrelated passing CI evidence cannot satisfy another required check
- Current hosted PASS remains usable after a later local diagnostic verify
- Missing failed and stale hosted records block completion
- Local-only task behavior and optional-check policy stay compatible
- Packaged dist is committed and current
- Task 0173 preserves all prior dependencies and adds 0179

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No evidence history or completed contract is reset
- No runtime or provider-specific CI integration is added
- No local command is presented as hosted CI
- Report artifact and observer references retain distinct documented meanings

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.

## Review questions

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does the fix address the root cause rather than only the symptom?

## Counterexample searches

- Search a UI-only defect, an intermittent race, an inaccessible provider, a host without a test framework, and an expensive reproducer.
- Search adjacent inputs, error paths, and repeated execution.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"deterministic","instruction":"Observe a successful hosted Quality run for the exact committed candidate SHA.","evidence":"exact SHA plus successful hosted Quality run URL"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- The existing helpers currently give report and manual categories precedence over environment ci; isHostedCiCheck follows that result type and the per-check gate does not itself require CI typing. Reproduce these interactions before changing them.
