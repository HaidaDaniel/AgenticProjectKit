# Task 0044 - Add Validated Task Create Command

State: done
Owner: opencode
Mode: product
Lane: tasks
Scope: cli,tasks,templates,docs,tests
Risk: high
Parallel: false
Depends on: 0042,0043
Tags: tasks,create,validation,templates

## Goal

Add `apk task create` so new task files are generated through the CLI with required metadata, narrow edit scope, and dependency validation instead of hand-written Markdown.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/index.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0044-add-validated-task-create-command.md
- README.md
- docs/cli-commands.md
- docs/task-system.md
- docs/context-system.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/index.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates unless generated command docs require sync changes
- source outside task creation, task parsing, and CLI help surfaces

## Steps

1. Define the non-interactive CLI contract for `apk task create`.
2. Support required flags for title, mode, lane, scope, risk, context files, allowed files, and verification commands.
3. Support optional flags for depends-on, tags, parallel, forbidden files, steps, acceptance criteria, documentation updates, and notes.
4. Auto-select the next numeric task id from existing task files.
5. Generate a slugged task filename under the configured task directory.
6. Render the task with the existing task Markdown renderer.
7. Validate the rendered task with the existing parser before writing.
8. Validate the dependency graph including the new task before writing.
9. Refuse duplicate ids, invalid metadata values, missing dependency ids, and dependency cycles.
10. Avoid overwriting an existing task file.
11. Add tests for successful creation, invalid metadata, missing dependency, duplicate path, and generated filename.
12. Update command help and docs.
13. Run verification.

## Acceptance criteria

- `apk task create --title "Example" ...` writes a valid `.tasks/<id>-example.md` file.
- Created tasks default to `State: todo` and `Owner: none`.
- Created tasks include explicit `Depends on`, using `none` when no dependency is provided.
- Created tasks include all required compact sections.
- Invalid task metadata fails before writing a file.
- Missing dependencies fail before writing a file.
- The command is deterministic and works in a fresh initialized repository.
- Docs show at least one complete non-interactive example.

## Verification commands

- pnpm lint
- pnpm test
- pnpm exec tsx src/cli/index.ts task create --help
- pnpm exec tsx src/cli/index.ts audit

## Documentation updates

- Update README.md with a compact task creation example.
- Update docs/cli-commands.md.
- Update docs/task-system.md.
- Update docs/context-system.md if context flag behavior is documented.
- Update docs/progress.md when task status changes.

## Notes

- Do not add an LLM planner in this task.
- Prefer repeated flags over JSON for v1 if that keeps implementation small.
- If JSON input is added, document the schema and keep flag mode working.
