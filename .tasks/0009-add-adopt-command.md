# Task 0009 - Add Adopt Command

Status: done
Mode: mvp
Risk: high
Depends on: 0001, 0002, 0004, 0006, 0007, 0008

## Goal

Implement `apk adopt` for bringing the kit into an existing repository without rewriting the codebase.

## Context files

- `AGENTS.md`
- `docs/adoption-flow.md`
- `docs/architecture.md`
- `docs/progress.md`
- `.tasks/0009-add-adopt-command.md`

## Files allowed to edit

- `src/cli/commands/adopt.ts`
- `src/cli/index.ts`
- `src/core/scanners/**`
- `src/core/docs/**`
- `src/core/exporters/**`
- `package.json`
- `docs/progress.md`
- `docs/decisions.md`
- `.tasks/0009-add-adopt-command.md`

## Files forbidden to edit

- future task files

## Steps

1. Add repository scanning.
2. Generate adoption docs.
3. Add conservative safety checks.
4. Update progress.

## Acceptance criteria

- Existing repositories can be scanned safely.
- Adoption avoids rewriting application code.
- The command behavior is documented and tested.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Favor conservative changes.
- Allowed files were expanded to include CLI entrypoint wiring and test script updates.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts adopt <temp-repo>`
  - `pnpm exec tsx src/cli/index.ts --help`
