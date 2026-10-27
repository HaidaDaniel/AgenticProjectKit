# Task 0230 - Classify pending independent review without false needsHuman

State: done
Owner: codex-corrective-0230
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: attention,review,diagnostics,docs,tests
Risk: medium
Parallel: true
Depends on: 0228
Tags: attention,review,diagnostics,tests

## Goal

Reserve `needsHuman: true` for blockers that actually require an operator decision. A missing, stale, unknown, or incomplete independent review is normally work the primary agent can coordinate and must not be presented as a request for human intervention.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/status/attention.ts
- src/core/status/index.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts

## Files allowed to edit

- src/core/status/attention.ts
- src/cli/cli.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/status/index.ts
- src/core/tasks/**
- src/cli/command.test.ts
- src/cli/commands/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce the false signal before editing. Create a disposable fixture with a `review` or `blocked` task whose only blocker is missing independent-review evidence, and an available review budget. Run `attention --json` and record `needsHuman: true`, `assuranceStatus: unavailable`, `reviewEscalation: true`, and the `nextAction` that already tells the agent to request review.
2. Trace how `assuranceStatus` becomes `unavailable` for any review that is not current-and-pass, then how `src/core/status/attention.ts` converts that state into `needsHuman` without proving an operator-only condition.
3. Define one internal classification for the human-action decision. Distinguish at least: review can be organized by the agent; review is absent or stale with budget available; review returned `changes_requested`; review budget is exhausted; an explicit operator-only decision is required; and review state is unknown or unavailable for reasons other than a human decision.
4. Set `needsHuman: true` only when the blocker or policy state proves an operator-only condition, such as an exhausted review budget that requires `apk task decision`, an explicit human accept-current or accept-attribution requirement, or another documented operator-only decision. Do not infer operator need from `assuranceStatus: unavailable` alone.
5. Keep `reviewEscalation` and `assuranceStatus` semantics honest and distinct from `needsHuman`. If the existing fields cannot express the distinction without misleading consumers, add a bounded optional explanatory field only when `needsHuman` is true; do not rename or remove existing fields.
6. Keep the attention `nextAction` accurate for every classification. Missing or stale review with available budget should name the review request; `changes_requested` should name the fixer; exhausted budget should name the operator decision path; unknown state should name the inspection or retry action. Compute this refined `AttentionItem.nextAction` inside `src/core/status/attention.ts` from the existing status fields and policy. Do not change `src/core/status/index.ts` or rewrite the status projection's original next action. If a coherent fix genuinely requires changing both representations, stop and document the need for a follow-up task rather than widening this contract.
7. Do not weaken the independent-review requirement, review budget, gate, or operator-decision rules. A task with missing review must still be blocked from completion.
8. Add CLI tests for all eight scenarios in this contract. Use disposable fixtures and synthetic evidence only.
9. Document the meaning of `needsHuman`, `assuranceStatus`, and `reviewEscalation` in `docs/task-system.md` so agents do not interpret a pending review as a human request.
10. Run the focused test, typecheck, lint, APK task lint, docs consistency, diff check, and committed-dist check on the final candidate.

## Acceptance criteria

- A task whose only blocker is a missing independent review, with review budget available, reports `needsHuman: false` and a `nextAction` that requests independent review.
- A stale review with available budget reports `needsHuman: false` and a review next action.
- A `changes_requested` review reports `needsHuman: false` and a fixer next action.
- An exhausted review budget that requires an operator decision reports `needsHuman: true` with the operator decision path.
- A blocker that explicitly requires operator approval reports `needsHuman: true`.
- A task that does not require independent review reports `needsHuman: false`.
- A current passing review with another non-operator blocker reports `needsHuman: false` and names that blocker or its resolution.
- An unknown or unavailable review state that is not an operator-only decision reports `needsHuman: false` and a bounded inspection or retry action.
- `assuranceStatus`, `reviewEscalation`, `review`, and `blockers` remain consistent with `needsHuman`; an unavailable assurance does not by itself force a human decision.
- Missing review still blocks completion; the fix does not create a review bypass.
- Existing attention JSON fields remain present and compatible.
- The refined attention `nextAction` is produced without editing `src/core/status/index.ts`; the status projection's own next action remains unchanged.
- If the attention projection cannot produce an accurate next action from its existing inputs, the task records that limitation and does not silently leave an operator-only budget state with an agent-only action.
- The documentation states when an agent must involve an operator and when it may organize review itself.

## Correctness assumptions

- The primary agent is allowed by APK policy to launch an independent reviewer without routine user confirmation.
- `assuranceStatus: unavailable` means the requirement is not satisfied; it does not by itself prove that only a human can satisfy it.
- Review budget, explicit operator decisions, and attribution approvals are the authoritative sources of operator-only blockers.
- An unknown state can be an availability or evidence limitation that the agent should investigate before escalating.

## Invariants

- Do not relax the independent-review requirement or any gate condition.
- Do not treat a missing review as a pass or as optional.
- Do not infer operator approval from an agent identity or from the absence of a review.
- Do not suppress a genuine operator-only blocker.
- Do not rename or remove existing attention JSON fields.
- Do not add provider calls, model calls, or worker launches.
- Do not change task lifecycle or evidence.
- Do not edit `src/core/status/index.ts`. Refine only `AttentionItem` fields in `src/core/status/attention.ts`; a required status change is a separate task.
- If a future change requires both attention and status, it must depend on or follow Task 0229, which also edits `src/core/status/index.ts`.

## Required evidence

- Pre-fix attention output showing the false `needsHuman: true` for a missing-review fixture.
- Post-fix attention output for all eight scenarios, including the exact `needsHuman`, `assuranceStatus`, `reviewEscalation`, and `nextAction` values.
- Focused test output, typecheck, lint, APK lint, docs consistency, diff check, and committed-dist result.

## Review questions

- Does `needsHuman` now require positive evidence of an operator-only condition?
- Can a missing, stale, or unknown review still be misreported as a human request?
- Are `assuranceStatus` and `reviewEscalation` still truthful, and are they clearly distinct from `needsHuman`?
- Does a genuine exhausted budget or explicit operator decision still set `needsHuman: true`?
- Is missing review still a completion blocker?
- Are the existing public JSON fields preserved and documented?

## Counterexample searches

- Missing review with budget available.
- Stale review with budget available and with exhausted budget.
- `changes_requested` with and without budget.
- Current passing review plus a scope violation, missing verification, or forbidden file.
- Review not required but another blocker present.
- Unknown review state caused by unreadable evidence or an unavailable session.
- A blocker containing unrelated words such as "review" or "budget".
- Operator decision evidence present but stale or bound to another candidate.
- A task with an independent-review requirement and no registered reviewer.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document `needsHuman`, `assuranceStatus`, and `reviewEscalation` semantics and the agent-versus-operator escalation boundary in `docs/task-system.md`.
- Update `docs/progress.md` when the task state changes.

## Notes

- Confirmed downstream inconsistency in APK v0.5.1: a ResLedger task with the single blocker `Missing independent review evidence.` and next action `request independent review` reported `needsHuman: true`, `assuranceStatus: unavailable`, and `reviewEscalation: true`.
- Root cause: `src/core/status/attention.ts` sets `needsHuman` when `assuranceStatus === "unavailable"` and the gate is not passing, even though missing review makes assurance unavailable by construction.
- This task depends on Task 0228 because both tasks change `src/core/status/attention.ts`; implement after the worker projection extraction to avoid competing edits.
- Keep the change focused on classification and diagnostics. Do not implement a new review subsystem, provider integration, or automatic reviewer launch.
- Todo Task 0223 also allows `src/cli/cli.test.ts`. Sequence the tasks or use separate worktrees; do not edit that file concurrently.
- `src/core/status/index.ts` remains forbidden. Attention can derive a refined `nextAction` from `state`, `review`, `gate.blockers`, `policy`, and `reviewBudget`; it does not need to mutate the status projection. If the implementer concludes otherwise, the correct action is a documented follow-up after Task 0229, not an unreviewed scope expansion.
