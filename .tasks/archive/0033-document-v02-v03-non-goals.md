# Task 0033 - Document v0.2 v0.3 Non Goals

State: done
Owner: codex-a
Mode: product
Lane: documentation
Scope: roadmap,scope,docs
Risk: low
Parallel: true
Depends on: 0029
Tags: docs,roadmap,v0.2,v0.3

## Goal

Document that UI, SaaS, cloud sync, database, auth, and issue tracker sync are outside v0.2 and v0.3.

## Context files

- AGENTS.md
- docs/scope.md
- docs/roadmap.md
- README.md

## Files allowed to edit

- docs/scope.md
- docs/roadmap.md
- README.md
- docs/progress.md

## Files forbidden to edit

- application source files

## Steps

1. Update v0.2 and v0.3 roadmap language.
2. Add explicit v0.2 and v0.3 non-goals.
3. Keep future UI/SaaS/cloud ideas under future scope only.

## Acceptance criteria

- v0.2 and v0.3 do not include UI work.
- Future scope still records possible later UI/SaaS/cloud work.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/scope.md.
- Update docs/roadmap.md.
- Update docs/progress.md.

## Notes

- This is documentation-only scope control.

