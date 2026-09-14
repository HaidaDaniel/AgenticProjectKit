# Task 0127 - Add optional manually invoked milestone semantic integrity audit

State: todo
Owner: none
Mode: product
Lane: instructions
Type: feature
Scope: skills,instructions,cross-task-correctness,docs,tests
Risk: medium
Parallel: false
Depends on: 0064,0067,0068,0070,0092,0114
Tags: feature,skills,docs

## Goal

Ship an optional, explicitly invoked portable skill/instruction asset for semantic integrity audit of a selected set of completed APK tasks or a completed portion of a milestone. Ask whether the integrated system agrees with current canonical architecture/domain/interface contracts and whether completed task contracts leave semantic gaps between them. Prefer an asset using existing APK primitives; V1 needs no new CLI.

### Motivation and bounded downstream evidence

Task-local verification/review/gate can be valid while integration exposes assumptions that no individual task owns. ResLedger's post-implementation inspection of completed 0004/0005/0006/0007/0017 produced corrective tasks 0033-0037 for recorded-versus-occurred timestamps, multi-field correction audit, Workspace-scoped references, exhaustive schema evolution, shared Decimal/Quantity/unit semantics, removal provenance, and transaction-composable lifecycle correction. Later 0038-0042 cover persisted timestamp ordering, installation targets, overflow-safe stock arithmetic, Asset-owned policy meters/as-of evaluation, and completion readings whose Asset and occurrence time must agree with maintenance work. Its docs preserve historical done tasks and evidence while attributing fixes to new contracts. These are concrete cross-contract failure patterns, not proof that every original local review failed.

Translator-agent task 0026 and docs/direction-audit-20260913.md reconciled accumulated implementation with direction and pending contracts while preserving done 0001-0020, live runs, and historical evidence. It exposed confusion between implemented review capability and actual execution, source/model provenance, compatibility defaults, and unsupported benchmark assumptions. Reuse those acceptance boundaries without repeating an audit of either downstream project.

### Bounded scope and reuse

Support explicit intents such as "Run APK milestone semantic audit for tasks 0033-0042" and "Audit the completed milestone since <ref> against the current canonical architecture/domain contracts." Resolve named task IDs/ranges or a Git-ref-bounded milestone into a visible finite completed-task selection before inspection. For a mid-milestone request, assess the completed portion and read relevant unfinished dependencies/consumers only as declared boundary context; never certify unfinished implementation. Missing/ambiguous refs, task membership, dependencies, or canonical ownership require clarification or an explicit limited result, never expansion into an unbounded scan.

Reuse task contracts/dependencies, apk task deps, budgeted apk context, optional apk suggest-context, Git-aware discovery, canonical docs, bounded provenance/evidence/gate summaries, relevant implementation interfaces, and integration tests. Context output is a selection interface; inspect the selected file contents. Required context is never silently evicted on overflow. Read specifically relevant completed/archived contracts by established reference without globally enabling history or dumping runtime stores. Distinguish immutable completion-time evidence from current freshness and broad Git activity from task-attributed changes; unavailable history stays explicitly unknown.

Task 0123 task-grill clarifies one task before implementation; this audit inspects semantic consistency across multiple completed contracts after or during a milestone. Compare its manual-only, portable packaging and proposal/approval conventions, but do not merge the workflows or require 0123 to be implemented first. Existing per-task review remains authoritative for its own contract; the audit is neither another generic code reviewer nor a new completion certificate.

Use one canonical source at proposed src/core/templates/skills/apk-milestone-semantic-audit/SKILL.md.hbs, copied by the existing recursive .hbs asset copier into dist/core/templates/skills/apk-milestone-semantic-audit/SKILL.md.hbs and shipped through current package files. Document explicit reading of the installed asset for harnesses without native discovery. Plain instructions must work with local models and compatible harnesses without frontier-model requirements, model routing, provider integration, or installation into user-global skill directories. Keep discovery in manual documentation; no exporter/runtime hook is needed for V1.

