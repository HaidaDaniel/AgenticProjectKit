# Agentic Project Kit — Product Requirements

This document defines Agentic Project Kit (APK). A project initialized with APK receives a separate, generic requirements starter from [`src/core/templates/minimal-docs/product-requirements.md.hbs`](../../src/core/templates/minimal-docs/product-requirements.md.hbs); that starter describes the downstream project, not APK.

## Users and jobs

- Individual developers and teams use coding agents across sessions or tools and need durable repository context, bounded work, and a repeatable way to review changes.
- Repository maintainers need project rules, task contracts, and generated agent instructions that are versioned and reviewable with the code.
- Operators need task ownership, verification, review, evidence, and completion status that remain tied to the repository and candidate being assessed.

APK helps these users:

- establish or adopt repository-local project context;
- break work into tasks with explicit dependencies, allowed paths, acceptance criteria, and verification;
- prepare bounded context and prompts for external coding agents;
- inspect readiness, route declared work resources, and record task outcomes through deterministic repository-local commands.

## Supported repository workflows

### Greenfield

`apk init` creates missing starter documents, configuration, and task structure without overwriting existing files. Its requirements document is a generic editable starter for the initialized project.

### Brownfield

`apk adopt` inspects an existing repository and adds missing kit files conservatively. It preserves existing application code and customized files; migration of supported legacy configuration is explicit.

### Plan and execute work

Tasks are APK's unit of work. Agents use repository documents and task contracts to select context, claim work, implement within scope, run declared checks, and provide review or other required evidence. APK evaluates dependencies and candidate freshness before task completion according to the task's effective policy.

### Constrained-resource work

APK supports deterministic verification and resource-aware, explainable routing based on declared capabilities, cost, capacity, and availability. It may report that work must wait or needs a human when no eligible route exists. It does not launch or supervise the selected agent, model, process, or session.

## Product boundaries

APK is a repository-local semantic workflow control plane. Repository documents and configuration are the source of truth. The CLI manages task contracts, context, routing, assurance, verification records, review, evidence, provenance, gates, and safe Git workspaces. External agent harnesses own execution of coding sessions and processes.

APK should keep commands predictable, generated guidance concise and readable, and policy neutral across supported agent ecosystems. Mandatory verification, review, or evidence must remain visible when unavailable or stale; ambiguity must not silently become a pass.

## Trust, correctness, and compatibility

- Task scope and forbidden paths must be explicit and checked before successful completion.
- Verification and review outcomes must identify the task candidate they assess. Current candidate freshness, dependencies, required evidence, and assurance are evaluated by the same completion gate.
- Human-provided decisions and evidence must retain their source and trust model; APK must not manufacture consent, verification results, review passes, or adoption claims.
- Secrets do not belong in APK's portable project configuration or resource declarations.
- Existing task Markdown remains usable through documented legacy parsing where supported. Configuration changes that need migration are previewable and applied only through an explicit adoption action.
- Generated files must derive from canonical repository policy where applicable, and user-customized files must not be overwritten by init or adopt.

## Usability and open-source adoption

- A maintainer should be able to understand the task, its context, allowed files, and completion conditions from repository files without relying on prior chat history.
- Core workflows are available through a CLI and readable Markdown; generated agent-specific instructions adapt a neutral policy rather than becoming separate policy sources.
- A repository can use APK without an APK-hosted account, database, or service. Adoption should make changes reviewable in the consumer repository and preserve existing work.
- Repeatable installation is provided through validated release tags; a release must remain runnable from its tagged package contents without an install-time build hook.

## Quality and release expectations

- Changes use task-scoped automated verification and the review level required by effective policy; a successful gate is bound to the committed candidate.
- Release readiness must be demonstrated against the exact candidate, including clean-checkout CI and install/adoption checks appropriate to the release. Post-publication observations are recorded separately from evidence that had to precede the tag.
- Product documentation describes implemented behavior and accepted boundaries. Planned work is labeled as planned, and uncertain behavior is not presented as a guarantee.

## Explicit non-goals

- No web UI, hosted SaaS, user authentication, cloud sync, or central project database.
- No issue-tracker synchronization or multi-repository orchestration.
- No automatic application source rewriting or complex AST-based project transformation.
- No model/provider runtime, terminal, process, or agent-session orchestration; those belong to external harnesses.
- Optional reasoning assets remain manually invoked tools and do not become a mandatory task lifecycle or second state machine.

## Success signals

Technical signals include a fresh init that preserves custom files, a brownfield adoption that leaves application code intact, passing task and repository checks, candidate-current gate evidence, and a repeatable install from a validated release tag.

Claims about adoption, user outcomes, time saved, or product impact require observed consumer usage or explicitly attributed operator feedback. Repository tasks, run logs, planned features, and release notes alone do not establish those outcomes; documentation must not invent counts or results.
