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
