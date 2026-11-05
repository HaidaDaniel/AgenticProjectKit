# Task 0247 - Add lightweight backlog storage and CLI

State: done
Owner: opencode-0244-0251
Mode: product
Lane: implementation
Type: feature
Scope: backlog,tasks,cli,storage
Risk: high
Parallel: false
Depends on: none
Tags: p2,backlog,tasks,cli,storage

## Goal

Add a separate lightweight backlog layer at <taskDirectory>/backlog/<stable-slug>.md for future ideas with an immutable opaque Backlog-Id, idea/deferred/promoted/discarded status, and stable promotion-criterion IDs; the layer is readable and editable as Markdown and is explicitly excluded from every executable task inventory and lifecycle operation.

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

1. Define one minimal Markdown card contract with an immutable opaque Backlog-Id, human-readable slug filename, title, status, motivation, why-not-now, promotion criteria, proposed outcome, and references; validate status to idea, deferred, promoted, or discarded.
2. Make Backlog-Id the card identity and keep it non-numeric and distinct from any task ID; a manual file or slug rename may change the filename but must not change Backlog-Id, and a missing, duplicate, malformed, or reused Backlog-Id is refused.
3. Give promotion criteria stable local IDs distinct from their display text so text edits do not silently reuse an ID for a different criterion.
4. Implement bounded read, parse, render, and write helpers under the configured task directory without a second task store or database; add apk backlog add/list/show/validate with --json where supported and register the command once.
5. Explicitly exclude backlog cards from tasks, next-task, status, attention, workers, audit, doctor, lint, adopt, archive, and dependency-graph behavior; prove that creating a card does not allocate a numeric task ID and does not trigger verification or evidence warnings.
6. Add deterministic tests for slug and Backlog-Id collisions, renamed cards, path traversal, symlinks, malformed, oversized, or truncated cards, manual Git edits, bounded reads, no overwrite, and no extra I/O on ordinary hot paths; document the storage contract and exclusivity.

## Acceptance criteria

- Backlog cards carry an immutable opaque Backlog-Id, a human-readable slug filename, and no numeric task ID field.
- Backlog-Id is the card identity and survives a manual file or slug rename; the slug may change without changing identity.
- Missing, duplicate, malformed, or reused Backlog-Ids are refused with a bounded diagnostic.
- Promotion criteria have stable local IDs distinct from their display text.
- Creating a backlog item does not consume a numeric task ID.
- Existing ProjectTask and TASK_STATES behavior is unchanged.
- listTaskFiles and inspectTaskContracts do not return backlog cards as executable tasks.
- apk tasks, apk next-task, status, attention, workers, audit, doctor, lint, adopt, archive, and the dependency graph do not treat backlog cards as executable tasks.
- Backlog items create no verification or evidence warnings.
- Backlog cards remain normal Git-tracked Markdown documents and are not ignored.
- Slug collisions are refused; a slug rename never changes Backlog-Id and never silently aliases a different card.
- The parser is bounded by input size and field count, reports malformed Markdown without throwing or treating it as a task, and never overwrites an existing card.
- Ordinary hot CLI paths, including tasks, next-task, status, attention, workers, lint, doctor, and audit, do not perform a full backlog scan and receive no material additional I/O.
- Independent backlog items can be created without full task ceremony.
- add, list, show, and validate work with bounded readable output and --json where supported.
- The card contract supports manual Markdown editing through Git.
- No service, daemon, cron task, API, LLM inference, or second task database is added.

## Correctness assumptions

- Backlog items are intentionally outside ProjectTask and TASK_STATES; the configured task directory may be customized; Backlog-Id is an opaque card identity rather than a numeric task ID; card slugs are human-readable repository-local filenames

## Invariants

- Exactly one backlog store exists under the configured task directory; backlog cards never enter executable task lifecycle selection; cards have no numeric task ID; Backlog-Id is immutable across renames; no automatic promotion or ID allocation; no symlink or path escape can overwrite foreign files; existing task behavior and hot-path I/O remain unchanged; backlog files stay Git-tracked

## Required evidence

- Focused tests for inventory exclusion and no ID consumption; CLI add list show validate output including JSON; slug and Backlog-Id collisions, renamed cards, missing or duplicate Backlog-Id; stable criterion IDs; symlink path traversal; ordinary-command I/O comparison; malformed, oversized, and truncated card diagnostics

## Review questions

- Can a backlog card be mistaken for an executable task anywhere in status, next-task, audit, doctor, lint, adopt, or workers; can a crafted slug escape the backlog directory or overwrite another card; can a renamed card lose or duplicate its identity; can a criterion text edit silently change its identity; does adding this command add noticeable I/O to unrelated commands; is the card schema minimal enough to edit by hand

## Counterexample searches

- Slug collides with an existing card; slug resembles a numeric task ID; Backlog-Id missing, malformed, duplicated, or reused after rename; renamed card keeps its Backlog-Id; a new card reuses an old slug with a different Backlog-Id; criterion text edited or reordered; symlink inside backlog directory; malformed status; oversized or truncated card; deferred card during ordinary status and next-task; custom taskDirectory; concurrent add; huge card

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document backlog storage and CLI in docs/task-system.md docs/cli-commands.md docs/architecture.md and docs/decisions.md; update docs/progress.md when task state changes

## Notes

- Backlog statuses are idea, deferred, promoted, and discarded only; blocked is not a backlog status; no automatic promotion is part of this task; use the existing task directory configuration rather than a new config key; package.json may only change the test:source file list for new tests.
- Backlog-Id is intentionally not a task ID and not a second task allocator; it exists only to keep card identity stable across renames and to support safe promotion idempotency in Task 0248. Promotion criteria IDs are local card identifiers, not task IDs.
- Active todo Task 0223 also edits src/cli/command-registry.ts src/cli/command.test.ts src/cli/cli.test.ts docs/cli-commands.md docs/decisions.md docs/progress.md and dist; this contract intentionally does not depend on that large opt-in CI feature but must be sequenced or integrated in an isolated worktree to avoid overlapping CLI registry edits
