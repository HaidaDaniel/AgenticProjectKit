# Task 0150 - Implement a human-approved project rebrand

State: blocked
Owner: none
Mode: maintenance
Lane: migration
Type: migration
Scope: identity,compatibility,package,cli,docs,release
Risk: high
Parallel: false
Depends on: 0149,0165
Tags: migration,identity,blocked,human-decision,deferred,deep-backlog,optional-product-decision

## Goal

Migrate public identity only after a new explicit human decision to reconsider the current AgenticProjectKit identity and explicit human selection of a name, preserving compatibility and historical truth.

## Context files

- README.md
- package.json
- pnpm-lock.yaml
- src/cli/index.ts
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/releases/v0.4.6.md
- docs/decisions.md

## Files allowed to edit

- .tasks/0150-implement-a-human-approved-project-rebrand.md
- .agentic/config.json
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- README.md
- package.json
- pnpm-lock.yaml
- src/cli/index.ts
- src/cli/cli.test.ts
- src/core/templates/**
- scripts/**
- docs/project.md
- docs/scope.md
- docs/roadmap.md
- docs/architecture.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/product/**
- docs/guides/**
- docs/getting-started.md
- docs/concepts.md
- docs/index.md
- docs/decisions.md
- docs/research/**
- examples/**
- .github/**
- CONTRIBUTING.md
- SECURITY.md
- CHANGELOG.md
- docs/releases/index.md
- docs/progress.md

## Files forbidden to edit

- dist/**
- .tasks/archive/**
- docs/releases/v0.4.0.md
- docs/releases/v0.4.1.md
- docs/releases/v0.4.2.md
- docs/releases/v0.4.4.md
- docs/releases/v0.4.5.md
- docs/releases/v0.4.6.md

## Steps

1. Remain deferred and blocked until a new explicit human decision activates this optional work and the human explicitly chooses a name; Task 0149 or its research recommendation alone is not that decision. Record only the communicated choice.
2. Inventory old-name references and classify current product surfaces, compatibility aliases, and intentional historical references before editing.
3. Plan and apply migration for repository/package identity, package metadata, canonical CLI and legacy aliases, generated instructions, docs, examples, release scripts, install instructions, tests, URLs, and migration notes.
4. Coordinate any GitHub repository rename or redirect with the operator; verify it rather than assuming an external change occurred.
5. Build, test, sync, search current surfaces for old names, and preserve historical release notes and ADR wording.

## Acceptance criteria

- The exact migrated name matches an explicit human choice and completed research, not the research recommendation alone.
- All current identity surfaces agree and remaining old-name hits are classified with path-specific reasons.
- Compatibility aliases and downstream pin/migration guidance are tested.
- Historical releases and ADRs retain their original-era identity and are not rewritten as though the new name always existed.
- External repository rename/redirect evidence is distinct from code URL changes.

## Correctness assumptions

- A research recommendation is not human authorization.
- Repository URL rename is an operator-controlled external action.

## Invariants

- No inferred consent or unapproved public repository mutation.
- Historical release notes and ADR text are not rewritten.

## Required evidence

- Explicit human-selected name reference and completed dated research.
- Package/bin tests, old-name search, sync/build evidence, migration notes, and URL/redirect proof where required.

## Review questions

- Is there an explicit human choice?
- Can existing pins and aliases still be migrated safely?
- Are historical references preserved and intentional?

## Counterexample searches

- Research recommends a name but the human has not selected it.
- Package metadata changes but generated instructions still use the old name.
- A GitHub redirect is assumed without verification.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk sync"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/cli/cli.test.ts"}`
- `{"id":"check-5","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"check-6","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"check-7","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"check-8","type":"manual","required":true,"environment":"live","profile":"report","instruction":"Record the exact human-selected name and source communication after Task 0149 research is complete; verify repository/package/URL changes match it and classify remaining old-name references.","evidence":"explicit operator choice and dated migration report"}`
## Documentation updates

- Update current identity, aliases, generated guidance, docs, install paths, migration notes, and a current ADR/supersession pointer.

## Notes

- This task is deferred indefinitely and is not a prerequisite for public readiness or the next release under AgenticProjectKit. Execute only after a new explicit human decision to reconsider the current identity and a communicated name choice; Task 0149's existence or recommendation is not authorization. Never rewrite tagged releases or old ADR prose.
