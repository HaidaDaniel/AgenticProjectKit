# Task 0290 - Contain legacy export cleanup deletions inside the repository

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: bugfix
Type: security
Scope: exporters,config-paths,security,cli,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: security,filesystem,containment,export,destructive,tests

## Goal

Make classifyLegacyAgentExports and cleanupLegacyAgentExports fail closed for symlink final components, symlinked ancestors, escaping paths and classification-to-delete races; preflight the whole generated deletion set before the first removal and never delete outside the repository.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/agent-exporters.md
- docs/cli-commands.md
- src/core/config/paths.ts
- src/core/exporters/index.ts
- src/cli/commands/export.ts

## Files allowed to edit

- src/core/config/paths.ts
- src/core/exporters/index.ts
- src/cli/commands/export.ts
- src/core/templates/renderer.test.ts
- src/cli/cli.test.ts
- docs/agent-exporters.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/audit/**
- src/core/doctor/**
- src/core/init/**
- src/core/sync/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce the audit F-001 escape in an isolated fixture: a symlinked legacy export directory pointing to an outside marker whose file exactly matches the generated legacy rendering; record CLI exit code and marker bytes before and after export --cleanup-legacy.
2. Define the exact deletion set as findings classified generated; do not delete customized or absent files; resolve every generated path with lstat-based containment before any removal.
3. Add a contained-delete batch helper in src/core/config/paths.ts that rejects a symlink final component, a symlinked ancestor, an absolute or traversing path, an unavailable root and any non-ENOENT lstat error before the first rm; batch-abort on any refusal.
4. Re-check containment and classification immediately before each removal to bound the classification-to-delete race; if the on-disk object changed after classification, refuse rather than delete.
5. Apply the helper in cleanupLegacyAgentExports and keep --report-legacy read-only; preserve the exact generated-versus-customized classification contract and existing CLI output.
6. Add CLI and API regressions for symlinked ancestor, symlinked final component, dangling link, traversal, valid-first-plus-symlinked-second batch atomicity and ordinary cleanup.
7. Document the residual pre-mutation TOCTOU boundary without claiming race-free protection.
8. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- The audit F-001 reproducer is refused with a containment error, non-zero CLI exit and byte-identical outside marker.
- Every generated deletion target is resolved and validated before the first rm; a rejected member leaves all other targets untouched.
- A classification-to-delete change fails closed: no file is deleted when content or path identity differs from the classified finding.
- Symlink final components and symlinked ancestors are refused; dangling links are never followed or repaired.
- --report-legacy remains read-only and customized files remain preserved.
- Ordinary --cleanup-legacy output, exit codes and removed/removed-count semantics are unchanged for healthy repositories.
- Regressions cover CLI and API paths and record the residual TOCTOU boundary.

## Correctness assumptions

- Inputs callers and dependencies may be malicious or compromised

## Invariants

- Unauthorized actors cannot cross the repository-root containment boundary for deletion

## Required evidence

- Negative-path and fail-closed results with outside-marker byte comparison

## Review questions

- Is any default error path or classification fallback more permissive than the success path

## Counterexample searches

- Confused deputy via a symlinked ancestor; TOCTOU between classification and rm; Partial batch deletion

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/templates/renderer.test.ts src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"legacy-cleanup-repro","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run isolated symlinked-ancestor, symlink-final-component, dangling-link and batch-atomicity reproducers for export --cleanup-legacy; record exact exit codes and outside-marker bytes before and after."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document contained legacy cleanup and residual TOCTOU in docs/agent-exporters.md

## Notes

- Trust boundary: deletion must never cross the repository root even when classification reads succeed
- Reuse the existing resolveContainedRepositoryPath contract
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
