# Task 0041 - Add Task Listing Filters

State: done
Owner: opencode
Mode: product
Lane: tasks
Scope: cli,tasks,docs,tests
Risk: low
Parallel: false
Depends on: none
Tags: tasks,filters,workflow

## Goal

Make `apk tasks` useful as the daily work queue by hiding completed/canceled work by default while keeping explicit filters for full history and exact state views.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/cli/commands/tasks.ts
- src/cli/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0041-add-task-listing-filters.md
- README.md
- docs/cli-commands.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/commands/tasks.ts
- src/cli/index.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- exporter templates
- source outside task listing and CLI help surfaces

## Steps

1. Define active task states as `todo`, `doing`, `review`, and `blocked`.
2. Update `apk tasks` so no flags prints only active task states.
3. Add `apk tasks --all` to include `done` and `canceled` tasks.
4. Keep `apk tasks --state <state>` as an exact state filter, including `done` and `canceled`.
5. Preserve `apk tasks --owner <agent-id>` and make it compose with default active filtering, `--all`, and `--state`.
6. Update help text and docs to describe default active behavior.
7. Add unit or CLI tests for default active output, `--all`, `--state done`, and owner filtering.
8. Run verification.

## Acceptance criteria

- `apk tasks` hides `done` and `canceled` tasks by default.
- `apk tasks --all` shows every parsed task.
- `apk tasks --state done` shows done tasks even though done is not active.
- `apk tasks --owner <agent-id>` still filters by owner.
- Unknown options still fail with a clear error.
- README and CLI docs match the implemented command behavior.

## Verification commands

- pnpm lint
- pnpm test
- pnpm exec tsx src/cli/index.ts tasks
- pnpm exec tsx src/cli/index.ts tasks --all
- pnpm exec tsx src/cli/index.ts tasks --state done

## Documentation updates

- Update README.md command examples if they mention task listing.
- Update docs/cli-commands.md.
- Update docs/progress.md when task status changes.

## Notes

- `--state` should be treated as an explicit exact filter, not as an active-list modifier.
- If both `--all` and `--state` are present, prefer the exact `--state` filter and document the behavior in tests.
