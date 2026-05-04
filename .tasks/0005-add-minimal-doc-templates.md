# Task 0005 - Add Minimal Doc Templates

State: done
Owner: archive
Mode: mvp
Lane: archive
Scope: completed-v0.1
Risk: low
Parallel: false
Depends on: 0004
Tags: archive,v0.1

## Goal

Create the first minimal documentation templates for project generation.

## Context files

- `AGENTS.md`
- `docs/project.md`
- `docs/scope.md`
- `docs/engineering/template-system.md`
- `docs/progress.md`
- `.tasks/0005-add-minimal-doc-templates.md`

## Files allowed to edit

- `src/core/templates/**`
- `src/core/docs/**`
- `docs/progress.md`
- `.tasks/0005-add-minimal-doc-templates.md`

## Files forbidden to edit

- future task files

## Steps

1. Define minimal doc templates.
2. Wire template output into generation helpers.
3. Add tests or fixtures.
4. Update progress.

## Acceptance criteria

- Minimal docs can be generated from templates.
- Output matches the documentation-first design.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Prefer minimal useful content over exhaustive docs.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
