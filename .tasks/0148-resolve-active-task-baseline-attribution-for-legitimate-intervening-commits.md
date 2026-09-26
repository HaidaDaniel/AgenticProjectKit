# Task 0148 - Resolve active-task baseline attribution for legitimate intervening commits

State: doing
Owner: codex-0148
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: workflow,baseline,scope,attribution,verification,evidence,gate,provenance,tests,docs
Risk: high
Parallel: false
Depends on: 0116
Tags: bugfix,workflow,baseline,scope,attribution,provenance

## Goal

Add an explicit Git-lineage and attribution path for legitimate unrelated commits made while a task remains active or is temporarily released, while preserving Task 0116's anti-laundering invariant and failing closed whenever ownership cannot be proven safely.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/tasks/task.test.ts
- .tasks/0116-preserve-task-scope-attribution-across-release-and-reclaim.md
- .tasks/0117-enforce-successful-task-commit-hygiene.md
- .tasks/0121-document-candidate-and-completion-bookkeeping-commit-lifecycle.md
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- dist/**
- .tasks/0148-resolve-active-task-baseline-attribution-for-legitimate-intervening-commits.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .github/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/resources/**
- src/core/agents/**
- .tasks/archive/**

## Steps

1. Reproduce the current residual case in deterministic Git fixtures: an anonymous commit after A's baseline must fail closed, while a provenance-backed Task B commit from X to Y currently also fails closed without a safe attribution path.
2. Map existing baseline, handoff, candidate, worktree, HEAD, run/evidence provenance, commit-boundary, completion-bookkeeping, and provenance records to identify evidence sufficient for attribution.
3. Define a minimal explicit lineage/attribution model using Git history and existing provenance; do not introduce hidden ownership storage or choose a baseline solely because it makes verification pass.
4. Implement exclusion only for intervening commits proven by canonical APK provenance and Git lineage to belong to another bounded task candidate; retain bounded diagnostics or fail-closed behavior for anonymous, ambiguous, nonlinear, dirty, merged, same-file, or otherwise unsupported history.
5. Ensure verification and completion gate consume the same attribution result and candidate/evidence freshness remains unchanged.
6. Add a deterministic temporary-repository fixture suite for all required ownership, handoff, commit, merge, dirty-tree, and anti-laundering scenarios.
7. Run focused and full verification, rebuild committed dist, and update canonical workflow, provenance, and decision documentation.

## Acceptance criteria

- Task A claimed at X with only A's in-scope change remains attributable to A and can pass normal scope verification.
- Task A's out-of-scope change remains detected after any release, reclaim, or different-owner handoff.
- A legitimate Task B commit from X to Y is not attributed to active Task A merely because A's authoritative baseline is X.
- When Git lineage and existing provenance prove that an intervening commit belongs to B and is unrelated to A, A can verify without a false scope violation while B's files remain outside A's attribution.
- An anonymous or otherwise unproven intervening commit continues to fail closed.
- A commit or change-set is excluded from Task A attribution only when canonical APK provenance and Git lineage prove that it belongs to another bounded task candidate.
- Commit author identity, message text, timestamps, branch names, task filenames, or naming conventions alone never prove ownership or unrelatedness.
- A's own change remains attributable when followed by an unrelated B commit, including when the changes touch different files.
- Same-file or overlapping-file work is treated as ambiguous unless ownership can be proven safely; it never silently passes or silently becomes pre-existing.
- Release/reclaim laundering protections from Task 0116 remain intact for dirty and committed task-owned out-of-scope work.
- Different-owner handoff, tooling upgrade, completion-bookkeeping commit, dirty pre-existing work, committed unrelated work, and ordinary candidate freshness retain explicit deterministic semantics.
- Merge or nonlinear history is supported only if attribution is proven; otherwise a bounded fail-closed diagnostic identifies the unsupported condition.
- Verify, gate, and provenance expose the same bounded attribution or ambiguity result, including the relevant commit and file where available.
- No generic reset-baseline, manual allowed-scope expansion, force-done, or human-decision bypass is used to solve scope attribution.
- Candidate identity, evidence freshness, review binding, and completion-gate requirements remain unchanged except for correctly attributed file sets.

## Correctness assumptions

- Task 0116 correctly preserves the earliest authoritative baseline and prevents release/reclaim from laundering task-owned work, but currently fails closed on any intervening HEAD advance rather than attributing provably unrelated commits.
- Existing provenance records expose task participants, run/evidence identities, baseline HEAD, commit ranges, and repository activity but do not currently provide file-level ownership attribution for parallel commits.
- Git commit boundaries and existing task/run/evidence provenance are the preferred evidence; a second hidden ownership database is not justified unless the implementation proves existing evidence insufficient.
- The mere existence of a Git commit after A's baseline does not prove that the commit belongs to another task; anonymous or unproven commits remain fail-closed.
- Human decisions are not a general scope bypass and cannot authorize uncertain attribution.
- The repository may contain dirty unrelated edits, same-file overlap, merges, missing provenance, or unsupported history; those cases must not be overclaimed.

## Invariants

- A task-owned out-of-scope change cannot disappear by release, reclaim, handoff, baseline selection, or later unrelated commits.
- An unrelated committed change cannot be silently attributed to an active task solely because it is after that task's baseline.
- A Git commit is not considered unrelated merely because it has a different author, message, timestamp, branch position, task filename, or position after another task's baseline; exclusion requires deterministic canonical APK provenance or another explicitly defined repository proof linking the commit or change-set to another bounded task candidate.
- Ambiguous ownership fails closed with a bounded actionable diagnostic.
- Scope, candidate, evidence, review, and gate decisions use one coherent attribution result for the same evaluated state.
- Pre-existing dirty files unchanged after the first claim remain pre-existing.
- Task-owned and unrelated changes to the same file are never separated by guesswork.
- Completion bookkeeping remains excluded only where existing workflow semantics explicitly define it as bookkeeping; it cannot hide implementation changes.
- No reset, force bypass, manual allowed-scope expansion, or generic human decision weakens scope correctness.

## Required evidence

- Current-main reproducer output for the legitimate X to Y intervening-commit case showing the existing false block and its missing attribution path.
- Deterministic Git fixture result for an anonymous intervening commit that still fails closed.
- Deterministic Git fixture result for an APK-proven B commit on a separate file that may be excluded from A attribution.
- Deterministic Git fixture result showing an A-owned violation remains after a later proven B commit.
- Deterministic Git fixture result for A and B same-file overlap that fails closed unless ownership is proven deterministically.
- Deterministic Git fixture results for handoff, tooling upgrade, completion bookkeeping, dirty pre-existing, committed unrelated, and task-owned-then-unrelated scenarios.
- Negative fixtures showing a fake commit message mentioning another task and a different Git author alone do not establish ownership.
- Regression output proving Task 0116 dirty and committed release/reclaim laundering cases still fail scope closed.
- Merge/nonlinear-history and ambiguous-provenance results showing supported attribution or explicit fail-closed diagnostics.
- Verify, gate, and provenance output bound to the same baseline, candidate, worktree, and commit/file attribution.
- Typecheck, lint, focused tests, full tests, build, dist currency, and git diff checks for the committed candidate.

## Review questions

- What exact evidence proves a commit belongs to Task B rather than Task A?
- Does an anonymous intervening commit remain fail-closed rather than being guessed unrelated?
- Are canonical APK provenance and Git lineage both required before excluding B's separate-file change from A attribution?
- Are author, message, timestamp, branch, or task-name clues correctly rejected as ownership proof?
- Can the implementation both preserve A's old task-owned violation and exclude B's unrelated commit?
- What happens when A and B touch the same file, when B is a tooling upgrade, or when commit authors and registered agents differ?
- Does release/reclaim still preserve the 0116 anti-laundering behavior for dirty and committed changes?
- Do verify, gate, and provenance disagree about attributed files or lineage status?
- Are merge, dirty-tree, missing-provenance, and same-file cases fail-closed rather than inferred?
- Can human decisions, allowed-scope edits, or reset-baseline wording accidentally become a scope bypass?

## Counterexample searches

- A claims X, only A edits an allowed file, and A verifies before and after a normal handoff.
- A claims X, edits an out-of-scope file, releases, reclaims, and verifies with the file dirty.
- A claims X, commits an out-of-scope file, releases, reclaims, and verifies after the commit.
- A claims X, B commits an unrelated file X to Y while A is released, then A reclaims and verifies.
- An anonymous intervening commit appears after A's baseline with no canonical APK task provenance; A must fail closed.
- B has canonical APK provenance and commits a separate file; A may exclude B's change only when Git lineage also supports the link.
- A has an out-of-scope violation and B later makes a proven separate-file commit; A's violation remains visible.
- A changes an allowed file, B commits an unrelated file, and A verifies both changes together.
- A and B touch the same file in separate commits, with and without a common registered provenance identity.
- A remains active while a tooling or APK upgrade commit changes files outside and inside A's allowed scope.
- The task file or completion bookkeeping changes after the implementation candidate is reviewed.
- Pre-existing dirty unrelated files remain untouched while committed unrelated work is added.
- A merge commit, branch fast-forward, detached HEAD, missing parent, or nonlinear history appears between baseline and candidate.
- A fake commit message names another task, or a different Git author is the only ownership signal; neither establishes unrelatedness.
- Ambiguous attribution is presented to gate, status, and provenance and must not silently pass.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/tasks/task.test.ts"}`
- `{"id":"full-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"verification-report","type":"automated","required":true,"environment":"static","profile":"report","command":"pnpm exec apk task policy 0148"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/task-system.md with baseline lineage, commit attribution, ambiguity, and verify/gate/provenance behavior.
- Update docs/architecture.md with the selected use of Git lineage and existing provenance, including unsupported-history boundaries.
- Update docs/decisions.md with the attribution decision and explicit anti-laundering and fail-closed invariants.
- Update docs/progress.md when the implementation task changes status.

## Notes

- This is not a duplicate of Task 0116. Task 0116 fixed release/reclaim scope laundering and already has dirty, committed, handoff, and intervening-commit regressions; its current safe behavior marks any intervening HEAD advance ambiguous and blocks.
- Confirmed residual v0.4.6 behavior: the existing `intervening unrelated commits after release fail scope closed` test proves that legitimate unrelated X to Y work cannot be distinguished and A becomes blocked even when B's commit is otherwise attributable from repository/provenance evidence.
- Task 0121 documents candidate and completion-bookkeeping commit boundaries; this task must preserve those boundaries while adding only the missing ownership attribution path.
- Independent/fresh-context review is required by the high-risk policy; the implementation owner cannot certify its own attribution candidate.
- Keep every list element in this task file on one physical Markdown line until Task 0145 is implemented.
