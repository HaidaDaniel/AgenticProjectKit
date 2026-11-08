# Task 0275 - Contain remaining .agentic runtime mutations inside the repository

State: done
Owner: opencode-milestone
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: filesystem,containment,security,evidence,agents,config,locks,sessions,workspaces
Risk: high
Parallel: false
Depends on: none
Tags: p1,filesystem,containment,symlink,security,agentic

## Goal

Prevent every APK .agentic runtime mutation from escaping the repository through a symlinked .agentic directory or symlinked final component, while preserving normal worktrees, lock ownership, and lifecycle behavior.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/config/paths.ts
- src/core/tasks/evidence.ts
- src/core/tasks/lock.ts
- src/core/agents/index.ts
- src/core/tasks/index.ts
- src/core/work/session.ts
- src/cli/commands/task.ts
- .tasks/0265-contain-configured-task-and-docs-mutations-inside-the-repository.md
- .tasks/0266-publish-new-task-files-with-crash-safe-exclusive-linking.md
- .tasks/0268-contain-all-agentic-runtime-mutations-inside-the-repository.md

## Files allowed to edit

- src/core/config/paths.ts
- src/core/config/file.ts
- src/core/agents/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/index.ts
- src/core/tasks/review.ts
- src/core/tasks/dogfood.ts
- src/core/work/index.ts
- src/core/work/session.ts
- src/core/workspaces/index.ts
- src/core/perf/index.ts
- src/core/init/index.ts
- src/core/execution/calibrate.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/docs/**
- src/core/backlog/**
- src/cli/command-registry.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts

## Steps

1. Reproduce the confirmed escape on disposable fixtures: appendTaskEvidence through a symlinked .agentic, apk task lock recover --kind evidence deleting an external evidence lock, agent registration and run-log writes, config write, task-baseline append, and worker-session lock creation. Confirm external bytes are unchanged before the fix.
2. Use one shared .agentic containment helper in src/core/config/paths.ts built on the existing resolveContainedRepositoryPath mechanism; do not create a second independent validator.
3. Apply containment immediately before each .agentic mutation: evidence append and evidence lock, task baselines, agent registry and run logs, config writes, review/dogfood/work sessions, workspace records, perf runtime, and init .agentic writes. Reject symlinked ancestors, symlinked final components, and dangling links without following them.
4. Preserve the existing lock ownership protocol, automatic dead-owner recovery, and lifecycle behavior; a refusal must not create, delete, or modify external files or lock markers.
5. Add focused regression tests for the confirmed paths and every additional writer, including worker-session review-lock creation: symlinked .agentic, dangling .agentic, symlinked final file, normal worktree success, and unchanged external bytes after refusal.
6. Document the complete .agentic containment boundary and residual TOCTOU limit in docs/task-system.md and docs/decisions.md, update docs/progress.md, and rebuild committed dist.

## Acceptance criteria

- No APK .agentic runtime mutation writes, deletes, or renames outside the repository root through a symlinked .agentic directory, ancestor, or final component.
- External targets remain byte-identical after every refusal, including evidence append and evidence lock recovery.
- Normal evidence, task lifecycle, agent registration, run logging, config, session, workspace, and worker-lock behavior still works in a normal repository and Git linked worktree.
- Containment runs before mutation and fails closed without creating partial files; lock ownership and dead-owner recovery are not weakened.
- Regression tests cover the listed entry points including worker-session review locks and pass.

## Correctness assumptions

- The confirmed defect is reproducible with disposable fixtures and its implementation is retained in prior commit cc290a9.; A symlink swap after the pre-mutation check remains a residual TOCTOU limit that cannot be fully removed with Node core filesystem APIs.

## Invariants

- Every required mutation path is checked immediately before the write or delete.; No external file
- directory
- lock marker
- or pre-existing artifact is modified by a refusal.; Existing lock ownership
- evidence identity
- and task lifecycle semantics outside the containment boundary are preserved.

## Required evidence

- Pre-fix failing signal with disposable fixture output and post-fix regression output including worker-session lock containment.

## Review questions

- Was each mutation path checked immediately before the write or delete?|Does the fix reuse the shared containment mechanism instead of a second validator?|Are external bytes and lock ownership preserved on refusal?

## Counterexample searches

- Search a symlinked .agentic root
- a dangling .agentic link
- a symlinked final evidence/lock file
- a normal Git linked worktree
- and repeated recovery attempts.|Search an external target that already exists and one that does not exist.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts src/cli/cli.test.ts"}`
- `{"id":"containment-report","type":"automated","required":true,"environment":"local","profile":"report","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts src/cli/cli.test.ts","evidenceRef":"tmp/apk/agentic-containment.txt"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the .agentic containment boundary and residual TOCTOU limit in docs/task-system.md and docs/decisions.md.
- Update docs/progress.md when task state changes.

## Notes

- Predecessor Task 0268 was canceled after its claim baseline predated the milestone planning commit and its Allowed Files omitted src/core/work/session.ts. The retained implementation is commit cc290a9.
- Confirmed before the fix: a disposable repository with .agentic symlinked to an external directory allowed appendTaskEvidence to write external evidence.jsonl and apk task lock recover --kind evidence --force to delete an external evidence.append.lock.
- Keep the change mechanical and reuse resolveContainedRepositoryPath; do not build a general filesystem framework.
