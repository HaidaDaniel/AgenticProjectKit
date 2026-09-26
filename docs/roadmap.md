# Roadmap

This page separates released capabilities from work on `main` and future plans. Task contracts define lifecycle state and dependencies; release notes and delivery records define what has shipped. Roadmap grouping does not override either source.

## Shipped

### Latest validated installable release

[v0.4.7](releases/v0.4.7.md) is the latest validated installable release. Its correctness foundation is Tasks 0145-0148; the [post-release validation record](delivery/workflow-v0.4.7-self-dogfood.md) records the exact candidate, successful exact-SHA CI, tag peel, cold install, and downstream smoke.

### Gated workflow foundation

Tasks 0057-0081 are complete. Task 0075 validated frozen v0.3.1 candidate `5f65faa6a46c0e48e9586540b943898269fb78f7`; the [release evidence](delivery/gated-workflow-release-evidence.md) records candidate-bound checks, dogfood, review, gate, and hosted CI. The detailed milestone history and dependency graph are in the [historical delivery record](delivery/milestones.md).

### Resource-aware execution

Tasks 0082-0088 are complete and included in the [v0.4.0 release](releases/v0.4.0.md). The accepted design and current behavior are documented in [execution profiles](execution-profiles.md). Task 0092's canonical instruction-export consolidation is also complete ([contract](../.tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md)).

## Current state

AgenticProjectKit remains the product identity. The latest validated installable release is v0.4.7; public-readiness documentation and follow-up work on `main` do not change that release record. The next release version and date have not been decided.

## Public Readiness (current work)

Public readiness is the one current planned milestone. Tasks 0145-0148 are already shipped as the v0.4.7 correctness foundation. Product-truth tasks 0151-0157 are being completed before the documentation front door and final release gate. The current task state is recorded in the linked contracts.

| Workstream | Current state | Task contracts |
| --- | --- | --- |
| Product and current truth | done | [0151](../.tasks/0151-separate-apk-requirements-from-downstream-project-templates.md), [0152](../.tasks/0152-define-public-maturity-and-compatibility-policy.md), [0153](../.tasks/0153-make-progressmd-a-concise-current-state-document.md), [0154](../.tasks/0154-modernize-scopemd-around-current-and-historical-scope.md), [0155](../.tasks/0155-reframe-roadmapmd-as-shipped-current-planned-and-deferred.md), [0156](../.tasks/0156-mark-old-delivery-milestones-as-historical.md), [0157](../.tasks/0157-clarify-architecture-truth-and-normalize-adr-lifecycle.md) |
| Documentation front door | todo | [0158](../.tasks/0158-add-a-documentation-home.md), [0159](../.tasks/0159-write-a-canonical-getting-started-guide.md), [0160](../.tasks/0160-explain-apk-core-concepts-and-trust-boundaries.md), [0161](../.tasks/0161-document-safe-brownfield-adoption.md), [0162](../.tasks/0162-document-constrained-and-local-first-execution.md), [0163](../.tasks/0163-redesign-readme-as-the-public-front-door.md), [0164](../.tasks/0164-explain-when-to-use-apk-and-compare-alternatives.md) |
| CLI consistency | todo | [0165](../.tasks/0165-establish-one-canonical-public-cli-name.md), [0167](../.tasks/0167-keep-cli-reference-aligned-with-the-command-registry.md) |
| OSS contribution readiness | 0169 and 0171 todo; 0170 blocked | [0169](../.tasks/0169-add-contributor-docs-and-lightweight-github-contribution-ux.md), [0170](../.tasks/0170-publish-a-truthful-security-reporting-policy.md), [0171](../.tasks/0171-establish-a-release-changelog-and-index-strategy.md) |
| Acquisition and examples | todo | [0166](../.tasks/0166-simplify-first-run-acquisition-while-keeping-exact-pins.md), [0172](../.tasks/0172-add-runnable-greenfield-brownfield-and-local-first-showcases.md) |
| Documentation consistency and release gate | todo | [0168](../.tasks/0168-add-deterministic-documentation-consistency-checks.md), [0173](../.tasks/0173-validate-the-next-public-readiness-release.md) |

Task contracts carry the exact prerequisite graph; use `apk task deps <task-id>` to inspect it. In particular, the documentation home and final release gate wait for their declared guide, CLI, contribution, and consistency prerequisites. Task 0173 validates an exact frozen candidate only after its dependencies pass; it does not assign a version or date in advance.

## Deep backlog / deferred product identity

Tasks 0149 and 0150 are blocked and deferred identity work, not public-readiness prerequisites. Reconsidering the name requires a new explicit human decision; research does not authorize a rebrand ([0149](../.tasks/0149-research-and-recommend-a-public-project-name.md), [0150](../.tasks/0150-implement-a-human-approved-project-rebrand.md)).

The external-runtime dogfood recorded by Task 0097 is deferred until the APK backlog is complete. It is a validation exercise, not an adapter implementation or dependency ([Task 0097](../.tasks/0097-align-apk-with-external-agent-runtimes-and-persistent-dev-hosts.md), [ADR-0039](decisions.md#adr-0039---apk-is-a-repository-local-semantic-control-plane-not-an-external-runtime)).

## Blocked work

Task 0170 cannot be completed until the operator confirms a usable private vulnerability-reporting route. The task contract remains blocked while that external decision is missing.

Task 0173 depends on Task 0170, so the final release gate cannot pass until this prerequisite is unblocked and completed.

## Excluded from current scope

Web UI or SaaS, global/cloud project state, cloud sync, issue-tracker synchronization, multi-repository orchestration, provider/model runtime, and remote execution remain excluded. See the [current scope](scope.md#current-non-goals) and [runtime boundary decision](decisions.md#adr-0039---apk-is-a-repository-local-semantic-control-plane-not-an-external-runtime).

## Historical roadmap phases

The old v0.1-v0.3 sections are historical planning summaries, not upcoming release plans:

- **v0.1:** initial CLI, project files, task/context/prompt flows, templates, and agent-file exporters.
- **v0.2:** broader repository inspection, audit, validation, context selection, and prompt generation.
- **v0.3:** improved adoption/audit, mode-aware behavior, synchronization, templates, and tests.

The earlier gated-workflow and resource-aware dependency maps remain available in the [historical delivery milestone record](delivery/milestones.md).
