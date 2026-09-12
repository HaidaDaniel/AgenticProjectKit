# Task 0109 - Prepare v0.4.1 downstream Codex/OpenCode dogfood release

State: blocked
Owner: none
Mode: production
Lane: release
Type: release
Scope: versioning,release,docs,verification,ci
Risk: high
Parallel: false
Depends on: none
Tags: release

## Goal

Publish a stable patch release v0.4.1 containing the Task 0106/0107 adoption fixes and the Task 0108 assurance/review correction, installable from a pinned tag for downstream Codex/OpenCode dogfood.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/releases/v0.4.0.md
- .github/workflows/quality.yml
- package.json
- pnpm-lock.yaml
- README.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- docs/releases/v0.4.1.md
- docs/progress.md
- docs/audit-report.md
- docs/project-map.md
- README.md

## Files forbidden to edit



## Steps

1. Freeze and record the candidate SHA/tree.
2. Collect CI evidence and run post-bump validation.
3. Perform release smoke checks and rollback/recovery review.
4. Do not mutate the candidate after evidence is captured.

## Acceptance criteria

- Package version is 0.4.1; release checks pass on clean HEAD; exact-SHA hosted CI is green; annotated tag v0.4.1 points to the validated release commit; v0.4.0 is never moved; downstream can pin #v0.4.1 over SSH and HTTPS; README documents the pinned tag as the stable path and #main as unreleased testing only; brownfield adoption smoke passes from the tag; release notes bounded and accurate

## Correctness assumptions

- The adoption fixes on main are the intended v0.4.1 content; no source behavior changes are needed beyond the version bump and docs

## Invariants

- v0.4.0 tag is never moved or rewritten; no Herdr or PTY/session/process/SSH/runtime orchestration is added; no master-agent
- swarm
- scheduler
- or new product surface; tag only after exact-SHA CI success; existing runtime-neutral/workspace abstractions are preserved

## Required evidence

- Candidate SHA/tree, CI, post-bump, smoke, and recovery evidence.

## Review questions

- Does the tag resolve to the exact green CI SHA? Do README instructions avoid presenting #main as stable? Does the brownfield smoke prove non-destructive adoption and no medium-risk paid reviewer?

## Counterexample searches

- CI success belongs to another SHA; tag object peels to another commit; clean install from #v0.4.1 fails; customized AGENTS.md overwritten; generated checks mutate tracked files

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"docs/releases/v0.4.1.md"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-audit","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"built-status","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js status --detail"}`
- `{"id":"brownfield-adoption-smoke","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Install the frozen release candidate as a package into a disposable brownfield repository with an existing numeric task id including 0001 and a customized AGENTS.md, then verify non-destructive adoption, collision-free adoption task id, canonical AGENTS.md generation, preserved custom AGENTS.md, current sync, passing lint, expected doctor diagnostics, working status, working prompt codex and prompt opencode, no redundant Codex/OpenCode policy files, deterministic verification, and that an ordinary medium task does not demand a second paid semantic reviewer.","evidence":"smoke transcript plus observed command results"}`
- `{"id":"release-artifacts","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Record green hosted CI for the exact release SHA and the pushed annotated v0.4.1 tag peeling to that SHA; confirm a clean package install from #v0.4.1 and that the built CLI starts.","evidence":"GitHub Actions URL with head SHA plus annotated tag peeled commit and tag install result"}`

## Documentation updates

- docs/releases/v0.4.1.md
- docs/progress.md
- README.md

## Notes

- Treat evidence capture as the final mutation boundary.
- block: Await exact-SHA clean-checkout CI for v0.4.1 release commit; reopen after green run.
