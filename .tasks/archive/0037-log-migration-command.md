# Task 0037 - Log Migration Command

State: done
Owner: codex-a
Mode: product
Lane: analytics
Scope: migration,agents,runs
Risk: medium
Parallel: false
Depends on: 0036
Tags: migration,analytics,team

## Goal

Add `apk agent migrate-logs [--remove-legacy]` to convert legacy logs to sharded layout.

## Context files

- AGENTS.md
- src/core/agents/index.ts
- src/cli/commands/agent.ts
- docs/cli-commands.md

## Files allowed to edit

- src/core/agents/index.ts
- src/cli/commands/agent.ts
- src/core/tasks/task.test.ts
- docs/cli-commands.md
- docs/progress.md
- .tasks/0037-log-migration-command.md

## Files forbidden to edit

- application source files

## Steps

1. Convert legacy agents to sharded JSON.
2. Convert legacy run events to sharded JSONL.
3. Keep legacy files unless `--remove-legacy`.
4. Reject conflicting existing agent JSON unless identical.

## Acceptance criteria

- Migration writes sharded files.
- Migration is idempotent for identical data.
- `--remove-legacy` deletes old JSONL files.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/cli-commands.md.
- Update docs/progress.md.

## Notes

- Legacy events without developer use `unknown`.
