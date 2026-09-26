# Progress

## Current state

Agentic Project Kit remains the current product identity. The latest validated, installable release is [v0.4.7](releases/v0.4.7.md); its exact tag, candidate, CI result, cold install, and downstream smoke are recorded in the [release validation record](delivery/workflow-v0.4.7-self-dogfood.md).

Public readiness is the current milestone. Its workstreams and ordering are maintained in the [roadmap](roadmap.md#public-readiness-current-work), with task contracts as the source of lifecycle state.

## Active work

No task is currently `doing` or `review` at this closeout. Continue the public-readiness workstream by its declared dependencies. Task 0173 remains the final release-validation task and is `todo` until its prerequisites are complete.

## Known blockers

- Tasks 0149 and 0150 remain deferred pending a new explicit human decision about reconsidering the product identity; they are not prerequisites for public readiness ([roadmap](roadmap.md#deep-backlog--deferred-product-identity)).
- Task 0170 remains blocked until the operator confirms a usable private vulnerability-reporting route ([task](../.tasks/0170-publish-a-truthful-security-reporting-policy.md)).
- Outside the current milestone, Task 0120 remains blocked on operator guidance for its stale claim baseline, and Task 0133 remains blocked in the task registry. The separately documented v0.4.4 release does not change Task 0133's lifecycle state ([Task 0120](../.tasks/0120-preserve-actionable-task-transition-reasons-and-truncate-only-presentation.md), [Task 0133](../.tasks/0133-release-v044-and-adopt-released-workflow-rules-in-apk-itself.md), [v0.4.4 release](releases/v0.4.4.md)).

## Next milestone

Complete the public-readiness workstreams in the [dependency-aware roadmap](roadmap.md#public-readiness-current-work), then run Task 0173 against the exact release candidate. Tasks 0145-0148 are complete correctness prerequisites; optional naming/rebrand work remains separate.

## Recently completed

- Task 0164 explained when APK fits and compared adjacent tools from dated public sources ([guide](why-apk.md), [task](../.tasks/0164-explain-when-to-use-apk-and-compare-alternatives.md)). Candidate commit: `f353b6e`; lifecycle closeout is committed separately.
- Task 0162 documented constrained and local-first execution, including network and platform limits ([guide](guides/constrained-local-execution.md), [task](../.tasks/0162-document-constrained-and-local-first-execution.md)). Candidate commit: `1b3749a`; lifecycle closeout is committed separately.
- Task 0160 documented APK workflow concepts and actor trust boundaries ([concepts](concepts.md), [task](../.tasks/0160-explain-apk-core-concepts-and-trust-boundaries.md)). Candidate commit: `ccdb161`; lifecycle closeout is committed separately.
- Task 0155 reframed the roadmap around released capabilities, current readiness work, deferred items, and exclusions ([roadmap](roadmap.md), [task](../.tasks/0155-reframe-roadmapmd-as-shipped-current-planned-and-deferred.md)). Candidate commit: `cdd3cab`; lifecycle closeout is committed separately.
- Task 0157 clarified current architecture boundaries and indexed ADR lifecycle status ([architecture](architecture.md), [decisions](decisions.md)). Candidate commit: `eeba8b7`; lifecycle closeout is committed separately.
- Task 0156 marked completed delivery plans as historical and linked their release evidence ([milestones](delivery/milestones.md), [task](../.tasks/0156-mark-old-delivery-milestones-as-historical.md)). Candidate commit: `7ba7cd3`; lifecycle closeout is committed separately.
- Task 0154 clarified current capabilities, exclusions, and historical scope in [scope](scope.md). Candidate commit: `7607aac`; lifecycle closeout is committed separately.
- Task 0153 reduced this page to current context and mapped historical entries to canonical records ([history map](history/progress-history.md), [task](../.tasks/0153-make-progressmd-a-concise-current-state-document.md)). Candidate commit: `236b438`; lifecycle closeout is committed separately.
- Task 0152 published the evidence-based public maturity and compatibility policy ([document](product/maturity-and-compatibility.md), [task](../.tasks/0152-define-public-maturity-and-compatibility-policy.md)).
- Task 0151 separated APK-owned requirements from the generic `apk init` starter ([requirements](product/requirements.md), [task](../.tasks/0151-separate-apk-requirements-from-downstream-project-templates.md)).
- Tasks 0145-0148 completed the v0.4.7 correctness foundation, published by Task 0174 ([release](releases/v0.4.7.md), [task](../.tasks/0174-release-v047-correctness-foundation.md)).

The [progress-history map](history/progress-history.md) identifies the release, task, and planning records that now hold details removed from this page.
