# Task 0246 - Make CI planning maturity-aware and proportional

State: todo
Owner: none
Mode: product
Lane: instructions
Type: feature
Scope: ci,planning,modes,skills,docs,verification
Risk: medium
Parallel: false
Depends on: none
Tags: p2,ci,planning,modes,skills,docs,verification

## Goal

Teach project and task planning instructions to treat CI as a maturity-aware choice rather than a default requirement so discovery and MVP work use relevant local checks while product and production work add CI only when a concrete need and its cost are justified.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/modes.md
- docs/engineering/testing-strategy.md
- docs/decisions.md
- docs/product/maturity-and-compatibility.md
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- src/core/exporters/index.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts
- .tasks/0193-make-verification-proportional-and-remove-redundant-quality-runs.md
- .tasks/0223-add-opt-in-exact-commit-local-ci-parity-before-push.md

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
- docs/modes.md
- docs/engineering/testing-strategy.md
- docs/task-system.md
- docs/decisions.md
- docs/product/maturity-and-compatibility.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .tasks/0223-add-opt-in-exact-commit-local-ci-parity-before-push.md
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/cli/**

## Steps

1. Confirm the current planning skills and docs do not distinguish discovery MVP product and production CI expectations; define one mode-aware policy covering discovery-stage/prototype work, MVP, product, and production; treat prototype as discovery-stage experimental work rather than a new operating mode; add explicit exception reasons for pre-MVP CI including automated deployment, multiple active developers, release or security requirements, reproducible clean-checkout problems, and an established repository quality policy; preserve explicit quality.required capabilities, quality.recommended semantics, existing CI configuration, and any already approved task contract as authoritative; update apk-project-grill, apk-task-author, apk-task-split, and apk-task-grill to surface CI need instead of mandating it and to prefer a deferred backlog candidate when implementation is premature; update modes, testing, task-system, maturity, and decision documentation plus generated init and adopt instructions and neutral exporter policy; add minimal deterministic instruction and template regressions and confirm Task 0223 local CI parity remains a separate opt-in capability

## Acceptance criteria

- Discovery-stage and MVP guidance does not require CI by default.
- MVP guidance prefers relevant lint, typecheck, focused tests, and build or smoke checks plus optional fast local hooks where useful.
- Product guidance recommends a minimal clean-checkout CI only after MVP acceptance is recorded or explicitly confirmed by an operator, and only when useful.
- Production guidance calls for checks sufficient for real users, integration, publication, and security.
- Every allowed pre-MVP CI exception names a verifiable reason.
- A quality.required ci capability or an approved task contract overrides the new default.
- quality.recommended remains recommended and never becomes required.
- Existing approved CI configuration is not disabled automatically by planning guidance.
- Project mode governs default CI expectations; task mode is not reinterpreted as project maturity, and neither rewrites the other.
- No new CI engine, mandatory gate, or global maturity schema is introduced.
- Task 0223 is not duplicated or modified.
- Focused skill and template tests pass.

## Correctness assumptions

- Mode describes project phase rather than a new maturity measurement system; planning skills are instructions rather than a runtime policy engine; local checks can provide useful MVP feedback without hosted CI

## Invariants

- No mandatory CI for discovery or MVP; no weakening of explicit quality.required, quality.recommended, existing CI configuration, or approved task verification; no new lifecycle gate or execution engine; APK does not install a CI provider or generate host workflows; project mode and task mode stay independent axes; MVP acceptance is never inferred from dates, task completion, or agent output

## Required evidence

- Focused instruction regression output for the mode table and exceptions; evidence that quality.required and approved contracts win; evidence that 0223 remains unchanged and separate

## Review questions

- Does the policy accidentally make CI optional in production or when quality.required names it; can a planner still mistake a best-practice slogan for a verifiable requirement; is prototype correctly treated without inventing a new mode; does the change duplicate the opt-in local CI parity task

## Counterexample searches

- Discovery project with one developer and no deployment; MVP with a fast local suite; product after an accepted MVP; production release with security obligations; quality.required includes ci; existing approved task requires CI; idea for CI before MVP; Task 0223 parity scope

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Update docs/modes.md docs/engineering/testing-strategy.md docs/task-system.md docs/decisions.md and docs/product/maturity-and-compatibility.md; update generated agent instructions and init adopt starter text; update docs/progress.md when task state changes

## Notes

- No task dependency is justified: scratch-directory behavior is not an API or semantic prerequisite for CI planning policy. Tasks 0245, 0249, and 0250 edit src/core/init/index.ts or src/core/docs/adopt.ts; Task 0223 shares docs/decisions.md, docs/progress.md, and dist. These are merge-conflict boundaries, not API prerequisites, so sequence those edits or use an isolated worktree.
- Task 0223 remains the separate opt-in exact-commit local CI parity feature and is not a prerequisite; a premature CI need may become a backlog candidate rather than an executable task.
