# Task 0001 - Initialize TypeScript CLI

Status: done
Mode: mvp
Risk: medium
Depends on: none

## Goal

Create the initial TypeScript CLI scaffold for Agentic Project Kit so the repository can run a minimal `apk` entrypoint locally.

## Context files

- `AGENTS.md`
- `docs/project.md`
- `docs/scope.md`
- `docs/architecture.md`
- `docs/engineering/tech-stack.md`
- `docs/engineering/package-structure.md`
- `docs/task-system.md`
- `docs/context-system.md`
- `docs/decisions.md`
- `docs/progress.md`

## Files allowed to edit

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `src/**`
- `README.md`
- `docs/progress.md`
- `docs/decisions.md`
- `.tasks/0001-initialize-typescript-cli.md`

## Files forbidden to edit

- `docs/project.md`
- `docs/scope.md`
- `docs/architecture.md`
- `docs/modes.md`
- `docs/cli-commands.md`
- `docs/task-system.md`
- `docs/context-system.md`
- `docs/agent-exporters.md`
- `.tasks/0002-add-config-schema.md`
- any other task file

## Steps

1. Create the package manifest and TypeScript config.
2. Add a minimal `src` tree with a CLI entrypoint.
3. Add development scripts for running the CLI with `tsx`.
4. Provide a basic help or placeholder command output.
5. Ensure the project can run locally without implementing future commands.
6. Update the progress doc.

## Acceptance criteria

- The repository has a valid TypeScript CLI scaffold.
- The CLI starts and prints a minimal help or placeholder output.
- The project uses pnpm-friendly scripts.
- No future commands are implemented yet.
- `docs/progress.md` reflects that Task 0001 is complete.

## Verification commands

- `pnpm -v`
- `pnpm install`
- `pnpm lint`
- `pnpm test`
- `pnpm exec tsx src/cli/index.ts --help`

## Documentation updates

- Update `docs/progress.md`.
- Add any dependency decision to `docs/decisions.md` if packages are introduced.

## Notes

- Keep the implementation intentionally small.
- Do not start Task 0002 in this change.
- Verification passed:
  - `pnpm -v`
  - `pnpm install`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm exec tsx src/cli/index.ts --help`
