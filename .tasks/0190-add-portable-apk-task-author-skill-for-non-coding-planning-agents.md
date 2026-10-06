# Task 0190 - Add portable APK task-author skill for non-coding planning agents

State: review
Owner: codex-continue-20261005-2055
Mode: product
Lane: instructions
Type: feature
Scope: skills,task-authoring,planning,agents,docs,tests
Risk: medium
Parallel: false
Depends on: 0189
Tags: skills,planning,tasks,agents,dogfood

## Goal

Ship one optional portable instruction asset, `apk-task-author`, that lets a non-coding planning agent turn a human natural-language request into one or more high-quality APK task contracts without implementing code.

The primary dogfood target is Hermes Agent, but the skill must remain harness-neutral and compatible with the existing APK packaged-skill convention. It should work for any agent that can read repository files and invoke the repository-local `apkit` CLI through a terminal/shell tool.

The skill owns task authoring only: inspect repository truth, detect overlap/duplicates, ask only material clarification questions, preview the proposed contract, obtain explicit human approval, create through canonical APK task facilities, validate the resulting graph/contract, and stop before claim/implementation.

## Context files

- AGENTS.md
- README.md
- docs/task-system.md
- docs/cli-commands.md
- docs/agent-exporters.md
- docs/engineering/template-system.md
- docs/engineering/testing-strategy.md
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- src/cli/commands/task.ts
- .tasks/0186-harden-task-contract-authoring-evidence-and-path-ergonomics.md
- .tasks/0188-add-stable-self-apk-verification-checks-without-shell-path-coupling.md
- .tasks/0189-finish-terminal-task-archiving-and-reference-safety.md

## Files allowed to edit

- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- README.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/progress.md
- dist/**
- .tasks/0190-add-portable-apk-task-author-skill-for-non-coding-planning-agents.md

## Files forbidden to edit

- src/core/tasks/**
- src/core/scanners/**
- src/core/audit/**
- src/core/execution/**
- src/core/work/**
- src/core/resources/**
- src/cli/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Define concise standards-compatible skill frontmatter and invocation guidance; keep the skill harness-neutral while ensuring it is usable by Hermes-class agents with repository read access and a terminal tool.
2. Establish repository truth before drafting: canonical policy/project/scope/architecture docs, active and archived task summaries, current roadmap/milestone, direct dependencies, and relevant context suggestions. Never scan the whole repository by default.
3. Detect existing tasks that already cover the request or would materially overlap its files/scope. Prefer extending a still-unfinished canonical task when appropriate; never rewrite completed history.
4. Decide whether the request is one task or materially needs decomposition. For a genuinely multi-slice target, propose use of `apk-task-split` instead of creating a giant catch-all contract or unresolved multi-task dependency preview.
5. Build a complete preview with title, type/template, mode, lane, risk, scope, goal, context, allowed/forbidden paths, dependencies, parallel flag, steps, acceptance, structured verification, correctness assumptions, invariants, required evidence, review questions, counterexample searches, docs updates, and notes as applicable.
6. Ask one clarification at a time only when a material choice cannot be resolved from repository truth. Do not ask the human to choose implementation details already owned by the future coding agent.
7. Require explicit approval of the concrete preview before any task write. After approval, create through `apkit task create` rather than hand-allocating IDs or directly inventing task filenames.
8. Immediately validate the new contract with `apkit lint --json`, inspect `apkit task deps <new-id>`, and report the actual ID/path and any remaining blockers. If validation fails, stop and report the failing command and blocker; do not directly edit the created contract or continue into implementation.
9. Stop before claim, work-package generation, implementation, verification, review, or done.
10. Add focused deterministic instruction/packaging tests and regenerate committed dist.

## Acceptance criteria

- One canonical `apk-task-author` packaged Markdown asset ships through the existing skill/template mechanism.
- The skill can turn a plain-language product/bug/refactor/docs request into a complete APK task contract without requiring the agent itself to be a coding agent.
- The skill uses repository truth and existing task graph/context before proposing work, and explicitly checks for duplicate/overlapping active work.
- It uses canonical `apkit task create` for ID allocation and contract creation rather than directly writing an arbitrary `.tasks/<id>.md` file.
- It validates the result with APK lint and dependency inspection before reporting success.
- It does not claim tasks, implement product code, run review, fabricate evidence, or mark work done.
- It asks only material questions not already answered by repository truth and keeps local implementation choices for the future implementation agent.
- Explicit human approval is required after the concrete task preview and before writing. A vague conversation, silence, or model-generated preference is not approval.
- Existing done/archive history is immutable; defects in completed work become fresh corrective tasks.
- Large requests are not silently stuffed into one giant contract; the skill recognizes when task-split is the appropriate next planning operation.
- The skill is portable Markdown and has no provider SDK, Hermes runtime dependency, model router, daemon, or new APK core lifecycle state.
- The frontmatter/body remain compatible with standards-based skill loaders; Hermes-specific metadata is optional and must not be required for correctness.
- Existing APK skills remain unchanged in semantics.

## Correctness assumptions

- A planning agent with repository read access plus terminal access to the repository-local APK CLI is sufficient to author tasks.
- Deterministic APK task creation/linting should own IDs/schema/graph safety; the LLM skill should own semantic planning and bounded clarification.
- Task 0186 has already improved evidence/path authoring diagnostics before this skill relies on them.

## Invariants

- Planning only; no implementation.
- Canonical task system remains the only task source of truth.
- No duplicate skill-specific task database or planner state.
- No task write before explicit approval.
- No direct dependence on Hermes internals.

## Required evidence

- Deterministic skill-content tests covering duplicate detection, one-task authoring, material clarification, large-request handoff to task-split, approval-before-write, canonical CLI creation, post-create lint/deps validation, and stop-before-implementation.
- Built/package asset presence for `apk-task-author`.

## Review questions

- Can a weak/local planning model follow the procedure without knowing APK internals?
- Does the skill avoid asking the human for details that repository inspection can answer?
- Can it accidentally create a duplicate task or a giant horizontal catch-all?
- Does any wording authorize implementation merely because task creation was approved?
- Is task creation always delegated to canonical APK facilities?

## Counterexample searches

- Request already fully covered by an active task.
- Bug in historically completed work.
- Request spanning unrelated subsystems and multiple observable outcomes.
- User asks only to record an idea, not implement it.
- Repository has no obvious verification command.
- Proposed allowed/forbidden paths overlap.
- Dependency candidate is archived/done versus active/blocked.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"packaged-skill","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node -e \"require('fs').existsSync('dist/core/templates/skills/apk-task-author/SKILL.md.hbs')||process.exit(1)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document the new optional task-author skill, its relation to task-split/task-grill, and its planning-only boundary.

## Notes

- Hermes Agent currently documents skills as on-demand Markdown compatible with the agentskills.io standard and recommends a Skill rather than a custom Tool when the capability is instructions plus an external CLI invoked through terminal access.
- Hermes can discover project-local `.agents/skills/<skill>/SKILL.md`, but APK currently packages canonical skill sources as `SKILL.md.hbs`; native materialization/discovery is intentionally a separate Task 0191 so this task does not grow a second skill installer/export system.
