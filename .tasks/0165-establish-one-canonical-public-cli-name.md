# Task 0165 - Establish one canonical public CLI name

State: todo
Owner: none
Mode: maintenance
Lane: cli
Type: feature
Scope: cli-identity,documentation,compatibility,tests
Risk: medium
Parallel: false
Depends on: none
Tags: feature

## Context files

- AGENTS.md
- README.md
- package.json
- docs/project.md
- docs/cli-commands.md
- docs/agent-exporters.md
- src/cli/index.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/cli/index.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/progress.md

## Files forbidden to edit

- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md
- package.json

## Goal

Resolve public confusion among `apkit`, `apk`, and `agentic-project-kit` by documenting one canonical user invocation and supported aliases.

## Steps

1. Inventory package bins, help, README, docs, scripts, tests, and generated examples for command names and invocation contexts.
2. Select one canonical public invocation based on package metadata, behavior, ergonomics, and collision risk without removing aliases.
3. Separate package-local user commands, contributor-from-source commands, and any supported global invocation.
4. Align help and CLI reference with the chosen public name and document retained aliases.
5. If approved rebrand work is underway, coordinate the choice with Task 0150 instead of duplicating edits.

## Acceptance criteria

- One canonical public command is consistent in user docs and CLI help.
- Existing aliases continue unless a separately approved change removes one.
- User docs show package-local invocation; source TypeScript invocation is contributor-only.
- Tests cover help text and alias compatibility.

## Correctness assumptions

- A canonical command can be selected without changing project or package name.
- Aliases may remain for compatibility.

## Invariants

- No alias is removed without an approved compatibility change.
- No quickstart starts with development-only tsx invocation.

## Required evidence

- Search inventory classifies command names by context and focused CLI tests cover canonical help plus aliases.

## Review questions

- Can users identify one recommended command without losing existing aliases?
- Does this duplicate rebrand edits?

## Counterexample searches

- Public examples continue to use competing defaults or source entrypoint as quickstart.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Clarify public use and preserve compatibility. Rebrand remains blocked behind current research and explicit human choice.
