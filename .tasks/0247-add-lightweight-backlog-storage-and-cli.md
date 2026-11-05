# Task 0247 - Add lightweight backlog storage and CLI

State: todo
Owner: none
Mode: product
Lane: implementation
Type: feature
Scope: backlog,tasks,cli,storage
Risk: high
Parallel: false
Depends on: none
Tags: p2,backlog,tasks,cli,storage

## Goal

Add a separate lightweight backlog layer at <taskDirectory>/backlog/<stable-slug>.md for future ideas with idea deferred promoted and discarded status that is readable and editable as Markdown and is explicitly excluded from every executable task inventory and lifecycle operation.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/cli/commands/tasks.ts
- src/cli/commands/next-task.ts
- src/cli/command-registry.ts
- src/cli/command.test.ts
- src/cli/cli.test.ts
- src/core/status/index.ts
- src/core/audit/lint.ts
- src/core/docs/adopt.ts
- src/core/doctor/index.ts
- src/core/init/index.ts
- scripts/check-docs-consistency.mjs

## Files allowed to edit

- src/core/backlog/**
- src/cli/commands/backlog.ts
- src/cli/command-registry.ts
- src/cli/command.test.ts
- src/cli/cli.test.ts
- package.json
- docs/cli-commands.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/core/config/**

## Steps

1. Define one minimal Markdown card contract with stable unique slug title status motivation why-not-now promotion criteria proposed outcome and references and validate status to idea deferred promoted or discarded; implement bounded read parse render and write helpers under the configured task directory without a second task store or database; add apk backlog add-list-show-validate with --json where the existing CLI contract supports it and register the command once; explicitly exclude backlog cards from tasks next-task status attention workers audit doctor lint adopt archive and dependency graph behavior and prove that creating a card does not allocate a numeric task ID; ensure backlog cards require no owner review gate verification or evidence and produce no missing-evidence warnings; add deterministic tests for slug collisions path traversal and symlinks malformed cards manual Git edits bounded reads no overwrite and no extra I/O on ordinary commands; document the storage contract and exclusivity

## Acceptance criteria

- Backlog cards carry a stable slug and no numeric task ID field.
- Creating a backlog item does not consume a numeric task ID.
- Existing ProjectTask and TASK_STATES behavior is unchanged.
- listTaskFiles and inspectTaskContracts do not return backlog cards as executable tasks.
- apk tasks, apk next-task, status, attention, workers, audit, doctor, lint, adopt, archive, and the dependency graph do not treat backlog cards as executable tasks.
- Backlog items create no verification or evidence warnings.
- Backlog cards remain normal Git-tracked Markdown documents and are not ignored.
- Slug identity is stable; collisions are refused; a manual file rename is an explicit identity change and never silently aliases the old slug.
- The parser is bounded by input size and field count, reports malformed Markdown without throwing or treating it as a task, and never overwrites an existing card.
- Ordinary hot CLI paths, including tasks, next-task, status, attention, workers, lint, doctor, and audit, do not perform a full backlog scan and receive no material additional I/O.
- Independent backlog items can be created without full task ceremony.
- add, list, show, and validate work with bounded readable output and --json where supported.
- The card contract supports manual Markdown editing through Git.
- No service, daemon, cron task, API, LLM inference, or second task database is added.

## Correctness assumptions

- Backlog items are intentionally outside ProjectTask and TASK_STATES; the configured task directory may be customized; card slugs are human-readable repository-local identifiers rather than numeric task IDs

## Invariants

- Exactly one backlog store exists under the configured task directory; backlog cards never enter executable task lifecycle selection; cards have no numeric task ID; no automatic promotion or ID allocation; no symlink or path escape can overwrite foreign files; existing task behavior and hot-path I/O remain unchanged; backlog files stay Git-tracked

## Required evidence

- Focused tests for inventory exclusion and no ID consumption; CLI add list show validate output including JSON; symlink path traversal and collision refusal; ordinary-command I/O comparison; malformed-card diagnostics

## Review questions

- Can a backlog card be mistaken for an executable task anywhere in status next-task audit doctor lint adopt or workers; can a crafted slug escape the backlog directory or overwrite another card; does adding this command add noticeable I/O to unrelated commands; is the card schema minimal enough to edit by hand

## Counterexample searches

- Slug collides with an existing card; slug resembles a numeric task ID; symlink inside backlog directory; malformed status; oversized or truncated card; card manually renamed in Git; deferred card during ordinary status and next-task; custom taskDirectory; concurrent add; huge card

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality","evidenceRef":"docs/task-system.md"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document backlog storage and CLI in docs/task-system.md docs/cli-commands.md docs/architecture.md and docs/decisions.md; update docs/progress.md when task state changes

## Notes

- Backlog statuses are idea deferred promoted and discarded only and blocked is not a backlog status; no automatic promotion is part of this task; use the existing task directory configuration rather than a new config key; package.json may only change the test:source file list for new tests
- Active todo Task 0223 also edits src/cli/command-registry.ts src/cli/command.test.ts src/cli/cli.test.ts docs/cli-commands.md docs/decisions.md docs/progress.md and dist; this contract intentionally does not depend on that large opt-in CI feature but must be sequenced or integrated in an isolated worktree to avoid overlapping CLI registry edits
