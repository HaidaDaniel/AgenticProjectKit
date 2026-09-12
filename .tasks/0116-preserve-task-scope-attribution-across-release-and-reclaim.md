# Task 0116 - Preserve task scope attribution across release and reclaim

State: done
Owner: opencode-ds-v41
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: tasks,baseline,scope,verification,evidence,gate,workflow
Risk: high
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Fix a generic lifecycle integrity problem where release followed by reclaim silently rebases scope attribution to a newer baseline.

Current v0.4.2 behavior captures a task baseline on every claim (`captureTaskBaseline(...)`) and `readTaskBaseline(task)` selects the latest baseline. Scope attribution then treats dirty files that already existed unchanged in the new baseline as `preExistingFiles` rather than task-attributed files. This sequence can launder a scope violation: claim task; create or modify an out-of-scope file; verify correctly fails; optionally commit or leave the change present; release task; claim same task again; the new baseline absorbs prior task changes; verify may pass because those files are now pre-existing.

ResLedger dogfood showed a real suspicious sequence: `claim 0001`, repeated `verify FAIL`, `release 0001`, `claim 0001`, `verify PASS`, `review`, `done`, while task 0001 allowed only narrow planning/documentation scope but substantial repository bootstrap changes already existed. Fix the generic lifecycle problem; do not hardcode ResLedger-specific logic.

Canonical invariant: a lifecycle transition must not make previously task-attributed work disappear from scope attribution. In particular `release -> reclaim` must not reset the authoritative implementation baseline for the same unfinished task. Inspect equivalent lifecycle paths such as `doing -> release -> todo -> claim`, `review -> release -> todo -> claim`, and `blocked -> release -> todo -> claim`. Do not assume only the same owner reclaims the task.

Desired semantics: establish one authoritative scope baseline for an unfinished task lifecycle. The first valid claim establishes it. Subsequent release/reclaim/handoff operations for that same unfinished task must preserve scope attribution to that original authoritative baseline rather than silently rebasing to current dirty or committed state. A new agent owner may claim the task, but ownership transfer must not erase the scope history. Task metadata may change legitimately; changing task allowed scope does not rewrite history. Do not weaken candidate freshness or evidence binding.

Important legitimate behavior to preserve: files that were already dirty before the first claim and remain unchanged must still be recognized as pre-existing and excluded from task attribution. But a file that was clean before the first claim and is modified by the task must remain task-attributed after release/reclaim.

Backward compatibility: existing append-only baseline files may contain multiple baseline records for one task because old APK versions captured on every claim. Define deterministic compatibility semantics. Do not silently select the newest baseline merely because it is newest; preserve the earliest valid authoritative lifecycle baseline unless repository evidence proves a distinct new task lifecycle, and surface ambiguity diagnostically or fail closed if history cannot be interpreted safely. Do not invent a complex migration framework unless required.

