# Task 0110 - Make Git-tag distribution self-contained and prepare v0.4.2

State: blocked
Owner: none
Mode: production
Lane: release
Type: release
Scope: packaging,ci,versioning,release,docs,verification
Risk: high
Parallel: false
Depends on: none
Tags: release

## Goal

Ship a runnable package inside the Git tag: commit the built dist/, remove the install-time prepare build script, reject stale committed dist in CI, and release v0.4.2 that installs from the tag in a fresh pnpm store with no build-script allowlist.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/releases/v0.4.1.md
- .github/workflows/quality.yml
- package.json
- pnpm-lock.yaml
- README.md

## Files allowed to edit

- .gitignore
- package.json
- pnpm-lock.yaml
- .github/workflows/quality.yml
- scripts/clean-dist.mjs
- scripts/copy-template-assets.mjs
- dist/**
- docs/releases/v0.4.2.md
- docs/decisions.md
- docs/progress.md
- README.md

## Files forbidden to edit

- src/**

## Steps

1. Freeze and record the candidate SHA/tree.
2. Collect CI evidence and run post-bump validation.
3. Perform release smoke checks and rollback/recovery review.
4. Do not mutate the candidate after evidence is captured.

## Acceptance criteria

- dist/ is committed and current; package.json has no prepare script and no install/postinstall build hook; CI rejects stale committed dist; a fresh empty-store pnpm install from #v0.4.2 with no onlyBuiltDependencies/allowBuilds succeeds; built CLI starts; disposable brownfield adoption smoke passes from the tag; package version is 0.4.2; annotated tag v0.4.2 points to the validated SHA; v0.4.0 and v0.4.1 tags are not moved; v0.4.1 remains historical and is not retagged

## Correctness assumptions

- Committing dist is acceptable because the distribution mechanism is Git tags; source behavior is unchanged so dist content is deterministic

## Invariants

- v0.4.0 and v0.4.1 tags are never moved or deleted; no Herdr or PTY/session/process/SSH/runtime orchestration; no master-agent
- swarm
- scheduler
- or new product surface; Git tag is a self-contained runnable package; downstream never needs a build-script allowlist

## Required evidence

- Candidate SHA/tree, CI, post-bump, smoke, and recovery evidence.

## Review questions

- Does the committed dist match a fresh build? Is every install-time build hook removed? Does the fresh-store install prove no consumer allowlist is needed? Are v0.4.0/v0.4.1 tags intact?

## Counterexample searches

- dist drift after a source change; pnpm still blocking a lifecycle script; warm shared store masking a clean-machine failure; tag peeled to a different SHA; v0.4.1 retagged

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"packaging-contract","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node -e \"const p=require('./package.json'); if(p.scripts.prepare) throw new Error('prepare script must be removed'); if(!require('fs').existsSync('dist/cli/index.js')) throw new Error('dist/cli/index.js must be committed');\""}`
- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"docs/releases/v0.4.2.md"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-audit","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"built-status","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js status --detail"}`
- `{"id":"fresh-store-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"In a brand-new empty temp directory with a brand-new pnpm store (pnpm add --store-dir <tmp>/pnpm-store -D git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.2) and no onlyBuiltDependencies or allowBuilds configuration, install succeeds, the built CLI starts, and a disposable brownfield repository adoption smoke passes.","evidence":"fresh-store install transcript plus adoption smoke results"}`
- `{"id":"release-artifacts","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Record green hosted CI for the exact v0.4.2 release SHA and the pushed annotated v0.4.2 tag peeling to that SHA; confirm package.json at the tag says 0.4.2, v0.4.0 and v0.4.1 were not moved, and the committed dist is current.","evidence":"GitHub Actions URL with head SHA plus annotated tag peeled commit and package version at tag"}`

## Documentation updates

- docs/releases/v0.4.2.md
- docs/decisions.md
- docs/progress.md
- README.md

## Notes

- Treat evidence capture as the final mutation boundary.
- block: Await exact-SHA clean-checkout CI for v0.4.2 release commit; reopen after green run.
