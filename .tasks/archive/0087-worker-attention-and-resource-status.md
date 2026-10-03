# Task 0087 - Worker Attention and Resource Status

State: done
Owner: local-agent-0087
Mode: product
Lane: developer-experience
Scope: workers,status,attention,resources,provenance,cli,tests,docs
Risk: medium
Parallel: false
Depends on: 0070,0071,0085
Tags: workers,status,attention,resources,cli

## Goal

Extend the CLI control plane with bounded worker occupancy and human attention status derived from existing task run gate and provenance state.

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- src/core/status/index.ts
- src/core/tasks/provenance.ts
- src/core/work/index.ts
- .tasks/0070-add-end-to-end-task-execution-provenance.md
- .tasks/0071-expose-concise-workflow-gate-and-evidence-status.md
- .tasks/0084-execution-profiles-and-resource-aware-routing.md
- .tasks/0085-adaptive-assurance-and-review-budget.md

## Files allowed to edit

- src/core/status/*.ts
- src/core/resources/*.ts
- src/core/execution/*.ts
- src/core/work/*.ts
- src/core/tasks/provenance.ts
- src/cli/index.ts
- src/cli/commands/status.ts
- src/cli/commands/workers.ts
- src/cli/commands/attention.ts
- src/cli/cli.test.ts
- docs/execution-profiles.md
- docs/architecture.md
- docs/task-system.md
- docs/cli-commands.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0087-worker-attention-and-resource-status.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Extend existing status/provenance projections with resource identity, lane capacity, worker occupancy, current task/run, and terminal/blocked/needs-human state.
2. Derive a bounded human attention queue from canonical task, gate, review, run, and resource state with stable priority/reasons and next actions.
3. Expose the smallest coherent CLI surface and matching JSON output without adding a daemon, dashboard, or duplicate telemetry store.
4. Add fixture regressions for free/busy/scarce workers, completed/stale/orphaned runs, blockers, review findings, and deterministic attention ordering.

## Acceptance criteria

- Output shows registered workers/resources, capability/cost class, declared parallel capacity, free/busy/unknown slots, scarce-lane occupancy, and current task/run where known.
- Attention/status exposes canonical 0085 states including assurance unavailable, frontier budget exhausted, review escalation required, and needs-human because the required assurance cannot be met.
- Worker/run state distinguishes ready, busy, blocked, needs-human, completed, failed, and stale/unknown observations without claiming live process knowledge that APK cannot prove.
- Attention is semantic, not process monitoring. APK reports only facts derivable from canonical records: review required, verification stale/invalid, blocked dependency, budget exhausted, assurance unavailable, needs-human, completed, failed, or stale. It must not assert PID liveness, active token generation, terminal responsiveness, live SSH, or physical agent idleness without external-runtime evidence.
- Machine-readable output stays runtime-neutral (`apk status`, `apk workers`, `apk attention`). No external runtime (for example Herdr) is embedded, launched, or required.
- Attention items are decision-ready and bounded: task/run, reason, relevant blocker or review finding summary, resource impact, and exact next action. Ordering is deterministic and explained.
- Existing task status, gate blockers, review findings, run sessions, and provenance are the source of truth. The feature adds a projection and no second task state, policy engine, evidence store, or raw-session log.
- A constrained setup can show one occupied scarce frontier lane while local and deterministic lanes remain available for useful work.
- Human and JSON forms contain equivalent sorted facts; default output is concise and detail remains bounded.
- Missing/malformed/stale resource or session data fails conservatively with diagnostics and never marks a worker free or a task complete without proof.
- Existing `apk status` remains compatible. `apk workers`/`apk attention` may be dedicated views only if they reuse one shared projection.
- Tests cover capacity greater than one, one busy frontier slot, concurrent local/deterministic work, blocked and needs-human items, stale sessions, review findings, no-resource legacy config, and stable output limits.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates

- Update execution-profile, architecture, task-system, CLI, README, decisions, and progress docs for implemented status and attention semantics.

## Notes

- Priority: later than registry, routing, and adaptive assurance. After 0085, this task can proceed in parallel with calibration. This is the CLI control-plane foundation for Herdr/DHH-like operation, not a GUI or SaaS dashboard.
- Dependency on 0085 is required so attention projects canonical assurance, escalation, and budget states. It intentionally does not depend on 0086; calibration and attention can proceed in parallel after 0085.
- Reuse 0070 provenance and 0071 status/gate projection. Do not infer provider billing, poll vendor APIs, launch workers, or implement scheduling.
- Boundary (ADR-0039): this is semantic attention/status, not live process monitoring. APK owns semantic attention over task/run/gate/review/evidence state; an external runtime (for example Herdr) owns PTY, persistent shells, detach/reattach, process lifetime, remote connectivity, and operator navigation. Do not implement a daemon, polling loop, terminal/session UI, or live-process supervisor here.
