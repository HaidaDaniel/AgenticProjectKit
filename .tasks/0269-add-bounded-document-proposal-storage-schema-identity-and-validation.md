# Task 0269 - Add bounded document-proposal storage schema identity and validation

State: doing
Owner: opencode-milestone
Mode: maintenance
Lane: implementation
Type: feature
Scope: proposals,docs,filesystem,validation
Risk: medium
Parallel: false
Depends on: 0275
Tags: p2,proposals,storage,validation,filesystem

## Goal

Add a lightweight Git-tracked document-proposal layer under the configured docs directory with an opaque stable identity, bounded strict parsing, symlink and containment safe reads and exclusive creation, duplicate detection, and no executable-task or backlog lifecycle.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/index.md
- src/core/backlog/index.ts
- src/core/config/paths.ts
- src/cli/commands/backlog.ts
- .tasks/0247-add-lightweight-backlog-storage-and-cli.md
- .tasks/0248-promote-backlog-items-into-canonical-apk-tasks-safely.md

## Files allowed to edit

- src/core/proposals/index.ts
- src/core/proposals/proposals.test.ts
- package.json
- docs/proposals.md
- docs/decisions.md
- docs/index.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/**
- pnpm-lock.yaml
- .github/**
- src/cli/**
- src/core/tasks/**
- src/core/backlog/**
- src/core/config/schema.ts
- src/core/config/file.ts

## Steps

1. Define the minimal proposal Markdown contract with opaque Proposal-Id, title, kind, status, created and optional updated timestamps, optional related and canonical links, decision history, and differentiated optional sections for context, observations, hypotheses, proposed direction, evidence, and open questions.
2. Implement bounded storage under <docsDirectory>/proposals/<slug>.md using the configured docsDirectory, a safe Unicode slug, exclusive creation, and the existing repository containment helper for symlink and escape refusal.
3. Implement strict UTF-8 bounded reads with inventory and per-file limits, duplicate stable-ID detection, unsupported schema-version refusal without mutation, and deterministic validation diagnostics.
4. Reuse backlog-style parsing patterns without importing the large task engine; keep module loading and hot-path cost negligible for commands that do not request proposals.
5. Add focused tests for new and existing proposals, duplicate IDs and slugs, Unicode titles, invalid UTF-8, unsupported metadata, truncated and oversized files, symlinked files and directories, nested configured docsDirectory, concurrent modification, and preservation of unrelated data.
6. Document the proposal model, schema, storage boundary, and non-task semantics in docs/proposals.md and docs/decisions.md; link it from docs/index.md; update docs/progress.md; rebuild committed dist.

## Acceptance criteria

- Proposals are stored as bounded Git-tracked Markdown at <docsDirectory>/proposals/<slug>.md and support a custom docsDirectory without a root package.json dependency.
- Stable Proposal-Id is independent of filename; duplicate identities and duplicate slugs are detected deterministically.
- Unsupported versions, invalid UTF-8, oversized or truncated files, symlinked targets, and escapes fail closed with actionable diagnostics and no mutation of unrelated data.
- The proposal module does not import the task engine and does not create tasks or backlog items.
- Focused tests pass and cover the required storage and validation scenarios.

## Correctness assumptions

- The existing backlog parser and repository containment helper provide sufficient reusable patterns without importing the task engine into a simple proposal parser.; A proposal is intentionally not a task
- backlog item
- ADR
- canonical document
- or verification evidence.

## Invariants

- Proposal creation allocates no task ID and changes no task or backlog state.; Unsupported or unknown metadata versions fail closed without rewriting the proposal file.; Reads and writes stay inside the configured docs directory.

## Required evidence

- Focused storage and validation test output including disposable symlink and malformed-file fixtures.

## Review questions

- Are size inventory UTF-8 identity collision and symlink bounds enforced before mutation?; Does duplicate identity detection work independent of filename?; Is the module free of task-engine imports?

## Counterexample searches

- Search duplicate stable IDs
- duplicate slugs
- Unicode titles
- invalid UTF-8
- truncated and oversized files
- unsupported metadata versions
- symlinked files and directories
- nested custom docs directories
- concurrent edits
- and unrelated data preservation.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"proposal-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Create docs/proposals.md and link it from docs/index.md.
- Document the proposal-storage decision in docs/decisions.md.
- Update docs/progress.md when task state changes.

## Notes

- This task adds storage and validation only; CLI lifecycle transitions belong to the dependent task.
- Do not create a second generic filesystem framework; reuse resolveContainedRepositoryPath.
