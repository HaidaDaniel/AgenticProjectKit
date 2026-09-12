# Task 0117 - Enforce successful task commit hygiene

State: doing
Owner: opencode-ds-v41
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: docs,agent-instructions,workflow,commit-hygiene
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Establish a canonical agent workflow rule that a successfully completed task must not be handed back with uncommitted task-owned changes.

Current canonical `AGENTS.md` requires claim / verify / review / gate / done but does not require a Git commit. The worker contract only says to include `commitIds` when available, so agents legitimately sometimes complete a task while leaving the repository dirty. Fix the canonical generated agent instructions so successful task completion includes explicit safe commit hygiene. APK itself must NOT become a Git auto-committer.

Successful task semantics:

- Task-owned implementation/fix changes must be committed rather than left as uncommitted working-tree state.
- Terminal task bookkeeping generated during the final workflow step must also not be left as unexplained uncommitted task-owned state.
- The final handoff must clearly report the resulting commit SHA(s).
- If there are no task-owned changes requiring a commit, do not create an empty commit merely to satisfy the rule.

Commit safety semantics:

- The agent must NOT blindly run `git add -A` or otherwise absorb unrelated or pre-existing dirty state.
- It must stage only files attributable to the current task or otherwise explicitly prove the staged set is safe.
- Pre-existing and unrelated dirty changes must remain untouched.
- Never discard unrelated user changes, include unrelated files in the task commit, rewrite unrelated history, force-push, or amend somebody else's commit unless explicitly requested by the user and allowed by repository policy.

Failed/non-terminal task semantics:

- Do NOT require a final completion commit when the task is blocked, released unfinished, failed, canceled, still under changes_requested/fix, or otherwise not successfully completed.
- A deliberate checkpoint commit may still be made when repository or user policy explicitly requires it, but that is separate from the successful-completion invariant.

Workflow ordering:

- Do not encode an ordering that weakens APK candidate/review/evidence semantics.
- Inspect the existing candidate, verification, review, gate, and `done` behavior before finalizing wording.
- Required invariant: a task must not be reported as successfully finished while task-owned changes that should be persisted are merely left uncommitted.
- If implementation/fix changes need to be committed before final review/gate so review is bound to the committed candidate, document that.
- If `apk done` itself creates only excluded workflow bookkeeping that requires a final bookkeeping commit, document that distinction explicitly.
- The contract must distinguish reviewed implementation candidate, terminal APK bookkeeping, and final repository cleanliness. Do not blindly say "always run git commit after `apk done`" if doing so would invalidate or misrepresent candidate-bound evidence.

Failure to commit:

- If commit creation fails because of a hook failure, merge/index conflict, missing Git identity, permissions, repository state, or another safety issue, the agent must not falsely report the task as fully handed off/complete.
- Report the blocker explicitly.
- Do not bypass hooks with `--no-verify` unless explicitly allowed by user/repository policy.

Expected instruction semantics (exact wording may differ to match project style): before handing a successfully completed task back, ensure all task-owned changes are committed; stage only task-attributed files; never absorb unrelated or pre-existing dirty state; report the resulting commit SHA; do not create an empty commit when there are no task-owned changes; and do not claim successful handoff if a required commit cannot be created safely.

Source-of-truth requirement: do not patch only the checked-in generated `AGENTS.md`. Find the canonical neutral source that populates the `taskRules` rendered by `src/core/templates/exporters/agents.md.hbs` (expected: `src/core/exporters/index.ts` `DEFAULT_AGENT_POLICY.taskRules`), update that source, and regenerate or sync `AGENTS.md` through the normal APK export/sync mechanism so generated exports stay consistent. Preserve the thin CLAUDE/GEMINI architecture and the direct Codex/OpenCode `AGENTS.md` semantics with no duplicated full-policy files.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/delivery/gated-workflow-release-evidence.md
- src/core/templates/exporters/agents.md.hbs
- src/core/exporters/index.ts
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts
- src/core/tasks/workflow.ts

