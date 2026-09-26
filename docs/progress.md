# Progress

## Current state

Agentic Project Kit remains the current product identity. The latest validated, installable release is [v0.4.7](releases/v0.4.7.md); its exact tag, candidate, CI result, cold install, and downstream smoke are recorded in the [release validation record](delivery/workflow-v0.4.7-self-dogfood.md).

Public readiness is the current milestone. Its workstreams and ordering are maintained in the [roadmap](roadmap.md#public-readiness-current-work), with task contracts as the source of lifecycle state.

## Active work

- Task 0153 is `doing`: reduce this page to current context and map removed journal entries to their durable records ([task](../.tasks/0153-make-progressmd-a-concise-current-state-document.md)).
- Continue public-readiness tasks by their declared dependencies. Task 0173 is the final release-validation task and remains `todo` until its prerequisites are complete.

## Known blockers

- Tasks 0149 and 0150 remain deferred pending a new explicit human decision about reconsidering the product identity; they are not prerequisites for public readiness ([roadmap](roadmap.md#deep-backlog--deferred-product-identity)).
- Task 0170 remains blocked until the operator confirms a usable private vulnerability-reporting route ([task](../.tasks/0170-publish-a-truthful-security-reporting-policy.md)).
- Outside the current milestone, Task 0120 remains blocked on operator guidance for its stale claim baseline, and Task 0133 remains blocked in the task registry. The separately documented v0.4.4 release does not change Task 0133's lifecycle state ([Task 0120](../.tasks/0120-preserve-actionable-task-transition-reasons-and-truncate-only-presentation.md), [Task 0133](../.tasks/0133-release-v044-and-adopt-released-workflow-rules-in-apk-itself.md), [v0.4.4 release](releases/v0.4.4.md)).

## Next milestone

Complete the public-readiness workstreams in the [dependency-aware roadmap](roadmap.md#public-readiness-current-work), then run Task 0173 against the exact release candidate. Tasks 0145-0148 are complete correctness prerequisites; optional naming/rebrand work remains separate.

## Recently completed

- Task 0152 published the evidence-based public maturity and compatibility policy ([document](product/maturity-and-compatibility.md), [task](../.tasks/0152-define-public-maturity-and-compatibility-policy.md)).
- Task 0151 separated APK-owned requirements from the generic `apk init` starter ([requirements](product/requirements.md), [task](../.tasks/0151-separate-apk-requirements-from-downstream-project-templates.md)).
- Tasks 0145-0148 completed the v0.4.7 correctness foundation, published by Task 0174 ([release](releases/v0.4.7.md), [task](../.tasks/0174-release-v047-correctness-foundation.md)).

The [progress-history map](history/progress-history.md) identifies the release, task, and planning records that now hold details removed from this page.
