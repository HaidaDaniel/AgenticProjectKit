# Task 0130 - Present spec correctness and engineering quality in one task review

State: todo
Owner: none
Mode: maintenance
Lane: review
Type: feature
Scope: review-prompt,review-findings,worker-guidance,docs,tests
Risk: medium
Parallel: true
Depends on: 0063,0064,0072,0085
Tags: feature,review,docs

## Goal

Make two conceptual review axes explicit in the existing single reviewer prompt/result guidance: Spec correctness and Engineering quality. V1 keeps one reviewer, one prepared run, one prompt, and one canonical outcome/evidence record; two paid model calls are not the default.

Spec checks goal/acceptance, external and missing behavior, scope creep, invariants and required claims/evidence. Engineering checks repository conventions, unnecessary complexity/duplication, poor abstraction, speculative generality, primitive obsession, leaky boundaries, coupling/module ownership, avoidable smells/dependencies and maintainability. Findings must be concrete and proportional; taste alone is not an invented blocker or reason for unrelated refactoring.

Prefer explicit Spec/Engineering sections and axis-labelled strings in existing bounded findings/reviewFindings. Define an explicit conservative Overall result: either axis requiring changes/failing cannot yield pass; unresolved coverage is disclosed. Preserve one canonical outcome and do not parse finding text to decide gate semantics. No evidence schema extension is needed for V1. Legacy unlabelled findings remain valid and readable, and pass may have no findings; failed/change-requested output remains actionable.

Reuse canonical independent review, correctness groups, assurance, budgets, registered reviewer separation, prepared run/candidate freshness and standalone/worker paths. Optional multiple reviewers remain available only through existing higher-assurance/resource-rich behavior; do not introduce a new selector, axis gate, subsystem, policy minimum or automatic second run.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/execution-profiles.md
- docs/agent-exporters.md
- src/core/tasks/review.ts
- src/core/tasks/task.test.ts
- src/core/work/contract.ts
- src/core/work/index.ts
- src/cli/commands/task-state.ts
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md
- .tasks/0085-adaptive-assurance-and-review-budget.md

## Files allowed to edit

- src/core/tasks/review.ts
- src/core/tasks/task.test.ts
- src/core/work/contract.ts
- src/core/work/index.ts
- docs/task-system.md
- docs/agent-exporters.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .agentic/**
- .tasks/**
- AGENTS.md
- src/cli/**
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/workflow.ts
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/exporters/**
- src/core/templates/**

## Steps

1. Trace shared standalone and worker review prompts/results, bounded finding normalization and canonical outcome handling; retain the issued candidate and reviewer identity.
2. Add compact Spec correctness and Engineering quality sections, concrete axis-labelled finding guidance, coverage limits and a conservative explicit overall outcome without changing evidence schema or deriving results from finding strings.
3. Keep worker/standalone output consistent through existing prompt/result guidance only; preserve legacy findings, failure handling, run uniqueness, reviewer separation, assurance/budgets and freshness.
4. Add focused prompt/result-path regressions for mixed axis outcomes, legacy findings, same candidate/one run, stale submissions and standalone/worker consistency. Update docs, build, commit and verify.

## Acceptance criteria

- One existing prepared review prompt explicitly covers Spec correctness and Engineering quality with the stated concrete concerns and bounded/proportional review instructions.
- Result guidance reports both axes distinctly and one explicit Overall outcome. A non-passing axis cannot be represented as overall pass; missing coverage is disclosed.
- Existing axis-labelled finding strings and one canonical review outcome suffice; no per-axis evidence fields, new schema, second review store/gate or text-matching gate logic.
- Legacy unlabelled findings and valid empty passing findings remain compatible; non-passing findings are actionable and do not authorize unrelated implementation work.
- Standalone and worker review paths retain the same prepared candidate/run, registered reviewer separation, freshness, idempotence and existing assurance/review budgets.
- Default execution remains one reviewer/run/prompt/outcome, without two provider calls or new routing minima. Optional diverse/multiple review remains governed solely by existing policy/resources.
- Deterministic regressions cover prompt grouping, mixed-axis reporting guidance, old findings and current/stale candidate paths without claiming arbitrary reviewer reasoning is proven.

## Correctness assumptions

- Review evidence already carries a canonical outcome plus bounded free-form findings.
- Two concerns can be inspected by one reviewer; richer execution is an optional existing assurance choice.
- Review presentation changes must not turn finding strings into control-plane decisions.

## Invariants

- One prepared run and canonical outcome by default; no automatic second model call or extra axis gate.
- Reviewer identity, immutable candidate binding, budgets and stale/self-review rejection remain unchanged.
- Legacy evidence remains readable; no schema rewrite or unrelated engineering refactor.

## Required evidence

- Shared prompt/result fixture output distinguishing both axes while preserving one canonical review record.
- Standalone/worker and legacy/stale-candidate regression summary plus a diff showing no policy/evidence schema changes.

## Review questions

- Do both axes have explicit actionable boundaries and an overall non-pass rule?
- Can an engineering preference cause scope creep or an unsupported blocker?
- Does either path create a second run, alter assurance/budget/freshness or infer results from finding text?

## Counterexample searches

- Spec pass/Engineering changes_requested; Spec fail/Engineering pass; both pass with empty findings.
- Legacy findings, long bounded axis labels, stale candidate submission, and a worker-origin review reused as standalone.
- A stylistic preference presented as a mandatory refactor or axis text parsed to bypass the gate.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- docs/task-system.md
- docs/agent-exporters.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog creation only: no implementation, claim, package change, release, or skill invocation during this planning pass.
- Milestone boundary: portable skills supply reasoning; APK core supplies deterministic lifecycle/scope/evidence/enforcement; external agents/harnesses execute. No LLM/provider runtime, chat engine, second workflow state machine, hidden planner, workflow DSL, Wayfinder, or generic Handoff.
- Keep instructions compact for local/small models and do not inflate always-loaded AGENTS.md. Existing correctness/Notes/evidence/context/template primitives stay canonical; no new schema, command, state, or mandatory skill registry without a separately justified contract.
- Parallel denotes semantic independence; shared tests/docs/dist require separate worktrees and coordinated integration, never concurrent mutable tasks in one worktree.
- P1; work/contract edits are allowed only for compact prompt/output guidance, never schema, issuance/routing/lifecycle or runtime behavior. No prerequisites on repro/split/prototype.
