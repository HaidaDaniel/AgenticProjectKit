# Task 0298 - Move type-only packages out of runtime dependencies

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: implementation
Type: refactor
Scope: packaging,dependencies,tests
Risk: low
Parallel: false
Depends on: none
Tags: maintenance,packaging,dependencies

## Goal

Keep the published package runtime surface limited to actual runtime dependencies while preserving build and test availability in development.

## Context files

- AGENTS.md
- docs/task-system.md
- package.json
- src/cli/cli.test.ts

## Files allowed to edit

- package.json
- pnpm-lock.yaml

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/**
- docs/**
- .github/**

## Steps

1. Confirm no non-test source imports typescript and that @types/node is compile-time only.
2. Move both packages to devDependencies and update the lockfile with the supported package manager.
3. Verify build typecheck lint and tests still pass in the development checkout.
4. Verify a production-only install can still execute the committed CLI entrypoint.
5. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- Runtime dependencies contain only packages imported by shipped code.
- Production-only install executes node dist/cli/index.js --version successfully.
- Build typecheck lint and tests remain green.
- No source behavior changes.

## Correctness assumptions

- The package ships committed dist

## Invariants

- Published runtime behavior is unchanged

## Required evidence

- Production-only install smoke result

## Review questions

- Is any runtime import of a moved package hidden behind a dynamic import

## Counterexample searches

- Runtime module importing typescript; Missing dev dependency causing build failure

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Low-severity packaging improvement
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
