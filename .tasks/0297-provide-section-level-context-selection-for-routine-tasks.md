# Task 0297 - Provide section-level context selection for routine tasks

State: done
Owner: opencode-corrective-impl
Mode: product
Lane: feature
Type: feature
Scope: context,cli,docs
Risk: low
Parallel: false
Depends on: none
Tags: feature,context,developer-experience,agent-harness

## Goal

Reduce agent context load by allowing a task context request to select bounded sections instead of entire large policy documents.

## Context files

- AGENTS.md
- docs/context-system.md
- docs/task-system.md
- src/core/docs/context.ts
- src/cli/commands/context.ts

## Files allowed to edit

- src/core/docs/context.ts
- src/cli/commands/context.ts
- docs/context-system.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/doctor/**
- src/core/audit/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Measure the current file-level context bundle for a routine bugfix task and identify the large documents that dominate it.
2. Add an optional bounded section selector to context resolution with deterministic parsing and an explicit fallback to whole-file behavior.
3. Keep level and budget semantics unchanged unless the new selector is requested.
4. Add tests for selected, absent and invalid sections and for unchanged default output.
5. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- A section-selected context request returns a smaller deterministic bundle.
- Default context output is unchanged for existing callers.
- Invalid selectors fail with an actionable error.
- No required context file is silently omitted when a selector is not used.

## Correctness assumptions

- Agents benefit from smaller but still complete context

## Invariants

- Context selection never hides a task-required file

## Required evidence

- Before and after context bundle sizes

## Review questions

- Can a selector accidentally exclude a required contract section

## Counterexample searches

- Malformed selector; Section name collision; Empty selected bundle

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/docs/context.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document section-level context in docs/context-system.md

## Notes

- Developer-experience improvement not a correctness fix
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
