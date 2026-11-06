# Task 0257 - Generate Unicode-safe task and backlog slugs

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: tasks,backlog,slug,filesystem,unicode
Risk: medium
Parallel: false
Depends on: 0255
Tags: p2,slug,unicode,tasks,backlog

## Goal

Ensure Russian Ukrainian and mixed Unicode titles always produce a non-empty deterministic safe task or backlog filename while preserving task IDs path traversal protection reserved-name handling and existing filenames.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/backlog/index.ts
- src/core/tasks/task.test.ts
- src/core/backlog/backlog.test.ts
- .tasks/0255-write-task-lifecycle-updates-atomically.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/backlog/index.ts
- src/core/tasks/task.test.ts
- src/core/backlog/backlog.test.ts
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

1. Reproduce empty task slug and backlog exception for Cyrillic titles; define one small dependency-free deterministic fallback that never yields empty filename components; preserve ASCII slug behavior; reject traversal and reserved names; handle collisions predictably; keep existing file names unchanged; add task and backlog tests for the acceptance examples and long Unicode titles

## Acceptance criteria

- Улучшить работу агента Покращити перевірку задач Qwen 27B — новая конфигурация and mixed titles produce safe non-empty filenames; ASCII titles keep predictable slugs; task IDs remain canonical; traversal and reserved names remain rejected; collisions are handled without overwrite; existing files are not renamed; focused tests pass

## Correctness assumptions

- A short stable transliteration or deterministic Unicode fallback is sufficient; no external dependency is needed; existing ASCII filenames must remain stable

## Invariants

- No empty filename component; no path traversal; no existing file rename; no task ID change; no collision overwrite

## Required evidence

- Before/after Unicode slug fixtures for task and backlog; ASCII regression; collision and long-title tests; build-current artifact

## Review questions

- Can any Unicode title still produce an empty or unsafe name; are existing ASCII slugs unchanged; are collisions safe; is the fallback deterministic across processes

## Counterexample searches

- Pure Cyrillic title; mixed Latin Cyrillic; emoji punctuation; long title; slug collision; reserved filename; traversal-like title

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document filename slug fallback in docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Depends on 0255 to sequence tasks/index.ts changes; confirmed at HEAD 5021f2e: buildTaskFileName returns 0001-.md and slugifyBacklogTitle throws for Cyrillic
