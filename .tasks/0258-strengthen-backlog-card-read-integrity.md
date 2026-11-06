# Task 0258 - Strengthen backlog card read integrity

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: backlog,filesystem,read-integrity,unicode
Risk: medium
Parallel: false
Depends on: 0257
Tags: p2,backlog,read-integrity,utf8

## Goal

Harden bounded backlog reads with strict UTF-8 decoding and portable change detection while documenting the residual same-size external rewrite limitation rather than inventing stronger atomicity than the filesystem provides.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/backlog/index.ts
- src/core/backlog/backlog.test.ts
- .tasks/0257-generate-unicode-safe-task-and-backlog-slugs.md

## Files allowed to edit

- src/core/backlog/index.ts
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
- src/core/tasks/**
- src/core/config/**

## Steps

1. Confirm replacement-character decoding and same-size rewrite behavior; add strict UTF-8 decode; compare size identity and available timestamps before and after reading; preserve 64 KiB bound and O_NOFOLLOW regular-file checks; avoid unbounded retries; return actionable change errors; document the residual TOCTOU boundary; add normal invalid UTF-8 short-read truncated grown same-size rewrite symlink and oversized tests

## Acceptance criteria

- Invalid UTF-8 is rejected instead of replaced; normal UTF-8 remains readable; short reads still assemble correctly; truncated and grown files are rejected; same-size rewrites are detected when portable metadata reveals them or the limitation is explicitly documented and tested; symlink and oversized files remain rejected; no infinite retry loop

## Correctness assumptions

- Portable change detection may not catch every same-size external rewrite; strict refusal is preferable to silent replacement decoding; 64 KiB limit remains authoritative

## Invariants

- No unbounded allocation or retry; O_NOFOLLOW and regular-file checks remain; no false acceptance of partial content; no weakening of symlink safety

## Required evidence

- Focused UTF-8 and change-detection fixtures; same-size rewrite result or documented limitation; symlink and oversized regressions; build-current artifact

## Review questions

- Can invalid UTF-8 be silently replaced; can a same-size rewrite be mistaken for stable content; is any retry unbounded; are symlink and size limits preserved

## Counterexample searches

- Invalid UTF-8; same-size rewrite; truncate; grow; short read; symlink; oversized; file changed between stat calls

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document strict UTF-8 and residual rewrite limits in docs/task-system.md; update docs/progress.md when task state changes

## Notes

- Depends on 0257 to sequence backlog/index.ts changes; confirmed at HEAD 5021f2e: readBoundedFileHandle uses Buffer.toString utf8 and size-only change comparison
