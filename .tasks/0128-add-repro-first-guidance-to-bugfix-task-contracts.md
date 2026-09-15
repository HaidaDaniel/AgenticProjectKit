# Task 0128 - Add repro-first guidance to bugfix task contracts

State: done
Owner: code-owner-0128
Mode: maintenance
Lane: task-authoring
Type: feature
Scope: bugfix-guidance,templates,docs,tests
Risk: low
Parallel: true
Depends on: 0064,0065
Tags: feature,templates,docs

## Goal

Strengthen the existing typed bugfix template with compact repro-first debugging guidance: reproduce -> minimize when worthwhile -> hypotheses -> instrumentation if needed -> minimal fix -> regression verification. Attempt to capture a failing signal before changing implementation, rather than treating the first hypothesis as proven.

### Bounded scope and existing coverage

Task 0065 and src/core/templates/task-templates.ts already require an old-behavior reproducer, root-cause notes, a narrow fix, and regression output. Add only the missing sequencing, economical minimization, hypothesis/evidence distinction, optional bounded instrumentation, and honest best-effort exceptions through existing Steps/correctness/evidence/review fields. No new debugging skill/subsystem is necessary.

Cover reproducible runtime defects, flaky failures, UI observations, external-provider faults, and unavailable local deterministic reproduction. A captured failing observation/trace with environment, attempts and limits may replace a red automated test when reproduction is objectively impractical. State what was attempted and remains unknown; absence of reproduction is not proof of a hypothesis. Regression protection is required only when practical within the host project's capabilities. Preserve explicit template overrides and do not edit existing historical task contracts.

No apk debug, debugger/tracing platform, persistent state/evidence schema, new assurance or lifecycle gate, extra model, universal TDD, mandatory instrumentation, or forced automated red test.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- src/core/templates/task-templates.ts
- src/core/templates/renderer.test.ts
- src/core/tasks/task.test.ts
- src/cli/commands/task.ts
- docs/engineering/testing-strategy.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md
- .tasks/0065-add-typed-task-templates-with-domain-specific-guardrails.md

## Files allowed to edit

- src/core/templates/task-templates.ts
- src/core/templates/renderer.test.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/engineering/testing-strategy.md
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
- src/core/tasks/index.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/evidence.ts
- src/core/tasks/review.ts
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/exporters/**
- src/core/templates/skills/**

## Steps

1. Compare current bugfix defaults and correctness projection with the requested sequence; change only declarative bugfix guidance and its relevant generated-task tests.
2. State pre-fix failing-signal attempt, economical minimization, competing hypotheses, optional scoped instrumentation, minimal fix, before/after evidence, and practical regression protection. Allow captured observations and explicit reproduction limits for flaky/UI/provider/unavailable cases.
3. Use existing task fields and preserve user overrides, type aliases, legacy parsing and other typed defaults; do not hard-gate reproduction or turn hypotheses into root-cause proof.
4. Add focused generated-contract/round-trip/override fixtures and update short canonical docs. Commit the delta, build dist normally, run verification and finish the normal task policy workflow.

## Acceptance criteria

- New bugfix defaults explicitly order a failing-signal attempt before implementation changes, then economical minimization, hypotheses, optional instrumentation, minimal fix and regression verification.
- For an ordinary reproducible defect, guidance captures old failing behavior, shows that it disappears after the fix, and preserves practical regression protection; untested hypotheses are not reported as facts.
- Flaky/runtime/UI/external-provider and locally unreproducible examples allow best-effort attempts or captured evidence with environment/limits, without demanding a fabricated automated red test.
- Existing assumptions/Required evidence/Review questions/Verification facilities carry the guidance; no new task/evidence schema, state, command, model run, mandatory TDD or repro completion gate.
- Template aliases, explicit overrides, legacy task parsing and unrelated typed defaults remain compatible; no done task contract is rewritten.
- Deterministic generated-contract tests cover sequence, honest exception wording, before/after evidence and override preservation; documentation and built dist agree.

## Correctness assumptions

- A reproducer is often available but not universally deterministic or economical.
- Existing declarative bugfix fields reach task files and prompts without new enforcement code.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No implementation patch before a documented failing-signal attempt in the guidance; objective reproduction limits stay explicit.
- No new hard gate or forced red test for unsupported/flaky/UI/provider cases.
- Template overrides and historical tasks remain unchanged.

## Required evidence

- Generated bugfix contract/round-trip/override fixture output for deterministic and best-effort cases.
- Before/after guidance comparison showing a small declarative delta and no lifecycle/evidence changes.

## Review questions

- Does the template prevent first-hypothesis patching while permitting honest best-effort evidence?
- Is minimization/instrumentation proportional, and is regression protection practical rather than universal TDD?

## Counterexample searches

- UI-only defect, intermittent race, inaccessible provider, missing host test framework, or expensive reproducer.
- Explicit user overrides and a historical bugfix task read back unchanged.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog creation only: no implementation, claim, package change, release, or skill invocation during this planning pass.
- Milestone boundary: portable skills supply reasoning; APK core supplies deterministic lifecycle/scope/evidence/enforcement; external agents/harnesses execute. No LLM/provider runtime, chat engine, second workflow state machine, hidden planner, workflow DSL, Wayfinder, or generic Handoff.
- Keep instructions compact for local/small models and do not inflate always-loaded AGENTS.md. Existing correctness/Notes/evidence/context/template primitives stay canonical; no new schema, command, state, or mandatory skill registry without a separately justified contract.
- Parallel denotes semantic independence; shared tests/docs/dist require separate worktrees and coordinated integration, never concurrent mutable tasks in one worktree.
- P1/high ROI; extend existing 0065 coverage instead of duplicating a debugging workflow. Low risk assumes a declarative template-only delta; update the contract before any wider implementation.
