# Task 0038 - Analytics Summary Command

State: done
Owner: codex-a
Mode: product
Lane: analytics
Scope: cli,analytics,summary
Risk: medium
Parallel: false
Depends on: 0037
Tags: analytics,summary,team

## Goal

Add `apk analytics summary [--month YYYY-MM] [--write]` for developer, agent, platform, and model comparison.

## Context files

- AGENTS.md
- src/core/agents/index.ts
- src/core/tasks/index.ts
- src/cli/index.ts

## Files allowed to edit

- src/core/analytics/index.ts
- src/core/analytics/analytics.test.ts
- src/cli/commands/analytics.ts
- src/cli/index.ts
- package.json
- docs/cli-commands.md
- docs/progress.md
- .tasks/0038-analytics-summary-command.md

## Files forbidden to edit

- application source files

## Steps

1. Read sharded and legacy run events.
2. Join task metadata from `.tasks`.
3. Render compact Markdown grouped by developer, agent, platform, and model.
4. Write summary to `docs/analytics/agent-summary-YYYY-MM.md` when `--write`.

## Acceptance criteria

- Summary groups by developer/model/platform.
- Month filter works.
- `--write` creates docs analytics summary.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/cli-commands.md.
- Update docs/progress.md.

## Notes

- Raw events must not include prompts, stdout, stderr, diffs, or absolute paths.