## Files allowed to edit

- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- AGENTS.md
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/resources/**
- src/core/workspaces/**
- src/core/tasks/**
- .github/workflows/**

## Steps

1. Locate the canonical neutral source that populates `taskRules` for the `AGENTS.md` exporter and confirm how `AGENTS.md` is generated and synced.
2. Inspect candidate, verification, review, gate, and `done` behavior to place the commit-hygiene rule without weakening candidate-bound evidence.
3. Add the successful-task commit-hygiene rule to the canonical neutral source.
4. Regenerate or sync `AGENTS.md` through the normal APK export/sync mechanism so generated exports stay current and drift-free.
5. Document the distinction between the reviewed implementation candidate, terminal APK bookkeeping, and final repository cleanliness in docs.
6. Add bounded regression coverage that the canonical source and generated `AGENTS.md` carry the rule and that sync does not drift.
7. Run verification.

## Acceptance criteria

- canonical generated agent policy explicitly requires safe commit hygiene for successfully completed tasks.
- implementation/fix work is not routinely left uncommitted at successful handoff.
- task-owned files only are staged or committed.
- unrelated or pre-existing dirty files are never silently included.
- empty commits are not required.
- blocked/released/canceled/failed tasks are not falsely treated as successfully completed.
- commit SHA(s) are reported in the final handoff.
- commit failure is surfaced rather than hidden.
- wording is compatible with candidate-bound verify/review/gate semantics.
- APK does not automatically run Git commit itself.
- generated `AGENTS.md` and exports remain canonical and drift-free.
- no duplicate full-policy files are introduced for Codex or OpenCode.

## Correctness assumptions

- `AGENTS.md` is generated from the neutral `taskRules` in `src/core/exporters/index.ts` through `src/core/templates/exporters/agents.md.hbs`.
- candidate-bound review/gate evidence is created through `apk task verify`, `apk review`, and `apk task gate` before or during `apk done`.
- `apk done` writes only excluded workflow bookkeeping (task state, run and evidence records) that is not implementation work.
- the worker contract currently mentions `commitIds` only when available, which permits successful completion with a dirty repository.

## Invariants

- APK never automatically runs `git commit`, `git add`, `git push`, or `git rm`.
- unrelated or pre-existing dirty state is never silently committed, discarded, or rewritten.
- no empty commit is required when a task has no task-owned changes.
- no force-push and no `--no-verify` unless explicitly allowed by policy.
- candidate freshness and review/evidence binding are not weakened.
- generated exports remain canonical and drift-free; thin adapters and direct `AGENTS.md` semantics are preserved.

## Required evidence

- regression test output proving the canonical source and generated `AGENTS.md` contain the successful-task commit rule, that sync is drift-free, and that the rule protects unrelated/pre-existing dirty state and does not require empty commits.

## Review questions

- Is the commit-hygiene rule generated from the neutral policy source rather than patched only in root `AGENTS.md`?
- Does the wording avoid misrepresenting candidate-bound review/evidence and refuse to claim success if a required commit fails?
- Does the rule scope to successful completion rather than blocked/released/canceled/failed tasks?
- Does the rule protect unrelated and pre-existing dirty state and forbid empty commits?

## Counterexample searches

- repository with unrelated pre-existing dirty files present at handoff
- task with no task-owned changes
- task blocked, released unfinished, canceled, or failed
- hook failure, missing Git identity, or index conflict during commit
- commit attempted after `apk done` when review/gate evidence is already candidate-bound
- an agent running `git add -A`

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/task-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Do not make APK an automatic Git committer; do not add a generic Git transaction manager, auto-push, daemon, branch-protection change, or squash/amend policy.
- One top-level successfully completed task may contain one or more commits when legitimately needed; the invariant is that its task-owned final changes are committed and identifiable.
- Keep the change bounded to canonical generated instructions and their tests.
