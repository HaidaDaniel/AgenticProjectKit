# Task 0011 - Add Mode Command

Status: done
Mode: mvp
Risk: medium
Depends on: 0002, 0003

## Goal

Implement `apk mode` so the active operating mode can be inspected and updated in project config.

## Context files

- `AGENTS.md`
- `docs/modes.md`
- `docs/cli-commands.md`
- `docs/progress.md`
- `.tasks/0011-add-mode-command.md`

## Files allowed to edit

- `src/cli/commands/mode.ts`
- `src/cli/index.ts`
- `src/core/config/**`
- `src/core/modes/**`
- `docs/progress.md`
- `.tasks/0011-add-mode-command.md`
- `package.json`

## Files forbidden to edit

- future task files

## Steps

1. Add helpers to read and write `.agentic/config.json`.
2. Implement `apk mode` to print the current mode.
3. Implement `apk mode <mode>` to update the mode.
4. Validate mode values against the config schema.
5. Add tests for read, write, and invalid mode behavior.
6. Update progress.

## Acceptance criteria

- `apk mode` prints the current configured mode.
- `apk mode <mode>` updates `.agentic/config.json`.
- Invalid modes fail with a useful error.
- Existing config fields are preserved.

## Verification commands

- `pnpm test`
- `pnpm lint`
- `pnpm exec tsx src/cli/index.ts mode --help`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Keep command output terse and deterministic.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts mode --help`
  - temp-directory `apk mode` read/write smoke
