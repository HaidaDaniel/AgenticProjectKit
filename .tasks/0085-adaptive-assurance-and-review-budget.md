# Task 0085 - Adaptive Assurance and Review Budget

State: doing
Owner: codex-resource-aware
Mode: product
Lane: review
Scope: assurance,policy,review,gate,evidence,workflow,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0062,0063,0080,0081,0084
Tags: assurance,review,completion-gate,budget,p0

## Goal

Replace near-Boolean review policy with adaptive assurance levels trigger-based escalation deterministic-first ordering and bounded resource-aware review loops.

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/review.ts
- src/core/tasks/evidence.ts
- src/core/work/index.ts
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0080-resolve-task-0073-independent-review-reliability-findings.md
- .tasks/0081-allow-automatic-independent-review-orchestration.md
- .tasks/0084-execution-profiles-and-resource-aware-routing.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/work/*.ts
- src/core/execution/*.ts
- src/core/status/*.ts
- src/core/templates/task-templates.ts
- src/core/config/*.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/cli/index.ts
- src/cli/commands/task.ts
- src/cli/commands/task-state.ts
- src/cli/commands/work.ts
- src/cli/commands/status.ts
- src/cli/cli.test.ts
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .agentic/config.json
- .tasks/0085-adaptive-assurance-and-review-budget.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**

## Steps

1. Replace the near-Boolean review requirement in the shared task policy with ordered assurance levels while preserving a compatibility projection for existing callers and evidence.
2. Compose risk, task classification, change/review triggers, execution profile, and resource availability into the minimum required and selected assurance plan.
3. Enforce deterministic-first ordering and bounded review/frontier budgets in existing work orchestration, review evidence, status, and the single completion gate.
4. Add critical-risk parsing/templates where required and regressions for escalation, freshness, identity, budget exhaustion, unavailable assurance, and fix/re-review loops.

## Acceptance criteria

- Canonical assurance levels are ordered and documented as `none`, `self-check`, `fresh-context`, `independent`, and `diverse`; existing lightweight/independent policy data has an explicit backward-compatible normalization.
- Risk provides a minimum assurance baseline and policy/change triggers may only raise it. Low defaults to deterministic verification, medium does not require frontier independent review by default, high obtains fresh semantic context at minimum, and critical obtains independent assurance with strongest-available/diverse preference unless stricter policy requires `diverse`.
- `fresh-context` proves an isolated session for the candidate; `independent` proves separate worker identity/context; `diverse` additionally records genuinely different model/resource-family evidence. Existing reviewer separation, freshness/revision binding, self-review protection, findings, and completion evidence remain intact.
- Security/auth, schema/migration, concurrency/async, public API, large semantic or broad-scope diffs, weak tests, invariant changes, repeated deterministic failures, worker/reviewer uncertainty, unexpected scope expansion, and critical release/integration work can produce stable escalation trigger IDs and reasons.
- Mechanical checks run first in the order supported by the task contract: typecheck/static analysis, source lint, tests, build/package, scope, task-contract, and changed-files validation. Semantic LLM review is not issued until required deterministic checks pass or policy explicitly marks an allowed unavailability.
- Budgets include bounded total review passes, frontier review passes, frontier runs per task, and paid-escalation policy. Constrained defaults to `maxFrontierReviewPasses = 1`.
- A second frontier review is allowed only for policy-defined cases such as high/critical work, substantial requested changes, or a materially changed candidate; loops terminate with actionable status instead of repeating indefinitely.
- If required assurance cannot be produced by available resources or within a non-overridable safety minimum, gate/status explain `unavailable`, `budget-exhausted`, or `needs-human`; completion never silently downgrades or bypasses the requirement.
- Self-check/fresh/independent/diverse outcomes reuse the append-only evidence and canonical gate. No second review store, task classifier, gate, or provenance chain is introduced.
- Regression tests cover constrained medium local/conditional review, high fresh-context frontier review, critical/trigger escalation, stale candidate evidence, resource unavailability, budget exhaustion, allowed re-review, and forbidden self-certification.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"assurance-regressions","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test","evidence":"assurance, gate, budget, and review lifecycle regression summary"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Update execution-profile, architecture, task-system, CLI, README, decisions, and progress docs for implemented assurance, trigger, budget, and degraded-state behavior.

## Notes

- Priority: P0; this task changes assurance selection, not the existence of independent review.
- Integrate with 0061 policy, 0062 gate, 0063 review evidence, 0073/0080 orchestration reliability, and 0081 reviewer delegation. Preserve exact-candidate and separate-identity guarantees.
- Do not treat a local reviewer as frontier by name; routing must use registry capability/cost metadata. Do not make a frontier reviewer the first line of mechanical verification.
