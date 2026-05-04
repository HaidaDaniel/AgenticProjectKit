# Scanner System

The scanner system will inspect the repository during `audit` and `adopt`.

## Goals

- detect the existing stack;
- identify repository structure;
- find documentation gaps;
- find candidate task boundaries;
- support context selection.

## Expected inputs

- filesystem structure;
- package manifest files;
- docs and config files;
- existing agent instructions;
- test and build files;
- project-specific conventions.

## Rules

- Prefer deterministic scans over heuristic guesswork.
- Record findings in docs rather than mutating code during audit.
- Keep adoption changes conservative.
- Use scan results to shape generated docs and tasks.

