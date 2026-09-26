# Progress History Map

This map covers the progress journal in commit `834d9af`, before Task 0153 reduced `docs/progress.md` to current context. Task files remain the source of lifecycle state; release notes and delivery records remain the source of candidate and publication evidence. This file is not a second task journal.

## Where the former entries went

| Former progress content | Classification | Durable record |
| --- | --- | --- |
| Current and previous release summaries, candidate identities, CI results, install checks, and post-release dogfood | Release facts, not current-status prose | [v0.4.0](../releases/v0.4.0.md), [v0.4.1](../releases/v0.4.1.md), [v0.4.2](../releases/v0.4.2.md), [v0.4.4](../releases/v0.4.4.md), [v0.4.5](../releases/v0.4.5.md), [v0.4.6](../releases/v0.4.6.md), [v0.4.7](../releases/v0.4.7.md) notes and the [v0.4.4](../delivery/workflow-v0.4.4-self-dogfood.md), [v0.4.5](../delivery/workflow-v0.4.5-self-dogfood.md), [v0.4.6](../delivery/workflow-v0.4.6-self-dogfood.md), [v0.4.7](../delivery/workflow-v0.4.7-self-dogfood.md) delivery records. v0.4.3 corrective-release details remain in [Task 0118](../../.tasks/0118-release-v043-corrective-dogfood-fixes.md), [ADR-0055](../decisions.md#adr-0055---clean-checkout-lint-does-not-fail-unverifiable-task-owners), and [the upgrade history](../engineering/apk-upgrade-workflow.md). |
| The long repository capability inventory, including initial CLI/docs and later workflow features | Repeated implementation summary | The individual [task contracts](../../.tasks/) and canonical [project](../project.md), [architecture](../architecture.md), [task system](../task-system.md), [context system](../context-system.md), [exporter](../agent-exporters.md), and [execution profile](../execution-profiles.md) documentation. |
| The old pre-release “Next step” chain and v0.3.1 frozen-candidate result | Completed milestone plan and release evidence | [Roadmap](../roadmap.md), [gated-workflow release evidence](../delivery/gated-workflow-release-evidence.md), and the [Task 0075 contract](../../.tasks/0075-validate-next-agenticprojectkit-release-against-gated-workflow.md). |
| Resource-aware execution plan, ordering, and corrections | Current architecture/backlog plus task history | [Roadmap](../roadmap.md), [execution profiles](../execution-profiles.md), [delivery milestones](../delivery/milestones.md), and Tasks 0082-0090 in the [task contracts](../../.tasks/). |
| The old “Remaining task plan” for the lightweight-workflow/v0.4.4 batch and research outcomes | Superseded plan and completed research | Current public-readiness ordering in the [roadmap](../roadmap.md#public-readiness-current-work); individual task contracts; [distribution research](../research/non-node-apk-installation-and-distribution.md); and [upgrade-workflow research](../engineering/apk-upgrade-workflow.md). |
| Task-specific implementation, correction, and regression summaries from 0001-0148 | Duplicate task/capability journal | The corresponding [task contracts](../../.tasks/), implementation tests, and accepted [decisions](../decisions.md). Exact release-level candidate, CI, tag, and install evidence stays in the linked release records. |
| The late Task 0074 dependency and unchanged historical claim/baseline | Unique lifecycle context already preserved at its canonical owner | [Task 0074](../../.tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md) and the [milestone dependency note](../delivery/milestones.md#dependency-map). |
| Public-readiness, deferred identity, and blocked-task state | Current plan and lifecycle state, not historical prose | [Public Readiness roadmap](../roadmap.md#public-readiness-current-work) and the individual task files; the current page calls out the material blockers. Task 0133's blocked state is distinct from the separately recorded v0.4.4 release. |
| Individual verification command lists and test-regression descriptions | Repeated task-level detail | Each task's `Verification`, acceptance criteria, and terminal state in the [task contracts](../../.tasks/). Published-release results are kept in delivery records rather than copied here. |

## Historical planning snapshots retained

These counts were recorded during planning passes and are not current repository metrics:

- Resource-aware planning reported 90 task contracts parsed and 17 existing legacy evidence-policy warnings; the resource-aware scope and dependency decisions are in Tasks 0082-0090, `docs/execution-profiles.md`, and the roadmap.
- Quality-guardrail planning reported 80 active tasks, 972 resolved context paths, four prerequisite outputs, and 24 valid milestone links; the task graph and checks are represented by the 0077-0080 contracts and the delivery milestone records.
- Corrective-backlog validation reported 76 parsed tasks, 20 backlog contracts, and 461 resolved context/milestone references; the corrected contracts and dependency edges remain in their task files.
- Initial-backlog validation reported 75 parsed tasks and 19 new contracts; their implementation and decisions remain in the task records and canonical project documentation.
- One corrective-pass doctor snapshot reported three non-failing warnings: the typecheck-script capability, `.env.example`, and GitHub Actions. This is a historical diagnostic count, not current readiness evidence.

The pre-0153 page also contained transient status and warning counts. They were not promoted to current claims; current task states and blockers come from task files, and current readiness comes from the roadmap and release artifacts.
