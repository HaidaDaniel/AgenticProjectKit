# Task 0197 - Add explicit operator-approved attribution recovery for interrupted tasks

State: doing
Owner: codex-recheck-20261007
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: tasks,provenance,verification,workflow,cli,docs
Risk: high
Parallel: false
Depends on: none
Tags: bugfix,interrupted-tasks,operator-decision

## Goal

Allow an explicit operator to approve specific intervening commit attribution when a long-lived task was interrupted by urgent work, while keeping deterministic verification, review, candidate freshness, and unapproved scope violations hard blockers.

## Context files

- AGENTS.md
- docs/task-system.md

## Files allowed to edit

- src/core/tasks/**
- src/cli/commands/task.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- dist/**
- docs/task-system.md
- docs/decisions.md
- docs/cli-commands.md
- docs/progress.md

## Files forbidden to edit

- pnpm-lock.yaml
- src/core/skills/**
- .github/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. define structured attribution decision
2. validate exact intervening commits and paths
3. run checks after approved attribution
4. add regression coverage and docs
5. regenerate dist and review

## Acceptance criteria

- urgent intervening task commits can be approved only by an explicit distinct operator identity
- approval is bound to exact baseline/head/candidate and listed commit SHAs
- unlisted out-of-scope or forbidden paths remain blockers
- failed checks and missing review remain blockers
- stale or mutated decisions do not resolve the gate
- Task 0191 can be reverified using the approved 0193 history

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- no automatic scope bypass
- operator decision remains append-only and candidate-bound
- accepted commit paths are explicit and auditable
- existing accept-current review semantics remain unchanged

## Required evidence

- focused interrupted-task fixture
- invalid SHA/path counterexamples
- stale decision regression
- Task 0191 reverification

## Review questions

- does approval cover only named commits and their actual paths
- can a real active-task forbidden edit hide behind an approved commit
- does candidate mutation stale the approval
- do existing review and deterministic blockers remain hard

## Counterexample searches

- unknown commit
- non-ancestor commit
- merge commit
- partial commit list
- extra dirty file
- forbidden active-task edit
- decision recorded by task owner
- HEAD mutation after approval

## Verification

- `{"id":"static-quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality:static"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/task-system.md
- docs/decisions.md
- docs/cli-commands.md
- docs/progress.md

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
