# Task 0002 - Add Config Schema

State: done
Owner: archive
Mode: mvp
Lane: archive
Scope: completed-v0.1
Risk: medium
Parallel: false
Depends on: 0001
Tags: archive,v0.1

## Goal

Define and validate the initial project configuration schema for Agentic Project Kit.

## Context files

- `AGENTS.md`
- `docs/project.md`
- `docs/scope.md`
- `docs/architecture.md`
- `docs/decisions.md`
- `docs/progress.md`
- `.tasks/0002-add-config-schema.md`

## Files allowed to edit

- `src/core/config/**`
- `src/utils/**`
- `package.json`
- `docs/progress.md`
- `docs/decisions.md`
- `.tasks/0002-add-config-schema.md`

## Files forbidden to edit

- `docs/project.md`
- `docs/scope.md`
- `docs/architecture.md`
- `.tasks/0001-initialize-typescript-cli.md`
- any future task file

## Steps

1. Define the config shape.
2. Add validation.
3. Add default values if needed.
4. Add tests for schema behavior.
5. Wire the tests into `pnpm test`.
6. Update progress.

## Acceptance criteria

- Config can be parsed and validated.
- Invalid config produces useful errors.
- The task remains isolated from unrelated CLI work.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.
- Record dependency or schema decisions in `docs/decisions.md` if required.

## Notes

- Keep the schema small and extensible.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
