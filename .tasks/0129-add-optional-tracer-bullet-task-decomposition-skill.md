# Task 0129 - Add optional tracer-bullet task decomposition skill

State: todo
Owner: none
Mode: product
Lane: instructions
Type: feature
Scope: skills,task-decomposition,docs,tests
Risk: medium
Parallel: true
Depends on: 0044,0067,0068,0092
Tags: feature,skills,docs

## Goal

Ship manual portable apk-task-split instructions that turn an explicitly named large task, feature/spec/design input, approved grill output, or planning target into a proposed set of small executable APK tasks. Prefer tracer-bullet vertical slices with observable outcomes rather than DB/API/frontend/tests fragments that cannot independently provide a meaningful result.

Inspect existing tasks, dependencies, canonical contracts, context budgets and overlap first. Preview decomposition before writes: each slice has goal/outcome, narrow allowed/forbidden paths, bounded context, acceptance/verification/evidence, reviewable boundary, and explicit dependency edges. Show the DAG, actual parallelism, blockers, shared migration/schema prerequisites, and merge candidates when slicing is too fine. Technical prerequisites are valid when concretely necessary; do not disguise artificial horizontal fragmentation as independent capability.

Explicit human approval of the complete proposed structural delta precedes task/doc writes. After approval use existing task create/dependency validation under normal ownership/scope rules, retain actual auto-assigned IDs, and resolve symbolic preview edges. Preserve historical done tasks/evidence; an approved split of an unfinished target must explicitly state its lifecycle/dependency disposition and existing-owner constraints. Do not automatically cancel/reopen/claim the parent or silently change its contract.

Use one proposed source src/core/templates/skills/apk-task-split/SKILL.md.hbs and current .hbs copier/dist package convention. Manual installed-asset loading works for Codex/OpenCode/Pi/Claude-like/local/future harnesses without a provider loader. Reuse 0123 packaging/approval conventions while keeping clarification and decomposition separate; approved grill output is optional input, not a prerequisite.

No new CLI, orchestration/runtime, task store/state machine, automatic decomposition/recommendation, model requirement, or mandatory lifecycle step. An ordinary small task proceeds directly through work/verify/review-if-required/gate/done.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- README.md
- docs/agent-exporters.md
- docs/engineering/template-system.md
- docs/engineering/testing-strategy.md
- package.json
- scripts/copy-template-assets.mjs
- src/core/templates/index.ts
- src/core/templates/renderer.test.ts
- .tasks/0123-add-optional-manually-invoked-apk-task-grill-skill.md
- docs/cli-commands.md
- .tasks/0044-add-validated-task-create-command.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0068-make-context-suggestions-dependency-and-change-aware.md

## Files allowed to edit

- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
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
- CLAUDE.md
- GEMINI.md
- src/cli/**
- src/core/config/**
- src/core/tasks/**
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/docs/**
- src/core/context-suggestions/**
- src/core/exporters/**
- src/core/templates/exporters/**
- src/core/templates/skills/apk-task-grill/**
- src/core/templates/skills/apk-prototype/**
- src/core/templates/skills/apk-milestone-semantic-audit/**

## Steps

1. Confirm task create/graph/context and portable packaging primitives. Inspect the explicitly selected planning target and existing repository answers before proposing decomposition.
2. Define a finite preview of observable vertical slices with executable contracts and a dependency DAG; explain shared prerequisites, blockers, real parallelism and excessively small merge candidates.
3. Present proposed new tasks and any unfinished-parent disposition/doc delta with paths. Require explicit approval; no response/refusal writes nothing and partial approval must still yield a coherent accepted DAG.
4. After approval create only accepted contracts through existing APK facilities with actual free IDs and graph validation; respect target owner/state/scope, preserve history and stop before product implementation.
5. Add deterministic instruction/package fixtures for vertical versus horizontal examples, prerequisite/parallel/merge decisions, absent/partial approval and parent ownership. Document manual loading, generate dist, commit and verify.

## Acceptance criteria

- One canonical compact apk-task-split asset is packaged and manually loadable across compatible/local harnesses; no new CLI or native skill runtime.
- Explicit targets can be an existing large task, spec/design, approved grill output, or named planning target. Repository task/dependency/context truth and existing overlaps are inspected first with bounded context and explicit overflow.
- Preview contains individually observable/reviewable slices with narrow paths, context, acceptance/verification/evidence and a visible DAG; meaningless horizontal fragments are rejected or merged.
- Preview separately explains actual parallelism, blocking edges, necessary shared migration/schema prerequisites and merge candidates; dependencies reflect real semantics rather than numbering or shared file overlap.
- No tasks/docs are written before explicit proposal approval. Refusal/silence produces no writes; partial approval is applied only when its dependency set is coherent, otherwise clarify remaining choices.
- Approved creation uses canonical task ID allocation/graph validation and reports real IDs. Parent contract/lifecycle changes are proposed explicitly and respect existing ownership; no automatic claim/cancel/reopen or historical evidence mutation.
- Small tasks need no split metadata, recommendation, state or gate; grill and split remain separate optional reasoning tools and product implementation is outside the session.
- Deterministic fixtures validate packaging, instruction/preview/approval/no-auto-trigger contracts without model calls or claims to prove arbitrary decomposition quality.

## Correctness assumptions

- Vertical slices are preferred but a demonstrated shared technical prerequisite may be necessary.
- Preview labels are symbolic until canonical task allocation returns actual IDs.
- A task-split invocation authorizes inspection/proposals, not unapproved structural writes or parent lifecycle changes.

## Invariants

- Manual-only and optional; no writes before explicit structural proposal approval.
- Real acyclic dependency edges, bounded context and independently observable/reviewable outcomes.
- One task store and portable instruction source; historical evidence and existing ownership stay intact.

## Required evidence

- Packaged asset and deterministic preview/approval/ownership fixture summaries.
- Synthetic create/edit/restart/failure slices with prerequisite and parallel edges, plus an over-fragmented horizontal example.

## Review questions

- Can every proposed task produce an observable outcome or justified prerequisite?
- Are DAG/partial approval/parent disposition safe under existing ownership and ID allocation?
- Can normal work proceed without invoking split or grill?

## Counterexample searches

- DB/API/tests-only fragments without an executable outcome; fake parallelism through a shared schema prerequisite.
- Rejected preview, missing prerequisite, only partly approved DAG, doing parent owned by another agent, or archived done parent.
- Existing overlapping todo task and ID allocation changing between preview and creation.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"packaged-skill","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node --input-type=module -e \"import { access } from 'node:fs/promises'; import { execFileSync } from 'node:child_process'; const p='dist/core/templates/skills/apk-task-split/SKILL.md.hbs'; await access(p); const [pack]=JSON.parse(execFileSync('npm',['pack','--dry-run','--json'],{encoding:'utf8'})); if(!pack.files.some(f=>f.path===p)) throw new Error('Skill missing from package payload');\""}`

## Documentation updates

- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog creation only: no implementation, claim, package change, release, or skill invocation during this planning pass.
- Milestone boundary: portable skills supply reasoning; APK core supplies deterministic lifecycle/scope/evidence/enforcement; external agents/harnesses execute. No LLM/provider runtime, chat engine, second workflow state machine, hidden planner, workflow DSL, Wayfinder, or generic Handoff.
- Keep instructions compact for local/small models and do not inflate always-loaded AGENTS.md. Existing correctness/Notes/evidence/context/template primitives stay canonical; no new schema, command, state, or mandatory skill registry without a separately justified contract.
- Parallel denotes semantic independence; shared tests/docs/dist require separate worktrees and coordinated integration, never concurrent mutable tasks in one worktree.
- P1; no artificial dependency on 0123 or repro-first work. Existing task-grill conventions suffice; optional approved grill output is one input. Final release integrates all included assets.
