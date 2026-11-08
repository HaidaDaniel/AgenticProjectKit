# Task 0273 - Integrate document proposals into planning guidance and generated instructions

State: done
Owner: opencode-milestone
Mode: maintenance
Lane: planning
Type: feature
Scope: planning,skills,generated-instructions,docs,proposals
Risk: low
Parallel: false
Depends on: 0272
Tags: p2,proposals,planning,generated-instructions,skills

## Goal

Teach planning agents to distinguish a short thought an engineering note an experiment result a document proposal a deferred backlog idea and an executable task while keeping proposal discovery bounded and avoiding new mandatory agents or hot-path scans.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/proposals.md
- docs/agent-exporters.md
- src/core/exporters/index.ts
- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- .tasks/0249-integrate-backlog-awareness-into-agent-planning-workflows.md
- .tasks/0272-add-validated-canonical-document-and-backlog-linkage-for-proposals.md

## Files allowed to edit

- src/core/exporters/index.ts
- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-prototype/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- scripts/check-docs-consistency.test.mjs
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/proposals.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/cli/**
- src/core/tasks/**
- src/core/backlog/**

## Steps

1. Extend the neutral agent policy with a bounded rule that distinguishes saving technical information as a proposal from creating a backlog item or an executable task and forbids auto-acceptance or factual promotion.
2. Update packaged planning skills so a request to save research an idea or an experiment proposes a proposal only when appropriate and checks relevant proposals for overlap before authoring a task.
3. Keep discovery bounded: use explicit proposal IDs slugs or a filtered list and never scan proposals during ordinary implementation verification review status gate or next-task work.
4. Update renderer and documentation-constraint tests to assert the new planning distinction and generated-instruction sync.
5. Regenerate committed generated instruction files from the neutral policy and rebuild committed dist.
6. Document the planning distinction in docs/proposals.md docs/task-system.md and docs/decisions.md; update docs/progress.md.

## Acceptance criteria

- Planning guidance clearly distinguishes a short thought an engineering note an experiment result a proposal a backlog item an executable task an accepted ADR and a canonical runbook.
- Agents do not create proposals automatically do not accept them without an operator decision and do not treat observations as canonical facts.
- Proposal discovery during planning is bounded and optional; ordinary commands do not enumerate proposals.
- Generated AGENTS CLAUDE and GEMINI instructions stay in sync with the neutral policy.
- Renderer and documentation tests pass.

## Correctness assumptions

- Proposal guidance belongs in the existing neutral agent policy and packaged planning skills rather than a new autonomous agent.; Planning discovery is bounded to explicitly relevant proposals and never scans the proposal inventory during ordinary work.

## Invariants

- No new mandatory planning stage agent gate or lifecycle state is introduced.; Agents do not create a proposal from every message accept a proposal without an operator decision or treat an observation as canonical fact.; Ordinary implementation verification review status and gate commands do not read proposals.

## Required evidence

- Rendered-policy and skill test output plus a hot-path check proving ordinary commands do not enumerate proposals.

## Review questions

- Can an agent distinguish proposal from backlog and task using this guidance?; Is proposal discovery bounded and optional?; Did generated instructions stay in sync?

## Counterexample searches

- Search a request to save information
- a deferred implementation idea
- an accepted proposal
- an experiment observation
- a small task
- and an ordinary status or verify invocation.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/templates/renderer.test.ts"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"sync-check","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"sync-check"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document planning use of proposals in docs/proposals.md and docs/task-system.md.
- Record the planning decision in docs/decisions.md.
- Update docs/agent-exporters.md and docs/progress.md.

## Notes

- No new autonomous agent or mandatory stage is introduced.
- Preserve the existing backlog distinction and do not duplicate backlog guidance.
