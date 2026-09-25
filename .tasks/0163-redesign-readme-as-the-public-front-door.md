# Task 0163 - Redesign README as the public front door

State: todo
Owner: none
Mode: product
Lane: documentation
Type: docs
Scope: readme,positioning,public-readiness
Risk: medium
Parallel: false
Depends on: 0151,0152,0158,0159,0160,0161,0162,0164,0165,0166,0169,0170,0171
Tags: docs

## Context files

- AGENTS.md
- README.md
- docs/project.md
- docs/product/requirements.md
- docs/product/maturity-and-compatibility.md (future output of prerequisite Task 0152)
- docs/index.md (future output of prerequisite Task 0158)
- docs/getting-started.md (future output of prerequisite Task 0159)
- docs/concepts.md (future output of prerequisite Task 0160)
- docs/guides/brownfield-adoption.md (future output of prerequisite Task 0161)
- docs/guides/constrained-local-execution.md (future output of prerequisite Task 0162)
- docs/cli-commands.md
- docs/releases/index.md (future output of prerequisite Task 0171)
- CONTRIBUTING.md (future output of prerequisite Task 0169)
- SECURITY.md (future output of prerequisite Task 0170)
- CHANGELOG.md (future output of prerequisite Task 0171)

## Files allowed to edit

- README.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md
- package.json
- pnpm-lock.yaml

## Goal

Replace the oversized mixed-purpose README with a concise, accurate public front door.

## Steps

1. Use approved product requirements, maturity policy, current scope, guides, install policy, and CLI identity as sources.
2. Lead with the user problem, concrete capability, audience, and explicit product boundary.
3. Provide one verified quickstart, a compact feature/trust summary, maturity status, and links to canonical docs and OSS metadata.
4. Remove duplicate command dumps and stale milestone/release claims while retaining useful links.

## Acceptance criteria

- The first screen answers what APK does, who it is for, and where to start.
- All product, compatibility, installation, and CLI claims match canonical sources.
- README contains no full CLI dump or stale future milestone claim.
- All links resolve and no unsupported features or guarantees are promised.

## Correctness assumptions

- README is an evaluation and navigation page; guides own detail.
- Identity remains AgenticProjectKit until approved rebrand work completes.

## Invariants

- No unapproved rebrand or project-name choice is made.
- No status claim outranks source, task, or release evidence.

## Required evidence

- A public claim audit maps each promise to implementation, release, or canonical policy.

## Review questions

- Can a new user understand the product and reach a runnable path quickly?
- Are maturity and trust limits visible?

## Counterexample searches

- Dead links, stale versions, unsupported promises, or old CLI examples remain.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This is the public front door after canonical sources stabilize; keep deep content in docs.
