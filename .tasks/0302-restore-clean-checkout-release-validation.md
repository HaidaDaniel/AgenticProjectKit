# Task 0302 - Restore clean-checkout release validation

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: bugfix
Type: release
Scope: docs,release,validation,tests
Risk: high
Parallel: false
Depends on: none
Tags: release,docs,reproducibility,validation,tests

## Goal

Make every required documentation link resolvable from the tracked Git tree and prove that pnpm release:check succeeds from a genuinely clean checkout at the exact candidate SHA without relying on untracked local files.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/progress.md
- scripts/check-docs-consistency.mjs
- docs/reviews/2026-11-19-a110cb4-pre-release-review.md

## Files allowed to edit

- docs/progress.md
- docs/audits/**
- docs/reviews/**
- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/**
- dist/**
- package.json
- pnpm-lock.yaml
- .github/**
- docs/releases/**
- docs/decisions.md

## Steps

1. Reproduce R-002 in a clean detached worktree at the exact candidate SHA: install with frozen lockfile and confirm scripts/check-docs-consistency.mjs exits 1 for the two audits/ links.
2. Make both referenced audit documents part of the tracked Git tree; stage only task-attributable files and never absorb .tasks/0285 or docs/adoption-report.md.
3. Add a regression test that builds a tracked-files-only documentation view (excluding untracked local files) and asserts missing relative link targets are detected even when those files exist locally but untracked.
4. Confirm no release check can treat dirty-checkout success as clean-checkout readiness: document the clean-checkout requirement in the validation path.
5. Run pnpm release:check in a fresh worktree at the committed candidate and record exact SHA and exit code.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- Every required document referenced by docs/progress.md exists in the tracked Git tree (git ls-files proof).
- No unrelated WIP is staged in the implementation commit.
- pnpm release:check exits 0 at the exact candidate SHA in a fresh checkout with frozen-lockfile install.
- The new regression test fails when a referenced document is absent from the tracked view even if it exists locally as untracked.
- Clean-checkout validation is documented as authoritative; dirty-checkout success is explicitly non-authoritative.

## Correctness assumptions

- A clean checkout is the authority for release readiness

## Invariants

- Tracked documentation links are complete

## Required evidence

- Clean worktree SHA and release:check exit code

## Review questions

- Does any local untracked path still influence the release check

## Counterexample searches

- Link resolves only from dirty tree; Unrelated WIP staged; Stale worktree from a different SHA

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"clean-checkout-release","type":"manual","required":true,"environment":"live","profile":"report","instruction":"Create a fresh detached worktree at the candidate SHA, install with pnpm install --offline --frozen-lockfile, run pnpm release:check, and record SHA, exit code and docs consistency output."}`
- `{"id":"clean-checkout-live","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Independently observe the clean-checkout release check and confirm the exact candidate SHA and exit code."}`

## Documentation updates

- Document clean-checkout release validation

## Notes

- R-002 from docs/reviews/2026-11-19-a110cb4-pre-release-review.md
- Preserve pre-existing untracked .tasks/0285 and docs/adoption-report.md
