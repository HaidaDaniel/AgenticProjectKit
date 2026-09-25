# Task 0169 - Add contributor docs and lightweight GitHub contribution UX

State: todo
Owner: none
Mode: product
Lane: community
Type: docs
Scope: contributing,github,oss,docs
Risk: low
Parallel: true
Depends on: none
Tags: docs

## Context files

- AGENTS.md
- package.json
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/engineering/package-structure.md
- docs/releases/v0.4.6.md
- LICENSE

## Files allowed to edit

- CONTRIBUTING.md
- .github/ISSUE_TEMPLATE/**
- .github/PULL_REQUEST_TEMPLATE.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md
- SECURITY.md

## Goal

Give outside contributors a concise contribution path and lightweight GitHub issue and pull-request templates.

## Steps

1. Confirm setup, quality commands, task workflow, and code-of-conduct status from current policy.
2. Write CONTRIBUTING.md with setup, bounded changes, ownership rules, and exact checks.
3. Add issue templates for reproducible bug reports, bounded feature proposals, and documentation problems.
4. Define a low-bureaucracy good-first-issue convention only if maintainers can keep it current.
5. Add a PR template asking for scope, evidence, and user-visible documentation impact.
6. Do not add a code of conduct without an accepted policy and maintainer commitment.

## Acceptance criteria

- A new contributor can install, run documented checks, and understand how to propose a bounded change.
- Templates request actionable information without duplicating long policies and document a maintainable good-first-issue convention.
- Commands and paths match canonical docs.
- No contact, response SLA, or governance promise is invented.

## Correctness assumptions

- Existing task workflow applies to contributions where appropriate.
- Lightweight templates are sufficient before contribution volume is known.

## Invariants

- Instructions imply no unstaffed support commitment.
- License and security policy remain outside this task.

## Required evidence

- Fresh checkout walkthrough confirms setup commands and links.

## Review questions

- Can a contributor find the first useful step and expected checks?
- Are templates useful but not burdensome?

## Counterexample searches

- Nonexistent scripts, stale CLI names, invented contact, or unsupported processes.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Add minimum viable contribution UX. Defer governance until maintainers make an explicit commitment.
