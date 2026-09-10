# Task 0083 - Resource and Worker Registry

State: todo
Owner: none
Mode: product
Lane: integration
Scope: resources,workers,harness,config,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0072,0074,0082
Tags: resources,worker,harness,config,foundation,p0

## Goal

Add a first-class vendor-neutral model harness and executable worker resource registry without owning model runtime or storing secrets.

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- .agentic/config.json
- src/core/config/types.ts
- src/core/config/schema.ts
- src/core/work/contract.ts
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md

## Files allowed to edit

- src/core/resources/*.ts
- src/core/config/*.ts
- src/core/work/*.ts
- src/cli/index.ts
- src/cli/commands/resources.ts
- src/cli/cli.test.ts
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .agentic/config.json
- .tasks/0083-resource-and-worker-registry.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**

## Steps

1. Extend the existing optional config schema with bounded model, harness, and executable worker/resource declarations; preserve legacy and schema-v2 compatibility.
2. Implement canonical parsing, validation, normalization, and deterministic human/JSON introspection for the registry.
3. Connect resource identity to the existing `apk-worker-v1` package/session provenance without coupling worker role to vendor or model.
4. Add fixture and CLI regressions for valid references, duplicate IDs, invalid capacity/cost/capability data, secret-shaped fields, and legacy config.


## Acceptance criteria

- Model, harness, and worker/resource are distinct first-class types. A worker references one model and one harness and describes endpoint/runtime reference, location, billing mode, cost class, availability, parallel capacity, and capabilities.
- Cost classes are vendor-neutral and ordered for policy use: `local-free`, `cheap`, `standard`, and `scarce-frontier` (or an equivalent documented stable encoding).
- Capability metadata can express role suitability, context limits, tool/workspace support, worker-protocol support, and local/remote execution without making a model name the routing key.
- Registry validation rejects duplicate IDs, dangling references, non-positive capacity, unsupported enum values, and secret material. Credentials/tokens/keys are never accepted or persisted; endpoint data is a non-secret locator or opaque external reference.
- Resource declarations are optional and backward compatible. Existing config and v0.3.1 adoption fixtures remain readable, and schema migration behavior from 0074 remains explicit and idempotent.
- Deterministic read-only introspection returns the same stable ordering and facts in human and JSON output; it does not probe providers, install runtimes, or start workers.
- Existing `apk-worker-v1` role/result semantics remain intact. Issued sessions may reference a validated worker/resource ID while preserving current candidate, owner, run, and review provenance.
- Tests cover registry round trips, model/harness/worker separation, invalid references, secret rejection, capacity/cost normalization, missing registry defaults, and worker-package resource provenance.


## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"registry-regressions","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test","evidence":"resource registry, secret-boundary, and worker-contract regression summary"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Update execution-profile, architecture, task-system, CLI, README, decisions, and progress docs for the implemented registry and compatibility boundary.


## Notes

- Priority: P0; first implementation task in the Resource-Aware Execution milestone.
- Extend the existing config and worker contract. Do not create a model runtime, provider SDK abstraction, credential manager, remote executor, or second worker protocol.
- `.agentic/config.json` is allowed only for a deliberate dogfood configuration update after schema/tests exist; do not write credentials or machine-local secrets.
- Task 0077 owns repository quality-capability detection. This task owns executable worker/resource declarations and must reuse stable capability IDs where they overlap rather than duplicating quality policy.
