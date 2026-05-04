# Task 0008 - Add Context Command

Status: done
Mode: mvp
Risk: medium
Depends on: 0007

## Goal

Implement `apk context` so agents can see exactly which files to read for a task.

## Context files

- `AGENTS.md`
- `docs/context-system.md`
- `docs/task-system.md`
- `docs/progress.md`
- `.tasks/0008-add-context-command.md`

## Files allowed to edit

- `src/cli/commands/context.ts`
- `src/cli/index.ts`
- `src/core/tasks/**`
- `src/core/docs/**`
- `docs/progress.md`
- `.tasks/0008-add-context-command.md`

## Files forbidden to edit

- future task files

## Steps

1. Implement context selection rules.
2. Print exact file lists for a task.
3. Add tests for the context output.
4. Update progress.

## Acceptance criteria

- The command returns the documented context levels.
- The output is explicit and deterministic.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Keep local-LLM-safe behavior in mind.
- Allowed files were expanded to include CLI entrypoint wiring.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts context 0008 --level 2`
  - `pnpm exec tsx src/cli/index.ts context 0008 --level 3`
