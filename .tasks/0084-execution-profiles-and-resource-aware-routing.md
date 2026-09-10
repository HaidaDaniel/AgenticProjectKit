# Task 0084 - Execution Profiles and Resource-Aware Routing

State: todo
Owner: none
Mode: product
Lane: policy
Scope: execution,policy,routing,resources,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0061,0073,0083
Tags: execution-profile,routing,resources,local-first,p0

## Goal

Add executionProfile and deterministic role routing across local constrained balanced and abundant resource configurations while preserving project mode semantics.

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/modes.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- .agentic/config.json
- src/core/tasks/policy.ts
- src/core/work/index.ts
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md
- .tasks/0083-resource-and-worker-registry.md

## Files allowed to edit

- src/core/execution/*.ts
- src/core/resources/*.ts
- src/core/config/*.ts
- src/core/tasks/policy.ts
- src/core/work/*.ts
- src/core/status/index.ts
- src/cli/index.ts
- src/cli/commands/execution.ts
- src/cli/cli.test.ts
- docs/execution-profiles.md
- docs/modes.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .agentic/config.json
- .tasks/0084-execution-profiles-and-resource-aware-routing.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**

## Steps

1. Add optional `executionProfile` configuration and built-in `local`, `constrained`, `balanced`, and `abundant` policy definitions independent of project `Mode`.
2. Resolve an effective execution plan from project mode, task risk/classification, change characteristics, profile, registry, availability/capacity, budgets, and explicit overrides.
3. Route planning, implementation, review, documentation, triage, and mechanical verification to the cheapest eligible worker/resource or deterministic lane with stable reasons.
4. Expose deterministic explain output and add profile/override/capacity/fallback regressions, with the constrained profile as the most detailed reference.


## Acceptance criteria

- `defaultMode`/task `Mode` retain their current meanings. `executionProfile` is a separate optional axis and supports exactly `local`, `constrained`, `balanced`, and `abundant` as built-in profiles.
- The resolver composes project mode, task risk and tags/type, bounded change characteristics, execution profile, resource capabilities, availability, capacity, and budgets into one effective execution/assurance plan; it does not duplicate the completion gate.
- Routing selects workers by validated resource identity and capability, then chooses the lowest-cost eligible available resource with deterministic tie-breaking and an explanation of selected and rejected candidates.
- The constrained profile is first-class: deterministic checks precede semantic review; low/simple implementation and docs/triage are local-first; scarce frontier is reserved for complex planning, high-complexity implementation, hard debugging, and policy-triggered semantic review.
- Medium-risk work under constrained does not automatically create a second frontier run. Current safety requirements remain visible until 0085 provides adaptive assurance semantics; this task must not weaken or bypass the existing gate.
- Local uses no automatic frontier escalation; balanced can use local, cheap, and frontier tiers; abundant can select diverse resources and more parallel lanes without changing the behavior of the other profiles.
- User overrides are represented separately from generated/default policy, applied last, and explained. Overrides may request stronger/more expensive execution but cannot silently reduce mandatory assurance or exceed declared capacity.
- Busy or unavailable scarce resources produce deterministic wait/queue/escalation/needs-human output instead of oversubscription or silent downgrade.
- Legacy config without `executionProfile` remains readable with a documented compatible default. Human/JSON explain output is stable and tests cover every profile, override precedence, tie-breaking, unavailable resources, and mode/profile independence.


## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Update execution-profile, modes, architecture, task-system, CLI, README, decisions, and progress docs for implemented routing and explain behavior.


## Notes

- Priority: P0; depends on the registry and extends 0061 policy plus 0073 orchestration.
- Capability does not imply mandatory execution. A profile decides how to satisfy a role/assurance requirement; it does not erase available independent/diverse review capability.
- No autonomous scheduler, always-on planner, provider API client, billing system, or parallel workspace lifecycle. Assurance levels and review budgets belong to 0085; calibration belongs to 0086.
