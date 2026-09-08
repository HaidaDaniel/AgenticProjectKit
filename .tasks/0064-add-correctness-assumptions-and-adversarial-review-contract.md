# Task 0064 - Add correctness assumptions and adversarial review contract

State: done
Owner: codex-20260909
Mode: product
Lane: review
Scope: review,cli,tests,docs
Risk: medium
Parallel: true
Depends on: 0063
Tags: correctness,assumptions,invariants,counterexamples,review

## Goal

Task contracts express correctness assumptions, invariants and adversarial review expectations without bloating ordinary tasks.

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
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/agents/index.ts
- src/cli/commands/task.ts
- src/core/templates/renderer.test.ts
- docs/cli-commands.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md

## Files allowed to edit

- src/core/tasks/*.ts
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/agents/*.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- docs/progress.md
- docs/decisions.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Add optional structured assumptions/invariants, required evidence references, review questions and counterexample expectations.
2. Preserve semantics through parser/renderer/create and review prompt; reuse evidence contract from 0058.
3. Cover legacy tasks, populated fields and omission of empty optional sections.

## Acceptance criteria

- Task can express assumptions, invariants, required evidence, review questions and expected counterexample searches.
- Benchmark, migration, async/distributed, security and high-risk architecture tasks can state claims reviewer must challenge.
- Legacy tasks parse unchanged; new optional fields survive canonical round trip.
- Review prompt includes populated correctness requirements; high-risk templates can consume same representation.
- Empty optional fields create no prompt/render noise; low-risk tasks need not supply all fields.
- Regression tests cover parsing, rendering, creation and review prompt propagation.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk task create --help
- pnpm exec apk doctor

## Documentation updates

- Update docs/task-system.md for implemented behavior and examples.
- Update docs/context-system.md for implemented behavior and examples.
- Update docs/cli-commands.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-REVIEW-02. Milestone 2.
- Extend task contract, not SPEC.md or another parallel specification system. Evidence expectations reuse existing structured records.
- Non-goals: forcing every optional field on low-risk tasks or implementing all domain templates.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
