# Task 0167 - Keep CLI reference aligned with the command registry

State: todo
Owner: none
Mode: maintenance
Lane: cli
Type: feature
Scope: cli-reference,command-registry,docs,tests
Risk: medium
Parallel: false
Depends on: 0165
Tags: feature

## Context files

- AGENTS.md
- src/cli/index.ts
- src/cli/commands
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/task-system.md

## Files allowed to edit

- src/cli/index.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/progress.md

## Files forbidden to edit

- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Goal

Make the public CLI reference derive from or deterministically validate against implemented command definitions.

## Steps

1. Inventory command declarations, dispatch, help, argument parsing, and current reference.
2. Choose a small source-of-truth design: structured registry driving help/reference or deterministic consistency check.
3. Document each public command, argument, option, default, side effect, and relevant failure mode.
4. Add focused tests showing a missing/stale reference fails deterministically.

## Acceptance criteria

- Every implemented public command and option appears accurately in reference.
- Reference uses one canonical identity and separates user and contributor workflows.
- A deterministic test detects a deliberately missing/stale entry.
- Consistency requires no NLP or network.

## Correctness assumptions

- Command metadata can be structured without a broad CLI rewrite.
- Implementation is authoritative for behavior.

## Invariants

- No unsupported command is documented.
- Consistency checking is deterministic.

## Required evidence

- Focused CLI tests cover command/reference consistency and a deliberate mismatch.

## Review questions

- Can a new command be added without several divergent help lists?
- Are defaults and side effects precise?

## Counterexample searches

- Dispatch branches, flags, or aliases missing from the reference.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Use the smallest maintainable registry/check. Avoid a general documentation generator.
