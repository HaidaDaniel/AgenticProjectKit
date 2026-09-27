# Task 0158 - Add a documentation home

State: todo
Owner: none
Mode: product
Lane: documentation
Type: docs
Scope: documentation-navigation,information-architecture,docs
Risk: low
Parallel: false
Depends on: 0151,0152,0153,0154,0155,0156,0157,0159,0160,0161,0162,0164,0165,0166,0167,0169,0171
Tags: docs

## Context files

- AGENTS.md
- README.md
- docs/getting-started.md
- docs/concepts.md
- docs/guides/brownfield-adoption.md
- docs/guides/constrained-local-execution.md
- docs/cli-commands.md
- docs/product/maturity-and-compatibility.md
- docs/releases/index.md
- docs/releases/v0.4.7.md
- CONTRIBUTING.md
- CHANGELOG.md
- docs/architecture.md
- docs/decisions.md
- docs/roadmap.md

## Files allowed to edit

- docs/index.md
- docs/progress.md

## Files forbidden to edit

- README.md
- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Goal

Create a documentation home that routes users and contributors to one canonical guide for each major question.

## Steps

1. Group documentation by audience and question: start, understand, adopt, reference, contribute, and release history.
2. Link only to files that exist or are explicit outputs of prerequisites; include SECURITY.md only when it exists.
3. Use short descriptions that explain when each guide is useful.
4. Check relative links and remove duplicate or stale destinations.

## Acceptance criteria

- The index links to Getting Started, Core Concepts, user Guides, CLI/Configuration Reference, Architecture, Decisions/ADRs, Releases, Contributing, and historical/archive planning.
- Add a Security link only if SECURITY.md exists; its absence while Task 0170 is blocked is not a broken-link failure.
- Every link resolves when prerequisites complete.
- The page is navigation-focused and does not duplicate long-form content.

## Correctness assumptions

- A single Markdown index is sufficient at current documentation scale.
- Each guide, not the index, owns detailed content.

## Invariants

- No link is broken at completion.
- Historical and current docs are clearly labeled.

## Required evidence

- A destination checklist records every link target and a pass/fail result. A bounded manual checklist is acceptable; do not claim an automated link check unless one actually ran.

## Review questions

- Can a new user find a first-run path quickly?
- Are link labels useful without opening the destination?

## Counterexample searches

- Competing quickstart/reference destinations or unresolved links remain.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"check-3","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Open each destination linked from docs/index.md and record its path and pass/fail result. Check SECURITY.md only if that file exists.","evidence":"A per-destination path and pass/fail checklist."}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This is the information architecture layer used by README. Keep it an index, not duplicate policy.
