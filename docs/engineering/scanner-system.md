# Scanner System

The scanner system will inspect the repository during `audit` and `adopt`.

## Goals

- detect the existing stack;
- identify repository structure;
- find documentation gaps;
- find candidate task boundaries;
- support context selection.

Quality detection is a shared read-only scanner projection. Its stable capability IDs are `typecheck`, `lint`, `tests`, `build`, `coverage`, `hooks`, and `ci`; script/config/vendor strings remain evidence metadata. The scanner distinguishes detected, missing, and unknown, and evaluates only explicitly configured required/recommended policy.

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
- Never execute repository commands, install dependencies, or write hooks/workflows/configuration during detection.
- Keep CI detection platform-neutral; GitHub Actions is one marker, not the capability identity.


Readiness findings respect detected capability rather than layout assumptions. The audit computes quality detection first, and the "Top-level test directory not detected." readiness info is emitted only when no test capability is detected by any supported mechanism. For Go modules (`go.mod`), tracked package-local `*_test.go` files count as strong native test evidence; Git-tracked discovery (`git ls-files *_test.go`) is preferred with a bounded two-directory-level filesystem fallback that always skips `.git`, `vendor`, `node_modules`, and generated/ignored trees, capped at 512 directories. The Project Map may still report `Test directories: none` as truthful inventory; that fact alone is not a readiness deficiency. Node, Python, and build detection are unchanged (Task 0122).
