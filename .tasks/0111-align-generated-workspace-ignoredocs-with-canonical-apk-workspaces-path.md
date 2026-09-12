# Task 0111 - Align generated workspace ignore/docs with canonical .apk-workspaces path

State: todo
Owner: none
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: workspaces,adoption,docs,templates
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Make .apk-workspaces/ the single canonical APK workspace base in generated ignore output, init/adopt templates, and canonical docs; remove stale .apk-worktrees/ naming; keep committed dist current.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- README.md
- src/core/workspaces/index.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts
- src/cli/cli.test.ts
- .gitignore

## Files allowed to edit

- src/core/workspaces/index.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- README.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/work/**
- src/core/tasks/**
- .github/workflows/**

## Steps

1. Capture a reproducer that fails on the old behavior.
2. Identify and document the root cause before changing code.
3. Implement the smallest safe fix; do not perform unrelated refactors.
4. Add regression coverage and run verification.

## Acceptance criteria

- fresh apk init ignores .apk-workspaces/; fresh apk adopt ignores .apk-workspaces/ without overwriting existing .gitignore content; generated ignore and doc output never introduces .apk-worktrees/; the runtime default remains .apk-workspaces/; canonical docs name .apk-workspaces/; committed dist stays current; sync and lint stay clean after generation

## Correctness assumptions

- the runtime constant .apk-workspaces is canonical; init and adopt currently emit no .gitignore entry so a safe additive entry may be required; no persisted APK-owned .apk-worktrees path exists that requires migration

## Invariants

- existing user .gitignore content is never overwritten; workspace safety semantics are unchanged; no existing worktree is renamed or migrated automatically

## Required evidence

- regression test output plus generated init and adopt ignore content

## Review questions

- Does any canonical source still name .apk-worktrees; is the generated ignore entry additive and idempotent; does built sync and lint stay clean

## Counterexample searches

- existing .gitignore without a trailing newline; existing .gitignore already containing .apk-workspaces; adopt into a repo with a customized .gitignore; CRLF line endings

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"workspace-constant","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node --input-type=module -e \"import { DEFAULT_WORKSPACE_BASE } from './dist/core/workspaces/index.js'; if (DEFAULT_WORKSPACE_BASE !== '.apk-workspaces') { throw new Error('unexpected workspace base: ' + DEFAULT_WORKSPACE_BASE); }\""}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/task-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Keep the fix narrow.
