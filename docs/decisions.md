# Decisions

This file records architecture and product decisions that affect the implementation.

## ADR-0001 - Repository-first source of truth

Status: accepted

Decision:

Project context, rules, and task definitions live in the repository rather than in chat history.

Reason:

Repository-stored context can be reviewed, versioned, and exported to multiple tools.

## ADR-0002 - Neutral policy with exporters

Status: accepted

Decision:

The core behavior is defined once and exported to tool-specific instruction files.

Reason:

This reduces duplication and prevents tool-specific instruction drift.

Implementation:

Task 0006 adds a neutral agent policy input and renders AGENTS, Codex, OpenCode, and Cursor instruction files from shared exporter templates.

## ADR-0003 - Task-driven execution

Status: accepted

Decision:

Work should be organized as small, atomic tasks with explicit context, allowed files, and verification commands.

Reason:

Smaller tasks are easier for agents to complete safely and easier for humans to review.

## ADR-0004 - CLI first, no UI in v0.1

Status: accepted

Decision:

The first implementation is a TypeScript CLI, not a web application.

Reason:

The highest-value early behavior is repository automation, not a UI layer.

## ADR-0005 - Handlebars templates

Status: accepted

Decision:

Use Handlebars for template rendering in the implementation.

Reason:

The templating problem is simple and predictable, and Handlebars is a lightweight fit for text generation.

Implementation:

Task 0004 adds Handlebars as the renderer dependency for reusable text templates.

## ADR-0006 - Caveman as default style

Status: accepted

Decision:

Use the `caveman` skill as the default output style for this repository when the active agent supports it.

Reason:

This keeps instructions compact, reduces filler, and matches the repo goal of explicit, task-driven agent work.

## ADR-0007 - Minimal CLI scaffold dependencies

Status: accepted

Decision:

Use `typescript`, `tsx`, and `@types/node` for the initial CLI scaffold.

Reason:

This combination gives a small TypeScript development loop with direct execution in local development and proper Node globals in type checking.

## ADR-0008 - Conservative adopt writes

Status: accepted

Decision:

`apk adopt` scans existing repositories and writes only missing kit, documentation, task, and exporter files.

Reason:

Adoption must preserve application code and avoid overwriting existing project instructions or docs.

## ADR-0009 - Structured verification with legacy projection

Status: accepted

Decision:

Store verification as compact typed checks in task Markdown, while retaining `verificationCommands` as a derived compatibility projection.

Reason:

Completion and verification workflows need explicit automated/manual type, requiredness, environment/profile, and evidence expectations without forcing existing v0.3.1 task files through a migration.

Implementation:

Canonical checks live as JSON bullets under `## Verification`. Legacy `## Verification commands` entries normalize to required automated checks with local/deterministic defaults. Structured checks are rendered in prompts; execution and evidence persistence remain later task capabilities.

## ADR-0010 - Dedicated append-only task evidence store

Status: accepted

Decision:

Persist task evidence in `.agentic/evidence.jsonl`, separate from agent/run analytics, with explicit task/candidate subject identity and freshness comparison.

Reason:

Verification, manual/live checks, reports, and review outcomes need preserved history, typed result states, and revision binding without placing large output or proof blobs in task Markdown.

Implementation:

Records require task, run, agent, evidence type, result, timestamp, baseline, candidate, worktree, and repository identity; Git subjects also require HEAD SHA. Missing or ambiguous identity returns `unknown` freshness, while mismatched candidate identity returns `stale`.

## ADR-0011 - Profile-aware verification is fail-safe

Status: accepted

Decision:

Verification executes only eligible automated checks for the requested profile and records every check outcome, including unavailable and not-run states.

Reason:

Manual/live requirements and skipped profiles must remain visible and must not become implicit passes. Candidate mutation during execution must invalidate pass evidence.

Implementation:

`apk task verify` keeps the legacy command projection, supports `--profile`, appends per-check evidence, and returns failure when any required check is not `pass`. Optional failures remain observable without blocking the run.

## ADR-0012 - Claim baseline for conservative scope attribution

