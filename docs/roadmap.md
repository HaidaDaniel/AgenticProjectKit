# Roadmap

This page separates released capabilities from work on `main` and future plans. Task contracts define lifecycle state and dependencies; release notes and delivery records define what has shipped. Roadmap grouping does not override either source.

## Shipped

### Latest validated installable release

[v0.4.9](releases/v0.4.9.md) is the latest validated installable release. Its exact candidate, successful exact-SHA CI, immutable tag peel, cold install, and profiler/downstream smoke are recorded in the [post-release validation record](delivery/workflow-v0.4.9-post-release.md). Its performance observability work builds on the prior v0.4.8 public-readiness release.

### Gated workflow foundation

Tasks 0057-0081 are complete. Task 0075 validated frozen v0.3.1 candidate `5f65faa6a46c0e48e9586540b943898269fb78f7`; the [release evidence](delivery/gated-workflow-release-evidence.md) records candidate-bound checks, dogfood, review, gate, and hosted CI. The detailed milestone history and dependency graph are in the [historical delivery record](delivery/milestones.md).

### Resource-aware execution

Tasks 0082-0088 are complete and included in the [v0.4.0 release](releases/v0.4.0.md). The accepted design and current behavior are documented in [execution profiles](execution-profiles.md). Task 0092's canonical instruction-export consolidation is also complete ([contract](../.tasks/archive/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md)).

## Current state

AgenticProjectKit remains the product identity. The latest validated installable release is v0.4.9. Tasks 0149 and 0150 remain deferred identity work and were not reopened.

## Public Readiness (current work)

Public readiness is the one current planned milestone. Tasks 0145-0148 are already shipped as the v0.4.7 correctness foundation. Product-truth tasks 0151-0157 are complete. Corrective Task 0178 separates a pre-tag package candidate from the last validated release; Task 0179 closes the hosted-CI completion-gate gap. Task 0173 runs only after those corrections and its existing prerequisites pass.

### Task state rows

Each row repeats its contract's lifecycle state so readers can compare the roadmap with the task source of truth. The documentation consistency check validates every row against task metadata discovered from `.tasks/`.

| Workstream | Task | State | Contract |
| --- | --- | --- | --- |
| Product and current truth | 0151 | done | [0151](../.tasks/archive/0151-separate-apk-requirements-from-downstream-project-templates.md) |
| Product and current truth | 0152 | done | [0152](../.tasks/archive/0152-define-public-maturity-and-compatibility-policy.md) |
| Product and current truth | 0153 | done | [0153](../.tasks/archive/0153-make-progressmd-a-concise-current-state-document.md) |
| Product and current truth | 0154 | done | [0154](../.tasks/archive/0154-modernize-scopemd-around-current-and-historical-scope.md) |
| Product and current truth | 0155 | done | [0155](../.tasks/archive/0155-reframe-roadmapmd-as-shipped-current-planned-and-deferred.md) |
| Product and current truth | 0156 | done | [0156](../.tasks/archive/0156-mark-old-delivery-milestones-as-historical.md) |
| Product and current truth | 0157 | done | [0157](../.tasks/archive/0157-clarify-architecture-truth-and-normalize-adr-lifecycle.md) |
| Documentation front door | 0158 | done | [0158](../.tasks/archive/0158-add-a-documentation-home.md) |
| Documentation front door | 0159 | done | [0159](../.tasks/archive/0159-write-a-canonical-getting-started-guide.md) |
| Documentation front door | 0160 | done | [0160](../.tasks/archive/0160-explain-apk-core-concepts-and-trust-boundaries.md) |
| Documentation front door | 0161 | done | [0161](../.tasks/archive/0161-document-safe-brownfield-adoption.md) |
| Documentation front door | 0162 | done | [0162](../.tasks/archive/0162-document-constrained-and-local-first-execution.md) |
| Documentation front door | 0163 | done | [0163](../.tasks/archive/0163-redesign-readme-as-the-public-front-door.md) |
| Documentation front door | 0164 | done | [0164](../.tasks/archive/0164-explain-when-to-use-apk-and-compare-alternatives.md) |
| CLI consistency | 0165 | done | [0165](../.tasks/archive/0165-establish-one-canonical-public-cli-name.md) |
| CLI consistency | 0167 | done | [0167](../.tasks/archive/0167-keep-cli-reference-aligned-with-the-command-registry.md) |
| OSS contribution readiness | 0169 | done | [0169](../.tasks/archive/0169-add-contributor-docs-and-lightweight-github-contribution-ux.md) |
| OSS contribution readiness | 0170 | done | [0170](../.tasks/0170-publish-a-truthful-security-reporting-policy.md) |
| OSS contribution readiness | 0171 | done | [0171](../.tasks/archive/0171-establish-a-release-changelog-and-index-strategy.md) |
| Acquisition and examples | 0166 | done | [0166](../.tasks/archive/0166-simplify-first-run-acquisition-while-keeping-exact-pins.md) |
| Acquisition and examples | 0172 | done | [0172](../.tasks/archive/0172-add-runnable-greenfield-brownfield-and-local-first-showcases.md) |
| Documentation consistency and release gate | 0168 | done | [0168](../.tasks/archive/0168-add-deterministic-documentation-consistency-checks.md) |
| Documentation consistency and release gate | 0178 | done | [0178](../.tasks/0178-separate-release-candidate-version-from-latest-validated-release.md) |
| Documentation consistency and release gate | 0179 | done | [0179](../.tasks/0179-require-externally-observed-ci-for-every-declared-ci-verification-check.md) |
| Workflow decision correctness | 0181 | done | [0181](../.tasks/0181-prefer-current-operator-decisions-over-stale-candidate-history.md) |
| Documentation consistency and release gate | 0173 | done | [0173](../.tasks/0173-validate-the-next-public-readiness-release.md) |
| Post-release documentation promotion | 0204 | done | [0204](../.tasks/0204-promote-validated-v048-release-documentation.md) |

