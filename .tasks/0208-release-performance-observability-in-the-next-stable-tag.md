# Task 0208 - Release performance observability in the next stable tag

State: doing
Owner: codex-performance-20261007
Mode: production
Lane: release
Type: release
Scope: release,performance,distribution,verification
Risk: high
Parallel: false
Depends on: 0206,0207
Tags: release,performance,distribution,exact-head,post-release

## Goal

Release performance observability in the next stable tag

## Context files

- AGENTS.md
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- docs/architecture.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/product/maturity-and-compatibility.md
- docs/releases/v0.4.8.md
- docs/releases/index.md
- docs/research/apk-performance-measurement-contract.md
- .tasks/0206-implement-opt-in-apk-performance-tracing-and-reporting.md
- .tasks/0207-add-deterministic-tooling-benchmark-harness-and-apk-overhead-attribution.md
- .github/workflows/quality.yml

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- README.md
- CHANGELOG.md
- docs/**
- .github/**
- dist/**
- .tasks/0206-implement-opt-in-apk-performance-tracing-and-reporting.md
- .tasks/0207-add-deterministic-tooling-benchmark-harness-and-apk-overhead-attribution.md

## Files forbidden to edit

- LICENSE
- .tasks/archive/**
- src/**
- scripts/**
- .agentic/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md

## Steps

1. Resolve the next free SemVer after the current validated release without moving existing tags

## Acceptance criteria

- The release contains the profiler and benchmark contract with truthful maturity/support claims

## Correctness assumptions

- Release evidence must identify the exact immutable candidate SHA/tree.
- Some release checks can only execute after publication and must be recorded as post-tag evidence.
- A release-note file committed inside the tag cannot contain its own commit SHA or the later tag/CI/install identity.

## Invariants

- Pre-tag and post-tag evidence are temporally distinct and never conflated.
- A published tag is immutable; the tagged artifact and recorded evidence refer to the same candidate tree.
- Tagged release notes contain only facts knowable before tagging.

## Required evidence

- Pre-tag criteria observed against the frozen candidate SHA, exact-SHA hosted CI, annotated tag peel to that SHA, and a distinct post-tag cold-install/released-consumer record.

## Review questions

- Did every criterion claimed as pre-tag actually run against the exact candidate SHA before tag publication?
- Is post-tag evidence kept separate and never presented as pre-tag?
- Was the published tag left unmoved and the tagged release notes kept free of fabricated future facts?

## Counterexample searches

- Search a release whose downstream or compatibility smoke ran after publication but was claimed pre-tag, a placeholder validation inside the tagged notes, a moved tag, and post-tag install facts written into the immutable tagged file.
- Search a changed candidate that reuses earlier freeze/CI evidence, a tag created on HEAD without an exact-SHA CI pass, and a missing or stale committed dist/asset.

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"exact-sha-hosted-ci","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Before tag creation, observe a successful hosted Quality workflow for the exact frozen candidate SHA and record its head SHA, run URL or ID, and conclusion.","evidence":"exact candidate SHA plus successful hosted Quality run URL or ID"}`
- `{"id":"tag-cold-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"After publication, verify the annotated v0.4.9 tag peels to the frozen candidate SHA; cold-install that actual tag with a fresh consumer and fresh store; prove all bin aliases, profiler commands, schemaVersion 1 JSON report, ignored local trace storage, and a disposable downstream smoke.","evidence":"post-tag artifact with tag object, peel, install, aliases, profiler smoke, and downstream transcript"}`
- `{"id":"post-release-record","type":"manual","required":true,"environment":"local","profile":"report","instruction":"After tag validation, record the immutable tag, exact-SHA CI, cold install, package payload, profiler smoke, and downstream observations in a separate docs/delivery/workflow-v0.4.9-post-release.md file without changing the tagged release note.","evidence":"committed separate v0.4.9 post-release artifact and promotion reference"}`

## Documentation updates

- Add next release notes
- release index/maturity updates and separate post-tag validation record

## Notes

- Use the repository release discipline; never hardcode the target version or move an existing tag. Exact hosted CI and actual-tag cold install are mandatory.
