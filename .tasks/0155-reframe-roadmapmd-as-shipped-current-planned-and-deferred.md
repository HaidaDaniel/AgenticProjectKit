# Task 0155 - Reframe roadmap.md as shipped, current, planned, and deferred

State: todo
Owner: none
Mode: maintenance
Lane: documentation
Type: docs
Scope: roadmap,current-truth,docs
Risk: low
Parallel: true
Depends on: 0153,0154,0156,0157
Tags: docs

## Context files

- AGENTS.md
- docs/project.md
- docs/roadmap.md
- docs/progress.md
- docs/scope.md
- docs/architecture.md
- docs/delivery/milestones.md
- docs/decisions.md
- docs/releases/v0.4.6.md

## Files allowed to edit

- docs/roadmap.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/delivery/milestones.md
- docs/decisions.md

## Goal

Turn docs/roadmap.md into an accurate index of shipped, current, planned, deferred, and excluded work.

## Steps

1. Use task state, release evidence, current scope, architecture, and delivery history as status sources.
2. Mark completed milestones shipped and remove claims that they are still the next planned release.
3. Present public-readiness as the current planned milestone with links to contracts and prerequisite groups.
4. Keep deferred and excluded work separate and do not invent dates or version numbers.

## Acceptance criteria

- No completed milestone is labeled next or planned.
- The roadmap identifies one understandable planned milestone and links to task contracts.
- Shipped, active, planned, deferred, and excluded work are distinct.
- Status claims agree with task state and release evidence.

## Correctness assumptions

- Task records and release artifacts define completion.
- Next version remains undecided until release policy and tags are checked.

## Invariants

- Roadmap ordering does not override dependencies or release gates.
- No unsupported date or version is committed.

## Required evidence

- A cross-check maps each milestone status to task states and release records.

## Review questions

- Could a reader mistake old v0.3 work for current release?
- Does any planned item lack an active contract or deferred label?

## Counterexample searches

- Stale “next gated-workflow release” or planned labels on done IDs remain.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Do this after bounded truth-source tasks. Keep rationale only where it explains current direction.
