# Task 0189 - Finish terminal task archiving and reference safety

State: doing
Owner: codex-continue-20261005-2055
Mode: maintenance
Lane: maintenance
Type: bugfix
Scope: archive,tasks,references,dependencies,maintenance
Risk: high
Parallel: false
Depends on: 0187,0188
Tags: archive,maintenance,ux,correctness

## Goal

Remove the remaining manual archive workarounds: support safe archiving of all appropriate terminal task states, especially canceled tasks, and detect literal task-path references before a move can break current docs/contracts/source fixtures.

Keep archived task contents byte-identical and preserve dependency resolution by task ID.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/documentation-maintenance.md
- docs/progress.md
- src/core/tasks/index.ts
- src/cli/commands/task.ts
- .tasks/0180-archive-completed-task-history-and-clarify-apk-self-update-validation.md
- .tasks/0187-design-a-lower-noise-task-lifecycle-without-losing-distributed-state.md
- .tasks/0188-add-stable-self-apk-verification-checks-without-shell-path-coupling.md

## Files allowed to edit

- src/core/tasks/**
- src/cli/commands/task.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- dist/**
- docs/task-system.md
- docs/cli-commands.md
- docs/engineering/documentation-maintenance.md
- docs/progress.md
- .tasks/0189-finish-terminal-task-archiving-and-reference-safety.md

## Files forbidden to edit

- src/core/scanners/**
- src/core/execution/**
- package.json
- pnpm-lock.yaml
- .github/**
- docs/releases/**
- .tasks/archive/**

## Steps

1. Reproduce the current rejection/workaround for archiving canceled tasks.
2. Define the terminal-state archive policy after considering Task 0187's lifecycle recommendation; at minimum done and canceled terminal tasks must have explicit supported behavior.
3. Add a dry-run/preview that lists the exact moves and scans bounded tracked repository text for literal references to each current .tasks/<file>.md path.
4. Classify references that are automatically safe through ID-based dependency resolution versus literal-path references that require retention or an explicit updating task.
5. Refuse a destructive archive move when a live literal reference would be broken unless the caller explicitly scopes corresponding reference updates through the normal task contract; never rewrite historical/versioned artifacts automatically.
6. Preserve archived task bytes exactly.
7. Make --all use the same preview/safety rules and produce actionable skipped reasons.
8. Regress dependency resolution, next-task/status, archive index/documentation behavior, and regenerate committed dist.

## Acceptance criteria

- Canceled terminal tasks have a supported archive path; manual filesystem moves are no longer the documented normal workflow.
- archive preview reports exact source/destination paths, state, dependents, and literal path references.
- ID-based dependencies continue resolving across archive unchanged.
- A live context/source/doc literal path that would break causes a clear skip/block before mutation.
- Immutable release/history artifacts are never rewritten automatically.
- Archived task contents remain byte-identical.
- --all is deterministic and skips unsafe tasks with reasons rather than partially guessing.
- Task 0187's accepted lifecycle source is used; this task does not create a competing state model.
- Existing done-task archive behavior remains compatible.

## Correctness assumptions

- Archiving is repository maintenance, not task-history rewriting.
- Literal path references are the primary reason a terminal task may need to stay top-level temporarily.

## Invariants

- No history-content mutation during archive.
- No broken dependencies.
- No automatic rewrite of immutable release/history records.
- Preview and apply select the same move set unless repository state changes.

## Required evidence

- Canceled-task archive fixture.
- Live literal-reference blocking fixture.
- ID-only dependency fixture.
- Byte-identity check before/after archive.

## Review questions

- Can --all move a task whose path is still needed by an unfinished task?
- Are false-positive reference matches bounded and explainable?
- Does archive behavior remain valid under the lifecycle recommendation from 0187?

## Counterexample searches

- Canceled task with active dependent.
- Done task referenced from source test fixture.
- Archived prerequisite of active task.
- Same task filename mentioned in historical release note.
- Repository changes between preview and apply.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint","evidenceRef":"archive-task-tests"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Replace the canceled-task/manual-move workaround with preview/apply guidance and reference-safety rules.

## Notes

- Task 0180 documented that archive can preserve ID dependencies but literal .tasks/<file>.md references do not relocate themselves, and that canceled tasks still required a manual move workaround.
- This task waits for 0187 so archive semantics align with whatever lifecycle source is accepted rather than baking in a soon-obsolete State field assumption.
