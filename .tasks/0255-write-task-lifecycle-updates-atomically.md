# Task 0255 - Write task lifecycle updates atomically

State: done
Owner: opencode-correctness-milestone
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: tasks,lifecycle,atomic-write,filesystem,provenance
Risk: high
Parallel: false
Depends on: 0254
Tags: p1,tasks,atomic-write,lifecycle

## Goal

Protect existing task Markdown from partial writes by publishing lifecycle updates through a same-directory temporary file and atomic replacement while preserving lock serialization, candidate identity, provenance, evidence freshness, and recoverable failure behavior.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- .tasks/0254-create-task-files-exclusively.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
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

1. Reproduce a partial existing-file write risk; separate exclusive create from replacement update; write a complete same-directory temporary file and publish with platform-appropriate replacement; clean temporary files on failure; preserve the original file until publication; preserve permissions where required; document crash-consistency and durability limits; add failure-injection tests for temporary write publish failure cleanup and interruption before publication

## Acceptance criteria

- Existing task updates are published atomically on supported platforms; a failure before publication leaves original bytes intact; temporary files are cleaned after failure; exclusive creation remains separate; claim release block review done still work; candidate/baseline/evidence identity is not weakened; Windows rename semantics are handled or documented as a limitation

## Correctness assumptions

- Atomic rename within one directory is available on the supported POSIX and Windows paths; fsync-level durability is not claimed unless explicitly performed; task mutation lock continues to serialize APK lifecycle mutations

## Invariants

- No partial task contract becomes visible under normal failure injection; no provenance or evidence bypass; original file preserved on pre-publication failure; lifecycle state and owner semantics unchanged

## Required evidence

- Failure-injection test output for temporary write publish failure and cleanup; original-byte-preservation assertions; claim/release/block/review/done regression output; build-current artifact

## Review questions

- Can a crash leave a truncated task contract; is the original file preserved before publication; are temporary files cleaned; does the change alter candidate identity or evidence freshness

## Counterexample searches

- Temporary write failure; publish failure; target missing; permission preservation; Windows rename behavior; concurrent lifecycle mutation under APK lock

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document the atomic replacement protocol and crash-consistency boundary in docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Depends on 0254 to keep create and update APIs distinct; do not claim fsync durability without performing it
