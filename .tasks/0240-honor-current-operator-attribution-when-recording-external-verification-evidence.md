# Task 0240 - Honor current operator attribution when recording external verification evidence

State: done
Owner: codex-corrective-0240
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: evidence,verification,attribution,tests
Risk: high
Parallel: false
Depends on: 0227,0239
Tags: bugfix

## Goal

Apply the existing exact candidate-bound operator attribution validation consistently to external verification recording. Preserve fail-closed behavior when approval is absent or stale or fails validation, and recheck approval-bound scope before append.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**

## Steps

1. Reproduce automated-pass versus non-gate-eligible manual recording under the same explicit approval
2. Change only recordManualVerification and narrowly required read-only helper calls in tasks/index.ts
3. Reuse currentTaskAttributionApproval without changing its validation or decision rules
4. Recheck approved subject and scope before append so concurrent changes cannot inherit approval
5. Test current approval and absent stale partial self-authored or dirty refusal cases
6. Commit then run canonical verification and independent review

## Acceptance criteria

- Current valid exact-commit attribution can make a correctly observed external check gate-eligible
- Missing stale incomplete or self-authored approval cannot make disputed evidence eligible
- Current unapproved worktree edits remain ineligible
- Any candidate change during approved external recording fails closed
- Unapproved normal clean-scope external recording retains existing behavior
- Artifact and benchmark recapture remains enforced
- No baseline rewriting or operator decision synthesis

## Correctness assumptions

- Attribution approval authorizes only its exact committed candidate and does not waive current dirty edits
- The same approval validator is already used by automated verification and completion gate

## Invariants

- Reuse the existing validator without widening accepted ownership
- No self-approval or rewritten evidence
- No lifecycle or baseline changes
- Do not change unrelated code in tasks/index.ts

## Required evidence

- Reproduction of non-gate-eligible manual evidence under valid approval and post-fix acceptance/refusal matrix

## Review questions

- Does the manual path use exactly the existing approval validator and retain recapture safety

## Counterexample searches

- No approval and stale candidate
- Partial commit list and forged self authorization
- Dirty overlapping files and candidate mutation before append
- Artifact or benchmark checks and ordinary clean baseline

## Verification

- `{"id":"attribution-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record the observed pre-fix discrepancy between automated verification and external report eligibility after explicit attribution approval, plus positive and refusal counterexamples after the fix."}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- docs/task-system.md
- docs/progress.md

## Notes

- Keep the fix narrow. Reproduction is best-effort, not a forced completion gate.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