### Findings, approval, and historical integrity

Return bounded findings with involved task IDs, canonical contract and code/test references, the contradictory assumption or missing invariant, an observable counterexample/impact, confidence and unresolved evidence, and proposed narrowly scoped corrective/follow-up contracts. Separate supported defects from hypotheses, documentation drift, and accepted tradeoffs. State coverage and omissions; never claim exhaustive semantic correctness from a clean result or from deterministic instruction tests.

Present findings and proposed backlog with intended paths, scope, acceptance boundaries, dependencies, and overlap checks before writes. A skill invocation or an individual answer is not approval to write. Require explicit human approval of the concrete proposal; no response/refusal means no writes, and partial approval authorizes only the accepted new contracts and necessary canonical planning references under normal APK authorization/ownership rules. New work receives fresh IDs through canonical task creation/graph validation. Never mutate/rewrite historical done contracts or evidence, automatically reopen completed work, or fix product/runtime code during an audit.

### Non-goals

No automatic after-task or continuous audit, heuristic auto-trigger, full-repository LLM scan, mandatory release/completion gate, extra mandatory review pass, new worker role, task lifecycle state, persistent database, ontology, issue tracker, evidence schema, provider/model runtime, or daemon. No new CLI merely to name the feature. No arbitrary-LLM reasoning-quality guarantee. This backlog creation does not implement or invoke the audit.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/agent-exporters.md
- docs/execution-profiles.md
- docs/engineering/template-system.md
- docs/engineering/testing-strategy.md
- README.md
- package.json
- scripts/copy-template-assets.mjs
- src/core/templates/renderer.test.ts
- src/core/templates/index.ts
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0068-make-context-suggestions-dependency-and-change-aware.md
- .tasks/0069-add-bounded-agent-dogfooding-evidence.md
- .tasks/0070-add-end-to-end-task-execution-provenance.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md
- .tasks/0085-adaptive-assurance-and-review-budget.md
- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md
- .tasks/0114-make-context-tree-walking-gitignore-aware-with-configurable-exclusions.md
- .tasks/0123-add-optional-manually-invoked-apk-task-grill-skill.md

## Files allowed to edit

