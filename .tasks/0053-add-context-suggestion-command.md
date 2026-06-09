# Task 0053 - Add Context Suggestion Command

State: done
Owner: codex-plan-47
Mode: product
Lane: context
Scope: cli,context,scanner,tasks,docs,tests
Risk: medium
Parallel: false
Depends on: 0052
Tags: context,suggestions,scanner,dx

## Goal

Add a deterministic `apk suggest-context` command that proposes candidate context and allowed files for a task description without using an LLM.

## Context files

- AGENTS.md
- docs/context-system.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- src/cli/index.ts
- src/cli/commands/context.ts
- src/cli/commands/task.ts
- src/core/scanners/index.ts
- src/core/tasks/index.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0053-add-context-suggestion-command.md
- README.md
- docs/context-system.md
- docs/cli-commands.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/suggest-context.ts
- src/core/context-suggestions/index.ts
- src/core/context-suggestions/context-suggestions.test.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans

## Steps

1. Add `apk suggest-context "<task description>"` help and routing.
2. Scan project files within bounded directories such as `src`, `test`, `tests`, `docs`, config files, and package files.
3. Tokenize the description and match against filenames, directory names, and simple keyword groups.
4. Include domain keywords such as auth, user, middleware, api, route, schema, config, test, docs, cli, audit, task, sync, prompt, export.
5. Rank candidates deterministically by score, then path.
6. Print suggested `Context files` and `Files allowed to edit` sections suitable for pasting into a task.
7. Add `--limit <n>` and `--json` only if both are small and tested; otherwise keep the first version text-only.
8. Optionally add `apk task create --suggest-files --from "<description>"` only after standalone suggestion behavior is stable.
9. Add tests for keyword matching, stable ranking, ignored directories, and empty/no-match behavior.

## Acceptance criteria

- `apk suggest-context "Add auth middleware"` prints deterministic candidate files.
- Suggestions include likely tests when matching source files have nearby test files.
- Ignored directories such as `.git`, `node_modules`, `dist`, `build`, `.next`, `.turbo`, and `.cache` are not scanned.
- Command works without network access and without an LLM.
- Docs clearly describe suggestions as heuristics, not guaranteed code understanding.
- No web UI is introduced.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js suggest-context "Add task status command"
- node dist/cli/index.js suggest-context --help
- node dist/cli/index.js audit

## Documentation updates

- Update docs/context-system.md to describe suggested context as optional heuristic support.
- Update docs/cli-commands.md with `apk suggest-context`.
- Add README example for creating a task with suggested files.
- Update docs/progress.md when task state changes.

## Notes

- This task is the implementation path for making context level 3 smarter without overclaiming.
- Keep the first version simple, local, deterministic, and dependency-free.
