# Task 0054 - Add Task Templates

State: done
Owner: codex-plan-47
Mode: product
Lane: tasks
Scope: cli,tasks,docs,tests
Risk: medium
Parallel: false
Depends on: 0048
Tags: task-create,templates,dx

## Goal

Add task creation templates so common bugfix, feature, refactor, docs, audit, and test tasks do not require long repetitive flag lists.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- src/cli/index.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0054-add-task-templates.md
- README.md
- docs/task-system.md
- docs/cli-commands.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans

## Steps

1. Add `apk task create --template <name>` support.
2. Support initial templates: `bugfix`, `feature`, `refactor`, `docs`, `audit`, `test`.
3. Define default mode/lane/risk/tags/verification per template.
4. Require `--title`; allow explicit flags to override template defaults.
5. Keep `--scope` and `--allowed` required unless a later suggestion flow supplies them explicitly.
6. Add `--dry-run` if it is easy to test and useful for reviewing generated content before writing.
7. Update help output with template names.
8. Add tests for each template and for explicit overrides.
9. Ensure dependency graph validation and duplicate id prevention still run.

## Acceptance criteria

- `apk task create --template bugfix --title "Fix Parser" --scope cli --allowed src/cli/index.ts` creates a valid task.
- Template defaults are visible in generated task metadata and sections.
- Explicit flags override template defaults.
- Unknown template names fail with a clear error.
- Existing fully explicit task creation still works.
- No new dependencies are added.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js task create --help
- node dist/cli/index.js audit

## Documentation updates

- Update docs/task-system.md with template behavior and supported names.
- Update docs/cli-commands.md with examples.
- Update README task creation examples.
- Update docs/progress.md when task state changes.

## Notes

- This addresses the analysis point that `task create` currently requires too many flags for common work.
- Keep templates conservative; they should reduce typing, not hide task contracts.
