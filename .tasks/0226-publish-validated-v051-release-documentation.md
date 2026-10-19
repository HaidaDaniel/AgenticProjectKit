# Task 0226 - Publish validated v0.5.1 release documentation

State: doing
Owner: codex-v051-docs
Mode: production
Lane: release-docs
Type: docs
Scope: release-documentation,post-tag-evidence
Risk: high
Parallel: false
Depends on: 0225
Tags: docs,post-tag

## Goal

Publish separate post-tag v0.5.1 validation evidence and promote stable installation documentation after the immutable tag passed release verification.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/releases/index.md
- docs/releases/v0.5.1.md
- docs/delivery/workflow-v0.5.0-post-release.md
- README.md
- CHANGELOG.md
- docs/product/maturity-and-compatibility.md
- docs/scope.md
- docs/index.md
- docs/roadmap.md
- docs/progress.md
- .tasks/0225-release-v051-workflow-correctness-fixes.md

## Files allowed to edit

- README.md
- CHANGELOG.md
- docs/releases/index.md
- docs/delivery/workflow-v0.5.1-post-release.md
- docs/product/maturity-and-compatibility.md
- docs/scope.md
- docs/index.md
- docs/roadmap.md
- docs/progress.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- src/**
- dist/**
- scripts/**
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/v0.5.0.md
- docs/releases/v0.5.1.md

## Steps

1. Record exact candidate and tag identities with pre-tag and post-tag evidence separately
2. Promote the validated-release marker and stable install links only after actual-tag validation
3. Preserve immutable notes and package source
4. Run bounded docs checks then independent review and APK gate
5. Commit lifecycle closeout and confirm hosted CI for final main

## Acceptance criteria

- Separate post-tag report contains real observed candidate and tag identities with hosted run and pinned cold-install results
- Stable release marker and install guidance identify v0.5.1
- Immutable tagged notes and all source package lockfile dist remain unchanged
- Tasks 0216 and 0218 and 0223 remain todo with deferral reasons
- Verification and independent review and completion gate pass

## Invariants

- Never mutate a published tag
- Never backfill post-tag facts into tagged release notes
- Local checks never substitute for hosted CI

## Verification

- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"post-tag-proof","type":"manual","required":true,"environment":"live","profile":"report","instruction":"Observe published immutable v0.5.1 object and peel; inspect exact-candidate hosted success and pinned cold-install evidence; verify v0.5.0 unchanged and report chronology is truthful."}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Do not change source code unless explicitly required.
- Add the host repository's documentation/link/example checks when relevant; docs-only work does not require unrelated application tests, coverage, or release checks.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
