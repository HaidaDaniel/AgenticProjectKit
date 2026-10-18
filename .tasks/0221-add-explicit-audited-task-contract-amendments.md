# Task 0221 - Add explicit audited task-contract amendments

State: blocked
Owner: none
Mode: maintenance
Lane: verification
Type: bugfix
Scope: task contract provenance,operator authorization,verification epochs
Risk: high
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Provide an explicit, append-only operator-authorized path for material task-contract amendments after claim, preserving the original baseline and invalidating stale candidate evidence without weakening scope checks.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- .tasks/0221-add-explicit-audited-task-contract-amendments.md
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/cli/commands/task.ts
- src/cli/command-registry.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit



## Steps

1. Store canonical contract snapshots in new claim baselines; implement a preview/record command that binds exact before/after hashes and diff to operator approval; validate amendment chains and permit verification epoch recovery only for an exact recorded amendment; preserve the original claim baseline and require normal carried-path scope checks; document legacy snapshot recovery and fail-closed limits; add regression tests for exactness
2. authorization
3. unchanged baseline
4. stale evidence
5. and scope; run canonical verification and independent fresh review.

## Acceptance criteria

- New claims retain exact canonical contract snapshots while legacy baseline records remain readable;Amendment preview prints exact contract diff plus deterministic digest and performs no writes;Recording requires registered active owner
- distinct explicit operator actor
- exact digest
- reason
- and prior snapshot matching the stored contract hash;Amendment records append without rewriting claim baseline and bind task path
- baseline
- from/to hashes
- exact diff digest
- actor
- recorder
- and reason;Verification epoch accepts a changed contract only through a complete valid append-only amendment chain and binds amendment ID;Without a matching approval or with tampered/missing records epoch remains fail-closed;Normal candidate scope and carried-path checks remain active and old candidate evidence becomes stale after epoch;Regression tests prove no baseline overwrite and no scope/approval bypass

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- Never overwrite or replace an original claim baseline;Never treat lifecycle decisions or attribution approval as task-contract approval;Never infer operator approval from an agent name
- task state
- or task diff;Never let amendments waive allowed/forbidden path enforcement or required verification;Never mutate existing task evidence during amendment

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.

## Review questions

- Can an agent authorize its own amendment or change the target after the digest was approved?;Can a missing
- reordered
- duplicate
- or tampered amendment record form a valid chain?;Can an amended allowed-file set launder prior forbidden/out-of-scope work?;Do old verification records become stale while original claim history remains available?

## Counterexample searches

- Changed task file with no approval;wrong prior snapshot;wrong diff digest;approval for different target;recorder equals operator actor;amended scope adds a path already changed before epoch;amendment chain fork or replay;epoch after task text is restored;corrupt amendment JSONL;legacy claim without snapshots

## Verification

- `{"id":"task-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- docs/task-system.md
- docs/progress.md

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
- block: Blocked: the immutable claim baseline is cc58a39, while current main attributes commits e012972/126dea1 foreign Task 0222 and Task 0223 contracts outside this task scope. The gate rejects those two paths; completing 0221 would require unsupported attribution or replacing its baseline. Existing verification and review evidence is stale. Continue only through bounded successor 0224 with a fresh baseline.
