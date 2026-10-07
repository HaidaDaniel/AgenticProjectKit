# Task 0214 - Release corrected performance observability as v0.5.0

State: doing
Owner: codex-performance-20261007
Mode: production
Lane: release
Type: release
Scope: release,performance,distribution,verification
Risk: high
Parallel: false
Depends on: 0212,0213
Tags: release,performance,distribution,exact-head,post-release

## Goal

Publish the v2 performance observability generation as immutable v0.5.0 after implementation, benchmark, exact-HEAD hosted CI, and actual-tag validation.

## Context files

- AGENTS.md
- package.json
- pnpm-lock.yaml
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/product/maturity-and-compatibility.md
- docs/releases/index.md
- docs/releases/v0.4.9.md
- docs/research/apk-performance-measurement-contract.md
- docs/research/apk-performance-v050-corrective-plan.md
- docs/benchmarks/apk-performance-v050-self-baseline.md
- .tasks/0212-implement-full-process-v2-apk-performance-attribution.md
- .tasks/0213-strengthen-apk-tooling-attribution-benchmark-harness.md
- .github/workflows/quality.yml

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- README.md
- CHANGELOG.md
- docs/**
- dist/**
- .github/**

## Files forbidden to edit

- src/**
- scripts/**
- .agentic/**
- .tasks/archive/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- LICENSE

## Steps

1. Resolve the free next SemVer target and confirm existing tags are immutable; never move or rewrite a published tag.
2. Freeze the exact candidate SHA/tree and observe every declared PRE-TAG criterion against that exact SHA, including local quality/coverage/build/release checks, committed dist currency, package/bin/asset payload, declared compatibility or downstream smoke, and exact-SHA hosted CI.
3. Create the annotated tag only after all PRE-TAG criteria pass, pointing to the validated candidate SHA, and verify the peeled commit equals that SHA.
4. Run POST-TAG checks separately: actual immutable-tag cold install, tag-peel verification, released package/bin identity, downstream install from the tag, and post-release self-adoption.
5. Record post-tag evidence in a post-release artifact, never backfilled into the release-note file committed inside the tag, and do not mutate the candidate or tag after evidence is captured.

## Acceptance criteria

- Package version is 0.5.0; tagged artifact is an annotated immutable v0.5.0 tag created only after exact-candidate hosted Quality success; release notes truthfully describe v0.4.9 as the first profiler generation and v0.5.0 as the revised v2 measurement generation; committed dist/package payload and actual-tag cold install expose v2 profiler and v1 compatibility; validated release promotion occurs only after separate post-tag validation.

## Correctness assumptions

- v0.5.0 is free at preflight; current release discipline requires exact candidate CI before tag and separate post-tag validation; v0.4.9 release notes and tag remain immutable historical artifacts.

## Invariants

- Never move v0.4.9 or v0.5.0; never put post-tag facts in tagged release notes; never tag before exact-SHA CI; never promote validatedReleaseVersion before post-tag validation; do not rewrite downstream repositories.

## Required evidence

- exact candidate SHA/tree; package payload; full local quality; exact-SHA hosted CI; annotated tag object/peel; fresh actual-tag consumer; aliases; v2 profiler smoke; v1 compatibility smoke; separate post-release record

## Review questions

- Did all pre-tag checks run on the frozen candidate? Was v0.5.0 tag created only after exact-SHA CI? Are v0.4.9 historical notes untouched? Does actual tag expose v2 metrics and honest v1 limitations? Is validated-release promotion temporally last?

## Counterexample searches

- existing v0.5.0 tag; lightweight/moved tag; package version mismatch; dist/source drift; CI on another SHA; v1 fixture getting fabricated startup; post-tag facts in immutable release note; early sentinel promotion

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"pnpm release:check"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","evidenceType":"benchmark","command":"git diff --check"}`
- `{"id":"exact-sha-hosted-ci","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Before tag creation, observe a successful hosted Quality workflow for the exact frozen v0.5.0 candidate SHA and record its head SHA, run URL or ID, and conclusion.","evidence":"exact candidate SHA plus successful hosted Quality run URL or ID"}`
- `{"id":"tag-cold-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"After publication, verify the annotated v0.5.0 tag peels to the frozen candidate SHA; cold-install that actual tag with a fresh consumer and fresh store; prove all bin aliases, profiler v2 commands, schemaVersion 2 JSON metrics, v1 compatibility behavior, ignored local trace storage, and disposable downstream smoke.","evidence":"post-tag artifact with tag object, peel, install, aliases, v2/v1 profiler smoke, and downstream transcript"}`
- `{"id":"post-release-record","type":"manual","required":true,"environment":"local","profile":"report","instruction":"After tag validation, record immutable v0.5.0 facts, exact-SHA CI, cold install, package payload, profiler v2 smoke, v1 compatibility smoke, benchmark smoke, and downstream observations in a separate docs/delivery/workflow-v0.5.0-post-release.md without changing v0.4.9 history.","evidence":"committed separate v0.5.0 post-release artifact and validated-release promotion reference"}`

## Documentation updates

- Add v0.5.0 release note
- release index/maturity/changelog/install guidance
- and separate post-release record.

## Notes

- Treat pre-tag evidence as the gate for tag creation and post-tag evidence as a separate record; never fabricate future facts inside an immutable commit.
- Select runnable host-repository checks with --verification-json; template shell commands are examples. Prefer focused feedback and a non-overlapping final set; do not repeat a suite through test, coverage, quality, and release aggregates. Report checks must execute the relevant tests and produce the declared artifact in one host command. Preserve required domain evidence.
