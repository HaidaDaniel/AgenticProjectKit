# Task 0115 - Distinguish hosted CI evidence from local runs of environment ci checks

State: todo
Owner: none
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: verification,evidence,gate,docs
Risk: high
Parallel: false
Depends on: none
Tags: evidence,ci

## Goal

Distinguish hosted CI evidence from a local `apk task verify` run of a check declared `environment: ci` so a local run cannot be mistaken for hosted CI proof and hosted CI evidence is explicit, candidate-bound, and provider-neutral.

Canonical semantics to establish:

1. `environment: ci` means an external CI environment. A generic local `apk task verify <task>` must not manufacture hosted-CI proof. Until APK has a trusted provider-neutral hosted execution context, `environment: ci` is treated as externally observed for authoritative CI evidence. Local diagnostic execution may remain useful, but its evidence must not be typed or counted as hosted `ci` evidence.
2. There must be an explicit, candidate-bound path to record a hosted CI outcome: registered/authorized owner as appropriate, exact task, exact current candidate, bounded external evidence reference, pass/fail, append-only evidence. No GitHub/GitLab/vendor API coupling; the reference may be a URL or string supplied by the user/agent.
3. Local diagnostics and authoritative CI proof stay distinct: local command execution is automated/local diagnostic evidence; an externally observed hosted CI result is `ci` evidence. The same local verifier must not implicitly upgrade one into the other.
4. A current hosted-CI PASS on an unchanged candidate must not be silently invalidated or shadowed by a later ordinary local verify of the same candidate.
5. If the implementation candidate changes, previously recorded hosted CI evidence becomes stale normally; candidate freshness is not weakened.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/index.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts

## Files allowed to edit

- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/index.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/work/**
- .github/workflows/**

## Steps

1. Establish the canonical semantics: `environment: ci` is externally observed and a generic local verify cannot manufacture hosted-CI proof.
2. Add an explicit candidate-bound recording path for hosted CI outcomes with a bounded external reference; keep it provider-neutral.
3. Keep local diagnostics and authoritative CI proof distinct: local execution is automated/local diagnostic evidence, externally observed hosted CI is `ci` evidence.
4. Preserve a current hosted-CI PASS across a later local verify of the unchanged candidate; keep candidate changes invalidating CI evidence.
5. Regression A: environment `ci` check with local verify produces no authoritative `ci` PASS and the hosted-CI requirement stays unsatisfied.
6. Regression B: an explicit hosted CI record PASS on the exact candidate is recognized by the gate.
7. Regression C: an explicit hosted CI PASS followed by an ordinary local verify on the same candidate keeps the hosted CI PASS authoritative and current.
8. Regression D: an explicit hosted CI PASS followed by a candidate change makes the prior record stale and blocks the gate.
9. Regression E: a local execution PASS with no hosted record blocks the gate when hosted CI is required.
10. Regression F: a hosted CI FAIL blocks the gate.
11. Add regression tests and run verification.

## Acceptance criteria

- Local `apk task verify` cannot create gate-eligible hosted-CI evidence merely from a check declared `environment: ci`.
- Hosted CI PASS/FAIL can be explicitly recorded with a bounded external reference and exact candidate binding.
- The completion gate accepts only current authoritative hosted-CI evidence when CI evidence is required.
- A local diagnostic PASS for the same CI command does not satisfy a hosted-CI requirement.
- A later local verify on an unchanged candidate does not shadow or invalidate an existing current hosted-CI PASS.
- Changing the candidate makes the prior hosted-CI record stale.
- Missing, stale, failed, pending, or unavailable hosted CI does not satisfy the requirement.
- No GitHub/GitLab/vendor coupling is introduced.

## Correctness assumptions

- `environment: ci` denotes an external CI environment; a local execution cannot prove the hosted CI result.
- Local verification currently records `environment: ci` checks with the hosted `ci` evidence type and can make them gate-eligible.

## Invariants

- Candidate-bound freshness and append-only evidence semantics are unchanged.
- Hosted CI evidence requires an explicit candidate-bound record.
- Local deterministic checks still run and remain required.
- No GitHub/GitLab/vendor coupling or CI service dependency is added.

## Required evidence

- Regression test output for scenarios A-F.
- Gate behavior when hosted CI evidence is missing, stale, failed, pending, unavailable, or when only a local diagnostic PASS exists.

## Review questions

- Can any local verifier path still emit gate-eligible hosted-CI proof?
- Can a later local/unavailable diagnostic shadow a valid current hosted-CI PASS?
- Does candidate mutation still invalidate hosted CI normally?
- Is the recording API provider-neutral and bounded?

## Counterexample searches

- `environment: ci` check executed locally.
- Recorded CI evidence on a stale candidate.
- Missing CI record with a local diagnostic PASS.
- Mixed-revision candidate.
- Automated check passing locally.
- Local verify after an explicit hosted CI PASS on the same candidate.
- Recorded hosted CI FAIL.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"hosted-ci-behavior","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Externally observe and record regression scenarios A-F: a local verify of an environment ci check produces no gate-eligible hosted-CI evidence; an explicit candidate-bound hosted-CI PASS is recognized; a later local verify on the same candidate does not shadow it; candidate mutation makes it stale; missing/stale/failed hosted CI blocks.","evidence":"bounded observed command output plus gate results"}`

## Documentation updates

- Update docs/task-system.md and record the decision in docs/decisions.md
- Update docs/progress.md

## Notes

- Treat `environment: ci` as externally observed until APK has a trusted provider-neutral hosted execution context.
- Local diagnostic execution may run but must not be typed or counted as hosted ci evidence.
- Do not add GitHub API coupling or a CI service dependency. Keep the change bounded to the existing evidence and gate model.
