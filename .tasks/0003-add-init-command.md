# Task 0003 - Add Init Command

State: done
Owner: archive
Mode: mvp
Lane: archive
Scope: completed-v0.1
Risk: medium
Parallel: false
Depends on: 0001, 0002
Tags: archive,v0.1

## Goal

Implement `apk init` to create the initial kit structure in a new repository.

## Context files

- `AGENTS.md`
- `docs/project.md`
- `docs/scope.md`
- `docs/architecture.md`
- `docs/cli-commands.md`
- `docs/task-system.md`
- `docs/progress.md`
- `.tasks/0003-add-init-command.md`

## Files allowed to edit

- `src/cli/commands/init.ts`
- `src/cli/index.ts`
- `src/core/**`
- `src/utils/**`
- `package.json`
- `README.md`
- `docs/progress.md`
- `docs/decisions.md`
- `.tasks/0003-add-init-command.md`

## Files forbidden to edit

- `.tasks/0001-initialize-typescript-cli.md`
- `.tasks/0002-add-config-schema.md`
- any future task file

## Steps

1. Define the init flow.
2. Create required directories and starter docs.
3. Add basic safeguards against overwriting work.
4. Add tests or fixture coverage.
5. Update progress.

## Acceptance criteria

- `apk init` creates the expected starter structure.
- Existing files are protected from accidental overwrite.
- The command is documented and tested.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.
- Update `README.md` if command examples change.

## Notes

- Keep the implementation minimal.
- Allowed files were expanded to include CLI wiring and test script updates needed for this command.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts --help`
  - `pnpm exec tsx src/cli/index.ts init <temp-dir>`
