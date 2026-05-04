# Task 0004 - Add Template Renderer

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

Add the first reusable template rendering layer for docs and generated files.

## Context files

- `AGENTS.md`
- `docs/architecture.md`
- `docs/engineering/template-system.md`
- `docs/decisions.md`
- `docs/progress.md`
- `.tasks/0004-add-template-renderer.md`

## Files allowed to edit

- `src/core/templates/**`
- `src/core/docs/**`
- `src/utils/**`
- `package.json`
- `pnpm-lock.yaml`
- `docs/progress.md`
- `docs/decisions.md`
- `.tasks/0004-add-template-renderer.md`

## Files forbidden to edit

- future task files

## Steps

1. Add template loading and rendering.
2. Add a minimal template fixture.
3. Add tests for rendering behavior.
4. Update progress.

## Acceptance criteria

- Templates can be rendered from input data.
- Template behavior is covered by tests.

## Verification commands

- `pnpm test`

## Documentation updates

- Update `docs/progress.md`.

## Notes

- Keep template logic simple and predictable.
- Allowed files were expanded to include dependency and test script updates needed for renderer coverage.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
