# Task 0253 - Fail closed on task inventory errors

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: tasks,inventory,filesystem,errors
Risk: high
Parallel: false
Depends on: none
Tags: p1,tasks,fail-closed,filesystem

## Goal

Make active and archived task inventory reads distinguish a legitimately missing optional directory from unreadable or malformed storage so an incomplete archive cannot be treated as empty and cannot cause unsafe task ID allocation.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/config/file.ts

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
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
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/config/**

## Steps

1. Reproduce readdir errors being converted to empty inventories; distinguish ENOENT from EACCES EPERM ENOTDIR ELOOP and I/O failures; verify expected directories are real directories; retain correct empty/new repository behavior; prevent nextTaskId allocation when active or archive inventory is incomplete; add deterministic injected-error and file-instead-of-directory fixtures; document the fail-closed boundary

## Acceptance criteria

- Only contractually optional missing storage is treated as empty; EACCES EPERM ENOTDIR ELOOP and I/O failures surface as actionable errors; a file at an expected task or archive directory is rejected; new repositories and valid empty directories still work; task creation refuses to allocate IDs when archive inventory is incomplete; archived IDs remain included in successful allocation; focused tests prove deterministic failures without relying on chmod

## Correctness assumptions

- A missing task or archive directory is optional only during initial repository setup; an existing but unreadable directory is never equivalent to absence; task creation must fail closed rather than guess IDs

## Invariants

- No silent empty inventory on I/O failure; no task ID collision with archived tasks; existing valid repositories remain readable; error diagnostics name the failing path and error class

## Required evidence

- Deterministic injected-error fixtures; inaccessible archive and active directory tests; file-instead-of-directory tests; ID allocation success and refusal tests; build-current artifact

## Review questions

- Can an unreadable archive still yield a new task ID; is a missing directory distinguished from an inaccessible one; does a file at the archive path produce an actionable failure; are archived IDs still respected

## Counterexample searches

- Missing .tasks; empty .tasks; unreadable .tasks; missing archive; unreadable archive; archive is a file; ELOOP; ID 0008 archived; create after incomplete inventory

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document inventory fail-closed behavior in docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Confirmed at HEAD 5021f2e: listTaskFiles and listArchivedTaskFiles use readdir(...).catch(() => []); A3 depends on this task
