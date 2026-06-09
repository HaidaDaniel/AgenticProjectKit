# Task 0051 - Add Doctor Command

State: done
Owner: codex-plan-47
Mode: product
Lane: diagnostics
Scope: cli,audit,config,tasks,docs,tests
Risk: medium
Parallel: false
Depends on: 0050
Tags: doctor,diagnostics,dx,cli

## Goal

Add `apk doctor` as a daily local health check for the repository workflow, separate from the broader report-writing `audit` command.

## Context files

- AGENTS.md
- docs/project.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- src/cli/index.ts
- src/cli/commands/audit.ts
- src/cli/commands/sync.ts
- src/core/audit/index.ts
- src/core/sync/index.ts
- src/core/tasks/index.ts
- src/core/scanners/index.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0051-add-doctor-command.md
- README.md
- docs/cli-commands.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/doctor.ts
- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans

## Steps

1. Add `apk doctor` help and routing.
2. Check whether Git is available and whether the current directory is inside a Git worktree.
3. Check `.agentic/config.json` presence and parse validity.
4. Check task directory presence and task parse validity.
5. Check registered agent files presence without requiring at least one agent for read-only use.
6. Check stale `.tasks/.apk.lock` using age and PID-safe heuristics that are documented in code tests.
7. Check generated instruction drift by reusing sync internals.
8. Check package scripts when `package.json` exists: test, lint, typecheck, build.
9. Check common local workflow files: README, license, `.env.example`, CI directory, lockfile consistency.
10. Print pass/warn/fail groups and return non-zero only for failures that block safe APK workflow.
11. Add tests for healthy repo, missing config, broken task file, stale lock, and missing scripts.

## Acceptance criteria

- `apk doctor` exits 0 with warnings for non-blocking gaps.
- `apk doctor` exits 1 for broken config, broken task files, or stale lock conditions that block task workflow.
- Output is concise and grouped by status.
- Doctor does not write audit reports or mutate files.
- Doctor does not duplicate all audit behavior; it is a quick health check.
- No web UI is introduced.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js doctor
- node dist/cli/index.js doctor --help
- node dist/cli/index.js audit

## Documentation updates

- Update docs/cli-commands.md with `apk doctor`.
- Add README daily workflow example using `status`, `doctor`, and `next-task`.
- Update docs/progress.md when task state changes.

## Notes

- `doctor` is for fast local diagnosis; `audit` remains for repository reports.
- Prefer shared pure checks that later audit/status commands can reuse.
