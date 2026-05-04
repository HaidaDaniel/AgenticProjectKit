# Task 0012 - Add Next Task Command

Status: done
Mode: mvp
Risk: medium
Depends on: 0007, 0008

## Goal

Implement `apk next-task` so agents can find the next actionable task file.

## Context files

- `AGENTS.md`
- `docs/task-system.md`
- `docs/context-system.md`
- `docs/cli-commands.md`
- `docs/progress.md`
- `.tasks/0012-add-next-task-command.md`

## Files allowed to edit

- `src/cli/commands/next-task.ts`
- `src/cli/index.ts`
- `src/core/tasks/**`
- `src/core/docs/**`
- `docs/progress.md`
- `.tasks/0012-add-next-task-command.md`
- `package.json`

## Files forbidden to edit

- future task files

## Steps

1. Add task directory listing and task file loading helpers.
2. Select the lowest-numbered task with `Status: todo`.
3. Print task id, title, mode, risk, and path.
4. Include the recommended context command for that task.
5. Add tests for deterministic selection and no-task behavior.
6. Update progress.

## Acceptance criteria

- `apk next-task` returns the next todo task deterministically.
- Done tasks are ignored.
- Output includes the task file path and context command.
- No actionable tasks produces a clear message.

## Verification commands

- `pnpm test`
- `pnpm lint`
- `pnpm exec tsx src/cli/index.ts next-task --help`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Do not infer priority beyond task number and status.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts next-task --help`
  - `pnpm exec tsx src/cli/index.ts next-task`
