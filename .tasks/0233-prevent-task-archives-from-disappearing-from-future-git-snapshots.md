# Task 0233 - Prevent task archives from disappearing from future Git snapshots

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: tasks,archive,git,lint
Risk: high
Parallel: false
Depends on: none
Tags: p1,archive,git,data-preservation

## Goal

Reject task archive destinations excluded by effective Git ignore rules before moving any task bytes; expose the same conflict through read-only contract lint without changing Git tracking or historical task content.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- src/core/tasks/index.ts
- src/core/audit/lint.ts
- src/core/tasks/task.test.ts
- src/core/audit/lint.test.ts
- src/cli/command.test.ts

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/archive-git-safety.ts
- src/core/tasks/task.test.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/cli/command.test.ts
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**
- package.json
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts

## Steps

1. Reproduce in a disposable Git repository: commit a valid terminal task and an ignore rule for .tasks/archive/; run preview and apply; inspect git add -A and the new tree. Preserve evidence that only the source deletion is staged while the previous commit still contains the task.
2. Add one bounded shared read-only destination check using effective Git rules including repository ignores; .git/info/exclude; configured global excludes; negations and custom task directories. Use argument arrays and NUL-safe path handling rather than a shell or handwritten ignore matching.
3. Preview must report the destination and matching ignore source or a bounded actionable reason. Apply must recheck under the existing mutation lock before moving each task; inability to establish safety inside Git must not count as permission.
4. Preserve single-task refusal and deterministic --all skip semantics. Detect changed ignore rules between preview and apply. Retain existing byte preservation; reference protection; collision checks and rollback behavior.
5. Add a non-mutating lint diagnostic for effective ignored archive destinations of terminal tasks and existing archive contracts. Distinguish an intentional non-Git repository from an unavailable or failed Git inspection; document no-Git behavior without claiming clone portability.
6. Prove the safe path with an actual archive commit and fresh local clone; prove ignored destinations leave the source in place and never mutate the Git index. Add focused regressions and document manual remediation.

## Acceptance criteria

- With .tasks/archive/ ignored the preview marks the move unsafe and apply fails before removing the source; --all skips unsafe entries with reasons while retaining deterministic safe moves.
- Ignored destinations created by .git/info/exclude and a fixture-scoped global excludes file receive equivalent protection. Nested ignore rules and valid unignore rules are evaluated by Git.
- A non-ignored archived task remains byte-identical and exists in a fresh clone after the operator stages and commits the move.
- Git inspection errors inside a worktree are explicit unknown or blocked outcomes; no-Git operation retains documented filesystem-only behavior.
- Lint exposes the conflicting destination and remediation without moving files; changing ignore rules; staging paths or rewriting history.
- Existing reference and collision safeguards remain intact and source tests plus committed package output include the fix.

## Correctness assumptions

- Previously committed task bytes remain recoverable from Git history; this defect loses the task from future snapshots rather than erasing history.
- Ignoring an untracked destination is enough to lose the archived file from the next ordinary commit.

## Invariants

- Never run git add -f or git rm on behalf of the user. Never auto-edit ignore rules.
- No changes to task bytes; evidence; baselines; completion policy or Git history.
- Bound subprocess output and inspection work; unknown safety is not a pass.

## Required evidence

- Pre-fix preview/apply and staged deletion observations plus post-fix refusal and safe fresh-clone assertions.
- Regression outputs for repository; local and global ignores; negations; custom paths; Git failure and no-Git mode.

## Review questions

- Can any effective ignore rule allow a source deletion without a portable archive?
- Can preview/apply races or Git command failures bypass the check?
- Do lint and archive use the same destination semantics without changing the index?

## Counterexample searches

- Ignored parent directory with a descendant negation that cannot actually unignore the file.
- Custom task directory; spaces or Unicode in paths; non-Git root; linked Git worktree; Git unavailable.
- Ignore configuration changes after preview; destination collision; unreadable global excludes; mixed safe and unsafe --all candidates.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts src/core/audit/lint.test.ts src/cli/command.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document ignored-destination refusal and manual repair in docs/task-system.md.
- Update docs/progress.md when task state changes.

## Notes

- Planning requested by the operator after the read-only downstream audit on 2026-10-20 at APK commit 5891ca51e9b9b7848a4d3237517b1d1ca6052ba0. This contract authorizes only its own future scope; no implementation is claimed.
- Use synthetic disposable repositories. Do not modify downstream repositories or infer consent for their migration.
- Parallel is false. Shared source files and docs/progress.md require sequential work in this checkout; separate worktrees and explicit integration are required for concurrent mutable work. Do not claim while another doing or review task owns this checkout.
- Commit the final candidate before canonical verification. Run the declared verification set once per unchanged candidate; do not prepend overlapping full-suite or release checks.
- Priority P1. ResLedger .gitignore line 37 ignored .tasks/archive/ at audit time; no actual lost task was established. The synthetic CLI experiment reproduced successful unsafe archive and a deletion-only staged diff.
- Task 0218 concerns historical provenance recovery; this task prevents future archive omissions and neither depends on nor implements that research.
- Source/test overlap with Tasks 0223 and 0224 requires sequencing or separate worktrees; do not expand into epoch compatibility or status diagnostics.
