# Scope

## Current scope

Agentic Project Kit (APK) is a repository-local CLI and semantic workflow control plane for AI-assisted software development. Project context, task contracts, shared agent instructions, and workflow state live with each repository; APK does not depend on a hosted project database or long chat history. See the [project description](project.md) and [architecture](architecture.md).

APK currently supports:

- initializing a project or adopting APK into an existing repository, with bounded repository-shape inspection;
- maintaining project documentation, configuration, task contracts, and generated agent instructions from repository-owned policy;
- selecting task context, preparing prompts and worker packages, and exporting or synchronizing instructions for supported agent ecosystems;
- auditing repository workflow readiness and detecting declared quality capabilities without running the adopted repository's commands;
- managing task dependencies, ownership, risk, execution profiles, routing, assurance, candidate-bound verification and evidence, independent review, completion gates, provenance, semantic attention, and safe Git worktree lifecycle.

The public CLI and lifecycle are documented in the [architecture](architecture.md), [task system](task-system.md), and [resource-aware execution guide](execution-profiles.md). The latest validated installable release is [v0.4.8](releases/v0.4.8.md). The separate [release validation record](delivery/workflow-v0.4.8-post-release.md) identifies the validated release's exact candidate and downstream checks.

## Current non-goals

- A model or provider runtime, autonomous worker launcher, terminal/session manager, SSH manager, remote execution service, or global process supervisor. APK owns semantic task state; an external harness or runtime owns model execution and the live operator environment ([ADR-0039](decisions.md#adr-0039---apk-is-a-repository-local-semantic-control-plane-not-an-external-runtime)).
- A hosted control plane, global project database, SaaS service, account system, cloud coordination or sync, or multi-repository orchestrator. APK state is repository-local.
- Issue-tracker synchronization, including GitHub Issues, Jira, and Linear. Repository task contracts remain the workflow source of truth.
- Automatic application-source rewriting or unrestricted/deep AST analysis. Repository inspection is bounded and purpose-specific.
- Mandatory packaged agent skills or automatic skill activation. Packaged skills are separate optional assets and do not replace task verification, review, or the completion gate ([ADR-0063](decisions.md#adr-0063---the-task-grill-instruction-is-an-optional-manually-invoked-packaged-asset-outside-common-policy)).

## Next milestone

Public readiness is the current milestone, tracked in the [roadmap](roadmap.md#public-readiness-current-work). Tasks 0151-0172 cover product truth, documentation, CLI consistency, contribution readiness, and examples. Corrective Tasks 0178 and 0179 must pass before Task 0173 performs final validation against the exact release candidate and its other prerequisites. These are planned work items, not claims that every listed improvement is already shipped.

Tasks 0149 and 0150 remain deferred identity work and are not prerequisites for this milestone. Task 0170 remains blocked pending an operator-confirmed private security-reporting route. Corrective Tasks 0178 and 0179 precede Task 0173; the roadmap is the source for current task ordering and status.

## Historical scope

The v0.1-v0.3 sections in the [roadmap](roadmap.md) preserve the original staged plan:

- **v0.1:** establish the TypeScript CLI, project files, initial `init`/`adopt`/mode/task/context/prompt/export flows, minimal templates, and basic agent-file exporters.
- **v0.2:** expand repository scanning, audit and gap reports, config/task validation, context selection, and prompt generation.
- **v0.3:** improve adopt/audit and mode-aware behavior, add templates and `sync`, and strengthen CLI/task-pipeline tests.

These are planning-history summaries, not a current delivery checklist. Their future-tense wording does not describe the current release state; use the current-scope section above and tagged [release notes](releases/) for shipped behavior.

Earlier planning also listed a web UI, SaaS, cloud sync, issue-tracker integrations, multi-repository workflows, and advanced project intelligence as possible future additions. They remain outside the current scope; none should be read as a committed or implemented capability.
