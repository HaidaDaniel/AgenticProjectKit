# Task 0271 - Add a safe explicit proposal-only Git commit workflow

State: done
Owner: opencode-milestone
Mode: maintenance
Lane: implementation
Type: feature
Scope: proposals,cli,git,workflow,safety
Risk: high
Parallel: false
Depends on: 0270
Tags: p2,proposals,git,isolated-index,commit-safety

## Goal

Add an explicit proposal-only local commit operation that publishes exactly one validated proposal file through an isolated Git index while preserving the caller index and working tree and never pushing rewriting history or committing unrelated code tasks evidence or generated output.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/proposals.md
- src/core/proposals/index.ts
- src/cli/commands/proposal.ts
- src/cli/command-registry.ts
- .tasks/0270-add-document-proposal-cli-and-explicit-lifecycle-transitions.md

## Files allowed to edit

- src/core/proposals/git.ts
- src/core/proposals/index.ts
- src/core/proposals/proposals.test.ts
- src/cli/commands/proposal.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
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
- src/core/tasks/**
- src/core/backlog/**
- src/core/config/**

## Steps

1. Implement an explicit proposal commit operation that resolves one proposal by slug or stable ID and validates the current file immediately before any Git mutation.
2. Detect a Git repository and an attached branch; fail closed for non-Git detached unsafe or ambiguous states with actionable guidance to use a separate worktree.
3. Build the commit from an isolated temporary index seeded from HEAD add only the exact proposal path validate no unrelated entry enters the tree and create a normal commit with commit-tree and a compare-and-swap update-ref.
4. Preserve the caller real index and working tree; refuse if the proposal path is staged differently from the validated working-tree bytes or if a concurrent change alters the proposal during the operation.
5. Never push fetch merge force-push or rewrite history; print the created commit SHA and the explicit manual push or PR handoff guidance.
6. Add focused disposable-repository tests for clean dirty staged untracked two-worktree concurrent-change and index-preservation scenarios; document the workflow dirty-worktree protected-main and multi-worktree rules; regenerate the CLI reference; update docs/progress.md; rebuild committed dist.

## Acceptance criteria

- The operation commits exactly one validated proposal file and no unrelated source task evidence generated or staged change.
- The caller real Git index and unrelated working-tree state are preserved or the operation fails closed with clear guidance.
- Concurrent proposal edits and staged-versus-working-tree conflicts fail closed without creating a commit.
- No push force-push history rewrite automatic merge or branch protection bypass occurs; the only result is a normal local commit.
- Tests cover clean dirty staged untracked two-worktree and concurrent-change scenarios and pass.
- Documentation states that proposal commits are ordinary provenance-visible commits and are not invisible to task attribution.

## Correctness assumptions

- The host Git executable supports read-tree add write-tree commit-tree and update-ref; an unavailable or unsupported Git fails closed.; Isolated-index plus plumbing commits are ordinary Git commits and are visible to task provenance like any other commit.

## Invariants

- The caller real Git index and unrelated working-tree changes are preserved byte-for-byte.; Only the explicitly selected proposal path is included in the commit.; No push force-push history rewrite automatic merge or branch-protection bypass is performed.; If safe preservation of unrelated staged state is impossible the operation fails closed with guidance to use a separate worktree.

## Required evidence

- Disposable-repository test output for clean dirty staged untracked two-worktree concurrent-change and protected-main-adjacent scenarios plus proof of real-index preservation.

## Review questions

- Does the commit include only the selected proposal path?; Is the caller index preserved or is the operation refused?; Are push and history rewrite impossible from this command?

## Counterexample searches

- Search clean worktree
- unrelated unstaged files
- unrelated staged files
- untracked files
- dirty index
- two Git worktrees
- concurrent Git changes
- proposal staged differently from working tree
- remote updated after preview
- and detached or missing branch states.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"proposal-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts"}`
- `{"id":"proposal-git-report","type":"automated","required":true,"environment":"local","profile":"report","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts","evidenceRef":"tmp/apk/proposal-git-workflow.txt"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the proposal-only commit workflow dirty-worktree rules protected-main handoff and provenance boundary in docs/proposals.md and docs/decisions.md.
- Regenerate the CLI command reference in docs/cli-commands.md.
- Update docs/progress.md when task state changes.

## Notes

- Use an isolated GIT_INDEX_FILE with standard Git plumbing rather than a custom transaction system.
- No GitHub API token or PR automation is required for local proposals.
