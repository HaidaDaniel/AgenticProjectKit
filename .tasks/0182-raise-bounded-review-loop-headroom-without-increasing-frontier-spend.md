# Task 0182 - Raise bounded review-loop headroom without increasing frontier spend

State: todo
Owner: none
Mode: maintenance
Lane: quality
Type: bugfix
Scope: assurance,review,budget,gate,execution,dogfood
Risk: high
Parallel: false
Depends on: 0181
Tags: assurance,review,budget,dogfood,correctness

## Goal

Stop ordinary fix -> re-review loops from dead-ending after two review attempts on difficult tasks or weaker models. Increase the bounded total review budget to a practical fixed range while preserving the separate scarce/frontier cost controls and all current operator-decision, freshness, identity, and hard-gate guarantees.

Use a simple bounded policy rather than a new complexity estimator: total review headroom defaults to 8 passes, critical tasks default to 10, and the existing explicit operator grant may extend a non-critical task only up to an effective total of 10. Do not infer task complexity with an LLM and do not make task authors tune a per-task review number.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md
- .tasks/0181-prefer-current-operator-decisions-over-stale-candidate-history.md
- .tasks/archive/0085-adaptive-assurance-and-review-budget.md
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/execution/index.ts

## Files allowed to edit

- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/*.test.ts
- src/core/execution/*.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- dist/**
- docs/task-system.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md
- .tasks/0182-raise-bounded-review-loop-headroom-without-increasing-frontier-spend.md

## Files forbidden to edit

- .agentic/config.json
- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce the current two-pass exhaustion behavior with repeated changes_requested reviews across successive candidate fixes.
2. Remove duplicated review-budget defaults so policy and execution cannot silently drift.
3. Set the normal total review budget to 8 and the critical total review budget to 10.
4. Keep scarce/frontier budgets independently bounded at their existing conservative defaults unless an existing explicit policy already raises them; increasing total local/cheap review headroom must not authorize extra paid/frontier runs.
5. Preserve the current +1/+2 operator grant mechanism, but cap the effective total review budget at 10.
6. Verify that a passing current review on the final allowed pass succeeds, a non-passing review at exhaustion still blocks, and old/stale reviews remain historical without resetting usage.
7. Update policy/status documentation and regenerate committed dist.

## Acceptance criteria

- A high-risk task can complete a normal iterative loop with up to 8 total review attempts without an operator decision.
- A critical task has 10 total review attempts.
- A normal task can receive at most enough current operator-granted passes to reach an effective total of 10; grant history remains append-only and Task 0181 current-first semantics stay intact.
- Total review headroom and scarce/frontier review budgets are distinct. Raising the former does not silently raise maxFrontierReviewPasses, maxFrontierRuns, paidEscalation, or resource cost permissions.
- There is one canonical default-budget definition consumed by task policy and execution routing, or an equivalently tested single source of truth.
- A current PASS on pass 8/10 is accepted; exhaustion only blocks when the required current passing review is still absent.
- Review freshness, exact candidate binding, separate reviewer identity, diverse-assurance requirements, deterministic verification, scope, CI/live evidence, and all non-review hard blockers are unchanged.
- No LLM-based complexity estimation or new task-author review-budget field is introduced.

## Correctness assumptions

- The recurring dogfood failure is insufficient total review-loop headroom, not a need to weaken review correctness.
- Most repeated loops can use local or cheap review resources; frontier cost is a separate budget dimension.

## Invariants

- Review remains bounded and cannot loop indefinitely.
- Increased headroom cannot authorize extra paid/frontier work by itself.
- Operator decisions remain explicit and cannot be synthesized by an agent.
- Historical review/evidence records are never deleted or reset to manufacture budget.

## Required evidence

- Regression showing current 2-pass behavior before the change and 8/10 bounded behavior after it.
- Tests proving frontier limits remain unchanged when total review headroom increases.

## Review questions

- Did the patch accidentally conflate total review attempts with paid/frontier attempts?
- Can any path exceed an effective total of 10 without an explicit future policy change?
- Does Task 0181 current-versus-stale decision ordering remain unchanged?

## Counterexample searches

- Eight changes_requested results followed by a pass.
- Exhaustion with no current review, stale review, owner self-review, diverse assurance, and failed deterministic checks.
- A constrained profile with only a scarce-frontier reviewer.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Explain the 8/10 total review budget, effective 10-pass cap, and separate frontier-cost budget in task-system/execution-profile docs.

## Notes

- Current main has DEFAULT_TASK_POLICY review max=2, critical max=3, and MAX_HUMAN_REVIEW_GRANT_PASSES=2. Gate counts append-only review records across the task, so repeated changes_requested cycles can exhaust the task before a weaker implementation/reviewer loop converges.
- This task intentionally follows 0181 because both touch gate/review decision semantics. Do not start it against the pre-0181 implementation.
