# Task 0013 - Add Export Command

Status: done
Mode: mvp
Risk: medium
Depends on: 0006

## Goal

Implement `apk export` so generated agent instruction files can be written from shared exporter templates.

## Context files

- `AGENTS.md`
- `docs/agent-exporters.md`
- `docs/cli-commands.md`
- `docs/progress.md`
- `.tasks/0013-add-export-command.md`

## Files allowed to edit

- `src/cli/commands/export.ts`
- `src/cli/index.ts`
- `src/core/exporters/**`
- `src/core/config/**`
- `src/utils/**`
- `AGENTS.md`
- `.codex/instructions.md`
- `.opencode/AGENTS.md`
- `.cursor/rules/**`
- `docs/progress.md`
- `.tasks/0013-add-export-command.md`
- `package.json`

## Files forbidden to edit

- future task files

## Steps

1. Add safe write helpers for exporter outputs.
2. Implement `apk export` to write all supported agent files.
3. Implement `apk export <agent>` for a single supported target.
4. Keep generated outputs based on neutral exporter templates.
5. Add tests for all-target and single-target export behavior.
6. Update progress.

## Acceptance criteria

- `apk export` writes AGENTS, Codex, OpenCode, and Cursor outputs.
- `apk export <agent>` writes only the selected target.
- Unsupported agents fail with a useful error.
- Exported files match renderer output.

## Verification commands

- `pnpm test`
- `pnpm lint`
- `pnpm exec tsx src/cli/index.ts export --help`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Keep exporter files derived from shared policy.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts export --help`
  - temp-directory `apk export codex` smoke
