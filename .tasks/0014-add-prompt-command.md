# Task 0014 - Add Prompt Command

Status: done
Mode: mvp
Risk: medium
Depends on: 0006, 0007, 0008, 0012

## Goal

Implement `apk prompt <agent> --task <task-id>` so agents get a concise task prompt with exact context.

## Context files

- `AGENTS.md`
- `docs/context-system.md`
- `docs/task-system.md`
- `docs/agent-exporters.md`
- `docs/cli-commands.md`
- `docs/progress.md`
- `.tasks/0014-add-prompt-command.md`

## Files allowed to edit

- `src/cli/commands/prompt.ts`
- `src/cli/index.ts`
- `src/core/tasks/**`
- `src/core/docs/**`
- `src/core/exporters/**`
- `src/core/templates/**`
- `docs/progress.md`
- `.tasks/0014-add-prompt-command.md`
- `package.json`

## Files forbidden to edit

- future task files

## Steps

1. Define prompt input from task metadata and selected context files.
2. Add minimal prompt templates for supported agents.
3. Implement `apk prompt <agent> --task <task-id>`.
4. Support `--level 1|2|3` for context selection.
5. Add tests for prompt content and invalid arguments.
6. Update progress.

## Acceptance criteria

- Prompt output includes task goal, mode, allowed files, forbidden files, acceptance criteria, and verification commands.
- Prompt output includes exact context files.
- Supported agents are explicit and deterministic.
- Invalid task ids or agents fail with useful errors.

## Verification commands

- `pnpm test`
- `pnpm lint`
- `pnpm exec tsx src/cli/index.ts prompt codex --task 0014 --level 2`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Keep prompt output caveman-short by default.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts prompt codex --task 0014 --level 2`
