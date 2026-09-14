# Task 0131 - Add advisory agent context hygiene estimates to APK lint

State: todo
Owner: none
Mode: maintenance
Lane: quality
Type: feature
Scope: lint,agent-context,context-estimates,docs,tests
Risk: medium
Parallel: true
Depends on: 0066,0067,0092,0114
Tags: feature,lint,context,docs

## Goal

Extend existing deterministic read-only apk lint with bounded advisory instruction/context hygiene findings and visible estimated initial-load cost. Reuse APK's canonical approximate unit ceil(UTF-8 bytes/4), existing required/relevant/optional context selection and canonical AGENTS.md/export ownership; do not build a token-analysis product or use an LLM to judge useful sentences.

### V1 scope

Estimate canonical always-loaded instructions, task contract, unique required context and selected relevant/optional context with explicit overlap accounting and missing-file fallback/unknown diagnostics. Initial-load totals count each normalized selected file once; show omissions and distinguish a selected pack estimate from all repository text or actual harness/model token usage. Report sizes informationally instead of choosing a universal hard limit. Expose consistent human/JSON summaries through existing lint result/CLI plumbing.

Implement a small deterministic set: exact duplicated rule/command lines or blocks with conservative EOL/trailing-whitespace normalization; repeated normalized context references to the same source; known legacy generated full copies and accidental policy duplication instead of canonical imports; missing context references where decidable without treating explicitly planned outputs as broken. Reuse existing legacy export classification and existing broken-reference diagnostics rather than duplicating inference. Deliberate repetition can be legitimate: report exact source locations/reasons and limitations, never semantic worth or a mandatory rewrite. No fuzzy semantic similarity.

New hygiene findings are advisory/warning-only and cannot fail done/lint or change gate policy merely because AGENTS.md is long. Existing structural/generated-drift errors keep their existing severity. No arbitrary threshold/config schema is needed for V1; configurable stricter policies, auto-cleanup and larger analysis are follow-ups only.

Discovery is bounded and Git-aware, excludes runtime/heavy trees, never drops required explicit context and never writes reports/instructions/tasks. Task 0122 owns readiness/test capability consistency; this feature neither revisits that detector nor regenerates provider-specific common policies.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/agent-exporters.md
- docs/cli-commands.md
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/docs/context.ts
- src/core/docs/context.test.ts
- src/core/exporters/index.ts
- src/core/context-suggestions/index.ts
- src/cli/commands/lint.ts
- src/cli/cli.test.ts
- .tasks/0066-add-built-in-repository-and-task-contract-linting.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md
- .tasks/0114-make-context-tree-walking-gitignore-aware-with-configurable-exclusions.md

## Files allowed to edit

- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/docs/context.ts
- src/core/docs/context.test.ts
- src/cli/commands/lint.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- docs/agent-exporters.md
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
- src/cli/index.ts
- src/core/tasks/**
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/config/**
- src/core/quality/**
- src/core/scanners/**
- src/core/context-suggestions/**
- src/core/exporters/**
- src/core/templates/**
- src/core/audit/index.ts

## Steps

1. Trace lint findings/rendering, canonical export/legacy ownership and existing budget accounting/discovery. Select the minimal deterministic hygiene checks and reuse existing diagnostics/helpers; do not add another scanner or token estimator.
2. Expose bounded file/category/unit summaries with normalized-path de-duplication, overlap accounting, selected-pack scope and explicit unavailable/fallback sizes. Keep sizes informational; required-context overflow semantics remain unchanged.
3. Add advisory exact-rule/block/command repetition, repeated source references and proven duplicate/legacy full-policy findings with locations/reasons. Preserve legitimate thin imports, customized files and planned outputs; do not infer sentence quality or auto-fix.
4. Cover deterministic ordering, JSON/human consistency, deliberate repetition/false positives, multibyte/EOL sizes, missing/planned paths, canonical adapters, ignored trees, read-only behavior and warning-only exit status in focused fixtures.
5. Document estimates and limitations; commit, generate dist normally and verify that existing hard structural/gate behavior is unchanged.

## Acceptance criteria

- Existing lint human/JSON output exposes the same bounded estimates for canonical instructions, task contract, unique required context and selected relevant/optional context using canonical APK units.
- Initial-load totals count normalized selected sources once, explain overlap/omitted context and unavailable/fallback sizes, and never claim real model/harness token use or total repository reasoning cost.
- Deterministic findings identify exact duplicated rules/commands/blocks, repeated normalized context references, proven legacy/generated full copies and decidable reference gaps with paths/locations/reasons; no LLM or fuzzy sentence-worth classifier.
- Canonical AGENTS.md plus thin imports remain one shared policy. Existing legacy ownership and broken-reference checks are reused; customized files and explicitly planned outputs are not silently deleted or misclassified as missing.
- New hygiene/size findings are advisory only and do not set lint hasErrors, fail done, lower assurance, or add evidence requirements. Existing structural/generated-drift errors remain errors.
- No universal hard size limit or new threshold config/schema is introduced. Deterministic repetition is labelled potentially intentional rather than proof of useless instructions.
- Read-only bounded Git-aware discovery skips heavy/runtime state, preserves required explicit context and performs no file/task/report mutation or provider-specific duplicate generation.
- Fixtures cover byte-unit accounting/de-duplication, CRLF/multibyte text, canonical adapters/custom legacy files, missing/planned references, deliberate repeats, warning-only success, pre-existing hard errors and repeatable human/JSON output.

## Correctness assumptions

- Instruction cost is estimable with canonical approximate byte units, not an exact model tokenizer.
- Existing context fileSizes are already units with canonical minimum/fallback behavior; do not reinterpret them as raw byte counts.
- Exact repetition is a mechanical finding that may be intentional, not a semantic quality verdict.
- Legacy filename presence alone cannot prove ownership or safe deletion.

## Invariants

- New context hygiene findings are read-only, deterministic and advisory; long instructions do not become a completion blocker.
- One canonical unit/accounting model and common policy source; no duplicated provider policies.
- Unique source accounting and explicit bounds/unknowns; required context and existing structural checks are unchanged.

## Required evidence

- Human/JSON estimate and finding fixture snapshots with byte/overlap accounting.
- Read-only/warning-only regression output plus existing structural-error checks showing no gate/policy change.

## Review questions

- Can totals double-count AGENTS/task/explicit context or imply actual model tokens?
- Are conservative duplicate findings explained as potentially intentional?
- Can new warnings accidentally set hasErrors, mutate files, widen discovery or demote existing structural failures?

## Counterexample searches

- Same file via ./ and slash aliases; AGENTS already in required context; missing/planned output; UTF-8/CRLF text.
- Deliberate command repetition in different sections, thin CLAUDE/GEMINI imports, one-byte customized legacy copy, very long valid AGENTS.md.
- Large ignored node_modules/runtime tree or a malformed task/real generated drift that must still fail independently.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- docs/agent-exporters.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog creation only: no implementation, claim, package change, release, or skill invocation during this planning pass.
- Milestone boundary: portable skills supply reasoning; APK core supplies deterministic lifecycle/scope/evidence/enforcement; external agents/harnesses execute. No LLM/provider runtime, chat engine, second workflow state machine, hidden planner, workflow DSL, Wayfinder, or generic Handoff.
- Keep instructions compact for local/small models and do not inflate always-loaded AGENTS.md. Existing correctness/Notes/evidence/context/template primitives stay canonical; no new schema, command, state, or mandatory skill registry without a separately justified contract.
- Parallel denotes semantic independence; shared tests/docs/dist require separate worktrees and coordinated integration, never concurrent mutable tasks in one worktree.
- P1; no audit-report write flow, readiness detector refactor, context semantic usefulness scoring, new config threshold, or hard context gate. Existing 0122 and renamed 0127 semantic audit remain separate.
