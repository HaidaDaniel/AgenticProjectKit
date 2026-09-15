# Task 0135 - Make Go test discovery honor canonical Git ignore semantics

State: doing
Owner: code-owner-0135
Mode: maintenance
Lane: quality
Type: bugfix
Scope: quality,go,tests,gitignore,audit
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Fix the release-safety defect where Go *_test.go discovery falls back to a non-ignore-aware filesystem walk when no tracked test is found, so gitignored tests can falsely create test capability. Use canonical Git-aware repository inventory, keep a bounded non-Git fallback, and make the regression actually prove the contract.

## Context files

- src/core/quality/index.ts
- src/core/quality/quality.test.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/core/docs/context.ts
- package.json
- docs/engineering/scanner-system.md
- docs/architecture.md
- docs/decisions.md
- .tasks/0122-align-repository-readiness-test-findings-with-detected-test-capability.md

## Files allowed to edit

- src/core/quality/index.ts
- src/core/quality/quality.test.ts
- src/core/audit/audit.test.ts
- package.json
- docs/engineering/scanner-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit



## Steps

1. Add a failing reproducer first: a Git Go module whose only `*_test.go` is gitignored (no tracked and no untracked-nonignored test). Confirm `detectQualityCapabilities` currently reports `tests: detected` through the ignore-unaware fallback.
2. Fix `findGoTestFiles` in `src/core/quality/index.ts`: for Git repositories use canonical inventory `git ls-files --cached --others --exclude-standard`, filter `*_test.go`, and drop skip segments (`.git`, `vendor`, `node_modules`, `dist`, `build`, `out`, `bin`, `coverage`, `tmp`). A successful Git result is authoritative even when empty, so a Git repository never falls through to the ignore-unaware walk. Keep the bounded (depth <= 2, 512-directory) filesystem walk only when the Git command fails (non-Git).
3. Repair the existing test `quality detection ignores gitignored Go test files and keeps tracked evidence` so it asserts the ignored file produces no evidence, and add focused coverage for: tracked tests detected; nonignored untracked tests detected; ignored-only tests not detected; `vendor`/generated paths filtered; mixed Go + APK-tooling `package.json` still detected; non-Git fallback still works.
4. Add `src/core/quality/quality.test.ts` to the `test` script in `package.json` with the minimal change so quality regressions actually run under `pnpm test`/CI.
5. Add an audit regression in `src/core/audit/audit.test.ts` proving a Go module detected through package-local tests never also emits `Top-level test directory not detected.` (guard for Task 0122's reconciliation).
6. Correct the misleading implementation comment and present-tense docs (`docs/engineering/scanner-system.md`, `docs/architecture.md`) so they describe canonical Git-inventory semantics; record the correction in `docs/decisions.md` only as a new entry if warranted. Do not rewrite historical ADR-0061 text.
7. Run every declared check, commit the candidate, `apk task verify`, required review, gate, `apk done`, then a separate bookkeeping commit.

## Acceptance criteria

- A gitignored-only Go `_test.go` set does not create `tests` capability; the Git inventory is authoritative for Git repositories.
- Tracked package-local Go tests are still detected as strong evidence.
- Nonignored untracked Go tests are detected because canonical repository inventory treats them as repository content.
- `vendor` and generated/heavy paths never produce Go test evidence, in both the Git and fallback paths.
- A non-Git repository retains the bounded depth/number-capped filesystem fallback, and it is only used when Git discovery fails.
- A mixed Go application plus APK-tooling `package.json` keeps `tests` detected and does not infer Node application semantics from tooling.
- Audit never emits `tests: detected` together with `Top-level test directory not detected.` for a Go module detected via package-local tests.
- `src/core/quality/quality.test.ts` is executed by the real `pnpm test` command.
- Misleading comments and present-tense docs are corrected; historical ADR-0061 and historical task contracts are not rewritten.
- No new scanner/index subsystem, dependency, command, or behavior change outside Go test evidence is introduced.
- All declared deterministic checks pass.

## Correctness assumptions

- `git ls-files --cached --others --exclude-standard` is the canonical Git-aware inventory already used for context discovery in `src/core/docs/context.ts`.
- A successful Git command with empty output means the repository genuinely has no Go test content; only a Git command failure (non-Git) may use the bounded walk.
- `go.mod` presence remains the entry condition for Go test evidence.

## Invariants

- No repository-memory, index, embedding, or scanner subsystem is added.
- Node, Python, build, coverage, CI, and hook detection are unchanged.
- The non-Git fallback stays bounded and skip-aware.

## Required evidence

- Failing reproducer output against the old behavior and the passing regression run after the fix, plus the focused test list executed by `pnpm test`.

## Review questions

- Can a gitignored `_test.go` still create test capability through any code path?
- Does the Git-empty case avoid the fallback while the non-Git case still uses it?
- Are `vendor`/generated paths filtered in both discovery paths?
- Is the `package.json` test-script change the minimal one needed to run `quality.test.ts`?
- Are historical ADRs and completed task contracts left unmodified?

## Counterexample searches

- Go repo whose only tests are gitignored.
- Go repo with tests under `vendor/` or a generated directory.
- Go repo with an untracked, nonignored test file.
- Non-Git Go directory.
- Mixed Go + `package.json` APK tooling.
- `.gitignore` negation re-including a previously ignored test.
- Ignored test nested deeper than the fallback depth boundary.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- docs/engineering/scanner-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md

## Notes

- Release-safety corrective that must be `done` before v0.4.4; it becomes a dependency of Task 0133.
- Bounded capability detection only. Do not implement persistent repository memory, indexes, embeddings, or a new scanner subsystem.
