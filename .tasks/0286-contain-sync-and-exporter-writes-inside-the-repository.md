# Task 0286 - Contain sync and exporter writes inside the repository

State: done
Owner: opencode-impl
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

1. Reproduce A1-A6 with the built CLI from the peeled v0.6.0 release commit in isolated temporary repositories using artificial outside marker files: existing AGENTS.md symlink with sync --write, same with export agents --force, symlinked ancestor directory via the public exporter API, dangling symlink, ../ traversal via writeAgentExportFiles, and ordinary sync/export status behavior.
2. Define the write set before any mutation: sync --write selects only rendered outputs classified missing or stale; writeAgentExportFiles selects every passed file under --force and only files whose read returns ENOENT without --force. Preflight exactly that write set, not files that will be skipped.
3. Add a small batch containment helper in src/core/config/paths.ts that reuses resolveContainedRepositoryPath and resolves every selected write path before any write, so a rejected member cannot leave a partially dangerous batch write. Treat a symlink component, an escaping or absolute/traversing outputPath, an unavailable repository root, a non-ENOENT lstat error, and any other PathContainmentError as batch-aborting before the first mkdir or writeFile.
4. Leave a path that the command will skip without writing untouched: when readFile of an existing symlink succeeds and export would therefore skip it, do not add it to the write-set preflight, do not rewrite it and do not fail the command solely because it is a symlink; a dangling symlink whose read returns ENOENT enters the write set and is therefore refused. Apply the helper in syncAgentExports/writeExpectedFile and writeAgentExportFiles while preserving missing/stale/current/written, skipped, force and check-mode exit semantics.
5. Add CLI regressions for symlinked and dangling destinations, a skipped symlink that stays untouched, and batch atomicity (valid first file plus symlinked second file writes nothing); add API regressions for traversal and symlinked ancestors, plus Linux/Windows symlink caveat notes; cover ordinary writes and --force/skipped/stale/written behavior.
6. Document the residual pre-mutation TOCTOU boundary in docs/agent-exporters.md without claiming race-free protection.
7. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- CONFIRMED repro A1-A5 are refused with a containment error, non-zero CLI exit where a CLI exists, and no write to the outside marker file or directory.
- Preflight covers exactly the write set: sync --write validates only rendered missing/stale outputs; export validates all passed files under --force and only ENOENT files otherwise; paths skipped without writing are neither resolved for writing nor modified.
- An existing symlink on a path the command will skip stays untouched, is reported by the existing skipped/current semantics, and does not fail the command; a dangling symlink selected for writing is refused because its read returns ENOENT.
- Any containment failure, escaping/absolute/traversing outputPath, unavailable repository root, or non-ENOENT lstat error aborts the entire batch before the first mkdir or writeFile, so no earlier member is written.
- Caller-supplied outputPath values containing ../ or an absolute path are refused before any mkdir or writeFile.
- Ordinary sync and export behavior is unchanged, including current/missing/stale/written buckets, skipped and --force semantics, and check-mode exit 1 vs --write exit 0.
- Regression tests cover the CLI commands and the public functions, including the skipped-symlink and batch-atomicity cases, on Linux with Windows symlink privilege caveats recorded.
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
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/sync/sync.test.ts src/core/templates/renderer.test.ts src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"symlink-repro-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run isolated symlink, dangling-symlink, ancestor-symlink and traversal reproducers for sync and export; record exact CLI exit codes, outside-marker contents and API outcomes."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document sync/export output-path safety and the residual TOCTOU boundary in docs/agent-exporters.md.

## Notes

- Baseline: immutable annotated tag object v0.6.0 = d83d069f5309ca2b963f8939a2626d771265979a; peeled release commit = 88fc21e0b6523808cb627d2707354f1d8d2128db. Never call the tag object SHA a commit; use the peeled commit for checkout, comparison and source reproduction. HEAD was 556daeacbb54f93353297245614b78891291f671 when the repro ran and 0abc6c29fded4bcde925900e69895a3b6a58fba4 when this contract was corrected; intervening commits are docs/task-only, and source/dist match the peeled release commit.
- Reproduced at /tmp/opencode/apk-v060-repro/A1-sync-symlink-existing, A2-export-force-symlink-existing, A4-sync-dangling-symlink, A5-A3-api; normal behavior in A6-normal-behavior. These temporary artifacts are advisory only and are not required evidence; required evidence comes from the committed regression tests and the recorded repro report.
- Reuse resolveContainedRepositoryPath; do not build an abstraction framework. adoptRepository in src/core/docs/adopt.ts is the reference guard-then-write implementation.
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated dirty state and must not be touched.
