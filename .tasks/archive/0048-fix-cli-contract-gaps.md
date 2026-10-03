# Task 0048 - Fix CLI Contract Gaps

State: done
Owner: codex-plan-47
Mode: product
Lane: bugfix
Scope: cli,core,docs,tests
Risk: high
Parallel: false
Depends on: 0047
Tags: cli,bugfix,contracts,validation,task-create

## Goal

Fix small but real CLI/core contract gaps found in repository analysis before adding larger workflow commands.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- README.md
- src/cli/index.ts
- src/cli/commands/init.ts
- src/cli/commands/agent.ts
- src/cli/commands/task.ts
- src/cli/commands/export.ts
- src/cli/commands/analytics.ts
- src/cli/commands/tasks.ts
- src/core/tasks/index.ts
- src/core/exporters/index.ts
- src/core/config/defaults.ts
- src/core/analytics/index.ts
- src/cli/cli.test.ts
- src/core/tasks/task.test.ts
- src/core/analytics/analytics.test.ts

## Files allowed to edit

- .tasks/0048-fix-cli-contract-gaps.md
- README.md
- docs/cli-commands.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/init.ts
- src/cli/commands/agent.ts
- src/cli/commands/task.ts
- src/cli/commands/export.ts
- src/cli/commands/analytics.ts
- src/cli/commands/tasks.ts
- src/core/tasks/index.ts
- src/core/exporters/index.ts
- src/core/config/defaults.ts
- src/core/analytics/index.ts
- src/cli/cli.test.ts
- src/core/tasks/task.test.ts
- src/core/analytics/analytics.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans

## Steps

1. Make `apk task create --goal <text>` either fully supported or fully removed; preferred fix is to add `--goal` to known flags, help, docs, and tests because the code already reads it.
2. Wrap `apk init` command execution in consistent try/catch behavior so invalid filesystem states exit 1 with a concise CLI error, not an uncaught stack trace.
3. Change `writeAgentExportFiles` default behavior to skip existing files unless `force` is explicitly true, matching CLI behavior.
4. Add tests for direct core exporter calls without options so overwrite defaults cannot regress.
5. Decide and implement missing-config CLI warning behavior for read commands such as `tasks`, `claim`, `context`, `prompt`, and `analytics`; keep `init` and `adopt` quiet where defaults are expected.
6. Make analytics task metadata include archived tasks so old done tasks do not lose mode/lane/risk grouping after archive.
7. Harden shared flag parsing so a value flag cannot silently consume another flag as its value, e.g. `--id --platform`.
8. Fix `apk task create` id allocation under concurrent/sequential near-simultaneous calls; task creation must not create duplicate task ids.
9. Add regression tests for duplicate-id prevention or atomic task-create locking.
10. Update CLI docs/help for any changed options and error messages.

## Acceptance criteria

- `apk task create --goal "Detailed goal" ...` creates a task whose Goal section uses the supplied goal.
- `apk task create --help` documents `--goal`.
- `apk init <bad-path>` exits 1 with a concise error and no Node stack trace.
- Calling `writeAgentExportFiles(directory)` without options does not overwrite existing generated files.
- Read commands either warn consistently when `.agentic/config.json` is missing or tests document why a command is exempt.
- `apk analytics summary` includes archived task metadata when calculating mode/lane/risk summaries.
- Missing flag values such as `apk agent register --id --platform codex --model gpt` fail with a clear "missing value" style error.
- Two task-create attempts cannot leave duplicate task ids in `.tasks`.
- No new dependencies are added.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js task create --help
- node dist/cli/index.js init --help
- node dist/cli/index.js analytics summary --help
- node dist/cli/index.js audit

## Documentation updates

- Update docs/cli-commands.md for `task create --goal`, error behavior, and analytics archived-task behavior.
- Update README command examples if `--goal` becomes public.
- Update docs/task-system.md if task-create locking or id allocation rules are documented.
- Update docs/progress.md when task state changes.

## Notes

- Analysis found `runCreateSubcommand` reads `--goal`, but `knownFlags` and help omit it.
- Analysis found `runInitCommand` is less defensive than commands such as `adopt`.
- Analysis found core exporter default overwrite behavior is riskier than CLI default skip behavior.
- Analysis found analytics currently builds its task metadata map from active task files only.
- While creating this backlog, parallel `apk task create` calls produced duplicate ids. Treat this as a real task-system contract gap.
