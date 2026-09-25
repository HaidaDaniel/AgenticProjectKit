# Task 0168 - Add deterministic documentation consistency checks

State: todo
Owner: none
Mode: maintenance
Lane: quality
Type: feature
Scope: docs-consistency,ci,tests,docs
Risk: medium
Parallel: false
Depends on: 0151,0152,0153,0154,0155,0156,0157,0158,0159,0160,0161,0162,0163,0164,0165,0166,0167,0169,0170,0171
Tags: feature

## Context files

- AGENTS.md
- package.json
- README.md
- docs/index.md (future output of prerequisite Task 0158)
- docs/roadmap.md
- docs/progress.md
- docs/cli-commands.md
- docs/releases/index.md (future output of prerequisite Task 0171)
- docs/engineering/testing-strategy.md
- .github/workflows/quality.yml

## Files allowed to edit

- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs
- package.json
- .github/workflows/quality.yml
- docs/engineering/documentation-maintenance.md
- docs/progress.md

## Files forbidden to edit

- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Goal

Add a small deterministic CI check for high-value documentation inconsistencies detectable without semantic guessing.

## Steps

1. List repeated facts with clear canonical sources and identify exact extraction rules.
2. Check only stable structured facts or explicit sentinels; leave semantic product truth to review.
3. Add tests for pass, deliberate stale value, missing link, and malformed input where applicable.
4. Wire the check into local quality and hosted CI with actionable file and line feedback.
5. Document scope and blind spots.

## Acceptance criteria

- Evaluate exact checks for current release/version alignment, canonical install command, relative links, documented context paths, CLI reference versus registry, shipped milestones mislabeled planned, and package version versus release index; implement only decidable checks.
- The checker catches a real high-value drift case and has pass/fail tests.
- Each checked value has one canonical source and deterministic rule.
- No NLP guessing, web access, or brittle broad matching is used.
- CI failure names the affected file and correction.

## Correctness assumptions

- Only exact or structurally unambiguous facts are machine-checkable.
- Historical content can intentionally differ from current facts.

## Invariants

- Historical release notes and ADRs are excluded unless explicitly scoped.
- The checker never auto-edits docs or resolves uncertain prose.

## Required evidence

- Tests cover deliberate inconsistency and a historical exception.
- CI runs the check in the documented quality workflow.

## Review questions

- Could legitimate historical content cause false failure?
- Can maintainers fix an error without guessing?

## Counterexample searches

- Test stale current value, old release note, reordered content, and missing target.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Guard mechanical drift only; do not build a broad prose linter.
