# Task 0262 - Contain configured filesystem mutations within the repository

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: filesystem,containment,security,tasks,adoption,docs
Risk: high
Parallel: false
Depends on: none
Tags: p1,filesystem,containment,symlink,security,tasks,adoption

## Goal

Prevent task and docs filesystem mutations from escaping the repository through symlinked configured directories, ancestors, archive directories, task Markdown files, or adoption destinations, while preserving normal worktrees and valid nested directories.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/adoption-flow.md
- docs/decisions.md
- src/core/config/paths.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/docs/adopt.ts
- src/core/analytics/index.ts
- src/core/tasks/diagnostics.ts
- .tasks/0252-validate-configured-repository-paths.md
- .tasks/0261-fail-closed-on-invalid-config-in-compatibility-and-adoption.md

## Files allowed to edit

- src/core/config/paths.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/analytics/index.ts
- docs/task-system.md
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
- src/core/config/schema.ts
- src/core/config/compatibility.ts
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/backlog/**

## Steps

1. Reproduce escape on disposable fixtures for symlinked taskDirectory, symlinked intermediate ancestor, symlinked archive directory, symlinked task Markdown file, symlinked docs directory, and symlinked adoption destination; confirm external bytes are unchanged before the fix.
2. Add one shared filesystem containment helper in src/core/config/paths.ts that keeps lexical repositoryRelativeDirectoryIssue validation separate, resolves the real repository root, walks existing components with lstat, rejects symlinked ancestors and non-directory components, and allows missing directories with a documented residual TOCTOU boundary.
3. Apply containment before any task mutation: task create, claim/release/block/review/done/epoch/cancel transitions through the shared mutation lock, task archive, .apk.lock publication, and task Markdown writes.
4. Make task Markdown reads and updates refuse symlinked task files with an actionable diagnostic instead of following the link.
5. Apply containment to every apk adopt operation destination and honor configured docsDirectory for generated documentation; assert before writing each destination so a refusal creates no files.
6. Apply containment to configured docsDirectory writes in analytics summary.
7. Add regression tests to existing suites for default .tasks, custom contracts, nested work/tasks, symlinked task directory, symlinked ancestor, symlinked archive, symlinked Markdown, symlinked docs directory, symlinked adoption destination, dangling symlink, a normal Git linked worktree, a successful safe operation, and a refusal that preserves external bytes.
8. Document the containment boundary and residual TOCTOU window in docs/decisions.md, docs/task-system.md, and docs/adoption-flow.md; rebuild committed dist.

## Acceptance criteria

- No supported APK mutation writes or deletes outside the repository root through configured taskDirectory or docsDirectory paths.
- External symlink targets remain byte-identical after a refusal.
- Normal task lifecycle, creation, archive, and adoption still work with default and valid nested directories, including Git linked worktrees.
- Every containment check runs before mutation and fails closed without creating partial files.
- Symlinked task Markdown is never followed for reading or updating.
- Regression tests cover the listed filesystem entry points and pass.

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No implementation patch precedes a documented failing-signal attempt; objective reproduction limits stay explicit.
- No forced red test is required for unsupported, flaky, UI-only, or provider-dependent cases.
- The fix preserves behavior outside the reported defect.

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.

## Review questions

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does the fix address the root cause rather than only the symptom?

## Counterexample searches

- Search a UI-only defect, an intermittent race, an inaccessible provider, a host without a test framework, and an expensive reproducer.
- Search adjacent inputs, error paths, and repeated execution.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the shared lexical vs filesystem containment boundary and residual TOCTOU limit in docs/decisions.md.
- Document task-directory and task-file safety rules in docs/task-system.md.
- Document adoption destination containment in docs/adoption-flow.md.
- Update docs/progress.md when task state changes.

## Notes

- Previous corrective commit 546d0ae added a private assertTaskDirectoryContained in adoption only; ordinary task lifecycle still lacks an equivalent check.
- Keep repository-relative POSIX directory paths as the canonical config form; do not add an automatic symlink repair path.
