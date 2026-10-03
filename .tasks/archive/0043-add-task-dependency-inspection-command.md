# Task 0043 - Add Task Dependency Inspection Command

State: done
Owner: opencode
Mode: product
Lane: tasks
Scope: cli,tasks,docs,tests
Risk: medium
Parallel: false
Depends on: 0042
Tags: tasks,dependencies,cli,workflow

## Goal

Add `apk task deps <task-id>` so humans and agents can inspect a task's prerequisites, dependents, and graph problems without reading every task file manually.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/index.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0043-add-task-dependency-inspection-command.md
- README.md
- docs/cli-commands.md
- docs/task-system.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/index.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- task state transition commands unless needed for routing only
- exporter templates
- source outside task dependency inspection and CLI help surfaces

## Steps

1. Add a task command router for `apk task <subcommand>`.
2. Add `apk task deps <task-id>` with `--help`.
3. Reuse the dependency graph validation helper from Task 0042.
4. Print the selected task id, title, state, and path.
5. Print direct prerequisites from `Depends on`.
6. Print direct dependents that list this task in `Depends on`.
7. Print whether each prerequisite is done, active, terminal, missing, or blocked.
8. Print dependency graph issues relevant to the selected task.
9. Return exit code 1 when the task id is unknown or usage is invalid.
10. Add core rendering tests and CLI smoke tests.
11. Run verification.

## Acceptance criteria

- `apk task deps 0043` prints prerequisites and dependents for task 0043.
- Missing dependency ids are visible in the command output.
- Dependency cycles involving the selected task are visible in the command output.
- Tasks with no prerequisites print `Depends on: none` or equivalent compact output.
- Tasks with no dependents print `Dependents: none` or equivalent compact output.
- Root `apk --help` lists the `task` command.
- `docs/cli-commands.md` documents `apk task deps <task-id>`.

## Verification commands

- pnpm lint
- pnpm test
- pnpm exec tsx src/cli/index.ts task deps 0043
- pnpm exec tsx src/cli/index.ts task deps 9999

## Documentation updates

- Update README.md command examples if task dependency inspection is documented there.
- Update docs/cli-commands.md.
- Update docs/task-system.md.
- Update docs/progress.md when task status changes.

## Notes

- Keep output compact and stable for agents.
- Do not recurse indefinitely; if recursive output is added, it must stop on cycles and keep deterministic ordering.
