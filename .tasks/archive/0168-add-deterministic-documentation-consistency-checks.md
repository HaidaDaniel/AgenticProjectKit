# Task 0168 - Add deterministic documentation consistency checks

State: done
Owner: codex-0168
Mode: maintenance
Lane: quality
Type: feature
Scope: docs-consistency,ci,tests,docs
Risk: medium
Parallel: false
Depends on: 0151,0152,0153,0154,0155,0156,0157,0158,0159,0160,0161,0162,0163,0164,0165,0166,0167,0169,0171
Tags: feature

## Goal

Add a small deterministic CI check for high-value documentation inconsistencies detectable without semantic guessing.

## Context files

- AGENTS.md
- package.json
- README.md
- docs/index.md (future output of prerequisite Task 0158)
- docs/roadmap.md
- docs/progress.md
- docs/cli-commands.md
- docs/releases/index.md (future output of prerequisite Task 0171)
- docs/releases/v0.4.7.md
- docs/product/maturity-and-compatibility.md
- docs/engineering/testing-strategy.md
- .github/workflows/quality.yml
- .tasks/0170-publish-a-truthful-security-reporting-policy.md

## Files allowed to edit

- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs
- package.json
- .github/workflows/quality.yml
- docs/engineering/documentation-maintenance.md
- docs/progress.md
- README.md
- docs/index.md
- docs/roadmap.md
- docs/product/maturity-and-compatibility.md
- docs/cli-commands.md
- docs/releases/index.md
- .tasks/0170-publish-a-truthful-security-reporting-policy.md

## Files forbidden to edit

- dist/**
- .tasks/archive/**
- docs/releases/v*.md
- docs/decisions.md

## Steps

1. List repeated facts with clear canonical sources and exact extraction rules; check only stable structured facts or explicit sentinels and leave semantic product truth to review.
2. Compare roadmap task-state rows with task IDs and `State` metadata discovered from repository task files; do not hardcode task IDs in the checker or tests.
3. Check relative Markdown links and anchors for the explicit canonical-doc allowlist only. Add a regression for a missing README anchor and correct the existing broken README anchor in `docs/product/maturity-and-compatibility.md`.
4. Add tests for passing input, deliberate stale values, missing links/anchors, malformed input where applicable, reordered content, and historical release notes that must remain exempt.
5. Keep `SECURITY.md` optional while Task 0170 is blocked; if it exists, validate only in-scope security links deterministically.
6. Wire `node scripts/check-docs-consistency.mjs` into local quality and hosted CI with actionable file and line feedback, and document scope and blind spots.
7. Before Task 0168 completes, ensure Task 0170's Verification section requires the exact command `node scripts/check-docs-consistency.mjs`; add or update that check through the sole bounded edit to another task contract.

## Acceptance criteria

- Evaluate exact checks for current release/version alignment, canonical install command, relative links, documented context paths, CLI reference versus registry, shipped milestones mislabeled planned, and package version versus release index; implement only decidable checks.
- Roadmap task-state rows are compared with task-file metadata discovered at runtime; new task IDs require no checker-code change.
- The existing README anchor referenced by the maturity document is validated, and the current broken reference can be corrected within the allowed files.
- The checker catches a real high-value drift case and has pass/fail tests.
- Each checked value has one canonical source and deterministic rule.
- Do not require SECURITY.md while Task 0170 is blocked or incomplete; if the file exists, check any in-scope security link deterministically.
- The checker command is exactly `node scripts/check-docs-consistency.mjs` in local quality, CI, and Task 0170's verification contract before Task 0168 is marked done.
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
- Task 0170 contains the exact docs-check command after Task 0168 updates its Verification section.

## Review questions

- Could legitimate historical content cause false failure?
- Can maintainers fix an error without guessing?

## Counterexample searches

- Test stale current value, old release note, reordered content, and missing target.

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Guard mechanical drift only; do not build a broad prose linter.
