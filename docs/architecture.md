# Architecture

Agentic Project Kit is intended to use a layered architecture:

1. CLI entrypoints.
2. Command handlers.
3. Core domain services.
4. Template and exporter system.
5. Repository scanners and context selection.
6. Internal docs and config as the source of truth.

## Core ideas

- Keep the human-readable policy in the repository.
- Generate agent-specific instruction files from one neutral source.
- Use tasks as the primary unit of work.
- Select context explicitly rather than loading the whole repository.
- Keep commands thin and predictable.

## Proposed internal layout

```txt
.agentic/
  config.json
  modes/
  policies/
  templates/
  exporters/
```

## Generated outputs

The tool may generate or maintain:

```txt
AGENTS.md
CLAUDE.md
GEMINI.md
.cursor/rules/*.mdc
.codex/instructions.md
.opencode/AGENTS.md
.github/copilot-instructions.md
docs/**
.tasks/**
```

## Flow

- `init` creates the repository structure.
- `adopt` performs a lightweight repository-shape scan and adds kit files.
- `mode` changes the active operating rules.
- `next-task` selects the next actionable item.
- `context` resolves what files an agent should read from the task contract and repository docs.
- `prompt` generates a tool-specific prompt from the neutral rules.
- `export` writes agent-specific instruction files.
- `audit` reads the repository and writes lightweight kit/workflow and export gap reports.
- `sync` checks or updates generated files from internal policy.

## Evidence storage

Task evidence uses a dedicated append-only `.agentic/evidence.jsonl` store. It is separate from agent/run analytics so verification, manual/live checks, reports, and later review evidence retain their own typed results and revision-bound subject identities. Read operations tolerate a missing store (no evidence) and report malformed records with line diagnostics.

Claim baselines use a parallel append-only `.agentic/task-baselines.jsonl` store. A baseline captures HEAD, dirty-file fingerprints, task path, owner, and explicit bookkeeping exclusions. Scope attribution reads this record without resetting or rewriting user files.

## Effective policy resolution

`src/core/tasks/policy.ts` is a deterministic policy layer over task risk, tags, and structured verification. It applies conservative low/medium/high defaults, merges additive classification rules, reports required evidence categories, and returns explainable blockers/diagnostics. The `apk task policy` command exposes this calculation read-only. The resolver does not mutate lifecycle state; later completion work consumes its result together with verification, scope, evidence, and review outcomes.

## Independent review and completion gate

`src/core/tasks/review.ts` adds reviewer-only runs and evidence on top of the shared subject/freshness contract. It validates reviewer/implementation-owner separation, captures the current baseline-to-candidate subject including dirty files, stores review outcomes and findings as append-only `review` evidence, and provides a distinct inspection prompt. `src/core/tasks/gate.ts` is the single read-only evaluator for task completion: it composes dependency state, policy blockers, baseline-aware scope, current verification evidence, evidence categories, and independent review freshness. `doneTask` invokes it under the existing mutation lock, rechecks the candidate before persistence, records a `completion` evidence provenance set, and only then writes the terminal task state.
