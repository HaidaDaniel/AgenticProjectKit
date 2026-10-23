# Task 0236 - Expose tracked APK operational artifacts in doctor with migration guidance

State: done
Owner: codex-fixes-0236
Mode: maintenance
Lane: diagnostics
Type: feature
Scope: doctor,git-hygiene,adoption
Risk: medium
Parallel: false
Depends on: 0234,0235
Tags: p2,git-hygiene,diagnostics

## Goal

Reuse the existing init/adopt operational-artifact detector in doctor and enrich its bounded read-only report with counts; indexed byte sizes and safe manual migration guidance without removing or untracking any file.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts

## Files allowed to edit

- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- docs/adoption-flow.md
- docs/task-system.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**
- package.json
- src/core/tasks/**
- .gitignore

## Steps

1. Reproduce tracked agent JSON and run JSONL files that remain tracked after canonical ignore entries are added. Confirm existing init/adopt warnings before adding another diagnostic surface.
2. Reuse the existing operational path policy and detector; keep intentional .gitkeep files excluded and distinguish runtime records from generated documentation already present in the policy.
3. Read tracked paths with NUL-safe Git output and obtain bounded indexed blob sizes without following worktree symlinks or exposing record contents. Label the size metric and distinguish index data from current worktree bytes.
4. Report exact counts and bytes for fully inspected groups with a bounded path sample. On limits; Git failure or inaccessible objects report incomplete/unknown coverage instead of silently reporting zero artifacts.
5. Surface the same findings in doctor and init/adopt diagnostics. Preserve existing compatibility where possible; ordinary warnings must not claim that tracked operational state is itself a failed completion gate.
6. Document manual migration: inventory and back up needed local evidence; decide which records must remain portable; check ignore rules; preview exact path-specific git rm --cached commands; review the index and commit deliberately. Explain that ignore rules do not untrack files and untracking does not erase past history.
7. Add regressions for tracked versus ignored-untracked files; .gitkeep; staged deletion; symlinks; unusual names; Git failure; limits and unchanged index/worktree.

## Acceptance criteria

- Doctor detects already-tracked operational artifacts and reports category counts plus clearly defined indexed byte totals; init/adopt retain equivalent detection.
- Reports distinguish agent records; run logs; evidence/baselines/reviews/sessions and generated docs rather than implying every matched path is a run log.
- Canonical ignored but untracked files and .gitkeep placeholders do not inflate tracked-artifact counts.
- Non-Git roots are explicit not-applicable outcomes; Git failures and bounded partial scans cannot masquerade as a clean zero result.
- No command changes tracking; deletes files; edits .gitignore; copies secrets or rewrites history. Diagnostics print metadata and bounded paths rather than file contents.
- Migration guidance preserves access to local task evidence and explains the portability tradeoff with unfinished work.

## Correctness assumptions

- Committing operational state may be intentional; a warning is not permission to remove it.
- The existing detector already solves basic init/adopt discovery; the missing work is doctor visibility and trustworthy bounded statistics.

## Invariants

- Never execute git rm; git reset; git add or cleanup on the user repository.
- No runtime-record content in reports and no symlink traversal outside the repository.
- Do not change evidence freshness; ownership; lifecycle state or gate policy.

## Required evidence

- Synthetic before/after doctor and adoption outputs with known blob sizes and category counts.
- Index/worktree snapshots proving inspection is read-only; partial/error coverage regressions.

## Review questions

- Are totals exact for the claimed scope and explicitly incomplete when bounded?
- Can an inspection error be mistaken for absence of tracked operational files?
- Does the proposed migration preserve local evidence and distinguish untracking from erasing history?

## Counterexample searches

- Tracked file now matching .gitignore; untracked ignored log; tracked .gitkeep; staged deletion; index/worktree size mismatch.
- Path containing spaces or newline; symlink blob; Git worktree; oversized log inventory; unreadable object; unavailable Git.
- Repository tracking generated docs but no agent/run logs; intentionally portable evidence.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/init/init.test.ts src/core/doctor/doctor.test.ts src/core/docs/adopt.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the doctor report and manual migration precautions in docs/adoption-flow.md and docs/task-system.md.
- Update docs/progress.md when task state changes.

## Notes

- Planning requested by the operator after the read-only downstream audit on 2026-10-20 at APK commit 5891ca51e9b9b7848a4d3237517b1d1ca6052ba0. This contract authorizes only its own future scope; no implementation is claimed.
- Use synthetic disposable repositories. Do not modify downstream repositories or infer consent for their migration.
- Parallel is false. Shared source files and docs/progress.md require sequential work in this checkout; separate worktrees and explicit integration are required for concurrent mutable work. Do not claim while another doing or review task owns this checkout.
- Commit the final candidate before canonical verification. Run the declared verification set once per unchanged candidate; do not prepend overlapping full-suite or release checks.
- Priority P2. Audit confirmed MarketPulse had 10 tracked agent JSON files and 15 run logs; ResLedger and translator-agent had zero of those two groups. ai-bench; InfoWarden and RigOps counts were not independently verified in this environment.
- The existing inspectApkGitignore result already warns through init/adopt and recommends manual git rm --cached. Do not describe this task as introducing tracking detection from scratch.
- Depends on 0234 and 0235 to serialize shared doctor/adoption integration. Portable handoff research 0237 is separate and does not authorize automatic evidence migration.