Task contracts carry the exact prerequisite graph; use `apk task deps <task-id>` to inspect it. In particular, Task 0173 depends on completed Tasks 0178 and 0179, and its existing guide, CLI, contribution, consistency, and security prerequisites. Task 0181 completed the current-versus-stale operator decision correction after 0179; it remains a separate workflow correctness task, not an added release prerequisite. Task 0173 validates an exact frozen candidate only after its dependencies pass; it does not assign a version or date in advance. Its PRE-TAG state may have `packageVersion` ahead of `validatedReleaseVersion`; promotion follows successful post-tag validation in a separate change on `main`.

## Deep backlog / deferred product identity

Tasks 0149 and 0150 are blocked and deferred identity work, not public-readiness prerequisites. Reconsidering the name requires a new explicit human decision; research does not authorize a rebrand ([0149](../.tasks/0149-research-and-recommend-a-public-project-name.md), [0150](../.tasks/0150-implement-a-human-approved-project-rebrand.md)).

The external-runtime dogfood recorded by Task 0097 is deferred until the APK backlog is complete. It is a validation exercise, not an adapter implementation or dependency ([Task 0097](../.tasks/archive/0097-align-apk-with-external-agent-runtimes-and-persistent-dev-hosts.md), [ADR-0039](decisions.md#adr-0039---apk-is-a-repository-local-semantic-control-plane-not-an-external-runtime)).

## Blocked work

Task 0173 completed its declared prerequisites, exact PRE-TAG checks, exact-SHA hosted CI, independent review, immutable v0.4.8 tag peel, and POST-TAG cold-install/self-adoption validation. Task 0204 records the separate post-release artifact and promotes the validated-release sentinel; the immutable tagged candidate remains unchanged ([reassessment](delivery/backlog-reassessment-2026-10-07.md)). Public readiness is complete; Tasks 0149 and 0150 remain deferred identity work.

## Excluded from current scope

Web UI or SaaS, global/cloud project state, cloud sync, issue-tracker synchronization, multi-repository orchestration, provider/model runtime, and remote execution remain excluded. See the [current scope](scope.md#current-non-goals) and [runtime boundary decision](decisions.md#adr-0039---apk-is-a-repository-local-semantic-control-plane-not-an-external-runtime).

## Historical roadmap phases

The old v0.1-v0.3 sections are historical planning summaries, not upcoming release plans:

- **v0.1:** initial CLI, project files, task/context/prompt flows, templates, and agent-file exporters.
- **v0.2:** broader repository inspection, audit, validation, context selection, and prompt generation.
- **v0.3:** improved adoption/audit, mode-aware behavior, synchronization, templates, and tests.

The earlier gated-workflow and resource-aware dependency maps remain available in the [historical delivery milestone record](delivery/milestones.md).
