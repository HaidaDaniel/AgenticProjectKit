# Task 0137 - Add optional project-level grill skill

State: done
Owner: code-owner-0137
Mode: production
Lane: instructions
Type: feature
Scope: skills,project-grill,docs,tests
Risk: medium
Parallel: true
Depends on: 0092,0064,0067,0068,0114
Tags: feature,skills,docs

## Goal

Ship one optional, manually invoked portable instruction asset, `apk-project-grill`, for repository-grounded design grilling of a whole project, the current milestone, or one bounded subsystem/topic. It helps a human periodically re-examine whether the project is building the right thing, whether original goals and assumptions still hold, where scope/architecture drift exists, which decisions are already well supported, and which gaps should become follow-up tasks. It is not code review, not task review, not a milestone semantic audit, and not autonomous architecture refactor.

Use the established packaged-skill convention: canonical source `src/core/templates/skills/apk-project-grill/SKILL.md.hbs`, copied as-is by the existing recursive `.hbs` asset copier into `dist/core/templates/skills/apk-project-grill/SKILL.md.hbs` and shipped by the package `files: [dist, README.md]` rule. Add no CLI command, exporter, native installer, provider/model runtime, worker role, lifecycle state, evidence schema, mandatory gate, scanner, daemon, database, embeddings, or LLM router. Native harness discovery is optional and uses the same canonical content; a harness without native discovery reads the installed asset explicitly.

### Three supported scopes

One skill, bounded for each request:

- whole project: product direction, scope, domain assumptions, architecture boundaries, operational constraints and roadmap coherence, reasoned globally from the canonical project model (code read only to verify specific important claims, never every source file);
- current milestone / next release direction: a bounded milestone and its relationship to overall project goals;
- bounded subsystem/topic (for example storage/backup, translation pipeline, authentication/permissions): only the requested subsystem/topic context.

Do not add separate `apk-app-grill`, `apk-milestone-grill`, or `apk-architecture-grill` assets.

### Two use cases

- Initial project grill on a start/very early project: user problem, success, MVP in/out, real constraints, hypotheses versus facts, source of truth, domain entities/invariants, destructive/external actions, local/remote, persistence model, security/trust boundaries, offline behavior, failure semantics, backup/recovery, deployment, observability, testing, which future-compatibility doors to keep open and which to close now. These are reasoning aids, not a fixed mandatory questionnaire.
- Checkpoint / re-grill after a series of tasks, a milestone, or a material change: compare intended project against current repository truth, identifying intentional evolution, validated learning, accidental drift, unresolved contradiction, stale assumptions, and acceptable tradeoffs. A difference from the original plan is not automatically an error.

### Context and interaction

Start from canonical project truth in priority order: AGENTS/canonical policy; project/scope/product docs; architecture/domain/security/operational docs; decisions/ADR-equivalent canonical records; roadmap/current backlog/current milestone; project map; selected recent/relevant tasks; dependency relationships; relevant code/tests only when needed to verify a specific claim. Reuse existing APK primitives (`apk status`, `apk tasks`, `apk task deps`, `apk context`, `apk suggest-context`, canonical docs) without inventing a new runtime/scanner/database; selected files are a selection interface and must be read before reasoning.

Run a real interactive loop instead of a questionnaire dump: establish repository truth; identify the highest-impact unresolved decision; ask one question at a time, first stating what the repository already establishes, what remains ambiguous, and why it matters; fold in the answer; re-prioritize. Prioritize high-impact uncertainty (wrong product goal, ownership, persistence model, security boundary, destructive behavior, irreversible architecture choice) over naming/layout/minor preferences. Do not ask questions the repository already answers. Stop when major uncertainty has materially reduced.

The grill must be willing to challenge: name a solution that conflicts with the current goal, an abstraction with no second consumer, speculative future-proofing cost unsupported by a real use case, or a roadmap optimizing the wrong problem. It must not argue for its own sake, invent requirements, or replace a human product decision; every point is labeled evidence, inference, hypothesis, or preference.

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
- docs/project-map.md
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs

## Files allowed to edit

- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
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
- src/core/templates/skills/apk-task-split/**
- src/core/templates/skills/apk-prototype/**
- src/core/templates/skills/apk-milestone-semantic-audit/**

## Steps

1. Confirm the existing packaged-skill convention, context/task interfaces, canonical documentation ownership, and the normal work/review/gate boundaries. Keep the whole deliverable asset/documentation/test-only and manual-only.
2. Add the canonical portable asset defining scope resolution for whole project, milestone, and bounded subsystem; bounded repository-grounded context selection; the interactive one-question-at-a-time loop; capability to challenge stale/inconsistent assumptions; and evidence/inference/hypothesis/preference labeling.
3. Define both use cases: initial project grill and checkpoint/re-grill, including how re-grill distinguishes intentional evolution, validated learning, accidental drift, unresolved contradiction, stale assumption, and acceptable tradeoff.
4. Define write/approval semantics: no writes before an explicit human-approved bounded proposal (confirmed decisions, changed assumptions, unresolved questions, tradeoffs, stale assumptions, proposed canonical doc changes, proposed backlog changes, proposed task creations/cancellations/deferments, and what is deliberately not changing); silence or a model-generated answer is never approval. Approved decisions go to discovered canonical owners, never a parallel grill store; backlog changes never rewrite completed history, reopen done tasks, or fabricate human decisions.
5. Document ownership discovery and boundaries versus `apk-task-grill` (one task before implementation), `apk-task-split` (decomposition), `apk-milestone-semantic-audit` (cross-contract consistency of completed tasks), and `apk-prototype` (bounded experiment), making them composable but never mutually required, with no mandatory lifecycle.
6. Add focused deterministic content/packaging tests consistent with the existing skill tests, cover whole-project/milestone/subsystem scopes, both use cases, manual-only/no-auto-trigger, approval-before-write, canonical-owner routing, no product-code implementation, no full-repo scan, and no provider-specific runtime requirement.
7. Update only the necessary canonical feature docs (README, agent-exporters, task-system, template-system, decisions) and regenerate committed dist through the normal build.

## Acceptance criteria

- One canonical `apk-project-grill` portable Markdown asset ships through the existing template/package mechanism, is present in built/package payload, and is explicitly loadable without a new CLI command.
- The skill runs only on explicit human request and never auto-activates; no scanner, work/review hook, heuristic, mandatory lifecycle step, or completion gate invokes it.
- One skill supports whole-project, milestone, and bounded subsystem/topic scope without separate per-scope assets.
- Both an initial project grill and a repeated checkpoint/re-grill are supported; re-grill compares intended project against repository truth without treating any plan difference as an error.
- Context selection is bounded and repository-grounded, prioritizes canonical project truth, reuses existing APK primitives, and reads code/tests only to verify specific claims rather than scanning the whole repository.
- The interaction asks iterative high-value questions one at a time with stated repository truth, remaining ambiguity, and impact, rather than dumping a questionnaire.
- The skill challenges inconsistent/stale assumptions while distinguishing evidence, inference, hypothesis, and human preference, and never substitutes its own product decision.
- No task/documentation write occurs before explicit human approval of a concrete bounded proposal; silence and model-generated answers are not approval.
- Approved decisions are written to discovered canonical owners (project/scope, architecture, domain, security, decisions, roadmap/planning, task contracts), never a parallel grill database, transcript, or generic `PROJECT_GRILL.md`.
- Backlog changes use canonical task lifecycle: new/corrective tasks get fresh IDs; completed task history and immutable evidence are never rewritten, reopened, or reset.
- No production code modification, feature implementation, migration, dependency change, refactor, or runtime/orchestration/provider infrastructure is introduced; the asset works as portable Markdown for local and generic harnesses.
- Packaging and instruction drift checks pass and committed `dist` includes the new asset; existing `apk-task-grill` semantics stay task-specific and unchanged, and common policy stays compact.

## Correctness assumptions

- A manually invoked external agent/harness performs the interviewing; APK supplies instructions and repository interfaces, not a conversation runtime.
- Repository docs/config/tasks define durable truth; a grill does not override existing documentation authority or task ownership.
- The existing `.hbs` copier and package `files` rule can ship the new asset without a new loader, dependency, or command.

## Invariants

- Optional and manual only; ordinary work is implementable without any project grill.
- No writes before explicit human approval; one canonical truth source per decision; no duplicated or parallel grill store.
- No product-code implementation, runtime infrastructure, automatic trigger, or mandatory lifecycle/gate.
- Completed task history and immutable evidence remain intact.

## Required evidence

- Deterministic instruction/package tests covering all three scopes, both use cases, manual-only behavior, approval-before-write, canonical-owner routing, history preservation, and common-policy isolation.
- Bounded built/package asset presence confirmation for `apk-project-grill`.

## Review questions

- Can any discovery text auto-activate the grill or make normal work depend on it?
- Does the skill constrain context instead of scanning the whole repository, and does it ask one high-value question at a time?
- Are approved decisions routed to actual canonical owners rather than a new parallel document or database?
- Do backlog/task changes preserve completed history and avoid fabricated human approval?
- Did the change stay asset/test/doc-only and preserve existing `apk-task-grill` semantics and compact common policy?

## Counterexample searches

- Whole-project grill reads every source file or dumps a 50-question checklist.
- Re-grill treats every divergence from the original plan as drift/error.
- Grill writes a decision file before approval, or invents an approval from a model answer.
- A completed done task is reopened or its evidence rewritten instead of creating a corrective task.
- The asset adds a CLI command, scanner, daemon, vector store, or provider-specific requirement.
- Common policy or `AGENTS.md` is inflated with the skill body, or existing task-grill scope broadens.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"packaged-skill","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node -e \"require('fs').existsSync('dist/core/templates/skills/apk-project-grill/SKILL.md.hbs')||process.exit(1)\""}`
- `{"id":"packaged-payload","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"npm pack --dry-run --json | grep -q \"apk-project-grill/SKILL.md.hbs\""}`

## Documentation updates

- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog creation only in this planning pass: no implementation, claim, package change, release, or skill invocation.
- Milestone boundary: portable skills supply reasoning; APK core supplies deterministic lifecycle/scope/evidence/enforcement; external agents/harnesses execute. No LLM/provider runtime, chat engine, second workflow state machine, hidden planner, workflow DSL, Wayfinder, or generic Handoff.
- Keep instructions compact for local/small models and do not inflate always-loaded AGENTS.md; this repository's convention is that packaged skills are documented in README/agent-exporters/template-system docs, not listed by name in generated common policy. Do not add skill names to AGENTS.md.
- Do not create a second source of truth: no generic `PROJECT_GRILL.md`, context/state store, or session transcript.
- Parallel denotes semantic independence; shared docs/tests/dist require separate worktrees and coordinated integration, never concurrent mutable tasks in one worktree.
- Ready for the v0.4.5 release after this task and the release-ordering corrective are done. No dependency on blocked 0133; do not force-complete or launder blocked historical tasks.
