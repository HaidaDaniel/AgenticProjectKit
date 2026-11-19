# Task 0295 - Support external read-only evidence references in task contracts

State: done
Owner: opencode-corrective-impl
Mode: product
Lane: feature
Type: feature
Scope: tasks,lint,docs,downstream
Risk: medium
Parallel: false
Depends on: none
Tags: feature,tasks,lint,downstream,provenance

## Goal

Give downstream projects a machine-readable way to declare read-only external evidence paths without lint treating them as missing repository-relative context files.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/core/audit/lint.ts

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- docs/task-system.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/doctor/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce F-009 with translator-agent task 0338 style absolute run-root paths in contextFiles and observe lint advisory output.
2. Add a bounded external-evidence declaration to the task contract with schema validation and rendering round-trip.
3. Exclude declared external evidence from repository-relative context-reference checks while keeping it visible in parsed and rendered contracts.
4. Add lint tests for valid, malformed and absent declarations and a downstream-style fixture using absolute read-only paths.
5. Document the contract and that APK never reads writes or validates trust of external evidence.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- A declared external evidence path produces no context-reference-missing advisory.
- The path remains machine-readable in parsed JSON and rendered task Markdown.
- Malformed declarations fail validation with an actionable error.
- Ordinary contextFiles continue to be checked as repository-relative paths.
- No paid experiment or benchmark is executed by any verification check.

## Correctness assumptions

- External evidence is read-only operator context

## Invariants

- APK never mutates external evidence

## Required evidence

- Lint JSON before and after the declaration

## Review questions

- Does any code path attempt to open an external evidence path

## Counterexample searches

- Traversal or absolute path smuggled into contextFiles; External declaration used to bypass forbidden path checks

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/audit/lint.test.ts src/core/tasks/task.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document external evidence in docs/task-system.md

## Notes

- Downstream benefit without downstream mutation
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