Status: accepted

Decision:

Capture a task claim baseline in append-only `.agentic/task-baselines.jsonl` and compare later paths plus content fingerprints against it.

Reason:

A whole-worktree diff cannot distinguish pre-existing user edits from task changes. Safe verification must report attribution limits and avoid blaming unchanged dirty files or APK bookkeeping.

Implementation:

Git baselines record HEAD and dirty-file fingerprints; later verification includes post-claim commits and working-tree changes, handles new/deleted/renamed paths, and excludes unchanged baseline files plus explicit bookkeeping paths. No-git and detached/unborn HEAD states return diagnostics and fail closed on attribution certainty.

## ADR-0013 - Deterministic effective task policy

Status: accepted

Decision:

Resolve task completion requirements from the risk level and additive classification tags in a pure policy module. Keep policy output explicit and read-only until the completion gate composes it.

Reason:

Risk must produce predictable ceremony: automated verification for low risk, scope and review for medium risk, and evidence declarations for high risk. Classification-specific needs such as live release checks or independent security review should be extensible without an LLM or a large hardcoded classifier.

Implementation:

`resolveTaskPolicy` applies conservative defaults, merges the small built-in tag-rule registry with optional rules, deduplicates evidence categories, and reports conflicts or missing requirements as blockers. Legacy command-only tasks normalize to local deterministic checks; high-risk legacy tasks remain readable but fail policy resolution until evidence is declared. `apk task policy` is a read-only diagnostic surface; completion enforcement is deferred to the dependent gate task.

## ADR-0014 - Independent review uses separate revision-bound evidence

Status: accepted

Decision:

Keep the lifecycle transition to `review` separate from independent review certification. Record reviewer outcomes in the existing append-only evidence store with a distinct review run, reviewer identity, findings, and the evaluated candidate subject.

Reason:

An implementation owner must not certify a mandatory independent review. Review evidence must survive fix iterations, make stale PASS results visible after dirty changes, and give a later completion gate a stable current/stale/unknown assessment without requiring a vendor model runtime.

Implementation:

`recordTaskReview` validates a registered reviewer different from the task owner, emits `pass`, `changes_requested`, or `fail`, links an optional implementation run, and reuses verification subject/freshness semantics. `renderTaskReviewPrompt` names the baseline-to-current diff and requires acceptance, scope, hidden-assumption, failure-path, and counterexample review. The CLI supports `--prompt` and evidence recording; it does not change task state or enforce done.

## ADR-0016 - Optional correctness contract stays descriptive and sparse

Status: accepted

Decision:

Add optional task fields for correctness assumptions, invariants, required evidence references, review questions, and counterexample searches. Store them as compact Markdown list sections and propagate populated values to implementation and independent-review prompts.

Reason:

Reviewers need explicit claims and adversarial targets for high-risk, distributed, security, migration, benchmark, and architecture work, while ordinary tasks should not pay prompt or format noise for unused fields.

Implementation:

The task parser, renderer, creator, and CLI preserve these fields and omit empty sections. The fields guide inspection but do not independently alter verification or completion policy; required proof remains represented by structured verification and append-only evidence records.

## ADR-0017 - Typed templates are declarative task contracts

Status: accepted

Decision:

Extend the existing task-create template surface with canonical typed templates for feature, bugfix, refactor, migration, async-worker, provider-integration, deployment, benchmark, security, and release work, while retaining docs, audit, and test templates. Persist the canonical type in task metadata and map domain types to existing deterministic policy tags.

Reason:

Reusable domain guardrails reduce omissions in high-risk task contracts without introducing a second authoring system or requiring an LLM. Generated Markdown must remain compact, parseable, and editable.

Implementation:

Template defaults live in `src/core/templates/task-templates.ts`. They use existing structured verification and optional correctness fields; `--type` is canonical, `--template` remains an alias, and explicit flags override defaults. Provider/integration and async aliases normalize to canonical types. Policy consumes persisted type mappings in addition to explicit tags, so classification remains deterministic even when tags are overridden.
