# Task 0286 - Contain sync and exporter writes inside the repository

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: security
Scope: sync,exporters,containment,security,cli,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: p1,security,filesystem,containment,symlink,sync,export,tests

## Goal

Make writeExpectedFile() and writeAgentExportFiles() fail closed when an output path is a symlink, has a symlinked ancestor, or escapes the repository root, while preserving existing sync/export status semantics and user file contracts.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/agent-exporters.md
- docs/cli-commands.md
- src/core/config/paths.ts
- src/core/sync/index.ts
- src/core/exporters/index.ts
- src/cli/commands/sync.ts
- src/cli/commands/export.ts
- src/core/sync/sync.test.ts
- src/core/templates/renderer.test.ts
- src/cli/cli.test.ts
- .tasks/0265-contain-configured-task-and-docs-mutations-inside-the-repository.md
- .tasks/0275-contain-remaining-agentic-runtime-mutations-inside-the-repository.md

## Files allowed to edit

- src/core/config/paths.ts
- src/core/sync/index.ts
- src/core/exporters/index.ts
- src/core/sync/sync.test.ts
- src/core/templates/renderer.test.ts
- src/cli/cli.test.ts
- docs/agent-exporters.md
- dist/**

## Files forbidden to edit

- src/core/init/**
- src/core/doctor/**
- src/core/docs/**
- .tasks/**
- .agentic/**
- docs/releases/**
- docs/decisions.md
- docs/task-system.md
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce A1-A6 with the v0.6.0 built CLI in isolated temporary repositories using artificial outside marker files: existing AGENTS.md symlink with sync --write, same with export agents --force, symlinked ancestor directory via the public exporter API, dangling symlink, ../ traversal via writeAgentExportFiles, and ordinary sync/export status behavior.
2. Add a small batch containment helper in src/core/config/paths.ts that reuses resolveContainedRepositoryPath and validates every requested file path before any write, so a rejected member cannot leave a partially dangerous batch write.
3. Apply the helper in syncAgentExports/writeExpectedFile and preserve missing/stale/current/written classification and --write exit semantics.
4. Apply the helper in writeAgentExportFiles for caller-supplied outputPath values and preserve force/skipped/written semantics.
5. Add CLI regressions for symlinked and dangling destinations and API regressions for traversal and symlinked ancestors, plus Linux/Windows symlink caveat notes; cover ordinary writes and --force/skipped/stale/written behavior.
6. Document the residual pre-mutation TOCTOU boundary in docs/agent-exporters.md without claiming race-free protection.
7. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- CONFIRMED repro A1-A5 are refused with a containment error, non-zero CLI exit where a CLI exists, and no write to the outside marker file or directory.
- Every output path in a sync/export batch is resolved and validated before any member is written; a rejected member cannot cause a partial dangerous write.
- Caller-supplied outputPath values containing ../ or an absolute path are refused before any mkdir or writeFile.
- Ordinary sync and export behavior is unchanged, including current/missing/stale/written buckets, skipped and --force semantics, and check-mode vs --write exit codes.
- Regression tests cover the CLI commands and the public functions, on Linux with Windows symlink privilege caveats recorded.
- docs/agent-exporters.md states the best-effort pre-mutation check and residual TOCTOU boundary; no race-free guarantee is claimed.
- No changes to init, doctor, or adopt behavior or files.

## Correctness assumptions

- Inputs, callers, and dependencies may be malicious or compromised.

## Invariants

- Unauthorized actors cannot cross the protected capability boundary.

## Required evidence

- Negative-path, fail-closed, leakage, privilege, and auth-boundary results.

## Review questions

- Is any default, error path, or fallback more permissive than the success path?

## Counterexample searches

- Search missing credentials, confused deputy, privilege escalation, injection, and secret-in-log paths.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:source"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"symlink-repro-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run isolated symlink, dangling-symlink, ancestor-symlink and traversal reproducers for sync and export; record exact CLI exit codes, outside-marker contents and API outcomes."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document sync/export output-path safety and the residual TOCTOU boundary in docs/agent-exporters.md.

## Notes

- Baseline: immutable tag v0.6.0 commit d83d069f5309ca2b963f8939a2626d771265979a; current HEAD 556daeacbb54f93353297245614b78891291f671 has only docs/task changes since the tag, so source and dist match the release.
- Reproduced at /tmp/opencode/apk-v060-repro/A1-sync-symlink-existing, A2-export-force-symlink-existing, A4-sync-dangling-symlink, A5-A3-api; normal behavior in A6-normal-behavior.
- Reuse resolveContainedRepositoryPath; do not build an abstraction framework. adoptRepository in src/core/docs/adopt.ts is the reference guard-then-write implementation.
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated dirty state and must not be touched.
