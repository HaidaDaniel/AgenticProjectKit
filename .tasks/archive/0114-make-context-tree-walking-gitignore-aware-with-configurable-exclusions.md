# Task 0114 - Make context tree walking gitignore-aware with configurable exclusions

State: done
Owner: opencode-ds-v41
Mode: maintenance
Lane: workflow
Type: feature
Scope: context,config,docs
Risk: medium
Parallel: false
Depends on: none
Tags: context,gitignore

## Goal

Make budgeted context and prompt discovery honor .gitignore and an explicit configured exclusion list so ignored runtime state does not participate in context selection or slow the walk.

## Context files

- AGENTS.md
- docs/context-system.md
- docs/architecture.md
- docs/decisions.md
- src/core/docs/context.ts
- src/core/config/schema.ts
- src/core/config/types.ts
- src/core/docs/prompt.test.ts
- .gitignore

## Files allowed to edit

- src/core/docs/context.ts
- src/core/docs/context.test.ts
- src/core/config/schema.ts
- src/core/config/types.ts
- package.json
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/work/**
- src/core/tasks/**
- .github/workflows/**

## Steps

1. Capture a reproducer where a large gitignored directory is walked or selected as context
2. Implement a gitignore-aware walk plus optional configured context exclusions
3. Ensure required and explicitly named context files are always retained
4. Add regression tests and run verification

## Acceptance criteria

- Gitignored directories and files are excluded from context discovery
- Optional configured exclusions are additive and deterministic
- Required context is never silently dropped

## Correctness assumptions

- Full .gitignore semantics are out of scope and a deterministic bounded subset is acceptable
- Gitignored runtime state must not become a context candidate

## Invariants

- Required and explicitly named task context files are never dropped
- Selection order and unit accounting remain deterministic
- Repository files are never mutated

## Required evidence

- Regression test output showing gitignored directories and files are excluded
- Bounded before and after context selection for a repository with large ignored directories

## Review questions

- Can an explicitly required ignored file be dropped?
- Is the exclusion behavior deterministic and documented?

## Counterexample searches

- Root .gitignore with directory patterns
- Nested .gitignore files
- Negation patterns such as !keep.md
- Missing .gitignore
- CRLF line endings
- Configured exclusion that also matches a required file

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document exclusion behavior in docs/context-system.md and record the decision in docs/decisions.md
- Update docs/progress.md

## Notes

- No network compiler or embedding service. Keep the fix bounded and deterministic.
- Before implementation, prefer delegating ignore semantics to Git where practical (e.g. Git-native file/ignore queries) rather than implementing a partial custom .gitignore parser.
