# Task 0156 - Mark old delivery milestones as historical

State: done
Owner: codex-0156
Mode: maintenance
Lane: documentation
Type: docs
Scope: milestones,history,release,docs
Risk: low
Parallel: true
Depends on: none
Tags: docs

## Goal

Label completed delivery milestone plans as historical and link the current roadmap without changing task or release history.

## Context files

- AGENTS.md
- docs/roadmap.md
- docs/delivery/milestones.md
- docs/progress.md
- docs/releases/v0.4.6.md

## Files allowed to edit

- docs/delivery/milestones.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/roadmap.md
- docs/decisions.md

## Steps

1. Compare docs/delivery/milestones.md sections with canonical task state and release evidence.
2. Mark the completed 0057-0088 milestone shipped and include only already-recorded evidence.
3. Retain historical dependencies and rationale while removing language that suggests completed work still awaits release.
4. Add a concise pointer to the current roadmap without duplicating its task list.

## Acceptance criteria

- The completed milestone is explicitly historical/shipped and no longer labeled next.
- Historical task graph and decision context remain intact.
- Completion and release claims link to existing evidence.
- No task state, release note, or historical artifact is modified.

## Correctness assumptions

- Milestone prose is an index, not authoritative task state.
- Old dependency diagrams retain historical value.

## Invariants

- No completed task or released candidate is reopened or rewritten.
- No old candidate is presented as current.

## Required evidence

- Status cross-check against task output and release files.

## Review questions

- Do links lead to the canonical roadmap and history?
- Are historical plans distinguishable from current work?

## Counterexample searches

- Stale next/planned/required labels remain on completed task IDs.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This is a bounded historical labeling task; preserve useful old planning context.
