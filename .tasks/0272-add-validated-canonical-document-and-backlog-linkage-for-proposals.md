# Task 0272 - Add validated canonical-document and backlog linkage for proposals

State: done
Owner: opencode-milestone
Mode: maintenance
Lane: implementation
Type: feature
Scope: proposals,docs,backlog,planning,linking
Risk: medium
Parallel: false
Depends on: 0271
Tags: p2,proposals,canonical-link,backlog,planning

## Goal

Add a minimal validated manual linking workflow from a proposal to a canonical document or backlog card without automatic promotion task creation or a second review and gate system.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/proposals.md
- src/core/proposals/index.ts
- src/core/backlog/index.ts
- src/cli/commands/backlog.ts
- .tasks/0271-add-a-safe-explicit-proposal-only-git-commit-workflow.md

## Files allowed to edit

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

1. Define a minimal proposal link operation that records a canonical document path or backlog slug on the proposal without editing the canonical destination or backlog card.
2. Require the canonical file to be a contained regular non-symlinked file that already contains the proposal stable ID or proposal path; require a backlog card to exist and reference the proposal.
3. Preserve proposal stable identity and all prior decisions; reject arbitrary paths symlinks escapes and missing references with actionable diagnostics.
4. Keep promotion explicit: document the manual proposal to backlog to canonical task path and add no automatic task creation or canonical rewrite.
5. Add focused tests for valid and invalid canonical links backlog links missing references symlinks custom docs directories rejected and superseded proposals.
6. Document the linking policy and promotion boundary in docs/proposals.md and docs/decisions.md; regenerate the CLI reference; update docs/progress.md; rebuild committed dist.

## Acceptance criteria

- A proposal can record a validated canonical document link only when the destination exists inside the repository and contains a verifiable proposal reference.
- A proposal can record a validated backlog link only when the card exists and references the proposal.
- Linking never edits canonical documents creates backlog cards or creates tasks and never auto-promotes a proposal.
- Rejected and superseded proposals remain readable and their links remain verifiable.
- Stable Proposal-Id is preserved across links and filename changes.
- Focused tests pass.

## Correctness assumptions

- Validated manual linking is sufficient for the first version; a proposal never becomes authoritative or implemented merely by being accepted or linked.; The canonical document or backlog card must already contain a verifiable reference to the proposal.

## Invariants

- No command automatically edits canonical documentation or creates a backlog card or task.; Proposal stable identity survives linking and later filename changes.; Rejected and superseded proposals remain available and linkable.

## Required evidence

- Focused tests for valid and invalid canonical links backlog links missing references symlinks and custom docs directories.

## Review questions

- Does linking require a verifiable reference rather than accepting an arbitrary path?; Can any link operation create a task or rewrite canonical content?; Are rejected and superseded proposals still readable?

## Counterexample searches

- Search a canonical file without the proposal reference
- a symlinked canonical file
- an escaping path
- a missing backlog card
- a backlog card without the proposal reference
- and a custom docs directory.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"proposal-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document canonical and backlog linking and the explicit promotion boundary in docs/proposals.md and docs/decisions.md.
- Regenerate the CLI command reference in docs/cli-commands.md.
- Update docs/progress.md when task state changes.

## Notes

- Do not build a document management framework or a separate proposal review gate.
- Accepted proposals are not implemented features and linked proposals do not become canonical truth automatically.
