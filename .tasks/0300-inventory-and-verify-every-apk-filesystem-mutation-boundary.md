# Task 0300 - Inventory and verify every APK filesystem mutation boundary

State: done
Owner: opencode-corrective-impl
Mode: audit
Lane: verification
Type: security
Scope: filesystem,containment,audit,tests,docs
Risk: high
Parallel: false
Depends on: 0290,0291
Tags: security,containment,audit,inventory,tests

## Goal

Enumerate all repository filesystem mutation call sites, prove each is contained or explicitly justified, and add a durable guard that prevents new uncontained mutation paths.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- src/core/config/paths.ts
- src/core/audit/audit.test.ts
- src/core/tasks/index.ts

## Files allowed to edit

- src/core/config/mutation-boundary.test.ts
- src/core/config/paths.ts
- docs/architecture.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/index.ts
- src/core/audit/index.ts
- src/core/doctor/index.ts
- src/core/init/index.ts
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Enumerate every call to rm unlink rename rmdir writeFile appendFile mkdir copyFile link and symlink in shipped source excluding tests.
2. Classify each site as contained by a validated helper explicitly justified outside the repository or a gap; record the exact call path and trust boundary.
3. Verify each contained site with a negative-path fixture using an outside marker and a symlinked ancestor or final component.
4. Add a bounded guard test that fails when a new mutation call site appears without a documented containment decision; do not rewrite command implementations in this task.
5. If a new gap is found record it as a follow-up proposal in the report rather than fixing it here.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- The inventory covers every shipped mutation call site with its containment decision.
- Every contained site has a reproducible negative-path result with no outside mutation.
- The guard test detects a deliberately introduced uncontained mutation in a fixture.
- No command implementation is changed by this task.
- Any new gap is reported with a bounded follow-up proposal.

## Correctness assumptions

- A complete inventory is possible from shipped source

## Invariants

- No repository mutation path is undocumented or uncontained

## Required evidence

- Inventory matrix and negative-path results

## Review questions

- Is any mutation call hidden behind an abstraction that escapes the inventory

## Counterexample searches

- Dynamic import mutation; Git subprocess writing outside worktree; Worktree record path escape

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/config/mutation-boundary.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"mutation-inventory","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record the complete mutation call-site matrix with containment decisions and negative-path outcomes."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the mutation boundary matrix in docs/architecture.md

## Notes

- Justified as a separate task because 0290 and 0291 have narrow allowed files and cannot cover all mutation sites
- Trust boundary: exhaustive enumeration not two isolated fixes
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