Intervening unrelated work: while a task is released, another task, human, or agent may legitimately advance the repository from X to Y and change unrelated files. Reclaiming the first task must neither silently rebase it and launder its previous task-owned changes, nor blindly attribute all unrelated X to Y repository changes to that task. Release/reclaim must preserve task attribution history without silently laundering previous task work or silently attributing unrelated intervening work to the task. If APK cannot safely distinguish lineage from existing repository evidence, it must fail closed with an explicit bounded ambiguity/intervening-changes diagnostic rather than choosing whichever baseline makes verification pass. This must not be implemented as naive earliest-baseline attribution of every subsequent repository commit.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/gate.ts
- src/core/tasks/evidence.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/gate.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/workspaces/**
- src/core/resources/**
- .github/workflows/**

## Steps

1. Reproduce baseline laundering: claim a task, create a dirty out-of-scope file, verify fails, release, reclaim, and observe the file classified as pre-existing.
2. Reproduce the committed case: initial claim at HEAD A; task makes an out-of-scope change; the change is committed as HEAD B; release; reclaim; the verifier must still compare against authoritative baseline A so the out-of-scope committed change remains visible.
3. Reproduce the dirty working-tree case: initial claim; dirty out-of-scope change; release; reclaim; the unchanged dirty file must not become pre-existing.
4. Reproduce the different-owner handoff: agent A claims and works; releases; agent B claims; the scope baseline remains authoritative across the handoff.
5. Reproduce the blocked path: claim; change; block; release; claim; scope history is not reset.
6. Establish one authoritative scope baseline for an unfinished task lifecycle; do not rebase on release/reclaim.
7. Preserve legitimate pre-existing behavior: dirty before the first claim and unchanged stays pre-existing.
8. Define deterministic compatibility semantics for existing multiple-baseline history; fail closed on uninterpretable history.
9. Ensure the completion gate uses the same authoritative scope baseline with no force bypass and unchanged candidate/evidence freshness.
10. Reproduce intervening unrelated work: claim A at X; release A; unrelated task B advances X to Y and changes unrelated files; reclaim A; attribution must not launder A's old changes and must not silently own all of B's changes; if lineage is ambiguous, fail closed with an explicit diagnostic.
11. Add regression tests for scenarios 1-13 and run verification.

## Acceptance criteria

- the first claim creates the authoritative baseline.
- release/reclaim does not replace it.
- same-owner reclaim preserves the baseline.
- different-owner reclaim preserves the baseline.
- a task-created dirty out-of-scope file cannot become pre-existing.
- a committed out-of-scope change cannot disappear after reclaim.
- a legitimately pre-existing dirty file present before the first claim remains pre-existing.
- in-scope work remains attributable after reclaim.
- blocked then release then claim cannot reset attribution.
- old multiple-baseline history is handled deterministically and safely.
- the gate cannot pass solely because reclaim changed the selected baseline.
- baseline and evidence candidate identities remain coherent.
- unrelated repository advancement while a task is released cannot silently reset authoritative task attribution.
- unrelated intervening work cannot silently become task-owned merely because the original task retains its historical baseline.
- ambiguous lifecycle lineage fails closed explicitly.
- no convenient latest-baseline selection.
- no naive earliest-baseline attribution of every subsequent repository commit.

## Correctness assumptions

- v0.4.2 captures a baseline on every claim and `readTaskBaseline` selects the latest, so release/reclaim can rebase scope attribution.
- ResLedger dogfood showed claim, repeated verify FAIL, release, claim, verify PASS, review, done for a narrow-scope task while substantial bootstrap changes were present.
- existing append-only baseline files may contain multiple baseline records for one task because old APK versions captured on every claim.
- while a task is released, unrelated work may legitimately advance HEAD and change unrelated files.

## Invariants

- prior verification evidence still follows candidate/baseline freshness rules.
- reclaim must not make stale or failing evidence current.
- the completion gate must use the same authoritative scope baseline and has no force bypass.
- malformed or ambiguous baseline history fails closed rather than choosing a convenient newer baseline or attributing unrelated intervening commits to the task.
- candidate freshness and evidence binding are not weakened.
- ownership transfer does not erase scope history.
- files dirty before the first claim and unchanged remain pre-existing.

## Required evidence

- old-behavior reproducer result plus regression test output for scenarios 1-13.
- gate behavior when reclaim would otherwise change the selected baseline, including the intervening unrelated-work case.

## Review questions

- Does release/reclaim preserve the authoritative baseline for an unfinished task?
- Can a task-created file become pre-existing after reclaim?
- Does ownership transfer reset scope attribution?
- Is multiple-baseline history interpreted deterministically and safely?
- Do candidate and evidence identities remain coherent?
- Can unrelated intervening repository advancement be silently laundered into or out of task attribution?

## Counterexample searches

- clean before first claim then task modifies then release/reclaim
- dirty before first claim and unchanged
- committed out-of-scope change after the first claim
- different-owner reclaim
- blocked then release then claim
- review then release then claim
- old multiple-baseline history
- malformed or ambiguous baseline history
- claim A at X; release A; unrelated task B advances X to Y; reclaim A; attribution neither launders A's old changes nor owns all B changes

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"scope-attribution-behavior","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Externally observe and record the release/reclaim reproducers: a task-created dirty out-of-scope file cannot become pre-existing; a committed out-of-scope change remains visible after release/reclaim; same-owner and different-owner reclaim preserve the authoritative baseline; blocked then release then claim does not reset attribution; dirty files present before the first claim remain pre-existing; the gate cannot pass solely because reclaim changed the selected baseline.","evidence":"bounded observed command output plus gate results"}`

## Documentation updates

- docs/task-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Keep the fix narrow; do not add a force bypass or weaken candidate freshness.
- Do not touch execution, workspaces, or resources unless an unavoidable compile dependency is demonstrated.
