# Task 0062 - Gate task completion on verification, scope, policy and evidence

State: done
Owner: codex-20260909
Mode: product
Lane: task-system
Scope: task-system,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0059,0060,0061,0063
Tags: done,completion-gate,lifecycle,verification,evidence

## Goal

done succeeds only after common completion gate proves dependencies/blockers, verification, scope, policy and independent review satisfied by current evidence for exact candidate state.

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
- src/core/tasks/workflow.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/commands/task-state.ts
- src/cli/commands/task.ts
- src/core/agents/index.ts
- src/core/status/index.ts
- src/core/audit/index.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- .tasks/0059-execute-task-verification-profiles-and-record-evidence.md
- .tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/agents/*.ts
- src/cli/commands/task-state.ts
- src/cli/commands/task.ts
- src/cli/index.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/architecture.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Build common gate evaluator using 0059 execution evidence, 0060 scope, 0061 effective policy and prerequisite 0063 independent review; compare evidence subjects with current candidate.
2. Route done through gate under existing task mutation lock; expose read-only gate preview through task CLI or apkit gate.
3. Record successful completion evidence/provenance; add rejection and success regression coverage.

## Acceptance criteria

- Failed required verification, pending/unavailable required evidence, scope violations, unfinished dependencies and unresolved blockers reject completion.
- Independent review capability from completed 0063 participates in gate; failed, missing or stale required review rejects completion. This task first activates final done enforcement across existing capabilities.
- Only current evidence for evaluated task/baseline/candidate identity satisfies gate. Stale or different-candidate evidence never satisfies completion, even if result is PASS; history remains intact.
- Blockers distinguish verification evidence stale, review evidence stale and evidence belongs to another candidate revision.
- Regression: verification/review PASS for A; change relevant implementation/task-controlled input to B -> gate rejects stale A evidence; fresh verification/review for B -> gate may pass when all other requirements met.
- Detect candidate changes between gate evaluation and completion persistence; fail closed rather than record completion using mismatched evidence. Successful completion records exact candidate identity and evidence set.
- CLI explains all blocking reasons with check/dependency identities, scope violations and missing live/review evidence.
- Low-risk task meeting requirements completes without unnecessary extra ceremony.
- Successful completion records evidence/provenance supporting decision; checks and persistence errors fail closed.
- Gate preview and done use same evaluator; rejected done does not write successful completion or change task to done.
- No easy --force bypass; initial implementation provides no gate bypass.
- Regression proves doing -> done without required gates fails for gated tasks; legacy readability remains intact.

## Verification

- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"test","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"task-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk task create --help"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm exec apk doctor","evidence":"doctor readiness report"}`

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/architecture.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-GATE-06. Milestone 1.
- Current doneTask checks owner/state then sets done; reviewTask only changes state. Preserve ownership/lock protections while replacing completion semantics.
- Bootstrap order: 0061 computes policy, 0063 supplies independent review evidence/prompt/freshness, then 0062 enforces done. No dependency on an unimplemented reviewer or temporary bypass.
- Compatibility never converts unknown, unavailable or failed verification into success. Keep historical task readability distinct from proof for new gated completion.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