- src/core/templates/skills/apk-milestone-semantic-audit/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/cli/**
- src/core/config/**
- src/core/exporters/**
- src/core/tasks/**
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/docs/**
- src/core/templates/exporters/**
- src/core/templates/skills/apk-task-grill/**
- AGENTS.md
- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/**

## Steps

1. Confirm canonical instruction packaging, task/dependency/context interfaces, Git/evidence/provenance semantics, and the separate task-grill/review purposes from listed context; use the recorded downstream summaries as motivation without a new general audit.
2. Add one portable manual-only instruction asset and explicit installed-asset loading documentation. Resolve final name/location within this contract before edits; change the task allowed path and packaging verification first if the proposed location is unsuitable.
3. Define intent -> visible completed-task selection -> canonical documentation ownership -> budgeted boundary/context selection -> inspection. Include relevant dependencies, shared interfaces, implementation boundaries, integration tests, and bounded completion evidence; expose missing/ambiguous/over-budget context.
4. Define cross-contract reasoning targets and a bounded findings format with traceable assertions, concrete counterexamples, confidence, coverage limits, and proposed corrective backlog. Avoid generic whole-code review and task-local completion recertification.
5. Define findings/proposal -> explicit human approval -> only approved fresh corrective tasks and necessary canonical planning references. Enforce no-write/no-reopen/no-historical-evidence-mutation/no-product-fix boundaries and existing task creation/dependency/owner rules.
6. Add deterministic asset/instruction fixtures or snapshots for selection boundaries, required-context overflow, missing history, no approval/refusal/partial approval, manual-only discovery, historical preservation, and ordinary work/review remaining independent. Use synthetic completed contracts; no external model or downstream runtime invocation.
7. Document task-grill versus milestone audit versus task review, local-model portability, bounded claims, and optional manual invocation. Generate dist through the normal build and confirm the canonical asset is in the package payload.
8. Commit task-owned implementation, run declared verification, and complete the existing policy-driven review/gate/done workflow for this feature task. Audited downstream tasks gain no new mandatory lifecycle or assurance requirement.

## Acceptance criteria

- One canonical portable milestone semantic audit asset ships in the built/package payload through the existing text-template mechanism and can be explicitly loaded from an installed package without a new CLI, exporter, or native skill installer.
- Only explicit human invocation on a finite named completed-task set/milestone starts the audit. No after-task trigger, scanner, work/review hook, mandatory gate, or automatic release requirement is added; ordinary work completes without audit state or evidence.
- Task-ID/range and since-ref examples resolve visible bounded task membership. Mid-milestone audits cover only completed work; missing/ambiguous selections are clarified or reported as limited instead of silently widening.
- Instructions inspect selected completed contracts and relevant dependencies, canonical docs, bounded completion/provenance/evidence summaries, shared domain/interfaces, implementation boundaries, and integration tests. Required context survives overflow; missing history and omitted coverage remain explicit.
- Git-aware context/suggestions are reused as candidates rather than edit authorization or proof of inspected contents. A specifically relevant archived contract may be read explicitly; ignored runtime stores and unrelated history are not dumped.
- Audit targets contradictory assumptions, invariant gaps, multiple sources of truth, ownership/reference and identity mismatch, occurrence-versus-recording time, transaction boundaries, lifecycle, migration compatibility, persistence differences, error semantics, concurrency, shared units/value representations, security boundaries, and one task relying on a guarantee its peer never supplies.
- Findings name involved tasks, canonical contract/code/test references, violated guarantee, a concrete cross-boundary counterexample and impact, confidence/evidence gaps, bounded coverage, and proposed corrective acceptance/dependencies. Supported defects remain distinct from hypotheses and accepted tradeoffs.
- Present bounded findings and concrete proposed backlog/paths before any write. Explicit approval is required for writes; silence/refusal leaves files unchanged and partial approval permits only accepted fresh contracts/planning references.
- Historical done task contracts and historical evidence are never rewritten or mutated; completed work is never automatically reopened. Product/runtime fixes, dependency changes, task-local recertification, or gate-eligible review/completion evidence are not outputs of an audit.
- Approved follow-ups use new free IDs and existing graph/overlap validation under repository scope/ownership rules. The asset introduces no parallel tracker, persistent audit database, evidence schema, transcript store, or worker role.
- Task-grill remains pre-implementation clarification of one task; milestone audit remains post/mid-milestone semantic consistency of completed contracts; neither substitutes for the existing per-task review or mandates the other.
- Plain instructions support local models and compatible harnesses without requiring a frontier model, provider SDK, model routing, autonomous runtime, or automatic user-global installation.
- Deterministic checks cover canonical packaging, instruction/selection/budget boundaries, no-write/no-auto-trigger and historical preservation contracts using synthetic fixtures; they do not claim to prove arbitrary LLM reasoning quality or exhaustive system correctness.
- No APK runtime behavior, completion policy, task schema, existing context implementation, or generated common policy changes are required for the asset-only V1. Any missing primitive is recorded as a possible follow-up instead of silently expanding this task.

## Correctness assumptions

- Existing .hbs copying and dist inclusion can ship this instruction asset without a new package dependency, loader, or command; verify the payload rather than assuming source presence proves delivery.
- Local task contracts and canonical docs can establish bounded integration intent; Git history alone does not uniquely determine milestone membership or task ownership.
- A local PASS for every selected task does not imply semantic consistency across tasks; current freshness is different from immutable completion-time evidence.
- An explicit request to audit authorizes bounded inspection/proposals, not historical rewrites or corrective writes; an external harness performs reasoning while APK remains deterministic.

## Invariants

- Optional and manual-only; no automatic audit, frontier requirement, extra mandatory review, or completion/release gate.
- Finite explicit selection and preserved required context; unknown evidence/coverage is never presented as verified completeness.
- No audit-session writes before explicit proposal approval, no automatic reopen, no historical contract/evidence mutation, and no product implementation during audit.
- One canonical portable instruction source; existing APK lifecycle, context, evidence/provenance, worker roles, and gate remain authoritative.

## Required evidence

- Deterministic asset/instruction fixture output and package payload presence proving manual discovery, bounded selection/context, approval/no-write, and historical preservation contracts.
- Synthetic scenario summaries for locally valid peer contracts with a missing cross-task invariant, an ambiguous since-ref selection, required-context overflow, missing historical evidence, refusal, and partial approval; semantic findings are examples rather than model-quality certification.
- Documentation comparison showing independent task-grill, milestone-audit, and task-review boundaries plus normal work remaining usable without the asset.

## Review questions

- Can any instruction/discovery text automatically invoke the audit or make ordinary task completion depend on it?
- Does the audit inspect guarantees between completed tasks rather than replaying task-local reviews or claiming exhaustive correctness?
- Can selection, overflow, archived/ignored files, unknown evidence, or broad Git activity silently exceed the declared boundary?
- Are concrete findings/proposed writes approved before mutation, and are historical contracts/evidence and existing ownership protected?
- Is the asset actually packaged and portable on local-model harnesses without a new runtime or a dependency on task-grill implementation?

## Counterexample searches

- Two locally passing tasks disagree on OccurredAt versus RecordedAt or on which outer transaction owns a lifecycle correction.
- A relationship has correct Workspace scope while a consumer assumes the referenced Meter/Document also belongs to the same Asset.
- Shared numeric/unit or timestamp representation is valid in isolation but differs in persistence ordering, overflow handling, or migration behavior across modules.
- A since-ref range includes unrelated Git activity or unfinished tasks; an archived dependency or required contract is missing or over budget.
- An old completion PASS is presented as current-candidate proof, or missing runtime evidence is treated as an empty successful audit.
- An audit request, silence, a rejected proposal, or approval of only one finding is treated as authorization to create all corrective tasks or rewrite done history.
- A manually discovered asset is accidentally embedded into always-active common policy, or tests invoke a model and claim semantic reasoning is proven.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"packaged-audit","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node --input-type=module -e \"import { access } from 'node:fs/promises'; import { execFileSync } from 'node:child_process'; const p='dist/core/templates/skills/apk-milestone-semantic-audit/SKILL.md.hbs'; await access(p); const [pack]=JSON.parse(execFileSync('npm',['pack','--dry-run','--json'],{encoding:'utf8'})); if(!pack.files.some(f=>f.path===p)) throw new Error('Audit asset missing from package payload');\""}`

## Documentation updates

- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog contract only: do not implement the asset or run a semantic audit while creating this task. Downstream repositories are read-only motivation sources, not edit targets or mandatory test environments.
- Bounded evidence: resledger@0c4ce6c:docs/progress.md and .tasks/0033-0042 contracts describe the corrective train after completed feature slices; translator-agent@631be46:docs/direction-audit-20260913.md and .tasks/0026-audit-literary-translator-direction-and-repair-documentation-and-pending-task-contracts.md document the late direction/contract reconciliation. The summaries above remain usable without those sibling checkouts or ignored runtime artifacts.
- 0123 overlaps only in portable manual packaging and approval conventions; it clarifies one task before implementation. Reuse conventions or a completed asset if available, but do not edit its contract/asset or introduce a prerequisite dependency.
- 0119 resolves candidate-bound review-budget decisions; 0120 stores transition reasons; 0121 documents commit lifecycle; 0122 reconciles deterministic readiness detection; 0124 changes style opt-in. This task implements none of those mechanisms and does not audit APK generally.
- Dependencies are completed correctness/context/provenance/export/Git-discovery foundations. No new CLI or source-of-truth store is justified for V1; dist changes must come from the normal build.
