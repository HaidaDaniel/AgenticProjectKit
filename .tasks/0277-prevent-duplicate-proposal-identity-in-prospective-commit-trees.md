# Task 0277 - Prevent duplicate proposal identity in prospective commit trees

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: proposals,git,identity,rename,integrity
Risk: high
Parallel: false
Depends on: 0276
Tags: p1,proposals,git,identity,rename

## Goal

Prevent apk proposal commit from publishing a Git tree that contains the same stable Proposal-Id at more than one path, including uncommitted renames, and fail closed with an actionable Git-workflow message.

## Context files

- AGENTS.md
- docs/proposals.md
- docs/decisions.md
- src/core/proposals/git.ts
- src/core/proposals/index.ts
- src/cli/commands/proposal.ts
- .tasks/0271-add-a-safe-explicit-proposal-only-git-commit-workflow.md
- .tasks/0276-harden-proposal-lifecycle-concurrency-and-decision-encoding.md

## Files allowed to edit

- src/core/proposals/git.ts
- src/core/proposals/proposals.test.ts
- src/cli/cli.test.ts
- docs/proposals.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/proposals/index.ts
- src/core/tasks/**
- src/core/backlog/**
- src/core/config/**

## Steps

1. Reproduce in a disposable Git repository: commit docs/proposals/old.md with Proposal-Id X, rename it in the working tree to new.md without staging the deletion, run apk proposal commit new, and observe that HEAD contains both paths with the same identity.
2. Inspect the prospective commit tree, not only the filesystem inventory, for every Proposal-Id under the configured proposals directory with a bounded single-command Git search; detect duplicate IDs and missing expected current identity.
3. Fail closed before commit-tree/update-ref when a duplicate identity would be published, with a message explaining that the rename must be published through a separate controlled git mv commit and that unrelated files are not included.
4. Keep the pinned-parent diff-tree allowlist, isolated index, CAS update-ref, and current add/update behavior unchanged.
5. Add focused tests for same-slug rename, old path deletion unstaged, git mv staged rename, duplicate IDs already in HEAD, normal new proposal, normal update, unrelated staged files, and a second worktree.
6. Document the fail-closed rename policy and prospective-tree uniqueness check in docs/proposals.md and ADR text; update docs/progress.md; rebuild committed dist.

## Acceptance criteria

- A proposal commit cannot publish a Git tree with duplicate stable Proposal-Ids, including an unstaged rename whose old path remains in HEAD.
- A rename either publishes safely as a complete rename or fails closed with actionable guidance; no duplicate identity is published.
- Only the selected proposal path enters the commit, branch CAS is preserved, and no push or history rewrite occurs.
- Normal new-proposal and in-place update commits continue to work, including with unrelated staged/untracked files and in another worktree.
- Focused tests pass and docs describe the supported rename workflow and residual Git boundaries.

## Correctness assumptions

- A same-directory rename can leave the old committed path in the isolated HEAD tree while the new path is added; only the prospective tree proves published identity uniqueness.; Full automatic rename support is not required if a safe fail-closed workflow is documented.

## Invariants

- A proposal commit never publishes duplicate stable proposal identities.; Only the selected proposal path enters the commit tree.; Unrelated staged/untracked state and branch CAS semantics are preserved.; No push or history rewrite occurs.

## Required evidence

- Disposable rename reproducer showing the pre-fix duplicate tree and post-fix refusal or safe publication
- plus focused tests.

## Review questions

- Is uniqueness checked on the prospective commit tree rather than the working-tree inventory?; Does a rename with the old path still in HEAD fail closed with actionable guidance?; Are normal add/update commits unaffected?

## Counterexample searches

- Search same-slug rename
- rename to a new slug
- old path deleted but not staged
- git mv staged rename
- duplicate IDs already in HEAD
- existing new path with another ID
- unrelated staged files
- multiple worktrees
- and stale revision.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"proposal-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts"}`
- `{"id":"rename-report","type":"automated","required":true,"environment":"local","profile":"report","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts","evidenceRef":"tmp/apk/proposal-rename-integrity.txt"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document prospective-tree identity checking and the fail-closed rename workflow in docs/proposals.md and docs/decisions.md.
- Update docs/progress.md when task state changes.

## Notes

- Found by the v0.6.0 corrective assignment after the 0271 commit workflow was published.
- Prefer fail-closed behavior over a complex automatic rename implementation.
