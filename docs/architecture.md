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

Task evidence uses a dedicated append-only `.agentic/evidence.jsonl` store. It is separate from agent/run analytics so verification, manual/live checks, reports, and later review evidence retain their own typed results and revision-bound subject identities. Appends use an evidence-specific lock, never the task lifecycle lock. Records explicitly mark gate eligibility; anonymous verification remains diagnostic-only. Read operations tolerate a missing store (no evidence) and report malformed records with line diagnostics. The legacy global JSONL remains the compatibility layout; a malformed line is diagnosed at read time and can still affect the global reader until evidence sharding is introduced.

Claim baselines use a parallel append-only `.agentic/task-baselines.jsonl` store. A baseline captures HEAD, dirty-file fingerprints, task path, owner, and explicit bookkeeping exclusions. Scope attribution reads this record without resetting or rewriting user files.

## Effective policy resolution

`src/core/tasks/policy.ts` is a deterministic policy layer over task risk, tags, and structured verification. It applies conservative low/medium/high defaults, merges additive classification rules, reports required evidence categories, and returns explainable blockers/diagnostics. The `apk task policy` command exposes this calculation read-only. The resolver does not mutate lifecycle state; later completion work consumes its result together with verification, scope, evidence, and review outcomes.

## Independent review and completion gate

`src/core/tasks/review.ts` adds reviewer-only runs and evidence on top of the shared subject/freshness contract. It validates reviewer/implementation-owner separation, persists a compact prepared review session under `.agentic/reviews/<task>/<review-run>.json`, binds the result to that immutable subject, and rejects stale/mixed revisions without rebasing. `src/core/tasks/gate.ts` is the single read-only evaluator for task completion: it composes dependency state, policy blockers, baseline-aware scope, current trusted verification evidence, evidence categories, and independent review freshness. Git comparison failures are explicit blockers; an empty successful diff remains distinct from an unknown diff. `doneTask` invokes it under the existing mutation lock, rechecks the candidate before persistence, records a `completion` evidence provenance set, and only then writes the terminal task state.

## Task provenance reporting

`src/core/tasks/provenance.ts` is a read-only reporting layer over those existing stores. It joins task identity, claim baseline, run-log events, registered agents, revision-bound evidence, completion gate evidence IDs, and bounded Git metadata by task ID. It does not introduce a second policy or telemetry store and never emits raw command logs. Evidence history remains append-only: current freshness is evaluated against the present candidate, while completion retains the exact candidate and decision-time freshness used at persistence. Lifecycle-only task-file changes are excluded from the implementation subject hash; attributed implementation paths still create new candidate revisions. Provenance separates task-attributed changed files from the broad `repository activity since task baseline` commit/diff range, which may include parallel-agent activity. `apk task provenance` exposes human output and `--json` machine output, with explicit diagnostics for unavailable baseline, commits, or links.

## Model-agnostic worker boundary

`src/core/work/contract.ts` is the vendor-neutral boundary between APK task orchestration and a coding harness. `apk-worker-v1` packages task/context/constraints/output expectations with one of four roles: `implement`, `review`, `fix`, or `verify`. A package provenance is the issued/input candidate; mutable worker results recapture an output candidate, while review results remain bound to the prepared/current subject. Parsing and serialization are bounded and SDK-free; exporter templates only adapt the common guidance to each tool.

`src/core/work/index.ts` creates each package in a temporary session directory and atomically publishes it, transitions `doing` to `review` only after successful independent-review issuance, resolves roles from the canonical gate projection, and records implement/fix output candidates separately from issued inputs. This keeps the task contract and provenance in the core workflow while allowing one harness to implement a task and another to review or fix it.

Terminal worker and review results use one evidence-lock transaction for duplicate detection plus append, so concurrent submissions cannot both commit. Worker review preparation and activation share a per-run lifecycle lock; failed pre-activation issuance removes only the exact worker-origin preparation and preserves standalone, successor, or correctly activated review state.
