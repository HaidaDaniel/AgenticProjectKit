# Task 0259 - Add unambiguous CLI list arguments for task authoring

State: done
Owner: opencode-correctness-milestone
Mode: maintenance
Lane: cli
Type: feature
Scope: cli,task-authoring,backlog,arguments
Risk: medium
Parallel: false
Depends on: none
Tags: p3,cli,task-authoring,arguments

## Goal

Preserve existing CSV CLI flags while adding one explicit JSON list input so steps acceptance criteria and other list fields can carry commas quotes Unicode and multiline text without ambiguous splitting.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/cli/commands/task.ts
- src/cli/commands/backlog.ts
- src/cli/command.test.ts
- src/cli/command-registry.ts

## Files allowed to edit

- src/cli/commands/task.ts
- src/cli/commands/backlog.ts
- src/cli/command-registry.ts
- src/cli/command.test.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/core/backlog/**
- src/core/config/**

## Steps

1. Reproduce comma splitting in task create and backlog promote; add one documented JSON list option compatible with existing CSV flags; reject conflicting duplicate field specification; preserve existing command semantics when the new option is absent; cover Unicode commas quotes and multiline text; update CLI help registry docs and tests

## Acceptance criteria

- Existing CSV flags behave unchanged; complex list text can be supplied without splitting; conflicting CSV and JSON values for the same field are rejected with an actionable error; task create and backlog promote both support the new input; Unicode commas quotes and multiline steps/acceptance are preserved; no separate CLI parser framework is introduced

## Correctness assumptions

- A single JSON list object is simpler than many repeatable flags; CSV remains the backward-compatible default; list field values are strings

## Invariants

- No silent semantic change to existing flags; no new parser framework; task creation validation remains canonical; backlog promotion canonical creator remains authoritative

## Required evidence

- Focused CLI tests for comma quotes Unicode multiline and conflict; help/reference alignment; build-current artifact

## Review questions

- Can commas still silently split complex text; do existing scripts remain compatible; are conflicting inputs rejected; is the JSON input bounded and validated

## Counterexample searches

- Comma in step; quoted comma; multiline step; Unicode title; both CSV and JSON; malformed JSON; backlog promote acceptance

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Update CLI help and docs/cli-commands.md and docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Confirmed at HEAD 5021f2e: comma-separated --steps and --acceptance split ordinary text into multiple items
