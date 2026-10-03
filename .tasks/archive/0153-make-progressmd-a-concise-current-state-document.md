# Task 0153 - Make progress.md a concise current-state document

State: done
Owner: codex-0153
Mode: maintenance
Lane: documentation
Type: docs
Scope: progress,current-truth,docs
Risk: low
Parallel: false
Depends on: none
Tags: docs

## Goal

Make docs/progress.md a concise current-context page and move unique historical journal detail to a history record or existing release/task records.

## Context files

- AGENTS.md
- docs/project.md
- docs/roadmap.md
- docs/progress.md
- docs/releases/v0.4.6.md
- docs/delivery/milestones.md

## Files allowed to edit

- docs/progress.md
- docs/history/progress-history.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Steps

1. Classify each existing progress entry as current state, already represented by a release/task record, unique historical context, or stale/duplicated prose.
2. Preserve unique historical context in docs/history/progress-history.md only where an authoritative release/task record does not already hold it; link to existing records instead of copying them.
3. Replace the canonical docs/progress.md body with current release, current state, active work, known blockers, next milestone, and recently completed sections.
4. Verify every current claim against package version, tagged release, task state, roadmap, and milestone records; keep uncertain claims explicit.

## Acceptance criteria

- docs/progress.md is a concise current-context page with current release, current state, active work, known blockers, next milestone, and recently completed sections.
- Append-only journal detail is not kept in the canonical current-context page.
- Unique historical details are retained in the history record or authoritative release/task records; duplicate history is linked, not copied.
- No task is described as started or completed unless its recorded state supports that claim.
- The backlog is represented as planned without duplicating every task contract.

## Correctness assumptions

- Task records and tagged release artifacts take precedence over stale prose labels.
- Historical progress entries may be moved out of the current-context page, but unique information must remain recoverable.

## Invariants

- No evidence is fabricated, removed, or backdated.
- Current summary and historical notes remain distinguishable.

## Required evidence

- Before/after review maps each removed journal entry to its history destination or canonical release/task source.

## Review questions

- Can a reader identify current status without reading the whole file?
- Did any historical claim change beyond a bounded stale-label correction?

## Counterexample searches

- Contradictory current-version, next-milestone, or completion claims remain.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Keep the canonical page current and short; never rewrite release evidence or task lifecycle history.
