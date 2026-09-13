# Task 0122 - Align repository-readiness test findings with detected test capability

State: todo
Owner: none
Mode: maintenance
Lane: adoption
Type: bugfix
Scope: audit,quality,scanner,tests,go
Risk: medium
Parallel: true
Depends on: none
Tags: bugfix

## Goal

A downstream repository audit reports `INFO repo-readiness: Top-level test directory not detected.` while the same audit reports `tests: detected (required-detected)`. This is contradictory. The current audit heuristic is effectively `package.json exists AND top-level test directory absent -> INFO Top-level test directory not detected`, implemented in `src/core/audit/index.ts` using `scan.readiness.testDirectories` from `src/core/scanners/index.ts`. But APK itself introduces/uses package.json/pnpm tooling in non-Node projects, so the package.json proxy is wrong for repositories whose tests live elsewhere.

For Go projects, idiomatic tests are package-local (`foo_test.go`, `bar_test.go`, `database_test.go`) rather than a top-level `tests/` directory. Make readiness findings respect actual detected test capability instead of assuming a top-level test-directory layout. General principle: when quality capability says tests are detected, the absence of a top-level test directory should not imply missing test readiness. The Project Map may still truthfully show `Test directories: none` as inventory; that fact alone should not create a misleading readiness warning/info when usable tests are detected by another supported mechanism.

Add or confirm bounded native Go test evidence: for a Go repository, tracked `*_test.go` files should count as strong native test evidence. Prefer Git-aware/tracked-file discovery where practical, and do NOT recursively scan `.git`, `vendor`, `node_modules`, build output, or ignored generated trees with an uncontrolled filesystem walk. A clean Go repository with `go.mod` and `internal/foo/foo_test.go` must have tests detected even without `package.json` or `tests/`.

Prefer the generic invariant over one-off suppression: if tests capability is detected, do not emit "top-level test directory not detected" as a readiness deficiency. Keeping the raw inventory fact in the Project Map is fine. Improve consistency between scanner/readiness inventory, quality capability detection, and audit findings without adding a Go-only special case if the generic invariant can be expressed cleanly.

## Context files

- docs/engineering/scanner-system.md
- docs/architecture.md
- src/core/audit/index.ts
- src/core/quality/index.ts
- src/core/scanners/index.ts
- src/core/audit/audit.test.ts
- src/core/quality/quality.test.ts

## Files allowed to edit

- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/quality/index.ts
- src/core/quality/quality.test.ts
- src/core/scanners/index.ts
- docs/engineering/scanner-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/audit/lint.ts
- src/core/tasks/**
- src/cli/**
- src/core/work/**
- .github/workflows/**

## Steps

1. Reproduce the contradiction and identify where readiness inventory and quality capability detection diverge.
2. Decide the smallest generic invariant connecting detected test capability to readiness findings.
3. Add bounded, non-recursive Go `*_test.go` detection using tracked/Git-aware discovery where practical.
4. Ensure the Project Map can still report `Test directories: none` as inventory without treating that alone as a readiness deficiency.
5. Add regression fixtures for the scenarios in Acceptance criteria.
6. Confirm Node and Python behavior is preserved.
7. Update canonical docs and regenerate `dist/` through the normal build.
8. Run verification.

## Acceptance criteria

- Go package-local tests (`go.mod` plus `internal/db/db_test.go`) detect tests and produce no misleading top-level-test-directory readiness finding.
- Go without tests (`go.mod`, no `*_test.go`) does not falsely detect tests.
- Node with conventional tests (`package.json` plus `tests/`) preserves current behavior.
- Node with a test script but no tests directory does not contradict a credibly detected test capability merely because the directory layout differs.
- Mixed Go plus APK tooling (`go.mod`, `package.json`, pnpm lock, package-local `*_test.go`) detects tests with no false top-level-directory readiness finding.
- The Project Map may still report `Test directories: none` as inventory without that alone being classified as missing readiness.
- Audit and quality detection cannot contradict each other about whether tests exist.
- Go detection avoids uncontrolled filesystem traversal and handles tracked/ignored/generated files consistently.
- Node and Python behavior is preserved.

## Correctness assumptions

- Quality capability detection and repository scanning are independent read-only projections that can be reconciled at the audit layer.
- A top-level test directory is inventory, not the universal definition of test capability.
- Git-tracked file discovery is available and safe when the repository is Git-backed, with a bounded fallback otherwise.

## Invariants

- The fix does not execute test commands during audit.
- Discovery is bounded and skips `.git`, `vendor`, `node_modules`, build output, and ignored generated trees.
- Existing Node, Python, and build-detection behavior is not weakened.
- Downstream repositories are not modified.
- Quality policy requirements are not changed by this task.

## Required evidence

- Regression fixture output for the Go, Go-without-tests, Node, and mixed scenarios proving tests detection and readiness findings agree.

## Review questions

- Can audit and quality still contradict each other about whether tests exist?
- Does Go test detection avoid uncontrolled filesystem traversal?
- Are tracked/ignored/generated files handled consistently?
- Does the fix preserve Node/Python behavior?
- Is "test directory" treated as inventory rather than universal test capability?

## Counterexample searches

- Go module with tests only in a vendor tree.
- Go module with a `*_test.go` file that is gitignored.
- Node project with `package.json` test script but no `tests/` directory.
- Non-Git Go directory where tracked-file discovery is unavailable.
- Mixed repository where a top-level `tests/` directory exists but quality does not detect tests.
- A repo with neither package.json nor any test evidence.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-quality-detect","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js quality detect --json"}`
- `{"id":"built-audit","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js audit"}`

## Documentation updates

- docs/engineering/scanner-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md

## Notes

- Non-goals: do not build a universal test-framework detector, execute test commands during audit, add Go-specific configuration files, modify downstream repositories, or change quality policy requirements.
- Prefer a generic capability-vs-inventory invariant over a language-specific suppression when both are viable.
