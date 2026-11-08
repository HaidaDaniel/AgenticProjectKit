# Task 0274 - Run integrated document-proposal regression and prepare the next minor release candidate

State: doing
Owner: opencode-milestone
Mode: maintenance
Lane: release
Type: audit
Scope: proposals,regression,performance,release-readiness,docs
Risk: medium
Parallel: false
Depends on: 0273
Tags: p2,proposals,release-candidate,regression,performance

## Goal

Run end-to-end proposal regression and performance checks prepare the v0.6.0 minor release candidate documentation and record an honest release-readiness assessment without publishing a tag or changing the validated release sentinel.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/proposals.md
- docs/releases/index.md
- docs/delivery/backlog-integration-readiness.md
- src/core/proposals/index.ts
- src/core/proposals/git.ts
- src/cli/commands/proposal.ts
- .tasks/0273-integrate-document-proposals-into-planning-guidance-and-generated-instructions.md

## Files allowed to edit

- src/core/proposals/proposals.test.ts
- src/core/proposals/git.ts
- src/cli/cli.test.ts
- package.json
- docs/delivery/document-proposals-readiness.md
- docs/releases/v0.6.0.md
- docs/releases/index.md
- docs/proposals.md
- docs/progress.md
- docs/index.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- .github/**
- pnpm-lock.yaml
- docs/releases/v0.5.0.md
- docs/releases/v0.5.1.md
- docs/releases/v0.5.2.md
- src/core/tasks/**
- src/core/backlog/**

## Steps

1. Add integrated end-to-end proposal tests covering storage lifecycle linking and proposal-only commits plus downstream-shaped Go Python and Node fixtures with zero proposals and existing backlog and task behavior.
2. Measure operation counts and cold-start behavior for status next-task workers attention task verify task gate and review with 0 1 100 and 1000 proposals and prove there is no additional proposal-specific filesystem or Git work.
3. Choose and record the next minor candidate version after verifying release policy and tags; prepare the candidate release note without claiming publication or changing the validated release sentinel.
4. Run the authoritative release checks and record exact commit text counts failures warnings dist currency and worktree state.
5. Write docs/delivery/document-proposals-readiness.md with security correctness data-preservation Git-isolation compatibility performance documentation and CLI-semantics findings and a single honest release status.
6. Update docs/proposals.md docs/progress.md and docs/index.md as needed; do not tag push publish or upgrade downstream repositories.

## Acceptance criteria

- Integrated proposal storage lifecycle linking and Git workflow scenarios pass end to end.
- Ordinary APK commands perform no additional proposal-specific filesystem or Git work at 0 1 100 or 1000 proposals.
- Existing backlog task lifecycle provenance task IDs init adopt and downstream-shaped Go Python and Node fixtures remain compatible.
- The v0.6.0 candidate documentation is truthful the validated release sentinel remains v0.5.2 and no tag or publication is created.
- Committed dist is current the worktree is clean after the candidate commit and the release-readiness report records exact evidence and limitations.

## Correctness assumptions

- The next minor version is 0.6.0 because the latest validated tag is v0.5.2 and no later release exists.; Performance is judged by absence of additional proposal-specific work on ordinary commands rather than by absolute zero Git operations.

## Invariants

- The validated release sentinel remains v0.5.2 until a new version is published and post-tag validated.; No tag push GitHub release force-push history rewrite or downstream upgrade is performed.; Task provenance rules are not weakened for benchmark convenience.

## Required evidence

- Release-readiness report with exact commit and commands plus performance operation counts for 0/1/100/1000 proposals and existing backlog task lifecycle compatibility.

## Review questions

- Do ordinary status next-task workers attention verify gate and review commands perform no proposal-specific filesystem or Git work?; Is the release note truthful about the unpublished candidate?; Are old backlog and task behaviors unchanged?

## Counterexample searches

- Search a repository with zero proposals
- existing downstream-shaped Go Python and Node fixtures
- a dirty worktree
- existing backlog cards
- an existing task lifecycle
- committed dist currency
- and a candidate version ahead of the sentinel.

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"proposal-e2e","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"dist-currency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Create docs/delivery/document-proposals-readiness.md.
- Create the v0.6.0 candidate release note and update docs/releases/index.md candidate version without changing the validated sentinel.
- Update docs/proposals.md docs/progress.md and docs/index.md.

## Notes

- Do not publish a tag or GitHub release.
- Do not run downstream upgrades.
