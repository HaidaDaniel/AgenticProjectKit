# Task 0266 - Publish new task files with crash-safe exclusive linking

State: done
Owner: opencode-final-corrective
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: tasks,filesystem,exclusive-write,concurrency,crash-safety
Risk: high
Parallel: false
Depends on: 0265
Tags: p2,tasks,exclusive-create,crash-safety,filesystem

## Goal

Replace direct exclusive file writing for new tasks with a same-directory temporary file and hard-link-based exclusive publication so no existing target is replaced and no partial final Markdown appears after failure, without losing the exclusive-create guarantee.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/tasks/lock.ts
- .tasks/0254-create-task-files-exclusively.md
- .tasks/0255-write-task-lifecycle-updates-atomically.md

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
- src/core/config/**
- src/core/docs/**
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/tasks/workflow.ts

## Steps

1. Confirm the current writeTaskFile temp-file plus rename protocol and the createTaskFileExclusive writeFile wx behavior, and inspect existing task creation tests.
2. Create the new task Markdown in a same-directory temporary file with an exclusive flag, fully write it, sync the file contents when available, and close it before publication.
3. Publish the temporary file only when the target is absent, using a hard-link-based exclusive publication that cannot replace an existing target; do not use ordinary rename for exclusive creation.
4. Fail closed with an actionable diagnostic for unsupported hard-link publication (EPERM, EOPNOTSUPP, ENOSYS, or EXDEV) instead of silently downgrading to an overwrite-capable operation.
5. Map EEXIST publication collisions to TaskCreateError, preserve the existing target bytes, and clean the temporary file on every failure path.
6. Preserve canonical task ID allocation, the task mutation lock, and retry semantics.
7. Add tests for successful publication, collision before creation, target appearing after the precheck, temporary-file write failure, exclusive publication failure, temp cleanup, absence of partial final Markdown, external target preservation, unchanged task ID allocation, retry after refusal, and fail-closed unsupported publication; use injectable operations only for failure paths.
8. Document the publication protocol and state the durability boundary honestly without claiming directory fsync durability that is not implemented; rebuild committed dist.

## Acceptance criteria

- A newly created task file never overwrites an existing target and never appears partially written after a failed publication.
- Temporary files are removed on every write failure, publication failure, and collision.
- Unsupported exclusive publication fails closed without an overwrite-capable rename fallback.
- A collision preserves existing target bytes and returns an actionable TaskCreateError.
- Canonical task ID allocation and mutation lock behavior remain correct under sequential creation and collision retry.
- Tests cover the required failure and success scenarios and pass.

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
- `{"id":"exclusive-publication-report","type":"automated","required":true,"environment":"local","profile":"report","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts","evidenceRef":"tmp/apk/exclusive-publication-tests.txt"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document exclusive task publication and its durability boundary in docs/task-system.md.
- Update docs/progress.md when task state changes.

## Notes

- writeTaskFile already uses a same-directory temp file plus rename for updates; this task changes new-file creation only.
- Do not claim fsync directory durability unless it is actually implemented and tested.
