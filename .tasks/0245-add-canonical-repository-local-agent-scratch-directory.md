# Task 0245 - Add canonical repository-local agent scratch directory

State: done
Owner: opencode-0244-0251
Mode: product
Lane: implementation
Type: feature
Scope: init,adopt,gitignore,agents,scratch,worktree,scope
Risk: high
Parallel: false
Depends on: none
Tags: p2,init,adopt,gitignore,scratch,agents,worktree

## Goal

Provide one canonical repository-local scratch area at tmp/apk/ for agent research, temporary scripts, reproducers, and working notes and have init/adopt prepare it with a narrowly scoped ignore rule while preserving existing user files, task scope attribution, and APK operational-state guarantees.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/adoption-flow.md
- docs/context-system.md
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/templates/renderer.test.ts
- src/core/tasks/task.test.ts
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .gitignore
- docs/task-system.md
- docs/context-system.md
- docs/adoption-flow.md
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
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- .apk-workspaces/**

## Steps

1. Define `<worktree-root>/tmp/apk/` as the canonical scratch path with optional research, repro, task-<id>, and other child directories; add only the root-anchored `/tmp/apk/` ignore entry so the rest of the operator tmp tree stays visible to Git; make apk init create the scratch directory and idempotently add the canonical ignore entry; allow a fresh clone to create the missing ignored directory on demand without requiring a committed placeholder; make adopt preview report the additive directory and ignore changes and make apply perform only safe additive writes with a repeated-run no-op; add canonical neutral agent instructions and exporter guidance for using scratch without extra CLI or LLM calls and without moving required evidence or reports there; prove ignored scratch does not become task-attributable scope or evidence and that allowedFiles is never auto-edited; preserve the existing .agentic/ and .apk-workspaces/ contracts and leave operating-system temp available for tools that genuinely require it; add deterministic tests for repeated init and adopt, existing user files, custom .gitignore, symlink and path escape, and multiple Git worktrees

## Acceptance criteria

- The canonical scratch path is `<worktree-root>/tmp/apk/`, not the operating-system temp directory.
- The ignore entry is root-anchored `/tmp/apk/` and does not ignore the rest of the user or repository `tmp/` tree.
- A fresh clone can create the missing ignored scratch directory on demand without a committed placeholder.
- apk init and idempotent apk adopt prepare the scratch directory and ignore entry; adopt --preview reports proposed changes without writing and adopt --apply applies only additive safe changes.
- Existing user files, custom .gitignore content, and existing scratch material are preserved; no automatic cleanup occurs.
- Symlink or path-escape attempts are refused with a bounded diagnostic.
- Several Git worktrees can each use their own repository-root-local scratch directory.
- Ignored scratch does not create false task scope or evidence violations and allowedFiles is unchanged.
- Ordinary scratch writes require no APK CLI or LLM call.
- Required reports and evidence are not permitted only inside ignored scratch.
- .agentic/ and .apk-workspaces/ guarantees remain intact and no file sandbox is introduced.

## Correctness assumptions

- A repository-local ignored directory is the right default for agent intermediate work; Git ignore semantics already exclude ignored paths from ordinary status-based scope discovery; existing init and adopt ignore updates are additive and byte-preserving

## Invariants

- Never ignore the entire /tmp/ tree; never delete or rewrite existing scratch material automatically; never auto-change a task allowedFiles list; never make ignored scratch a required evidence location; preserve existing operational ignore entries and worktree safety; directory creation is idempotent and requires no tracked placeholder

## Required evidence

- Focused test output for repeated init and adopt; custom .gitignore and existing-file preservation; symlink and path-escape refusal; multi-worktree isolation; ignored-scratch scope and evidence regression

## Review questions

- Can the new ignore rule hide unrelated user files or an entire system temp path; can a symlinked scratch directory escape the repository; can ignored scratch still be attributed to a task or satisfy required evidence; does repeated adopt remain byte-preserving and idempotent; do multiple worktrees share state accidentally

## Counterexample searches

- Existing custom .gitignore with comments and CRLF; pre-existing tmp/apk file owned by the user; symlink from tmp/apk to an external directory; nested or linked worktree; scratch file created during an active task; tool requiring OS temp; adopt run twice

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document tmp/apk/ usage and boundaries in docs/task-system.md docs/context-system.md docs/adoption-flow.md and docs/decisions.md; update the generated agent instructions through the canonical exporter; update docs/progress.md when task state changes

## Notes

- At HEAD 77c8720 the operational ignore contract has no scratch entry and init creates no tmp directory; do not generalize this into a file sandbox; keep OS temp available for tools that need it.
- Tasks 0246, 0249, and 0250 also edit src/core/init/index.ts or src/core/docs/adopt.ts; Task 0223 shares generated dist and docs/decisions.md. These are merge-conflict boundaries, not API prerequisites, so sequence the shared edits or use a separate worktree instead of adding dependencies.
