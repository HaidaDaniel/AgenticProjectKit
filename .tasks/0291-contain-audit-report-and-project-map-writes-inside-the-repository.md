# Task 0291 - Contain audit report and project-map writes inside the repository

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: bugfix
Type: security
Scope: audit,config-paths,security,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: security,filesystem,containment,audit,tests

## Goal

Preflight both audit outputs as one batch so symlinked ancestors or final components and escaping paths are refused before any write, and decide and document how docsDirectory config applies to these fixed report paths.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/audit/index.ts
- src/core/config/paths.ts
- src/core/audit/audit.test.ts
- src/core/config/schema.ts

## Files allowed to edit

- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- docs/cli-commands.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/doctor/**
- src/core/init/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce the audit F-002 escape in an isolated fixture with a symlinked docs directory and an outside marker named audit-report.md; record exit code and marker bytes.
2. Resolve both report paths through a contained write batch before mkdir or writeFile so a refusal on either path prevents partial mutation.
3. Refuse a symlink final component and any symlinked ancestor; do not follow or repair discovered links.
4. Resolve the docsDirectory configuration question explicitly: either honor it for both report paths or document that they are canonical fixed paths; keep ignore-entry canonical strings consistent with the chosen behavior.
5. Add tests for symlinked docs ancestor, symlinked final report file, refusal before partial mutation, custom docsDirectory and ordinary audit behavior.
6. Confirm doctor and other read-only consumers still see the reports where expected; run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- The audit F-002 reproducer exits non-zero with a containment error and the outside marker is byte-identical.
- Both report paths are preflighted before the first mkdir or writeFile; a refusal on the second path leaves no first-path write.
- Symlinked ancestors and symlink final components are refused for both reports.
- The docsDirectory behavior is implemented or documented and consistent with canonical ignore entries.
- Ordinary audit output, report content and Project Map content are unchanged for healthy repositories.
- Tests cover all listed negative paths and the normal path.

## Correctness assumptions

- Repository configuration and directory entries may be hostile

## Invariants

- Audit cannot write outside the repository root and cannot partially mutate its output pair

## Required evidence

- Negative-path results with outside-marker byte comparison and no-partial-write proof

## Review questions

- Does any error path skip the batch preflight

## Counterexample searches

- First report written then second refused; Symlinked docs ancestor; Configured docsDirectory escape

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/audit/audit.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"audit-write-repro","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run isolated symlinked-docs, symlink-final-report and custom-docsDirectory reproducers for apk audit; record exit codes, outside-marker bytes and whether a partial write occurred."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the contained audit report contract in docs/cli-commands.md

## Notes

- Trust boundary: report writes must stay inside the repository root
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
