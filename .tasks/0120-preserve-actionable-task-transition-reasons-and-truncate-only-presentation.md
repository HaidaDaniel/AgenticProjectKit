# Task 0120 - Preserve actionable task transition reasons and truncate only presentation

State: todo
Owner: none
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: task-state,run-log,status,blockers,presentation
Risk: medium
Parallel: true
Depends on: none
Tags: bugfix

## Goal

Current block/cancel/task-transition reasons are truncated at storage time to roughly 160 characters. Task Markdown currently receives logic equivalent to `reason -> normalize whitespace -> trim -> slice(0, 160)` in `src/core/tasks/workflow.ts`, and the runtime run-log reason is truncated the same way in `src/core/agents/index.ts`. An actionable blocker can therefore be permanently lost. A real downstream example ended as `APK review budget 2 exhausted and gate requires explicit human de`, and the full reason was no longer available in task Markdown. This is data loss, not merely UI truncation.

Separate the stored reason from the display summary. Canonical principle: storage may be bounded but actionable; presentation may be compact. Do not introduce unlimited strings. Choose an explicit bounded storage maximum of approximately 1-2 KiB during implementation. Whitespace may remain normalized to a single line if the current formats benefit from that. Status/table summaries may remain around 160 characters with an ellipsis or equivalent indication of truncation.

Preserve the full bounded reason in the authoritative records (task note/state record and run log) where appropriate; do not silently store only the UI summary. If evidence/provenance already provides a better canonical location for the full reason, use the smallest coherent design. Audit `apk block`, `apk cancel`, `apk release`, and any other transition accepting `--reason` for storage truncation, but do not expand scope to arbitrary CLI strings unrelated to lifecycle reasons.

## Context files

- docs/task-system.md
- docs/architecture.md
- src/core/tasks/workflow.ts
- src/core/agents/index.ts
- src/core/tasks/index.ts
- src/core/status/index.ts
- src/cli/commands/task-state.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/workflow.ts
- src/core/agents/index.ts
- src/core/tasks/index.ts
- src/core/status/index.ts
- src/cli/commands/task-state.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/work/**
- src/core/resources/**
- .github/workflows/**

## Steps

1. Locate every lifecycle persistence path that accepts `--reason` and identify each truncation site and its current limit.
2. Choose an explicit bounded storage maximum and a separate compact presentation limit.
3. Preserve the full bounded reason in the authoritative task record and run log while keeping deterministic single-line normalization.
4. Keep status/rendered summaries compact with a clear truncation indicator.
5. Confirm `block`, `cancel`, `release`, and other transition paths are consistent.
6. Add regression coverage for the cases in Acceptance criteria.
7. Update canonical docs and regenerate `dist/` through the normal build.
8. Run verification.

## Acceptance criteria

- A short reason is stored unchanged.
- A reason longer than 160 characters but below the full storage limit survives authoritative storage.
- The status/rendered compact view remains bounded and indicates truncation.
- A reason beyond the chosen storage limit has deterministic bounded behavior.
- A multiline reason is normalized deterministically.
- A UTF-8 reason is preserved without broken characters or invalid serialization.
- Task-note and run-log semantics remain compatible with existing parsers.
- No authoritative persistence path still truncates to the UI limit.
- Existing task parser compatibility is preserved.

## Correctness assumptions

- Current task Markdown note and run-log reason fields are single-line normalized values.
- Displaying a bounded summary does not require the authoritative record to be shortened.
- Existing readers tolerate a longer bounded reason in task notes and run logs.

## Invariants

- The authoritative stored reason is bounded by an explicit maximum, never unlimited.
- Presentation truncation never substitutes for authoritative storage.
- Reason normalization is deterministic and does not corrupt UTF-8.
- Existing task parser round-trip compatibility is preserved.
- No external storage, database, or unstructured task-note blob is introduced.

## Required evidence

- Regression test output proving full bounded reasons survive authoritative storage, compact views stay bounded, and long/multiline/UTF-8 inputs behave deterministically.

## Review questions

- Can any authoritative persistence path still truncate to the UI limit?
- Does the compact status view clearly indicate truncation?
- Is storage still bounded against accidental huge input?
- Does the change preserve existing task parser compatibility?

## Counterexample searches

- Reason with exactly 160 characters and 161 characters.
- Reason at and beyond the chosen storage maximum.
- Multiline reason with trailing and repeated whitespace.
- Multibyte UTF-8 reason near byte/character boundaries.
- `block`, `cancel`, and `release` transition reasons.
- Existing task files with legacy short reasons read back unchanged.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`

## Documentation updates

- docs/task-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Non-goals: do not turn task Notes into arbitrary blobs, add external storage, add database persistence, redesign run logging, or make blocker reasons multiline documents.
- If provenance/evidence already has a better canonical location for the full reason, use the smallest coherent design rather than duplicating storage.
