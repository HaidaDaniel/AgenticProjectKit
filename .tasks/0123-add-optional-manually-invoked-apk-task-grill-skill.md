# Task 0123 - Add optional manually invoked APK task-grill skill

State: doing
Owner: code-owner-0123
Mode: product
Lane: instructions
Type: feature
Scope: skills,instructions,docs,tests
Risk: medium
Parallel: false
Depends on: 0092,0064,0067,0068
Tags: feature,skills,docs

## Goal

Add an optional, manually invoked APK-shipped skill/instruction package for design clarification of one existing APK task. Working name: `apk-task-grill`. Prefer a skill-only MVP using existing repository task/context/documentation facilities; stop before product implementation.

### Motivation

Implementation can satisfy a written contract while the contract remains under-specified. Resolve material uncertainty before implementation when a human explicitly decides the extra design work is worthwhile, reducing expensive rework around semantics, ownership, identity/lifecycle, timestamps, transaction boundaries, migrations, security, compatibility, external behavior, failure semantics, and expensive-to-reverse representations.

### Scope

Ship portable instructions, document manual discovery/invocation, inspect bounded repository context, interview the human iteratively, and apply only approved task/canonical-documentation refinements. Planning creates/splits/orders work; task-grill resolves uncertainty in one bounded piece of work; work implements the contract; review verifies implementation against that contract. Grill replaces neither planning nor review.

### Design constraints

Current APK has no shipped skill registry or canonical SKILL.md directory. Its reusable instruction source is `NeutralAgentPolicy`/`DEFAULT_AGENT_POLICY` in `src/core/exporters/index.ts`, rendered through `src/core/templates/exporters/agents.md.hbs`. Codex, OpenCode, and Cursor consume canonical `AGENTS.md`; Claude/Gemini use thin imports. Pi, local models, and future harnesses must be able to read the same plain instructions without adding an exporter target or proprietary session format.

Use the existing text-template/package asset convention: proposed canonical source `src/core/templates/skills/apk-task-grill/SKILL.md.hbs`, copied by the current recursive .hbs asset copier into `dist/core/templates/skills/apk-task-grill/SKILL.md.hbs` and shipped by the existing package.json `files: [dist, README.md]` rule. Confirm the final name/location during implementation; this is a proposed extension of the template convention, not an already existing skill facility. Prefer this asset plus documented explicit loading through an installed APK package path. Native harness skill installation is optional and must use the same canonical content; any necessary discovery pointer stays concise, declarative, and explicitly manual. Do not embed an always-active interview in common policy or hand-maintain provider-specific instruction copies.

Reuse `apk context <task-id> --budget <units>`, task Context files, `apk task deps <task-id>`, and optional `apk suggest-context` candidates. Required context is never silently dropped; an over-budget result requires narrowing optional context or surfacing the constraint. Read files after selecting them: context output is a file-selection interface, not proof that their contents were inspected. Existing Git-aware exclusions, dependency selection, correctness sections, task parser/renderer, and bounded evidence summaries remain authoritative. Direct task dependencies, completed related tasks, likely downstream consumers, explicitly named code/tests, and canonical project/domain/security/testing/decision docs may be read selectively when relevant. Archived tasks remain excluded from default packs; read a specific completed/archived related task only when its relevance is established.

APK already owns work/review/evidence/provenance and completion gates. Grill must not issue an `apk work` package, invent a worker role, create a review result, satisfy verification evidence, or certify completion. Prefer no new persistent state. Optional manual-clarification metadata may use an existing task Notes/reference only if useful and non-gating; do not extend evidence schemas for V1. Task 0119's candidate-bound review-budget decisions solve a different problem and are not a dependency or approval mechanism for this skill.

### Non-goals

No new CLI command, including `apk task grill`; no LLM/provider layer, interactive chat engine, provider SDK, model routing, paid/local model selection, or harness orchestration. No automatic activation, heuristic interviews, automatic task scans, backlog scanner, integration into `apk work`/`apk review`, implementation blocker, mandatory large-task grilling, completion gate, or new required task states such as needs-grill/grilled/design-ready. Ordinary tasks remain fully implementable without this skill.

