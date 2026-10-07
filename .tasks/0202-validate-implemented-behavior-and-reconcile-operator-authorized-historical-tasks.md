# Task 0202 - Validate implemented behavior and reconcile operator-authorized historical tasks

State: doing
Owner: codex-main-20261007
Mode: maintenance
Lane: workflow
Type: audit
Scope: verification,docs,tasks,archive
Risk: high
Parallel: false
Depends on: 0198,0199,0201
Tags: audit

## Goal

On a fresh baseline validate already-implemented behavior from operator-canceled 0120/0191/0197; record exact historical blockers and authorization without retroactive done; preserve PVR decision and remaining release dependency; safely archive eligible terminal contracts through APK.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/progress.md
- docs/roadmap.md
- src/core/agents/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/task.test.ts
- src/core/skills/index.ts
- src/core/skills/skills.test.ts
- src/cli/commands/skills.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/**
- docs/progress.md
- docs/roadmap.md
- docs/task-system.md
- docs/delivery/backlog-reassessment-2026-10-07.md

## Files forbidden to edit

- src/**
- package.json
- pnpm-lock.yaml
- .github/**
- docs/releases/**

## Steps

1. Inspect current behavior.
2. Add or update audit checks.
3. Run verification.

## Acceptance criteria

- Bounded UTF-8 lifecycle reason storage and concise presentation pass existing behavior regressions
- Skill materialization create preview noop customization force redirect hardlink rollback and platform fallback are validated
- Operator attribution exact SHA path identity stale decision failed checks independent review and direct chain lifecycle semantics remain fail closed
- Original 0120 0133 0191 0197 contracts are truthfully canceled under explicit operator option 2 and no attribution approval is synthesized
- GitHub PVR is selected but unavailable externally verified route remains blocked and no SECURITY policy falsely claims otherwise
- Independent package bin skill downstream self-adoption technical smoke is recorded with exact candidate and temporal limits
- Canonical eligible archival preserves bytes and provenance and skips protected literal references
- All remaining nonterminal tasks have current human or external blockers

## Review questions

- Are all three implemented behaviors evidenced rather than retroactively marking old contracts done
- Do cancellation notes match actual operator authorization
- Do archive proofs and exact approvals still fail closed
- Are technical smoke and hosted CI distinct from publication and post-tag proof

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"coverage/coverage-summary.json"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Keep audit static unless the task says otherwise.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.

- Focused validation passed: all 8 skill materialization tests and 18 lifecycle/attribution regressions; development-candidate packaging/downstream/self-adoption smoke passed at 040440f. Canonical archive moved 8 eligible contracts byte-identically; lint, dependency resolution, and docs consistency passed. Exact historical blockers, actual option-2 authorization, PVR decision, and temporal limits are recorded in docs/delivery/backlog-reassessment-2026-10-07.md.
