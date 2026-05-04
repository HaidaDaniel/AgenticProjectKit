# Task 0006 - Add Agent Exporters

Status: done
Mode: mvp
Risk: medium
Depends on: 0004, 0005

## Goal

Add exporters for the initial agent instruction files.

## Context files

- `AGENTS.md`
- `docs/agent-exporters.md`
- `docs/architecture.md`
- `docs/progress.md`
- `.tasks/0006-add-agent-exporters.md`

## Files allowed to edit

- `src/core/exporters/**`
- `src/core/templates/**`
- `AGENTS.md`
- `.codex/instructions.md`
- `.opencode/AGENTS.md`
- `.cursor/rules/**`
- `docs/progress.md`
- `docs/decisions.md`
- `.tasks/0006-add-agent-exporters.md`

## Files forbidden to edit

- future task files

## Steps

1. Define neutral export input.
2. Generate the supported instruction files.
3. Add tests for exporter output.
4. Update progress.

## Acceptance criteria

- The initial agent files can be generated from shared policy.
- Exporter behavior is covered by tests.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.
- Record exporter design decisions if needed.

## Notes

- Keep the exporter surface small in v0.1.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
