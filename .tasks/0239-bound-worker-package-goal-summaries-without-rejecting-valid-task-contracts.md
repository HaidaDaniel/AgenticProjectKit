# Task 0239 - Bound worker package goal summaries without rejecting valid task contracts

State: doing
Owner: codex-corrective-0239
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: worker,serialization,tests
Risk: medium
Parallel: false
Depends on: 0227
Tags: bugfix,worker

## Goal

Allow valid long task goals to produce bounded apk-worker-v1 summaries while retaining the complete canonical task contract and execution prompt. Do not weaken the external package parser or alter task semantics.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/work/contract.ts
- src/core/work/index.ts
- src/cli/command.test.ts

## Files allowed to edit

- src/core/work/contract.ts
- src/cli/command.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/**
- src/core/work/index.ts
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**

## Steps

1. Reproduce the 320-character worker goal failure from a valid contract
2. Bound only the generated worker package goal summary and visibly mark truncation
3. Keep short goals byte-identical and full task goal available in context and prompt
4. Test actual worker issuance and package parsing limits
5. Commit candidate then verify report and obtain independent review

## Acceptance criteria

- Valid goals longer than 320 characters issue valid worker packages
- Generated summaries remain at most 320 characters and explicitly point to the full task contract
- Untruncated goals remain unchanged
- Canonical Markdown and complete prompt retain the full original goal
- External oversized package goals remain rejected
- Existing worker constraints and provenance remain unchanged

## Correctness assumptions

- The canonical task contract permits goals longer than the bounded worker summary
- Worker context contains the current task file and prompt carries the full goal

## Invariants

- No task contract amendment
- No silent truncation
- No relaxed external parser limits
- No lifecycle or evidence trust changes

## Required evidence

- Observed long-goal failure and successful bounded issuance with full prompt preserved

## Review questions

- Is the full goal still available to the worker and are external bounds unchanged

## Counterexample searches

- Boundary goals of 319 320 and 321 characters
- Very long and Unicode goals
- External malformed or oversized package goals

## Verification

- `{"id":"goal-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record actual long-goal worker issuance before and after the fix, preserving the full task contract and prompt."}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/command.test.ts"}`
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
