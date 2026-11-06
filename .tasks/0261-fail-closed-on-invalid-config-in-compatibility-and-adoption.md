# Task 0261 - Fail closed on invalid config in compatibility and adoption

State: done
Owner: opencode-correctness-milestone
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: config,compatibility,adoption,fail-closed
Risk: high
Parallel: false
Depends on: none
Tags: p1,config,compatibility,adoption,fail-closed

## Goal

Ensure invalid configured taskDirectory or docsDirectory values are never used for compatibility filesystem inspection and that adoption refuses all mutation for an invalid config before any file is written.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/adoption-flow.md
- docs/decisions.md
- src/core/config/compatibility.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/config/schema.test.ts

## Files allowed to edit

- src/core/config/compatibility.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/config/schema.test.ts
- docs/adoption-flow.md
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
- src/core/config/schema.ts
- src/core/config/paths.ts

## Steps

1. Reproduce compatibility using raw invalid taskDirectory and adopt mutating with invalid config; stop compatibility task inspection when config state is invalid or unsupported; return an explicit diagnostic and empty coverage; make adoptRepository refuse invalid or unsupported config before any mutation regardless of --apply; keep planAdoption read-only diagnostic behavior; preserve valid custom directories and default .tasks; correct ADR wording to parser plus consumer enforcement; add fixtures with an adversarial outside task file

## Acceptance criteria

- Invalid config never causes compatibility inspection of the raw configured directory; compatibility reports invalid/unsupported with explicit task-contract-not-inspected diagnostic; adoptRepository rejects invalid or unsupported config before creating or rewriting any file; no outside or inside mutation occurs; planAdoption remains read-only; valid .tasks and custom task directories still work; ADR claims match behavior; focused tests pass

## Correctness assumptions

- An invalid config has no trustworthy task directory; read-only preview may report diagnostics but must not write; parser lexical validation is already committed

## Invariants

- No invalid path drives filesystem access; no adoption mutation on invalid config; valid configs unchanged; no automatic config rewrite

## Required evidence

- Adversarial invalid-config fixture; no-outside-read/no-mutation assertions; valid custom-directory regression; build-current artifact

## Review questions

- Can an invalid raw taskDirectory still be enumerated; can adopt write before rejecting; is preview still read-only; are valid custom directories preserved

## Counterexample searches

- Invalid taskDirectory ../outside with an outside task file; invalid docsDirectory; adopt without --apply; adopt --apply; valid contracts directory; missing config

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Correct ADR-0097 wording and adoption-flow guidance; update docs/progress.md when task state changes

## Notes

- Supersedes canceled 0252 for consumer scope; parser validation commit a972ad9 is a prerequisite baseline
- not a runtime dependency. Confirmed at a972ad9: detectCompatibility uses raw taskDirectory and adoptRepository mutates with invalid config when migration is not requested
