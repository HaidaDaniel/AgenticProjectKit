# Task 0113 - Harden generated workflow docs against invalid APK CLI examples

State: todo
Owner: none
Mode: maintenance
Lane: docs
Type: bugfix
Scope: docs,templates,cli-contract,adoption
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Make canonical workflow docs and generated templates use only CLI examples accepted by the current parsers: execution explain takes canonical execution roles and independent review recording requires --review-run.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- src/core/docs/adopt.ts
- src/core/templates/exporters/agents.md.hbs
- src/cli/commands/task-state.ts
- src/cli/commands/execution.ts
- src/cli/cli.test.ts

## Files allowed to edit

- docs/task-system.md
- docs/cli-commands.md
- README.md
- src/core/docs/**
- src/core/templates/**
- src/cli/cli.test.ts
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/work/**
- src/core/tasks/**
- .github/workflows/**

## Steps

1. Capture a reproducer that fails on the old behavior.
2. Identify and document the root cause before changing code.
3. Implement the smallest safe fix; do not perform unrelated refactors.
4. Add regression coverage and run verification.

## Acceptance criteria

- canonical docs and generated templates use --role implementation for apk execution explain; every review-result example includes --review-run obtained from the prior --prompt step; example roles and flags are accepted by current CLI parsing contracts; adopt-generated docs remain deterministic; committed dist stays current; a bounded regression test guards examples from drift

## Correctness assumptions

- execution explain accepts planning/implementation/review/fix/documentation/triage/verification; apk work accepts implement/review/fix/verify; review recording requires --review-run returned by the prior --prompt step

## Invariants

- no general shell parser or docs execution framework is added; fixes land in canonical sources and templates; CLI parsing contracts are unchanged

## Required evidence

- regression test output plus the corrected canonical example snippets

## Review questions

- Do any examples pair execution explain with work roles; do all review examples include --review-run; does the guard test assert against canonical strings or real parsers

## Counterexample searches

- adopt-generated docs; README quickstart; docs/cli-commands list; an agent executing the example end to end

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"review-run-docs","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"for f in docs/task-system.md README.md docs/cli-commands.md; do grep -q -- '--review-run' \"$f\" || { echo \"missing --review-run in $f\"; exit 1; }; done"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/task-system.md
- docs/cli-commands.md
- docs/progress.md

## Notes

- Keep the fix narrow.
