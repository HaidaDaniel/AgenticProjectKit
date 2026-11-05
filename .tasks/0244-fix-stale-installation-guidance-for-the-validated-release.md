# Task 0244 - Fix stale installation guidance for the validated release

State: done
Owner: opencode-0244-0251
Mode: maintenance
Lane: docs
Type: docs
Scope: docs,installation,release,consistency
Risk: low
Parallel: false
Depends on: none
Tags: p1,docs,installation,consistency

## Goal

Remove the stale v0.4.7 install instruction from docs/getting-started.md and make all current installation guidance resolve from the canonical validated-release sentinel so a future version drift fails the documentation check while historical walkthroughs remain unchanged.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/getting-started.md
- README.md
- docs/releases/index.md
- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs
- docs/engineering/documentation-maintenance.md

## Files allowed to edit

- docs/getting-started.md
- README.md
- scripts/check-docs-consistency.mjs
- scripts/check-docs-consistency.test.mjs
- docs/engineering/documentation-maintenance.md
- docs/progress.md

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- docs/delivery/**
- src/**
- dist/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce the drift by comparing README v0.5.2 guidance with the docs/getting-started.md install command and manifest sentence at current HEAD.
2. Classify every version reference as a current instruction or a historical walkthrough; preserve recorded v0.4.7 hashes and results as history.
3. Replace only current install and manifest guidance with the validated-release sentinel value; do not rewrite historical records or invent a new release version.
4. Extend scripts/check-docs-consistency.mjs to validate the getting-started install command and current version claims against the sentinel.
5. Add a deterministic fixture regression where a stale getting-started tag fails and an aligned tag passes, including a prerelease candidate ahead of the validated sentinel.
6. Document the canonical release-version maintenance rule in documentation-maintenance.md.

## Acceptance criteria

- No current installation instruction names an older tag than the validated-release sentinel.
- Historical v0.4.7 walkthrough hashes and results remain byte-identical history.
- Older versions are not replaced outside the active install guidance.
- A future getting-started version drift fails the documentation consistency check with the file and line.
- A prerelease package candidate cannot replace the validated release value used by stable install guidance.
- The task does not create or imply a new release version.
- README and getting-started agree on the same install command.
- Focused docs tests pass.

## Correctness assumptions

- The sentinel in docs/releases/index.md is the single validated-release source of truth; historical walkthrough paragraphs are distinguishable by explicit recorded-run context; the checker must stay read-only and network-free

## Invariants

- Published release notes and delivery evidence are immutable; the checker never queries tags or the network; no application or runtime behavior changes

## Required evidence

- Before-and-after docs check output showing the stale line detected; focused regression output for stale and aligned fixtures; final clean docs consistency run

## Review questions

- Are any historical walkthrough claims accidentally rewritten; can a candidate version leak into stable install guidance; does the new check cover both the command and the manifest sentence; are multiple hardcoded version copies still required

## Counterexample searches

- Getting-started names an older tag while README is current; package version is ahead of the validated sentinel; historical paragraph mentions the old tag and hash; release note link is missing; checker runs without network or Git tags

## Verification

- `{"id":"docs-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/getting-started.md current install guidance; document release-version maintenance in docs/engineering/documentation-maintenance.md; update docs/progress.md when task state changes

## Notes

- At HEAD 77c8720 README names v0.5.2 while docs/getting-started.md line 14 names v0.4.7; keep the recorded v0.4.7 clean-directory walkthrough text and hash as history; do not create a broad documentation rewrite
