# Task 0069 - Add bounded agent dogfooding evidence

State: done
Owner: codex-20260909
Mode: product
Lane: evaluation
Scope: evaluation,cli,tests,docs
Risk: medium
Parallel: true
Depends on: 0058,0063,0064
Tags: dogfood,agent-usability,evidence

## Goal

Controlled dogfooding sessions produce bounded, comparable evidence of agent usability, distinct from automated tests.

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
- src/core/work/index.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/commands/agent.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/engineering/testing-strategy.md
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md

## Files allowed to edit

- src/core/agents/*.ts
- src/core/analytics/index.ts
- src/core/analytics/analytics.test.ts
- src/core/work/index.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/tasks/*.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/engineering/testing-strategy.md
- docs/progress.md
- docs/decisions.md
- .tasks/0069-add-bounded-agent-dogfooding-evidence.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Define dogfood evidence kind and session lifecycle using existing agent/run registration.
2. Generate reproducible scenario instructions and accept structured results without launching a model.
3. Test session/result lifecycle, failure preservation and bounded output.

## Acceptance criteria

- Dogfood record stores scenario, agent/tool identity, task goal, start/end, outcome, failures/retries, bounded observations and discovered issues.
- Action/tool count, context size and latency/duration may be recorded when available.
- APK generates reproducible dogfood prompt/instructions, registers session/run and accepts structured result/evidence.
- Dogfood evidence is distinct from automated test/benchmark fixtures; failed sessions never become pass.
- Different agents can be compared through vendor-neutral schema; future policy can require dogfood for agent-facing high-risk tasks.
- Output bounded; record lifecycle tests cover successful/failed sessions and optional metrics.

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"task-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts task --help"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts doctor"}`

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/engineering/testing-strategy.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-DOGFOOD-01. Milestone 3.
- Existing work writes optional session prompt; run analytics already groups platform/model. Extend those concepts with dedicated evidence semantics.
- Depends on 0064 as shown in requested phase graph, in addition to 0058/0063 from task specification.
- APK need not run model; real release dogfood session is validated in 0075.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
