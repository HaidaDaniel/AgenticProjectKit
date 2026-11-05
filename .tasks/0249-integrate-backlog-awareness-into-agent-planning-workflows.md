# Task 0249 - Integrate backlog awareness into agent planning workflows

State: todo
Owner: none
Mode: product
Lane: instructions
Type: feature
Scope: backlog,planning,skills,docs,agents
Risk: medium
Parallel: false
Depends on: 0246,0247,0248
Tags: p2,backlog,planning,skills,docs,agents

## Goal

Teach planning agents to distinguish durable future ideas from executable task contracts and to use the backlog only when the human wants an idea recorded or deferred while preserving canonical task authoring for work that is ready now.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/roadmap.md
- docs/cli-commands.md
- docs/decisions.md
- docs/modes.md
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- src/core/exporters/index.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts
- .tasks/0246-make-ci-planning-maturity-aware-and-proportional.md
- .tasks/0247-add-lightweight-backlog-storage-and-cli.md
- .tasks/0248-promote-backlog-items-into-canonical-apk-tasks-safely.md

## Files allowed to edit

- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- src/core/exporters/index.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- docs/roadmap.md
- docs/task-system.md
- docs/cli-commands.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/core/backlog/**
- src/cli/**

## Steps

1. Define the planning decision rule for recording an idea creating a deferred post-MVP item creating a full task now detecting an existing contract and handling a changed mind; require backlog proposals to be surfaced before creating a new task so motivation and prior decisions are visible; keep promotion explicit and human-confirmed with no automatic promotion; update apk-project-grill apk-task-author apk-task-split and apk-task-grill with bounded backlog awareness that does not trigger on ordinary implementation verification review or status work; update the neutral exporter policy and generated init and adopt instructions; update roadmap task-system CLI and decision documentation to match the actual implementation; add deterministic scenarios for CI after MVP a future feature idea fixing a bug now an idea already in backlog a changed mind and a blocked task that is not a backlog item

## Acceptance criteria

- Planning skills remain optional and manually invoked; no skill auto-activates.
- A human request to remember a future idea can produce a backlog proposal or item only when explicitly allowed.
- No backlog item is created automatically from an ordinary user message without explicit permission.
- A post-MVP request becomes a deferred card with promotion criteria.
- A request for work now uses the canonical task workflow.
- An existing contract is not duplicated in backlog.
- Relevant backlog proposals are considered before creating a task.
- Reaching promotion criteria produces a proposal rather than automatic promotion.
- Planning does not ask questions already answerable from repository truth.
- Not every idea becomes a mandatory project stage.
- Backlog awareness is bounded to planning and task-authoring context and does not run a full scan during ordinary implementation, verification, review, or status work.
- No second task store, persistent model memory, RAG, vector database, polling, or background agent is added.
- Generated instructions remain backward compatible and require no new configuration key.
- Docs and generated agent instructions match the implemented CLI.

## Correctness assumptions

- Planning skills remain optional manual instruction assets; backlog cards are lightweight context rather than lifecycle state; the canonical task workflow remains authoritative for executable work

## Invariants

- No automatic promotion; no persistent model memory RAG vector database polling or background agent; no duplicate canonical task versus backlog records; no new lifecycle state or mandatory planning stage

## Required evidence

- Focused instruction and template tests for all six scenarios; evidence that ordinary implementation verification review and status do not scan the backlog; evidence that generated agent instructions are current

## Review questions

- Can a planner silently promote a card or create a duplicate task; can backlog awareness add full-repository scanning to ordinary work; does the skill distinguish a blocked executable task from a deferred idea; are the documented CLI semantics real rather than aspirational

## Counterexample searches

- Idea for CI after MVP; future feature idea; bug to fix now; idea already in backlog; user changes their mind; blocked task treated as backlog; existing task contract already covers the idea; ordinary status run with many backlog cards

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/roadmap.md docs/task-system.md docs/cli-commands.md and docs/decisions.md as needed; update generated agent exports and init adopt starter text; update docs/progress.md when task state changes

## Notes

- Depends on tasks 0246, 0247, and 0248 because planning instructions reuse the CI policy and backlog/promotion behavior. Scratch-directory behavior is not a semantic prerequisite and is not a dependency; Tasks 0245 and 0250 share skills, exporter, init/adopt, generated, docs, and dist files, so sequence those edits or use an isolated worktree.
- This task is instruction integration only and must not add runtime scanning or memory.
- Active todo Task 0223 also edits docs/cli-commands.md docs/decisions.md docs/progress.md and dist; this task does not depend on that large opt-in CI feature but must sequence shared generated documentation and dist integration
