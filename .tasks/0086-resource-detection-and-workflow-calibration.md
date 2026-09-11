# Task 0086 - Resource Detection and Workflow Calibration

State: doing
Owner: local-agent-0086
Mode: product
Lane: execution
Scope: resources,detection,calibration,planning,config,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0077,0085
Tags: resources,detection,calibration,planning,explain

## Goal

Add deterministic resource inventory and vendor-neutral planner calibration with validated saved recommendations user overrides and explainable output.

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- .agentic/config.json
- src/core/scanners/index.ts
- src/core/work/contract.ts
- src/core/config/types.ts
- .tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md
- .tasks/0083-resource-and-worker-registry.md
- .tasks/0084-execution-profiles-and-resource-aware-routing.md
- .tasks/0085-adaptive-assurance-and-review-budget.md

## Files allowed to edit

- src/core/resources/*.ts
- src/core/execution/*.ts
- src/core/quality/*.ts
- src/core/scanners/index.ts
- src/core/config/*.ts
- src/core/work/*.ts
- src/cli/index.ts
- src/cli/commands/resources.ts
- src/cli/commands/execution.ts
- src/cli/cli.test.ts
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .agentic/config.json
- .tasks/0086-resource-detection-and-workflow-calibration.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**

## Steps

1. Build deterministic resource inventory from declared workers, known harness/runtime markers, compatible endpoint declarations, capacities, cost classes, and 0077 quality capabilities without reading or persisting secrets.
2. Extend the existing vendor-neutral worker-package boundary with the minimal planning/calibration intent needed to ask the strongest eligible available planner for a routing recommendation.
3. Validate planner output deterministically against registered resources, profiles, capability requirements, budgets, capacity, and safety minima before it can be applied.
4. Add read-only detect/explain and explicit calibration/apply behavior that preserves user-authored overrides and records inventory/policy provenance.

## Acceptance criteria

- Resource detection is deterministic, read-only by default, bounded, and vendor-neutral. It reports declared/detected/unknown availability, harness/runtime markers, compatible endpoint references, capabilities, cost class, and parallel capacity with source/reason.
- Detection never reads, emits, or persists API keys/tokens/credentials, never performs provider login, and never calls proprietary APIs. Network/model probing requires an explicit external harness action and is not part of deterministic detection.
- Repository quality capabilities come from the shared 0077 detector; calibration does not duplicate tool/vendor inference.
- Calibration selects the strongest eligible available planning worker by declared capabilities and stable tie-breaking, emits a bounded planner package through an extension of `apk-worker-v1`, and remains usable with Codex, OpenCode, Claude Code, Pi, local endpoints, or other compatible harnesses.
- Planner output is a recommendation only until deterministic validation succeeds. Unknown worker IDs, impossible capacity, unsupported profiles, unsafe assurance downgrade, invalid budgets, and secret-shaped output are rejected.
- Portable declarations, selected profile, generated/calibrated policy, inventory fingerprint/provenance, and user overrides remain distinct. Explicit apply updates only the generated recommendation and never deletes or rewrites user overrides.
- Legacy config remains readable. Detection can run without saving; saved calibration is explicit, idempotent for identical input, schema-validated, and stale when the referenced inventory changes.
- Explain output shows effective profile, route per role, selected/rejected resource reasons, assurance target, budgets, overrides, capacity conflicts, and calibration provenance in stable human/JSON forms.
- CLI taxonomy is coherent with existing commands; `resources detect`, `execution calibrate`, and `execution explain` are preferred unless implementation finds and documents a more consistent bounded shape.
- Tests cover no-resource/local/constrained/balanced inventories, strongest-planner selection, malformed planner output, override preservation, stale inventory, secret rejection, deterministic repeated output, and no-provider-SDK imports.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Update execution-profile, architecture, task-system, CLI, README, decisions, and progress docs for implemented detection/calibration/apply/explain behavior.

## Notes

- Priority: high. Dependency on 0085 ensures calibration validates canonical assurance levels, safety minima, escalation state, and review budgets rather than temporary compatibility logic. Dependency on 0077 intentionally reuses the existing quality-capability detector; resource-aware work does not block 0077-0079.
- Prefer extending optional sections of `.agentic/config.json` for portable authored/applied state. Generated machine observations may use existing ignored session/runtime storage, but must not become a second authoritative config or overwrite user policy.
- No proprietary provider integration, model runtime, secret manager, remote executor, generic plugin layer, or always-on master LLM.
