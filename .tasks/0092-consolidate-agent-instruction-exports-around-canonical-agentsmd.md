# Task 0092 - Consolidate Agent Instruction Exports Around Canonical AGENTS.md

State: done
Owner: local-agent-0092
Mode: maintenance
Lane: exporters
Scope: exporters adoption sync audit cli docs tests
Risk: high
Parallel: false
Depends on: 0029,0040,0066,0074,0081
Tags: exporters,agent-instructions,canonical,adoption,migration,sync,compatibility

## Goal

Make AGENTS.md the only full common-policy export and reduce harness files to direct consumption or minimal native adapters with safe legacy migration.

## Context files

- AGENTS.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- docs/roadmap.md
- docs/agent-exporters.md
- docs/adoption-flow.md
- docs/cli-commands.md
- src/core/exporters/index.ts
- src/core/templates/exporters/**
- src/core/templates/renderer.test.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/scanners/index.ts
- src/core/audit/index.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/audit/audit.test.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/cli/commands/export.ts
- src/cli/commands/sync.ts
- src/cli/commands/adopt.ts
- src/cli/commands/lint.ts
- src/cli/commands/audit.ts
- src/cli/cli.test.ts
- .tasks/0029-implement-sync-command.md
- .tasks/0040-add-claude-gemini-exporters.md
- .tasks/0066-add-built-in-repository-and-task-contract-linting.md
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md
- .tasks/0081-allow-automatic-independent-review-orchestration.md
- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md

## Files allowed to edit

- src/core/exporters/index.ts
- src/core/templates/exporters/**
- src/core/templates/renderer.test.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/scanners/index.ts
- src/core/audit/index.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/audit/audit.test.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/cli/commands/export.ts
- src/cli/commands/sync.ts
- src/cli/commands/adopt.ts
- src/cli/commands/lint.ts
- src/cli/commands/audit.ts
- src/cli/cli.test.ts
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .codex/instructions.md
- .opencode/AGENTS.md
- .cursor/rules/**
- docs/agent-exporters.md
- docs/architecture.md
- docs/task-system.md
- docs/adoption-flow.md
- docs/cli-commands.md
- docs/decisions.md
- docs/progress.md
- docs/roadmap.md
- docs/delivery/milestones.md
- README.md
- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- src/core/tasks/**
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/config/**
- scripts/**
- .github/**
- .agentic/config.json
- .tasks/archive/**

## Steps

1. Inventory the current exporter registry, init/adopt/export/sync/scanner/audit/lint behavior and generated fixtures; verify the currently supported direct `AGENTS.md` behavior and native Claude/Gemini reference syntax from project documentation and, where the external contract may have changed, current official harness documentation.
2. Refactor the exporter registry and templates around one canonical full `AGENTS.md` rendering. Remove redundant Codex/OpenCode common-policy exporters when direct `AGENTS.md` consumption is supported; make Claude/Gemini files minimal native adapters; retain a Cursor rule only when its metadata, glob scope, selective attachment or other Cursor-specific behavior is real and testable.
3. Update init/adopt/export/sync/scanner/audit/lint and prompt/CLI projections to use the reduced canonical set consistently. Keep generated-file ordering, target selection, missing/stale reporting and line-ending normalization deterministic.
4. Add an explicit legacy-export migration/reporting path. Recognize obsolete generated files only with a safe deterministic signature, distinguish them from customized/user-authored files, preview/report proposed cleanup, preserve files by default, and require an explicit safe action for any deletion. Do not use filesystem symlinks.
5. Add renderer, exporter, sync, adoption, scanner/audit/lint and CLI regressions for canonical content, thin adapters, removed exporters, legacy layouts, customized files, no-write preview and deterministic output.
6. Update exporter, architecture, adoption, CLI, task-workflow and decision documentation, plus required roadmap/milestone/progress references, to state the internal source, canonical rendered export and minimal adapter boundary.
7. Run the verification commands and inspect the final diff for forbidden files, generated drift and accidental deletion of user-authored content.

## Acceptance criteria



## Correctness assumptions

- Current supported harness behavior for root/nested `AGENTS.md` and native imports can be established before changing generated paths.
- A legacy generated file can be classified from a deterministic known rendering/signature; filename alone is insufficient evidence that a file is safe to delete.
- Existing repositories may contain customized instructions, mixed exporter generations, missing canonical files and platform-specific line endings.

## Invariants

- Every full common-policy rendering has exactly one canonical generated destination: `AGENTS.md`.
- Exporter registry, target selection, scanner inventory, sync drift checks and adoption reports share the same canonical export definitions.
- Default init/adopt/export/sync flows never overwrite or delete customized/user-authored instruction files.
- Rendered content and output ordering are deterministic and contain no symlink requirement.

## Required evidence

- Renderer/exporter tests showing canonical full-policy and thin-adapter content.
- Sync/lint/audit output showing the reduced generated set with no canonical drift.
- Adoption preview/apply regression output showing legacy classification, no-write preview and custom-file preservation.

## Review questions

- Does every supported harness either consume `AGENTS.md` directly, import it natively, or have a justified Cursor-specific rule?
- Can the migration path prove that an obsolete file is generated before offering cleanup, and does it preserve customized content?
- Do init, adopt, export, sync, scanner, audit, lint, prompt and CLI target lists derive from one coherent registry without stale path assumptions?
- Are the adapters truly bounded, deterministic and portable on Windows, Linux and macOS?

## Counterexample searches

- Legacy Codex/OpenCode files with exact old generated content versus one-character custom edits.
- Custom `CLAUDE.md`, `GEMINI.md`, Cursor rules or `AGENTS.md` alongside obsolete generated files.
- Partial/mixed layouts with missing `AGENTS.md`, stale adapters, extra old exporters and repeated preview/apply runs.
- CRLF and LF repositories, nested repositories and paths containing spaces.

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm exec apk lint","evidence":"machine-readable task-lint output"}`
- `{"id":"generated-sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk sync","evidence":"generated-sync output"}`

## Documentation updates

- Update `docs/agent-exporters.md`, `docs/architecture.md`, `docs/task-system.md`, `docs/adoption-flow.md`, `docs/cli-commands.md`, `README.md` and `docs/decisions.md` for the canonical export and safe legacy migration behavior.
- Update `docs/roadmap.md`, `docs/delivery/milestones.md` and `docs/progress.md` when the backlog/milestone reference is added or the task changes state.

## Notes

- Priority: high-value maintenance simplification; reduce generated-file count and drift surface without blocking unrelated release/resource-aware work.
- Direct dependencies are completed exporter, sync, contract-lint, adoption-compatibility and generated-policy foundations (`0029`, `0040`, `0066`, `0074`, `0081`). No dependency on active `0079` is required because this task does not alter the release workflow and its overlap is not a serialization constraint.
- Before implementation, confirm the exact currently supported harness contracts. If direct support or native import syntax has changed, record the bounded compatibility decision in `docs/decisions.md` and adjust only the necessary adapter/migration behavior.
- Legacy cleanup must be conservative: absence from the new registry is not permission to delete an existing file. Prefer report/preview and explicit opt-in cleanup; preserve unknown or customized files.
- No implementation is performed by this planning task; the initial state remains `todo` with `Owner: none`.
