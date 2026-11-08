# Task 0278 - Publish new proposal files with crash-safe exclusive linking

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: proposals,filesystem,exclusive-write,crash-safety
Risk: high
Parallel: false
Depends on: 0277
Tags: p2,proposals,exclusive-create,crash-safety,filesystem

## Goal

Replace direct exclusive proposal writing with same-directory temporary preparation and hard-link publication so no existing target is replaced and no partially written final proposal appears after failure.

## Context files

- AGENTS.md
- docs/proposals.md
- docs/decisions.md
- src/core/proposals/index.ts
- src/core/tasks/index.ts
- .tasks/0266-publish-new-task-files-with-crash-safe-exclusive-linking.md
- .tasks/0277-prevent-duplicate-proposal-identity-in-prospective-commit-trees.md

## Files allowed to edit

- src/core/proposals/index.ts
- src/core/proposals/proposals.test.ts
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
- src/core/proposals/git.ts
- src/core/tasks/**
- src/core/backlog/**
- src/core/config/**

## Steps

1. Analyze the canonical task exclusive-publication protocol and confirm the pre-fix proposal creation path writes directly to the final target with flag wx, which prevents replacement but not a partial final file after a write failure.
2. Render and validate the complete proposal Markdown before any filesystem mutation.
3. Write the Markdown through an exclusive same-directory temporary file, sync file contents when supported, close it, and publish only by hard link so an existing target can never be replaced.
4. Map EEXIST to a proposal-already-exists error, fail closed on unsupported hard-link codes, clean the temporary file on every failure, and surface cleanup failure after successful publication without claiming the target is missing.
5. Keep containment, symlink refusal, custom docsDirectory, duplicate-ID validation, and no-task/no-Git behavior unchanged.
6. Add injectable failure-path tests and normal creation tests; document the publication protocol and its durability boundary in docs/proposals.md and docs/decisions.md; update docs/progress.md; rebuild committed dist.

## Acceptance criteria

- A new proposal never overwrites an existing target and never appears partially written after a failed write or publication.
- Temporary files are removed on write, publication, and collision failures; cleanup failure after successful publication is surfaced with an actionable message.
- Unsupported hard-link publication fails closed without an overwrite-capable rename fallback.
- Normal creation works with default and custom docsDirectory, and symlinked directories/targets remain refused.
- Focused tests cover the required success and failure scenarios and existing proposal behavior does not regress.

## Correctness assumptions

- The canonical task exclusive-publication protocol is a suitable small model for proposals.; Hard-link support may be unavailable on some filesystems; unsupported publication must fail closed rather than fall back to overwrite-capable rename.

## Invariants

- An existing target is never replaced or modified.; No partial final Markdown appears after write or publication failure.; Temporary files are cleaned on pre-publication failure and cleanup failure after successful publication is surfaced.; Proposal creation allocates no task ID and performs no Git operation.

## Required evidence

- Disposable failure-path tests for write
- collision
- unsupported link
- cleanup
- and target preservation
- plus the pre-fix observation that direct write could leave a partial final file.

## Review questions

- Can a partially written final proposal appear after failure?; Is the exclusive-create guarantee preserved?; Are unsupported hard links and cleanup failures surfaced rather than hidden?

## Counterexample searches

- Search collision before and after precheck
- partial temp write
- link publication failure
- unsupported link codes
- cleanup failure after success
- existing target bytes
- retry
- custom docsDirectory
- symlinked directory and target
- and duplicate Proposal-Id.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"proposal-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts"}`
- `{"id":"atomic-report","type":"automated","required":true,"environment":"local","profile":"report","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts","evidenceRef":"tmp/apk/proposal-atomic-create.txt"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document exclusive proposal publication and its crash-durability boundary in docs/proposals.md and docs/decisions.md.
- Update docs/progress.md when task state changes.

## Notes

- Model on Task 0266 but keep the implementation small and local to proposals.
- Do not claim directory fsync durability unless it is implemented and tested.
