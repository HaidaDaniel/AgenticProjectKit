# Task 0015 - v0.1 Readiness Pass

State: done
Owner: archive
Mode: mvp
Lane: archive
Scope: completed-v0.1
Risk: medium
Parallel: false
Depends on: 0011, 0012, 0013, 0014
Tags: archive,v0.1

## Goal

Verify the implemented product matches the v0.1 scope and update final user-facing docs.

## Context files

- `AGENTS.md`
- `README.md`
- `docs/scope.md`
- `docs/cli-commands.md`
- `docs/progress.md`
- `.tasks/0015-v01-readiness-pass.md`

## Files allowed to edit

- `README.md`
- `docs/cli-commands.md`
- `docs/progress.md`
- `.tasks/0015-v01-readiness-pass.md`

## Files forbidden to edit

- any source file
- future task files

## Steps

1. Compare implemented commands against `docs/scope.md` v0.1.
2. Update README examples for the final v0.1 command surface.
3. Update `docs/cli-commands.md` so implemented and planned commands are clearly separated.
4. Run full verification.
5. Update progress to mark v0.1 ready if verification passes.

## Acceptance criteria

- README documents only implemented v0.1 commands as usable.
- `docs/cli-commands.md` matches the implemented CLI.
- Progress states whether v0.1 is ready.
- Full verification passes.

## Verification commands

- `pnpm test`
- `pnpm lint`
- `pnpm exec tsx src/cli/index.ts --help`
- `pnpm exec tsx src/cli/index.ts init --help`
- `pnpm exec tsx src/cli/index.ts adopt --help`
- `pnpm exec tsx src/cli/index.ts mode --help`
- `pnpm exec tsx src/cli/index.ts next-task --help`
- `pnpm exec tsx src/cli/index.ts context --help`
- `pnpm exec tsx src/cli/index.ts prompt --help`
- `pnpm exec tsx src/cli/index.ts export --help`

## Documentation updates

- Update `README.md`.
- Update `docs/cli-commands.md`.
- Update `docs/progress.md`.

## Notes

- This task is documentation and verification only.
- Verification passed:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm exec tsx src/cli/index.ts --help`
  - `pnpm exec tsx src/cli/index.ts init --help`
  - `pnpm exec tsx src/cli/index.ts adopt --help`
  - `pnpm exec tsx src/cli/index.ts mode --help`
  - `pnpm exec tsx src/cli/index.ts next-task --help`
  - `pnpm exec tsx src/cli/index.ts context --help`
  - `pnpm exec tsx src/cli/index.ts prompt --help`
  - `pnpm exec tsx src/cli/index.ts export --help`
