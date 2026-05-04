# Task 0010 - Add README Examples

State: done
Owner: archive
Mode: mvp
Lane: archive
Scope: completed-v0.1
Risk: low
Parallel: false
Depends on: 0001, 0003, 0008, 0009
Tags: archive,v0.1

## Goal

Improve the README with practical command examples once the initial CLI commands exist.

## Context files

- `AGENTS.md`
- `README.md`
- `docs/cli-commands.md`
- `docs/progress.md`
- `.tasks/0010-add-readme-examples.md`

## Files allowed to edit

- `README.md`
- `docs/progress.md`
- `.tasks/0010-add-readme-examples.md`

## Files forbidden to edit

- any source file
- future task files

## Steps

1. Review the implemented command surface.
2. Update README examples.
3. Make the quickstart clearer.
4. Update progress.

## Acceptance criteria

- README examples match the implemented CLI.
- The document stays concise and accurate.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Do not invent commands that are not implemented.
- Verification passed:
  - `pnpm test`
