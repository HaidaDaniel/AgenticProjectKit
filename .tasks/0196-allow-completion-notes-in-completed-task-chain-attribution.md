# Task 0196 - Allow completion notes in completed task chain attribution

State: doing
Owner: codex-recheck-20261007
Mode: product
Lane: workflow
Type: bugfix
Scope: tasks,provenance,verification,docs
Risk: high
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Make completed-task chain attribution accept non-semantic completion notes added after the candidate while keeping material contract changes fail-closed.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- .tasks/0191-materialize-apk-skills-into-standards-based-project-skill-directories.md
- .tasks/0193-make-verification-proportional-and-remove-redundant-quality-runs.md
- .tasks/0194-move-cli-behavior-matrices-to-isolated-command-layer-tests.md
- .tasks/0195-prove-completed-multi-commit-task-chains-in-stale-baseline-scope-exclusion.md

## Files allowed to edit

- src/core/tasks/**
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/cli/**
- src/core/skills/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce first-commit chain failure when completion notes are added after the candidate
2. Define the normalized material contract boundary for attribution
3. Add regression coverage for notes and material contract edits
4. Update scope-attribution documentation
5. Regenerate dist and complete candidate verification and review

## Acceptance criteria

- A completed first-commit task with terminal notes is excluded from a stale baseline scope
- Multi-commit attribution accepts only unchanged material scope verification and contract fields
- Changing a material task field inside the chain remains unprovable
- Existing fail-closed attribution tests continue to pass
- Documentation describes the notes boundary without weakening path scope or forbidden checks

## Correctness assumptions

- Task notes are narrative lifecycle context and do not define allowed or forbidden paths
- The current task file remains the authoritative material contract for scope verification

## Invariants

- No out-of-scope or forbidden path becomes excludable
- Material contract edits remain fail-closed
- Bounded ancestry and ambiguity checks remain unchanged

## Required evidence

- Pre-fix failing regression
- Post-fix passing regression
- Existing fail-closed attribution suite

## Review questions

- Can a task rewrite allowed or forbidden paths and still be attributed?
- Does the notes exception affect direct and chained completion proof?
- Are completion notes excluded without changing scope checks?

## Counterexample searches

- Completion notes added after candidate
- Allowed path changed inside chain
- Forbidden path changed inside chain
- Overlapping completed chains
- Task file created in first commit

## Verification

- `{"id":"static-quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality:static"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/task-system.md
- docs/progress.md

## Notes

- This corrective task follows the independent recheck of Task 0195 and the stale-baseline Task 0191 history.
