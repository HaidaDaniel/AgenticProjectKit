# Task 0132 - Add optional bounded throwaway prototype skill

State: todo
Owner: none
Mode: product
Lane: instructions
Type: feature
Scope: skills,prototype-guidance,docs,tests
Risk: low
Parallel: true
Depends on: 0067,0092
Tags: feature,skills,docs,p2

## Goal

Ship a small manual portable apk-prototype instruction asset for question -> bounded throwaway experiment -> observation -> conclusions -> discard. Explore uncertain library/API/protocol/integration/performance/migration/runtime feasibility cheaply before an expensive durable decision; do not silently promote prototype code to production.

Use proposed src/core/templates/skills/apk-prototype/SKILL.md.hbs and existing .hbs copier/dist inclusion. Inspect repository answers first, state the experiment question, success/failure observation, time/cost/context and temporary-path boundaries. Execute only a specifically authorized bounded experiment in owned scratch space or an appropriate isolated disposable fixture; respect external effects/data/secrets and existing project permissions. No root dependency/config/product changes, live workers or migrations by default.

Report tested conditions, observed results, supported/refuted hypotheses, production-relevant conclusions, limitations/unknowns and exact temporary artifacts to discard or leave uncommitted. Keep experiment artifacts, durable canonical decisions and future production tasks distinct. Cleanup touches only proven experiment-owned artifacts; never discard user/pre-existing/foreign files. A successful prototype is not production verification or gate evidence.

If conclusions imply architecture/docs/task changes, propose a bounded canonical delta and ask for explicit human approval before structural writes; silence/refusal writes none. Discover actual canonical ownership instead of inventing another decision store. Production work requires its own ordinary task/verification; no auto-task creation, auto-commit, new runtime/database/state/artifact platform or mandatory spike. Plain compact instructions work on local and compatible harnesses without a required model/provider.

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
- docs/execution-profiles.md
- .tasks/0067-generate-budgeted-task-context-packs.md

## Files allowed to edit

- src/core/templates/skills/apk-prototype/SKILL.md.hbs
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
- src/core/templates/skills/apk-milestone-semantic-audit/**

## Steps

1. Confirm canonical instruction shipping and repository decision/task ownership; keep this P2 slice asset/documentation-only and manual-only.
2. Define explicit question/authorized experiment bounds, observed success/failure, scratch isolation and stop conditions; inspect existing repository answers before spending experiment effort.
3. Define a concise observation/conclusion/unknowns/artifact report, safe experiment-owned cleanup, and an explicit distinction from durable decisions/production implementation.
4. Propose canonical architecture/task/docs changes only when warranted and write only after explicit human approval. No automatic production promotion or new lifecycle/store.
5. Add deterministic instruction/package fixtures for manual invocation, finite bounds, evidence limits, no unapproved structural writes and safe cleanup ownership. Document loading, commit, build and verify.

## Acceptance criteria

- One packaged manually loadable compact apk-prototype asset supports local/compatible agents without new CLI/runtime/installer or mandatory spike.
- Instructions check repository truth first and specify the question, finite time/cost/context/temporary-path scope, permitted observations and stop conditions before an authorized experiment.
- Experiments stay throwaway/isolated and do not silently change product/root dependencies/config, run live migrations/workers, or become production implementation.
- Output distinguishes observations and supported/refuted hypotheses from assumptions, production design conclusions, unknowns and unverified performance/generalization claims.
- Report names temporary artifacts that must be discarded or excluded from commits; cleanup requires proven experiment ownership and preserves foreign/pre-existing user work.
- Durable architecture/docs/task edits require a human-visible canonical proposal and explicit approval; refusal/silence writes nothing. Future production work follows its own task/verification, not prototype gate evidence.
- Deterministic packaging/instruction fixtures cover manual-only invocation, bounds, no approval/no write, no auto-promotion and cleanup boundaries without a model/experiment-quality guarantee.

## Correctness assumptions

- A small throwaway observation can reduce uncertainty but need not generalize to production.
- Manual invocation is not blanket authority for product writes, external effects or destructive cleanup.
- Existing canonical docs/tasks suffice for approved conclusions; no prototype state store is needed.

## Invariants

- Optional manual reasoning asset, finite throwaway scope, no automatic production promotion.
- No unapproved structural writes; temporary, durable and production artifacts remain distinct.
- Cleanup only experiment-owned artifacts; no model/runtime/state/database/platform or completion gate.

## Required evidence

- Package/instruction fixtures for finite experiment bounds, observation/unknown reporting, approval and artifact ownership.
- Synthetic API/performance or migration experiment examples explicitly labelled illustrative rather than executed production proof.

## Review questions

- Are temporary artifacts and durable conclusions clearly distinct?
- Can invocation or cleanup delete user work or change production state without authority?
- Do observed facts stay bounded rather than presented as universal feasibility/performance proof?

## Counterexample searches

- Successful scratch code copied directly into production; API experiment incurs unapproved effects; cleanup path includes pre-existing files.
- Negative/inconclusive experiment, exhausted budget, rejected architecture proposal, or unsupported production generalization.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"packaged-skill","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node --input-type=module -e \"import { access } from 'node:fs/promises'; import { execFileSync } from 'node:child_process'; const p='dist/core/templates/skills/apk-prototype/SKILL.md.hbs'; await access(p); const [pack]=JSON.parse(execFileSync('npm',['pack','--dry-run','--json'],{encoding:'utf8'})); if(!pack.files.some(f=>f.path===p)) throw new Error('Skill missing from package payload');\""}`

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
- P2; included in this release only as a small portable asset. No dependency on split/grill/review implementation; optional richer experiment automation is outside V1.
