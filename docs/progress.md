# Progress

## Current status

Phase 1 documentation is in place, and Tasks 0001 through 0046 are complete.

The repository now has:

- project definition docs;
- scope and roadmap docs;
- architecture and mode docs;
- task system and context system docs;
- exporter and adoption docs;
- agent instruction files;
- initial task files.
- `caveman` documented as the default agent style.
- a minimal TypeScript CLI scaffold.
- an initial config schema with validation and defaults.
- config schema tests wired into `pnpm test`.
- an `apk init` command that creates starter kit files without overwriting existing files.
- init command tests wired into `pnpm test`.
- a Handlebars-based template renderer with file loading and strict data checks.
- template renderer tests wired into `pnpm test`.
- minimal project, scope, and architecture doc templates.
- minimal doc generation helpers covered by tests.
- neutral agent exporter templates for AGENTS, Codex, OpenCode, and Cursor.
- generated agent instruction files covered by drift tests.
- task file parsing and generation helpers.
- task format validation tests wired into `pnpm test`.
- an `apk context` command with deterministic Level 1, Level 2, and Level 3 file selection.
- context selection tests wired into `pnpm test`.
- an `apk adopt` command that scans existing repositories and creates missing kit docs without rewriting app code.
- adoption scanner and safe-write tests wired into `pnpm test`.
- README examples for the implemented CLI command surface.
- an `apk mode` command that reads and updates `.agentic/config.json`.
- mode command tests wired into `pnpm test`.
- an `apk next-task` command that selects the lowest-numbered todo task.
- next-task selection tests wired into `pnpm test`.
- an `apk export` command that writes all or selected generated agent instruction files.
- export command tests wired into `pnpm test`.
- an `apk prompt` command that generates concise agent prompts from task metadata and selected context.
- an `apk task create` command that generates validated task files with auto-selected IDs and dependency graph checks.
- task create command tests for success, invalid metadata, missing dependencies, duplicate slugs, and generated filenames.
- prompt command tests wired into `pnpm test`.
- README and CLI docs updated for the implemented v0.1 command surface.
- post-readiness fixes for init/adopt workflow validity, config-aware task lookup, command-specific help, safe exports, and package bin/build support.
- compact task metadata with `State`, `Owner`, `Lane`, `Scope`, `Parallel`, and `Tags`.
- registered agent workflow backed by `.agentic/agents/<agent-id>.json`.
- compact run analytics backed by `.agentic/runs/YYYY-MM-DD_<developer-id>_<agent-id>.jsonl`.
- task state commands for claim, release, block, review, done, and cancel.
- discovery planning docs for requirements, load profile, tech options, and risk register.
- all task files converted to the compact format.
- task 0023 owner metadata fixed so task listing is valid.
- enriched repository scanning for kit docs, generated agent exports, config, and task files.
- an `apk audit` command that writes `docs/audit-report.md` and `docs/project-map.md`.
- audit validation for config and task file errors.
- an `apk sync` command with check-only default behavior and `--write` updates for generated instruction files.
- v0.2 and v0.3 task backlog files 0024 through 0033.
- v0.2 and v0.3 docs now exclude UI, SaaS, cloud sync, database, auth, and issue tracker sync.
- metadata-aware context selection for product, engineering, delivery, audit, adopt, sync, and testing docs.
- mode-aware prompt guidance.
- richer adoption reports with pre-adoption doc and export gap summaries.
- CLI smoke tests for help, audit, and sync.
- team analytics dataset sharded for low-conflict commits.
- `apk agent migrate-logs` for legacy log conversion.
- `apk analytics summary` for developer, agent, platform, and model comparison.
- CLI smoke tests for log migration and analytics summaries.
- public repository readiness cleanup: MIT license, package metadata, committed config, non-conflicting `apkit` bin alias, and ignored sharded telemetry.
- Claude Code and Gemini CLI exporters backed by the shared neutral policy.
- an `apk task archive` command that moves done tasks to `.tasks/archive/`.
- archive support for dependency resolution, next-task selection, and task deps inspection.
- archived task exclusion from default `apk tasks` output and context system.
- tests for single archive, archive all, non-done refusal, dependency resolution with archived tasks, and CLI smoke tests.
- regression fixes for task workflow review findings: unknown-flag rejection in archive, archive-all positional-arg rejection, archive-collision refusal, archived-task visibility in tasks --all, archived-task audit dependency validation, archived-task deps inspection, --scope/--allowed enforcement in task create, and CLI error handling without stack traces.

## Next step

No actionable todo task is currently identified.

## Remaining task plan

- Tasks 0001 through 0046 are complete.

## Notes

- `apk init` verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-directory smoke test.
- Template renderer verification passed with `pnpm test` and `pnpm lint`.
- Minimal doc template verification passed with `pnpm test` and `pnpm lint`.
- Agent exporter verification passed with `pnpm test` and `pnpm lint`.
- Task system verification passed with `pnpm test` and `pnpm lint`.
- Context command verification passed with `pnpm test`, `pnpm lint`, and Level 2/3 CLI smoke tests.
- Adopt command verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-repository smoke test.
- README examples verification passed with `pnpm test`.
- Mode command verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-directory read/write smoke test.
- Next-task command verification passed with `pnpm test`, `pnpm lint`, CLI help, and live command smoke test.
- Export command verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-directory single-target smoke test.
- Prompt command verification passed with `pnpm test`, `pnpm lint`, and `pnpm exec tsx src/cli/index.ts prompt codex --task 0014 --level 2`.
- v0.1 readiness verification passed with `pnpm test`, `pnpm lint`, and help checks for `init`, `adopt`, `mode`, `next-task`, `context`, `prompt`, and `export`.
- Post-readiness fix verification passed with `pnpm test`, `pnpm lint`, `pnpm build`, and fresh-repository smoke tests for `init`, `adopt`, `next-task`, `context`, `prompt`, and safe `export`.
- Compact agent workflow verification passed with task parsing, transition, registry, run log, lock, and compact prompt tests.
- Issue fixes verification passed: adopt creates task-system/context-system/decisions.md, init creates discovery docs, platform validation rejects unsupported platforms, and tech-stack.md matches package.json.
- Audit and sync implementation verification passed with `pnpm test` and `pnpm lint`.
- Final v0.2/v0.3 backlog verification passed with `pnpm test`, `pnpm lint`, and `pnpm build`.
- Team analytics verification passed with `pnpm test` and `pnpm lint`.
- Public readiness cleanup verification passed with clean `apk audit`, `pnpm lint`, `pnpm test`, `pnpm build`, and package dry-run checks.
- Claude/Gemini exporter verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `apk sync`, and `apk audit`.
- Task dependency inspection command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, and `apk task deps 0043` smoke test.
- Task create command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, and `apk task create --help` smoke test.
- Task archive command verification passed with `pnpm lint`, `pnpm test`, `pnpm exec tsx src/cli/index.ts task archive --help`, and `pnpm exec tsx src/cli/index.ts audit`.
- Task workflow review fixes verification passed with `pnpm lint`, `pnpm test`, `pnpm exec tsx src/cli/index.ts audit`, `pnpm exec tsx src/cli/index.ts tasks --all`, `pnpm exec tsx src/cli/index.ts task archive --help`, `pnpm exec tsx src/cli/index.ts task deps 0045`, and `pnpm exec tsx src/cli/index.ts task create --help`.
