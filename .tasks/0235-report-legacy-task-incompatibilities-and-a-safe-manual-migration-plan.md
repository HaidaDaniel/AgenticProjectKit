# Task 0235 - Report legacy task incompatibilities and a safe manual migration plan

State: doing
Owner: codex-fixes-0235
Mode: maintenance
Lane: diagnostics
Type: feature
Scope: compatibility,tasks,adoption,lint
Risk: medium
Parallel: false
Depends on: 0227,0234
Tags: p2,compatibility,diagnostics

## Goal

Extend existing read-only compatibility and lint reporting to enumerate task-contract incompatibilities and provide a safe manual migration plan without rewriting historical tasks or duplicating the status fix owned by Task 0227.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- src/core/config/compatibility.ts
- src/core/audit/lint.ts
- src/core/docs/adopt.ts
- src/cli/commands/adopt.ts
- src/core/status/index.ts
- src/core/config/schema.test.ts
- src/core/audit/lint.test.ts
- src/core/docs/adopt.test.ts
- .tasks/0227-prioritize-actionable-task-states-in-status-and-attention.md

## Files allowed to edit

- src/core/config/compatibility.ts
- src/core/config/schema.test.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/cli/commands/adopt.ts
- src/cli/command.test.ts
- docs/adoption-flow.md
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**
- package.json
- src/core/tasks/**
- src/core/status/**
- src/core/config/schema.ts

## Steps

1. Reproduce mixed valid and invalid task inventories including State in_progress; State planned; Mode validation; Mode experiment/implementation; Mode bugfix; noncanonical headings and section names.
2. Trace and reuse existing lint task-malformed reporting and parser diagnostics. Existing detectCompatibility counts Verification heading families only; extend compatibility with actual parseability facts without silently changing the meaning of legacy supported Verification commands.
3. Report deterministic per-file incompatibilities across active and archived contracts with paths; raw IDs when available; all parser issues within explicit bounds and coverage metadata for omitted or unreadable entries.
4. Expose findings and remediation through adoption preview and existing lint output. Preserve public fields where compatible and distinguish schema-marker migration from task-contract repair; neither legacy nor gated headings prove parseability.
5. Provide a manual migration sequence: preserve original bytes and Git history; classify each file; obtain explicit owner/state/mode decisions; prepare scoped changes; rerun lint; and independently revalidate affected provenance. Do not guess that in_progress means doing or that bugfix is a project Mode.
6. After prerequisite 0227 verify that malformed task input no longer hides healthy status/attention tasks or presents unknown counts as a healthy empty backlog. If that prerequisite remains incomplete report the blocker and fix it in its owning task rather than editing status here.
7. Add tests for multiple malformed files; archives; unreadable inputs; report bounds; legacy supported contracts and read-only/idempotent preview.

## Acceptance criteria

- A report enumerates every inspected incompatible contract and its parser issues; one bad file does not stop subsequent inspection.
- Valid legacy Verification commands contracts remain supported and are not described as invalid merely because they predate structured verification.
- Compatibility reporting distinguishes parseable; incompatible; unreadable and not-inspected cases; finite bounds are disclosed instead of claiming complete coverage.
- Adoption preview supplies a usable manual migration plan and never suggests that changing schemaVersion repairs invalid task content.
- Task files; archive bytes; State; Owner; evidence and baselines remain unchanged by all report paths; adoption apply does not auto-rewrite tasks.
- Task 0227 owns status/attention resilience; this task consumes its validated behavior and introduces no second parser or new lifecycle alias mapping.

## Correctness assumptions

- Search Forge contracts are demonstrably incompatible with the audited current parser; this does not establish a regression in a separately installed version.
- Some unfamiliar contracts require a human semantic decision and cannot be safely repaired by a text replacement.

## Invariants

- No automatic migration; lifecycle normalization; parser loosening; evidence trust change or history rewrite.
- Reuse parser validation and current lint findings instead of maintaining incompatible parallel acceptance rules.
- Diagnostics never promote malformed tasks to a valid or completed state.

## Required evidence

- Read-only reports for a mixed inventory containing at least two malformed active files and one malformed archived file.
- Before/after byte and index snapshots; bounded-report completeness assertions; valid-legacy regression outputs.

## Review questions

- Does the report expose all inspected issues rather than only the first parse exception?
- Can heading-family classification conceal an invalid State or unsupported section?
- Is the migration plan explicit about semantic decisions and candidate-bound evidence invalidation?

## Counterexample searches

- Mixed structured and legacy verification; invalid State plus invalid Mode; missing Owner; duplicate IDs; unsupported headings.
- Unreadable file; malformed archive entry; too many files; oversized task; non-UTF8 data; custom taskDirectory.
- Existing report fields consumed by adoption callers; repeat preview; marker-only adoption apply.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/config/schema.test.ts src/core/audit/lint.test.ts src/core/docs/adopt.test.ts src/cli/command.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document read-only compatibility coverage and the manual migration sequence in docs/adoption-flow.md and docs/task-system.md.
- Update docs/progress.md when task state changes.

## Notes

- Planning requested by the operator after the read-only downstream audit on 2026-10-20 at APK commit 5891ca51e9b9b7848a4d3237517b1d1ca6052ba0. This contract authorizes only its own future scope; no implementation is claimed.
- Use synthetic disposable repositories. Do not modify downstream repositories or infer consent for their migration.
- Parallel is false. Shared source files and docs/progress.md require sequential work in this checkout; separate worktrees and explicit integration are required for concurrent mutable work. Do not claim while another doing or review task owns this checkout.
- Commit the final candidate before canonical verification. Run the declared verification set once per unchanged candidate; do not prepend overlapping full-suite or release checks.
- Priority P2. The audit parsed Search Forge 0065; 0090 and 0090a and found incompatible metadata plus headings/sections. Existing lint already returns per-file task-malformed findings; this work extends rather than replaces it.
- The audit reproduced status exit 0 with all task counts zero after adding one malformed contract; tasks exited 1. Task 0227 already requires malformed-task resilience and remains the owner of that correction.
- Depends on 0234 to sequence adoption changes and on 0227 to avoid duplicating status work. CLI tests also overlap 0223 and 0230; sequence them or use isolated worktrees.
