# Task 0058 - Add first-class task evidence records

State: todo
Owner: none
Mode: product
Lane: task-system
Scope: task-system,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0057
Tags: evidence,verification,provenance,task-system

## Goal

Tasks have machine-readable evidence linked to agent/run identity, preserving history independently of free-text Notes.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- package.json
- README.md
- src/core/agents/index.ts
- src/core/analytics/index.ts
- src/core/analytics/analytics.test.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- docs/cli-commands.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md

## Files allowed to edit

- src/core/agents/*.ts
- src/core/tasks/*.ts
- src/core/analytics/index.ts
- src/core/analytics/analytics.test.ts
- src/core/audit/index.ts
- src/core/audit/audit.test.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/architecture.md
- docs/context-system.md
- docs/progress.md
- docs/decisions.md
- .tasks/0058-add-first-class-task-evidence-records.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Define compact evidence records on existing sharded run storage or dedicated append-only store; document chosen storage contract.
2. Expose add/read/filter-by-task operations with validation and bounded export-safe references.
3. Add record lifecycle, corruption and legacy-project regression coverage.

## Acceptance criteria

- Evidence records include task ID, agent/run identity, type, verification check/profile identity where applicable, result and timestamp.
- Optional command, artifact/report path, commit SHA, short summary and environment identity remain representable.
- Automated tests, CI results, live/manual checks, benchmark/report evidence and independent review remain distinct; fixture evidence cannot masquerade as live/production evidence.
- Evidence can be added and queried by task ID; append-only or equivalent history protection prevents accidental loss.
- Pass, fail and unavailable/not-run stay distinct; corrupted records produce diagnostics.
- Task markdown excludes large stdout/stderr blobs; references are safe for prompts/status exports.
- Tests cover write/read/filter, malformed records, history preservation and projects without evidence.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk task create --help
- pnpm exec apk doctor

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/architecture.md for implemented behavior and examples.
- Update docs/context-system.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-GATE-02. Milestone 1.
- Registry and run shards already exist in src/core/agents/index.ts; current RunLogEvent has outcome/reason but no first-class check evidence. Extend storage without duplicating registry.
- A separate .agentic evidence store is an implementation choice, not a required new subsystem. Runtime data belongs in fixtures during automated verification.
- Non-goals: policy enforcement, verification execution, automatic review or CI integration.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
