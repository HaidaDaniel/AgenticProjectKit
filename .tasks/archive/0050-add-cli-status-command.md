# Task 0050 - Add CLI Status Command

State: done
Owner: codex-plan-47
Mode: product
Lane: status
Scope: cli,tasks,analytics,sync,docs,tests
Risk: medium
Parallel: false
Depends on: 0048
Tags: status,cli,dashboard,dx

## Goal

Add a compact CLI status dashboard so users can see current project workflow state without a web UI.

## Context files

- AGENTS.md
- docs/project.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- src/cli/index.ts
- src/cli/commands/tasks.ts
- src/cli/commands/next-task.ts
- src/cli/commands/analytics.ts
- src/cli/commands/sync.ts
- src/core/tasks/index.ts
- src/core/analytics/index.ts
- src/core/sync/index.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0050-add-cli-status-command.md
- README.md
- docs/cli-commands.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/status.ts
- src/core/status/index.ts
- src/core/status/status.test.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans

## Steps

1. Add `apk status` help and command routing.
2. Create a small `src/core/status` service that reads config, tasks, archived task counts, next task, sync status, and latest run-log metadata.
3. Print current mode and config health.
4. Print task counts by state: todo, doing, review, blocked, done, canceled, archived.
5. Print the next actionable task id/title or `none`.
6. Print generated instruction drift summary: current/stale/missing counts.
7. Print latest run event summary without exposing prompts, stdout, stderr, diffs, absolute paths, or context lists.
8. Print warnings for stale lock, missing config, broken task files, duplicate task ids, and out-of-sync exports.
9. Add `--json` only if it can be kept stable and tested; otherwise keep text output for this task.
10. Add tests for empty repo/default config, current repo shape, broken task file warning, and help output.

## Acceptance criteria

- `apk status` exits 0 in a valid repository and prints compact text output.
- Output includes mode, task counts, next task, generated instruction summary, latest run summary, and warnings.
- `apk status` does not require or start a web UI.
- `apk status` does not mutate repository files.
- `apk status` handles no todo tasks without error.
- Broken task files are surfaced as warnings, not stack traces.
- Missing optional telemetry is reported as `none`, not an error.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js status
- node dist/cli/index.js status --help
- node dist/cli/index.js audit

## Documentation updates

- Update docs/cli-commands.md with `apk status`.
- Add README examples for daily CLI workflow using `status`.
- Update docs/progress.md when task state changes.

## Notes

- User explicitly prefers CLI status over a web dashboard.
- Keep output short enough to use before every work session.
- Do not add terminal UI frameworks or dependencies.
