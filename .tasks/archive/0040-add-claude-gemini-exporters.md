# Task 0040 - Add Claude And Gemini Exporters

State: done
Owner: codex-a
Mode: product
Lane: exporters
Scope: cli,exporters,docs,tests
Risk: medium
Parallel: false
Depends on: 0039
Tags: claude,gemini,exports,parity

## Goal

Add Claude Code and Gemini CLI instruction exports from the shared neutral agent policy.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/agent-exporters.md
- docs/cli-commands.md
- src/core/exporters/index.ts
- src/core/templates/renderer.test.ts
- src/cli/index.ts
- src/cli/commands/export.ts
- src/cli/commands/sync.ts

## Files allowed to edit

- .tasks/0040-add-claude-gemini-exporters.md
- CLAUDE.md
- GEMINI.md
- README.md
- docs/architecture.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/progress.md
- src/core/exporters/index.ts
- src/core/templates/exporters/claude.md.hbs
- src/core/templates/exporters/gemini.md.hbs
- src/core/templates/renderer.test.ts
- src/cli/index.ts
- src/cli/commands/export.ts
- src/cli/commands/sync.ts
- src/core/sync/sync.test.ts
- src/cli/cli.test.ts
- src/core/docs/prompt.test.ts
- src/core/agents/index.ts
- src/core/tasks/task.test.ts
- src/core/docs/adopt.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- application source outside exporter and CLI command surfaces

## Steps

1. Add Claude and Gemini exporter templates.
2. Add `claude` and `gemini` export targets.
3. Generate `CLAUDE.md` and `GEMINI.md`.
4. Update docs and command help.
5. Update exporter and sync tests.
6. Run verification.

## Acceptance criteria

- `apkit export claude` writes `CLAUDE.md`.
- `apkit export gemini` writes `GEMINI.md`.
- Full export and sync include Claude and Gemini.
- Generated files come from shared neutral policy.
- Docs list Claude and Gemini targets.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec tsx src/cli/index.ts sync
- pnpm exec tsx src/cli/index.ts audit

## Documentation updates

- Update README.md.
- Update docs/agent-exporters.md.
- Update docs/cli-commands.md.
- Update docs/architecture.md.
- Update docs/progress.md.

## Notes

- Claude Code should use `CLAUDE.md` with `@AGENTS.md` import.
- Gemini CLI should use `GEMINI.md` and keep parity with shared policy.
- Backprop: exporter-count assertions should derive from exporter registry so future exporter additions do not require unrelated test magic-number edits.