During an interview: no runtime/product code changes, migrations, dependency upgrades, opportunistic refactors, or implementation commits; code/tests may only be read. No blindly created CONTEXT.md or generic docs/adr files, fixed documentation filenames, duplicated independent truth sources, design-session database, governance ontology, elaborate provenance subsystem, raw transcripts, chain-of-thought storage, or full conversation persistence. No unrelated APK redesign. Future cheap/local scans may recommend manual grilling, but scanning and automatic invocation are explicitly outside V1.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/project-map.md
- docs/task-system.md
- docs/context-system.md
- docs/agent-exporters.md
- docs/decisions.md
- docs/engineering/template-system.md
- docs/engineering/testing-strategy.md
- .agentic/config.json
- package.json
- scripts/copy-template-assets.mjs
- src/core/exporters/index.ts
- src/core/templates/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/templates/renderer.test.ts
- src/core/docs/context.ts
- src/core/docs/context.test.ts
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/review.ts
- src/core/tasks/gate.ts
- src/core/work/contract.ts
- src/core/work/index.ts
- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0068-make-context-suggestions-dependency-and-change-aware.md

## Files allowed to edit

- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/sync/sync.test.ts
- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/decisions.md
- docs/progress.md
- AGENTS.md
- dist/**

## Files forbidden to edit

- src/cli/**
- src/core/config/**
- src/core/tasks/**
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/docs/context.ts
- src/core/docs/suggest-context.ts
- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**

## Steps

1. Confirm the existing neutral instruction and .hbs shipping paths, dependency/context interfaces, task correctness fields, canonical documentation ownership, and normal work/review/gate boundaries from the listed context. Keep the MVP skill-only; resolve final name/location within this contract before edits.
2. Add one canonical portable instruction asset and minimal manual-discovery documentation. Example intent: "Use the APK task-grill skill on task 0026." If a harness cannot natively discover it, document explicitly reading the installed asset rather than adding orchestration or a CLI command.
3. Define load -> bounded inspection -> repository-grounded uncertainty assessment. Establish existing repository answers first; ask only materially unresolved decisions. Include timestamps, transactionality, ownership, lifecycle, migration, security, external effects, failure behavior, compatibility, interface contracts, testing/evidence, and scope as optional reasoning aids rather than a checklist.
4. Define highest-value unresolved decision -> question -> incorporate answer in conversation -> reassess -> next question. Each question states known repository truth, the unresolved choice, and how its answer changes the contract. Stop when ready enough; leave local implementation choices to the implementation agent and explicitly expose remaining material questions.
5. Classify conclusions as task-local, domain-wide, architecture-wide, or temporary exploration. Discover documentation ownership in priority order: explicit project/APK configuration, AGENTS.md, project maps, task Context files, existing documentation structure, repository conventions. Ask the human if canonical ownership remains ambiguous; normally do not persist temporary exploration.
6. Accumulate proposed decisions without writes after each answer. Present resolved decisions, proposed task edits, proposed canonical doc edits and paths, deferred questions, remaining material unresolved questions, and discovered scope expansion/follow-up work. Require explicit human approval of that proposal before any task/docs write; elapsed time, silence, and agent-generated decisions are not approval.
7. After approval, apply only accepted documentation/task refinements within repository authorization and existing task/lifecycle ownership rules; preserve metadata, dependencies, verification, correctness sections, and unrelated content. Record shared decisions once in their canonical docs and add only necessary task implications/references. Do not claim, transition, or gate the target merely to conduct an interview; if an existing owner/scope constraint prevents approved edits, surface it without bypassing it.
8. Add deterministic instruction/package checks and fixture or snapshot scenarios for manual-only invocation, repository-answered questions, iterative material questions, no-runtime edits, ambiguous doc ownership, deferred/temporary conclusions, absent approval, and minimal approved changes. Assert normal work/review policy remains independent of grilling. Do not require paid LLM calls.
9. Update only necessary canonical feature docs and any derived discovery pointer; document planning/grill/work/review distinctions and the explicit no-implementation boundary. Regenerate dist through the normal build and verify the installed package includes the canonical asset.
10. Commit task-owned changes, run declared verification, and follow the existing policy-driven review/gate/done workflow for implementing this backlog task. The target task being grilled gains no new lifecycle or completion requirement.

## Acceptance criteria

- One canonical apk-task-grill skill/instruction asset ships through the existing APK template/package mechanism, is present in the built/package payload, and is discoverable by documented explicit loading or equivalent native skill invocation without a new CLI command.
- The skill runs only on explicit human request for a specified existing APK task; no heuristic auto-trigger, scanner, mandatory complexity rule, or work/review hook invokes it.
- An ordinary task can proceed directly through the current APK work/verification/review/gate/done flow without grill metadata, states, evidence, or gates.
- Before questioning, instructions load the target task and inspect bounded relevant repository truth using existing task/context/dependency interfaces; include justified code/tests, completed related tasks, and downstream consumers without a whole-repository dump.
- Repository-defined answers are recognized and referenced rather than re-asked; optional decision categories are reasoning aids, not a generic mandatory questionnaire.
- Questions are iterative and prioritize materially unresolved contract decisions; each explains known truth, remaining uncertainty, and contract impact. Stop at ready enough and defer local implementation details.
- Instructions explicitly prohibit runtime/product edits, migrations, dependency upgrades, refactors, and implementation commits throughout grilling; read-only code/test inspection is permitted.
- Conclusions distinguish task-local, domain-wide, architecture-wide, and temporary exploration; temporary exploration normally is not persisted as project truth.
- Canonical documentation ownership is discovered in the stated priority order, uses actual project conventions rather than fixed filenames, and requires a human answer if ambiguous; generic CONTEXT.md/ADR creation is not assumed.
- No writes occur after individual answers or before a final proposal containing resolved decisions, task changes, canonical doc changes with paths, deferred questions, remaining material questions, and scope expansion/follow-up work.
- Explicit human approval is required before applying task/docs changes; refusal or no approval produces no writes, and partial approval applies only accepted refinements.
- Approved edits touch only minimum necessary canonical artifacts and necessary target task implications/references; preserve unrelated sections and existing ownership/scope rules, avoid mechanical task rewrites, and never duplicate full shared decisions across independent truth sources.
- No mandatory lifecycle state, completion gate, design-session store, transcript/chain-of-thought persistence, worker role, or evidence schema is introduced; optional existing task Notes/reference remains non-gating.
- Portable plain instructions work for Codex, OpenCode, Pi, local models, and future compatible harnesses without proprietary session formats, provider logic, model selection, or runtime orchestration.
- User docs clearly distinguish planning, task-grill, work, and review and explain manual invocation, ready-enough stopping, approval-before-writing, and the no-implementation boundary.
- Relevant deterministic fixtures/snapshots verify canonical packaging/instructions and any minimal existing exporter/sync integration, including direct normal work compatibility, without paid LLM calls; tests do not pretend to prove arbitrary model behavior.
- Missing core primitives, automatic backlog recommendations, and richer native installation are documented only as possible follow-ups unless a tightly bounded existing facility suffices; this task does not grow into a generic design-session subsystem.

## Correctness assumptions

- Existing .hbs asset copying and dist package inclusion can ship the portable instruction without a new loader, dependency, or command.
- Design interviewing is performed by the manually invoked external agent/harness; APK supplies instructions and repository interfaces, not a conversation runtime.
- Repository docs/config/tasks define durable truth; an interview does not override existing documentation authority or task ownership.

## Invariants

- Manual-only and optional: a normal task is implementable without grilling.
- No product implementation during grilling and no task/docs writes before explicit human approval.
- One canonical instruction source and minimum canonical documentation updates; no duplicated truth or proprietary harness dependency.
- Existing task lifecycle, completion gate, context selection, evidence, and worker contracts remain authoritative and unchanged.

## Required evidence

- Deterministic package/instruction fixture or snapshot output covering the acceptance boundaries and a built/package asset presence check.
- Bounded fixture summary showing repository-defined answers, material iterative questions, ambiguous documentation ownership, no-approval/no-write behavior, and minimal accepted canonical edits.

## Review questions

- Does any discovery text accidentally auto-activate interviewing or make normal work depend on grill status?
- Can the plain installed asset be explicitly loaded across harnesses without a provider-specific session or duplicate policy?
- Do proposed/approved updates respect actual canonical documentation ownership, existing task owner/scope, and minimum necessary edits?
- Does V1 add any runtime, state, evidence, command, or context-selection primitive that could instead be deferred?

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"packaged-skill","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node --input-type=module -e \"import { access } from 'node:fs/promises'; await access('dist/core/templates/skills/apk-task-grill/SKILL.md.hbs');\""}`

## Documentation updates

- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- The .hbs skill path is a minimal planned extension of current packaged text assets. If the final source location changes, update this task allowed path and package verification before implementation; do not expand scope silently.
- Exporter/sync files and generated AGENTS.md are allowed only for a minimal declarative manual-discovery pointer if needed; prefer asset plus docs with no runtime integration. dist changes must be generated by the normal build.
- Dependencies name completed canonical export, correctness-contract, budgeted-context, and dependency-aware-context foundations. No new implementation prerequisite or dependency on Task 0119 is required.
- Inspiration: grill-with-docs/design interviews (inspect -> identify uncertainty -> ask human -> settle -> record approved durable conclusions -> stop before implementation). APK documentation ownership and task model take precedence; do not copy generic file-creation behavior.
- Tests validate deterministic packaging, instruction contracts, and fixture/integration behavior; actual interview quality may be explored manually without making model calls or dogfood evidence a completion gate.
