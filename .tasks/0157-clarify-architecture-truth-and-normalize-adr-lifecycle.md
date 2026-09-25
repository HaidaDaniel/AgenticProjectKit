# Task 0157 - Clarify architecture truth and normalize ADR lifecycle

State: todo
Owner: none
Mode: maintenance
Lane: documentation
Type: docs
Scope: architecture,current-truth,docs
Risk: low
Parallel: true
Depends on: none
Tags: docs,adr,architecture

## Context files

- AGENTS.md
- docs/project.md
- docs/architecture.md
- docs/decisions.md
- docs/roadmap.md
- docs/task-system.md
- docs/progress.md

## Files allowed to edit

- docs/architecture.md
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- docs/releases/**
- .tasks/archive/**

## Goal

Separate current, accepted target, deferred, and excluded architecture while making ADR supersession status easy to inspect.

## Steps

1. Map current architecture to source and accepted ADRs, and classify retained target/deferred ideas.
2. Review every ADR heading and identify its current lifecycle status from explicit supersession links and current decisions.
3. Add a lightweight ADR index with columns `ADR | Status | Topic | Superseded by` and mark ADR-0006 superseded by ADR-0062 without deleting or rewriting its historical rationale.
4. Add explicit accepted, superseded, deprecated, or historical status to ADR records where supported by evidence; do not invent a new decision or infer acceptance from age.
5. Label current architecture and accepted target/deferred ideas separately, linking each target to a decision or active task.
6. Keep this task documentation-only; propose a separate narrowly scoped deterministic check later only if the status structure proves machine-checkable without prose guessing.

## Acceptance criteria

- Current, accepted target, deferred, and excluded architecture are clearly distinguishable.
- The ADR index contains one row per retained ADR with status, topic, and supersession target where applicable.
- ADR-0006 is marked superseded by ADR-0062 and both historical texts remain intact.
- No target component is presented as shipped and each retained target links to an accepted decision or active task.
- No code or CI changes are required in this docs-only task; any future automation has a separate contract and deterministic tests.

## Correctness assumptions

- Architecture docs describe current repository behavior unless explicitly labeled otherwise.
- ADR lifecycle status must come from recorded supersession/decision evidence; chronology alone does not imply status.
- The canonical ADR record is docs/decisions.md and its lightweight index is a navigation aid.

## Invariants

- Historical ADR text is never deleted or silently rewritten as if a superseding decision had always existed.
- No ADR is marked accepted, deprecated, or superseded without explicit evidence.
- No target architecture is represented as implemented.

## Required evidence

- A complete ADR index cross-checks every retained ADR heading and explicit supersession link.
- A source/ADR reference supports each current architecture component and retained target element.
- A review checklist demonstrates each index row matches the ADR heading and explicit supersession links.

## Review questions

- Can a reader distinguish current data flow from proposal?
- Are runtime responsibilities assigned correctly?

## Counterexample searches

- Future components appear inside current diagrams without labels.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This normalizes two connected architectural sources of truth without removing history. Do not turn it into an ADR database or introduce unsupported decisions.
