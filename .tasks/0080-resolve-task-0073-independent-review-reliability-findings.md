# Task 0080 - Resolve Task 0073 independent-review reliability findings

State: todo
Owner: none
Mode: product
Lane: task-system
Scope: workflow,review,evidence,concurrency,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0073
Tags: bugfix,reliability,review,workflow,concurrency

## Goal

Three P2 findings retained by Task 0073 independent review are fixed with atomic result idempotence, no orphaned worker review preparation and actionable fixer progression.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/cli-commands.md
- src/core/work/index.ts
- src/core/work/session.ts
- src/core/tasks/review.ts
- src/core/tasks/evidence.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/cli/commands/work.ts
- src/cli/commands/task-state.ts
- src/cli/cli.test.ts
- .tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md
- .tasks/0076-recover-stale-task-mutation-locks-safely.md

## Files allowed to edit

- src/core/work/index.ts
- src/core/work/session.ts
- src/core/tasks/review.ts
- src/core/tasks/evidence.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/cli/commands/work.ts
- src/cli/commands/task-state.ts
- src/cli/cli.test.ts
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- docs/progress.md
- docs/decisions.md
- .tasks/0080-resolve-task-0073-independent-review-reliability-findings.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .husky/**
- src/core/config/**
- src/core/quality/**
- src/core/templates/**
- src/core/exporters/**
- .agentic/config.json
- .tasks/archive/**

## Steps

1. Move duplicate worker/review result detection into same evidence-append critical section as append; preserve one terminal result per run under concurrent submissions.
2. Make worker review preparation/publication transactional or clean exact worker-origin prepared review on every pre-activation failure without deleting valid standalone/successor state.
3. Replace standalone `changes_requested` + `doing` auto-role dead end with deterministic actionable lifecycle guidance; do not silently rewrite owner/state.
4. Add deterministic concurrency/failure-injection/CLI regressions for all three review findings.

## Acceptance criteria

- Concurrent submissions for same worker/review run append at most one terminal review result; loser receives stable already-recorded diagnostic.
- Duplicate decision and append share evidence lock/transaction boundary. Last-record-wins file order cannot choose between two accepted results for same run.
- Failure after worker review preparation but before session activation leaves no orphan worker-origin prepared review.
- Cleanup verifies exact task/run/origin/subject and cannot remove valid standalone review, activated session or successor artifact.
- Standalone `changes_requested` recorded while task remains `doing` never selects impossible fixer command silently. Output names exact required `apk review <task-id> --owner <owner>` transition or equivalent valid next action.
- No implicit state transition hides lifecycle history. Existing worker-origin automatic review transition contract remains unchanged.
- Tests cover duplicate concurrent review/worker submissions, forced failure at each preparation/publication boundary, cleanup race protection and actionable CLI auto-role behavior.
- Existing revision freshness, immutable session publication, gate eligibility and review history invariants remain intact.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsc -p tsconfig.json --noEmit"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"work-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk work --help"}`

## Documentation updates

- Update task/workflow docs only for changed idempotence, cleanup or next-action behavior.
- Record transaction/lifecycle invariant in docs/decisions.md if implementation changes persisted contract.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-RELIABILITY-02. Source: Task 0073 independent PASS evidence, run `work-1788972114349-451a6r`, three P2 findings.
- 0076 owns stale/dead/malformed lock recovery and lock ownership. This task owns correctness inside acquired evidence lock plus worker-review lifecycle cleanup/guidance.
- 0076 and 0080 overlap task evidence/workflow files: serialize implementation despite independent dependency edges.
- No model runtime, distributed lock, evidence-store migration or broad workflow redesign.
