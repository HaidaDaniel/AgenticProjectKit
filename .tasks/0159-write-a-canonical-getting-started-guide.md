# Task 0159 - Write a canonical getting-started guide

State: todo
Owner: none
Mode: product
Lane: documentation
Type: docs
Scope: getting-started,workflow,docs
Risk: low
Parallel: true
Depends on: 0151,0152,0165,0166
Tags: docs

## Context files

- AGENTS.md
- README.md
- docs/project.md
- docs/architecture.md
- docs/task-system.md
- docs/adoption-flow.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/product/maturity-and-compatibility.md (future output of prerequisite Task 0152)

## Files allowed to edit

- docs/getting-started.md
- docs/progress.md

## Files forbidden to edit

- README.md
- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Goal

Give a first-time user one end-to-end quickstart using supported installation and package-local CLI commands.

## Steps

1. Confirm install commands and supported versions from package metadata, compatibility policy, and bootstrap behavior.
2. Document one ordered user path: install, init or adopt, status, create a task, work/prompt, verify, review when required, gate, and done.
3. Use actual CLI syntax and expected outputs at each step.
4. Separate user commands from contributor-from-source commands and link contributor setup separately.
5. Show where repository-local exact pin and lockfile are established and generated instructions reviewed.

## Acceptance criteria

- A reader can follow install/init-or-adopt/status/task/work/verify/review-if-required/gate/done from a clean repository to one completed sample task.
- Every command and flag is verified and uses one canonical public invocation.
- Package-local execution is clear after exact dependency installation.
- Prerequisites, expected files, and safe inspection points are stated.

## Correctness assumptions

- Task 0125 exact local pin plus lockfile remains canonical.
- The page targets users; contributor setup is separate.

## Invariants

- No quickstart asks users to run source TypeScript.
- No sample claims completion without required evidence.

## Required evidence

- A clean-directory walkthrough records commands, expected outputs, and resulting files.

## Review questions

- Can users distinguish package use from development workflow?
- Does each command avoid undeclared global tools?

## Counterexample searches

- Stale binary names, unpinned installs, global assumptions, or dev-only tsx commands remain.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This is the canonical user path and feeds README and examples. Keep troubleshooting in linked guides.
