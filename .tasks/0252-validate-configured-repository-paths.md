# Task 0252 - Validate configured repository paths

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: config,filesystem,validation,security
Risk: high
Parallel: false
Depends on: none
Tags: p1,config,path-safety,filesystem

## Goal

Reject absolute, escaping, dot-segment and ambiguous Windows-style taskDirectory and docsDirectory values during config parsing before any filesystem mutation while preserving valid nested repository-relative paths and existing schema behavior.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/config/schema.ts
- src/core/config/schema.test.ts
- src/core/config/types.ts
- src/core/config/file.ts
- src/core/backlog/index.ts
- src/core/docs/adopt.ts

## Files allowed to edit

- src/core/config/schema.ts
- src/core/config/schema.test.ts
- src/core/config/types.ts
- src/core/config/file.ts
- src/core/config/paths.ts
- docs/decisions.md
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

## Steps

1. Reproduce acceptance of ../outside /tmp/outside C:\outside work/../../outside work/./tasks and backslash variants; define one shared repository-relative directory validator; reject absolute paths dot segments empty segments and escape without rewriting valid configs; preserve valid nested paths such as work/tasks; integrate validation into taskDirectory and docsDirectory parsing without changing schemaVersion; reuse or align with existing backlog path safety where practical; add deterministic positive and negative config tests and document the rule

## Acceptance criteria

- Invalid taskDirectory or docsDirectory values are rejected during config parsing before filesystem access; absolute POSIX and Windows paths are rejected; parent traversal and dot segments are rejected; valid nested paths remain accepted; existing valid configs remain readable without rewrite; no schemaVersion change; focused config tests pass; filesystem write escape is documented and covered where applicable

## Correctness assumptions

- A repository-relative POSIX-style directory path is the canonical config form; Windows drive and backslash paths must be rejected as ambiguous or absolute; existing valid nested configs must not be migrated automatically

## Invariants

- No filesystem mutation occurs for an invalid config; valid existing configs remain compatible; no automatic config rewrite; no broader path normalization that silently changes meaning

## Required evidence

- Focused negative/positive config test output; evidence that invalid values are rejected before mutation; build-current artifact

## Review questions

- Can a crafted Windows or mixed-separator value escape the repository; are valid nested paths preserved; does validation run before any write; is the shared helper consistent with backlog symlink safety

## Counterexample searches

- Absolute POSIX path; Windows drive path; parent traversal; dot segment; backslash separators; empty path; nested valid path; config loaded by init/adopt/status

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document the config path rule in docs/decisions.md; update docs/progress.md when task state changes

## Notes

- Confirmed at HEAD 5021f2e: parseAgenticConfig accepted ../outside /tmp/outside C:\outside work/../../outside and work/./tasks; do not change schemaVersion or rewrite configs
