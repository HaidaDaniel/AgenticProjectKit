# Task 0186 - Harden task-contract authoring evidence and path ergonomics

State: done
Owner: codex-continue-20261005-2055
Mode: product
Lane: tooling
Type: bugfix
Scope: task-contract,verification,evidence,lint,paths,authoring
Risk: high
Parallel: false
Depends on: 0184
Tags: tasks,lint,ux,dogfood,correctness

## Goal

Eliminate two recurring APK-self-inflicted correction commits from downstream dogfood:

1. agents naturally write narrative text into the verification evidence field and hit the hidden 240-character reference limit;
2. agents express "everything under X is forbidden except this allowed child" and only later discover a path-contract-contradiction.

Keep strict task contracts, but make the schema and diagnostics guide agents toward the valid form before implementation/review work is wasted.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- docs/engineering/testing-strategy.md
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/audit/lint.ts
- src/cli/commands/task.ts
- .tasks/0184-support-bounded-git-dag-and-merge-attribution-for-task-scope.md

## Files allowed to edit

- src/core/tasks/**
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/audit/audit.test.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- src/core/templates/task-templates.ts
- dist/**
- docs/task-system.md
- docs/cli-commands.md
- docs/engineering/testing-strategy.md
- docs/progress.md
- .tasks/0186-harden-task-contract-authoring-evidence-and-path-ergonomics.md

## Files forbidden to edit

- src/core/scanners/**
- src/core/execution/**
- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce the >240-character evidence-reference failure and allowed-child/forbidden-parent contradiction from real downstream-shaped fixtures.
2. Introduce an explicit short evidenceRef concept in structured verification while keeping legacy evidence as a backward-compatible alias.
3. Add a separate optional narrative summary field with a materially larger bounded size and map it to the existing evidence-record summary rather than forcing prose into the reference.
4. Improve parser/lint/CLI errors so they say that evidence/evidenceRef is a short locator/reference and direct long explanation to summary/Notes.
5. Make task create/template preflight detect path overlap before writing a task contract.
6. Keep overlap fail-closed, but emit an actionable diagnostic for the common parent-forbidden/child-allowed case explaining that the positive allowlist already bounds edits and the broad forbidden parent should be removed or narrowed.
7. Ensure built-in templates never generate an overlapping allowed/forbidden contract.
8. Regenerate committed dist and update docs/examples.

## Acceptance criteria

- New structured checks may use evidenceRef for a <=240-character locator and summary for bounded narrative context.
- Existing checks using evidence continue to parse and round-trip unchanged.
- Supplying both incompatible aliases is rejected deterministically; no ambiguous precedence.
- An overlong reference error explicitly explains where narrative evidence belongs.
- Task creation/preflight catches overlapping allow/forbid patterns before implementation starts.
- path-contract-contradiction remains an error; strict scope is not weakened and allowed-wins semantics are not silently introduced.
- The common allowed child inside a forbidden parent gets a concrete remediation message.
- ResLedger-shaped task contracts for specific internal/app subtrees can be authored without a later correction commit.
- Verification/evidence records preserve short-reference safety and do not start storing unbounded command output.

## Correctness assumptions

- The 240-character safety bound is appropriate for references, but the current field name invites misuse.
- Positive allowedFiles already forms the primary edit boundary; forbiddenFiles is for explicit additional exclusions, not a second overlapping precedence language.

## Invariants

- No silent scope broadening.
- Backward-compatible legacy task parsing.
- Evidence records remain bounded.
- Task lint remains deterministic/read-only unless an existing explicit create/write operation is used.

## Required evidence

- Fixture for long narrative evidence misuse.
- Fixture for allowed internal/app/asset/** plus forbidden internal/app/**.
- Round-trip tests for legacy evidence and new evidenceRef/summary.

## Review questions

- Can any alias combination lose evidence text silently?
- Does the suggested path fix preserve the intended allowlist boundary?
- Are diagnostics useful to a small/local model without requiring source-code knowledge?

## Counterexample searches

- Equal allowed/forbidden pattern.
- Sibling patterns that do not overlap.
- Globstar parent/child overlap.
- Evidence reference URL near limit.
- Multiline summary/reference.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json","evidenceRef":"task lint JSON output"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update structured verification examples and path-contract guidance with the new authoring model.

## Notes

- ResLedger required separate commits to shorten a verification evidence value and to remove broad forbidden internal/app/** entries after narrower internal/app/** paths were added to allowedFiles.
- This task follows 0184 because both edit task parsing/scope code; it must not race the baseline/DAG work.
