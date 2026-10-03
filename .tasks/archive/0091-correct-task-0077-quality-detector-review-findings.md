# Task 0091 - Correct Task 0077 quality detector review findings

State: done
Owner: codex-corrective-0077
Mode: production
Lane: quality
Type: bugfix
Scope: quality scanning cli tests docs
Risk: medium
Parallel: false
Depends on: 0077
Tags: corrective quality ci pytest

## Goal

Fix only the three bounded Task 0077 review findings: directory-safe CI scanning, canonical vendor-neutral CI projections, and pytest.ini_options detection.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/scanner-system.md
- docs/engineering/testing-strategy.md
- docs/cli-commands.md
- src/core/scanners/index.ts
- src/core/quality/index.ts
- src/core/quality/quality.test.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/doctor/index.ts
- src/cli/cli.test.ts
- .tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md

## Files allowed to edit

- src/core/scanners/index.ts
- src/core/quality/index.ts
- src/core/quality/quality.test.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/doctor/index.ts
- src/cli/cli.test.ts
- docs/progress.md
- SPEC.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .github/**
- .husky/**
- scripts/**
- .agentic/config.json
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- src/core/exporters/**

## Steps

1. Harden file versus directory existence checks and add a real .github/workflows regression fixture; consolidate doctor/audit CI output around shared quality detection and add GitLab-only regression coverage; extend bounded pytest configuration detection to tool.pytest.ini_options and add regression coverage; run deterministic verification and complete lifecycle evidence.

## Acceptance criteria

- A real .github/workflows directory with a workflow file never causes EISDIR; GitLab-only CI is detected as quality.ci without GitHub-specific missing warnings; tool.pytest.ini_options detects tests; doctor and audit project shared CI state; all required verification passes.

## Correctness assumptions

- The reproducer isolates the intended failing behavior.

## Invariants

- V4: quality capability IDs are vendor-neutral and detection is conservative and deterministic; V5: optional missing capabilities remain recommendations; V2: evidence and scope stay candidate-bound.
- V13: CI marker type and emptiness never mask valid markers; audit/doctor CI projection equals shared `quality.ci` result.

## Required evidence

- Old-behavior reproducer result and regression test output.

## Review questions

- Does CI detection distinguish file and directory types without EISDIR; do doctor and audit use one vendor-neutral CI result for GitLab and GitHub; does pytest.ini_options detection remain bounded without a TOML parser

## Counterexample searches

- empty .github/workflows directory; GitLab-only repository with no GitHub Actions; pyproject.toml containing only tool.pytest.ini_options

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts quality detect --json"}`
- `{"id":"check-5","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts doctor"}`
- `{"id":"check-6","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/progress.md when this corrective task changes state; record bounded recurrence invariant in SPEC.md

## Notes

- Corrective task linked to completed 0077; do not rewrite 0077 history or redesign quality architecture.
