# Progress

## Current status

Phase 1 documentation is in place, Tasks 0001 through 0022 are complete, and the compact agent workflow upgrade is ready.

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
- prompt command tests wired into `pnpm test`.
- README and CLI docs updated for the implemented v0.1 command surface.
- post-readiness fixes for init/adopt workflow validity, config-aware task lookup, command-specific help, safe exports, and package bin/build support.
- compact task metadata with `State`, `Owner`, `Lane`, `Scope`, `Parallel`, and `Tags`.
- registered agent workflow backed by `.agentic/agents.jsonl`.
- compact run analytics backed by `.agentic/runs.jsonl`.
- task state commands for claim, release, block, review, done, and cancel.
- discovery planning docs for requirements, load profile, tech options, and risk register.
- all task files converted to the compact format.

## Next step

Use the discovery planning docs and compact task workflow in target repositories.

## Remaining v0.1 task plan

None.

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
- Issue fixes verification passed: adopt creates task-system/context-system/decisions.md, init creates discovery docs, platform validation rejects unsupported platforms, architecture.md marks audit as planned, tech-stack.md matches package.json.
