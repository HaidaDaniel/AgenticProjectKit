# Task 0119 - Add first-class human decisions for exhausted review budgets

State: todo
Owner: none
Mode: maintenance
Lane: workflow
Type: feature
Scope: review,policy,gate,evidence,decision,provenance
Risk: high
Parallel: false
Depends on: none
Tags: feature

## Goal

Current APK review policy can exhaust its bounded semantic-review budget (`maxReviewPasses` default 2, `maxFrontierReviewPasses` default 1). When that budget is exhausted, the completion gate emits `Review budget exhausted; request an explicit human decision.`, but APK has no first-class workflow command, state, or evidence mechanism for recording that decision. A real downstream task reproduced the gap: multiple reviews and fixes -> review budget exhausted -> gate requests an explicit human decision -> automation has no canonical way to record one -> task blocked.

Introduce an explicit candidate-bound human-decision mechanism for review-budget escalation without creating a generic force/bypass mechanism. A conceptual CLI is `apk task decision <task-id> --actor <human-id> --result <decision> --reason "..."`. The exact command name and flags, and the bounded decision vocabulary (`accept-current`, `grant-review-passes`, `changes-required`, `cancel`), should be chosen during implementation to fit current CLI and evidence conventions while preserving the semantics below. Do not hardcode this exact vocabulary if a better bounded representation fits the existing architecture.

Critical safety invariant: human decisions MAY resolve semantic-review exhaustion. They MUST NOT override unrelated hard correctness blockers. `accept-current` MUST NOT bypass failed required deterministic verification, scope violations, forbidden-file violations, missing dependencies, missing mandatory CI evidence, missing mandatory live evidence, ambiguous candidate identity, ambiguous baseline attribution, stale required evidence, or malformed evidence. This task MUST NOT introduce `--force-done`, `--ignore-gate`, `--skip-verification`, or any equivalent generic bypass.

Candidate binding: every decision must be bound to the exact current candidate identity. At minimum preserve `taskId`, `candidateId`, `baselineId`, `worktreeId`, `headSha` when Git-backed, `actor`, `decision`, `reason`, and `timestamp`. A human decision recorded for candidate A MUST become stale for candidate B.

Evidence and provenance: prefer a first-class append-only representation (conceptually `type: human-decision`) or an equally explicit dedicated record. Do not overload an unrelated generic evidence type such as `manual` in a way that loses semantics. Status, gate, and provenance should expose the decision, actor, candidate, reason, whether it is current or stale, and which blocker it resolves.

Review-budget extension: if a decision allows further semantic review, model it explicitly as a bounded extension such as `grant-review-passes +1`, not a budget reset. Example: base budget 2, used 2, human grant +1, effective allowed 3. Do not reset review history and do not allow one decision to create unlimited review loops. The grant should be candidate/task-bound according to the smallest safe semantics supported by the current review architecture.

`accept-current` means the human accepts the current candidate despite an exhausted or non-passing semantic-review path. It does NOT mean ignoring tests, scope, CI, evidence freshness, or dependencies. The gate should clearly surface which review blocker was resolved by the human decision. `changes-required` records that a human requires further changes, must not make the gate pass, and must remain visible in provenance/status. If existing task cancellation is already the canonical transition, route `cancel` into it rather than duplicating cancellation logic, as long as provenance is preserved.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/execution-profiles.md
- docs/cli-commands.md
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/workflow.ts
- src/core/tasks/provenance.ts
- src/core/status/index.ts
- src/cli/commands/task.ts

## Files allowed to edit

- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/policy.ts
- src/core/tasks/workflow.ts
- src/core/tasks/provenance.ts
- src/core/tasks/index.ts
- src/core/status/index.ts
- src/core/status/attention.ts
- src/cli/index.ts
- src/cli/commands/task.ts
- src/cli/commands/task-state.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/architecture.md
- docs/decisions.md
- docs/execution-profiles.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/work/**
- src/core/resources/**
- src/core/workspaces/**
- .github/workflows/**

## Steps

1. Inspect the current review, gate, evidence, provenance, status, and lifecycle-transition code paths before choosing the representation and command surface.
2. Decide the bounded decision vocabulary and the first-class append-only record shape, preserving actor, candidate subject, reason, and timestamp.
3. Implement the human-decision record and the candidate-binding/freshness semantics using the existing evidence-freshness primitive.
4. Integrate the gate so a current human decision resolves only semantic-review exhaustion while every unrelated hard blocker still fails closed.
5. Implement bounded review-budget extension without resetting review history or enabling unlimited loops.
6. Expose the decision, actor, candidate, blocker it resolves, and current/stale freshness through status, gate, and provenance, and document the command in the CLI help surface.
7. Add regression coverage for the counterexamples in Acceptance criteria.
8. Update canonical docs and regenerate `dist/` through the normal build.
9. Run verification.

## Acceptance criteria

- Review budget exhausted with no human decision blocks the gate.
- Review budget exhausted on the current candidate with a human `accept-current`, while all required deterministic verification, scope, dependencies, and evidence remain valid, may be resolved.
- Failed required deterministic verification plus `accept-current` remains blocked.
- A scope violation plus `accept-current` remains blocked.
- Missing hosted CI evidence plus `accept-current` remains blocked.
- A human decision recorded for candidate A and a later candidate B makes the A decision stale and non-resolving.
- A review budget of 2 that is exhausted plus a `+1` grant permits exactly one additional review pass.
- Once the granted pass is consumed, the budget is exhausted again.
- `changes-required` cannot satisfy the gate.
- The decision, actor, candidate, reason, blocker it resolves, and freshness appear in status, gate, and provenance.
- No `--force-done`, `--ignore-gate`, `--skip-verification`, or equivalent generic bypass is introduced.
- Review history is never reset.

## Correctness assumptions

- The completion gate is the single authoritative completion decision and already consumes candidate-bound evidence freshness.
- Review evidence and candidate identity are derivable from the existing evidence subject and append-only store.
- Session-scoped human decisions can be modeled without a user-account or authentication system.

## Invariants

- A human decision only resolves the semantic-review exhaustion blocker and never an unrelated hard correctness blocker.
- A decision is bound to one candidate subject and becomes stale when the candidate changes.
- Review-budget extension is bounded and additive; review history and used-pass accounting are preserved.
- APK does not introduce a generic force-completion path.
- Existing evidence append-lock and freshness semantics remain authoritative.

## Required evidence

- Regression test output proving each counterexample and the candidate-staleness and bounded-extension semantics.
- A report of the exercised exhaustion and candidate-mutation scenarios showing which blocker the decision resolved and which hard blockers still failed the gate.

## Review questions

- Can a human decision accidentally bypass deterministic correctness checks?
- Can an old human acceptance survive a candidate mutation?
- Can review-budget extension become an unlimited reset?
- Is the actor and reason preserved in append-only provenance?
- Can the gate explain exactly which blocker the decision resolves?

## Counterexample searches

- Exhausted budget with a failing required verification check and `accept-current`.
- Scope or forbidden-file violation with `accept-current`.
- Decision recorded for candidate A, then candidate B is produced.
- Repeated grants attempting to create an unlimited review loop.
- Malformed or ambiguous candidate identity at decision time.
- `changes-required` recorded while an otherwise passing candidate exists.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"decision-counterexamples","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Exercise the exhausted-budget and candidate-staleness counterexamples for the human-decision path and record whether accept-current resolves only the review-exhaustion blocker while deterministic, scope, dependency, and evidence blockers still fail the gate.","evidence":"counterexample scenario output summary"}`

## Documentation updates

- docs/task-system.md
- docs/cli-commands.md
- docs/architecture.md
- docs/decisions.md
- docs/execution-profiles.md
- docs/progress.md

## Notes

- Non-goals: do not add generic force completion, make every task require human approval, reset review history, build a user-account/auth system, couple to GitHub approvals, couple to one agent vendor, add a UI, or redesign all evidence types.
- Keep the human-decision record dedicated and explicit; do not overload `manual` in a way that erases the decision semantics.
