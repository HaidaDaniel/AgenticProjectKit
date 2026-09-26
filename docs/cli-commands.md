# CLI Commands

The canonical public CLI command is `apkit`. The package keeps `apk` and `agentic-project-kit` as compatibility aliases for the same entrypoint.

When Agentic Project Kit is installed as a repository dev dependency, run commands through `pnpm exec apkit` so agents use the project-pinned CLI instead of a global binary.

## Invocation contexts

Use the repository-pinned command for an end-user project:

```sh
pnpm exec apkit init
```

When APK is intentionally installed globally, use the same canonical command name:

```sh
apkit --help
```

Run the TypeScript entrypoint directly only when contributing from the Agentic Project Kit source checkout:

```sh
pnpm exec tsx src/cli/index.ts --help
```

The `apk` and `agentic-project-kit` aliases remain available for existing scripts and local workflows. New public examples use `apkit`.

For first-time use, install an exact release tag into the target repository and then run the local binary with `pnpm exec apkit`; see the [repository-local install and recovery steps](../README.md#install-apk-in-another-repository).

## Implemented commands

The command synopsis and option list below are rendered from `src/cli/command-registry.ts`. CLI tests require this block to match the registry exactly; the behavior notes below explain defaults and side effects.

<!-- BEGIN GENERATED CLI COMMAND REFERENCE -->
- `apkit agent register --id <id> --platform <platform> --model <model> [--label <label>] [--developer <id>]` - register an agent in the repository-local registry.
- `apkit agent list` - list registered agents.
- `apkit agent migrate-logs [--remove-legacy]` - convert legacy analytics logs to sharded files.
- `apkit agent prompt --platform <platform>` - print compact setup instructions for a platform.
- `apkit adopt [directory] [--preview|--dry-run|--apply]` - add kit files and optionally preview/apply the explicit compatibility migration.
- `apkit analytics summary [--month YYYY-MM] [--write]` - summarize a month of agent activity, optionally writing the report.
- `apkit attention [--json]` - project task, gate, review, policy, and resource state without claiming live process facts.
- `apkit audit [directory]` - write lightweight kit/workflow and repository-readiness reports using static inspection.
- `apkit block <task-id> --owner <agent-id> [--reason <text>]` - block a task with an optional reason.
- `apkit cancel <task-id> --owner <agent-id> [--reason <text>]` - cancel a task with an optional reason.
- `apkit claim <task-id> --owner <agent-id>` - claim a todo task and capture its task baseline.
- `apkit context <task-id> [--level 1|2|3] [--budget <units>]` - select task context; budget units approximate tokens and required files are never dropped.
- `apkit done <task-id> --owner <agent-id>` - evaluate the completion gate and record completion evidence; there is no force bypass.
- `apkit doctor` - inspect local APK workflow health without running adopted-repository commands.
- `apkit execution explain <task-id> --role <planning|implementation|review|fix|documentation|triage|verification> [--profile <local|constrained|balanced|abundant>] [--resource <worker-id>] [--complexity <simple|medium|complex>] [--json]` - explain the effective route without starting a worker.
- `apkit execution calibrate [--json]` - emit a bounded calibration package.
- `apkit execution calibrate --recommendation <json> [--apply]` - validate an external recommendation and apply it only when requested.
- `apkit export [agent] [--force]` - export generated instructions; existing files are skipped unless forced.
- `apkit export --report-legacy` - report obsolete generated files without writing.
- `apkit export --cleanup-legacy` - remove only obsolete files whose content exactly matches a known APK rendering.
- `apkit init [directory]` - create starter docs, config, task, ignore rules, and generated instructions.
- `apkit language [show]` - show the resolved local language and its source.
- `apkit language set <tag>` - persist a short developer-local language tag.
- `apkit language reset` - remove the local preference and use the English fallback.
- `apkit lint [--json]` - run read-only contract lint; JSON output is stable for automation.
- `apkit mode [mode]` - inspect or set the repository's current workflow mode.
- `apkit next-task` - select a todo task whose dependencies are complete.
- `apkit prompt <agent> --task <task-id> [--level 1|2|3] [--budget <units>] [--language <tag>]` - render bounded task context and an optional invocation-only language override.
- `apkit quality detect [directory] [--json]` - read declared quality signals and evaluate explicit policy without executing project commands.
- `apkit resources [--json]` - render configured model, harness, and worker records without probing providers.
- `apkit resources detect [--json]` - inventory local markers and declared capabilities without mutation.
- `apkit release <task-id> --owner <agent-id>` - release a task owned by the registered agent.
- `apkit review <task-id> --owner <agent-id>` - move the implementation task to review.
- `apkit review <task-id> --reviewer <reviewer-id> --prompt` - prepare a revision-bound review session and print its review run ID.
- `apkit review <task-id> --reviewer <reviewer-id> --review-run <review-run-id> --result <pass|changes_requested|fail> [--finding <text>] [--implementation-run <run-id>]` - record the prepared review outcome; reviewer must be registered and separate from the owner.
- `apkit status [--detail]` - show task and gate state; detail adds bounded evidence/provenance diagnostics without writing files.
- `apkit suggest-context "<task description>" [--limit <n>]` - rank context candidates from repository paths and task signals; suggestions are not guaranteed impact analysis.
- `apkit sync [agent] [--write]` - check generated files by default; write missing or stale files only with `--write`.
- `apkit task archive <task-id>` - archive a done task.
- `apkit task archive --all` - archive all done top-level tasks.
- `apkit task deps <task-id>` - inspect prerequisites, dependents, and graph problems.
- `apkit task evidence <task-id>` - list bounded evidence references and subject identities.
- `apkit task lock status [--kind <task|evidence>] [--json]` - inspect task/evidence lock ownership and liveness.
- `apkit task lock recover --kind <task|evidence> [--force]` - recover a confirmed-dead lock; uncertain metadata requires `--force` and independent operator inspection.
- `apkit task policy <task-id>` - resolve requirements and show blockers without changing task state.
- `apkit task gate <task-id>` - preview completion blockers for the current candidate.
- `apkit task decision <task-id> --actor <human-id> --result <accept-current|grant-review-passes|changes-required|cancel> --reason <text> [--passes <1-2>] [--owner <agent-id>]` - record an operator-asserted, candidate-bound decision; there is no generic force bypass.
- `apkit task provenance <task-id> [--json]` - reconstruct bounded runs, commits, scope, evidence freshness, and completion provenance.
- `apkit task dogfood start <task-id> --owner <agent-id> --tool <tool> --scenario <text> [--session <id>] [--started-at <ISO timestamp>]` - create a bounded dogfooding prompt/session.
- `apkit task dogfood result <task-id> --owner <agent-id> --session <session-id> --outcome <pass|fail> [--ended-at <ISO timestamp>] [--failures <csv>] [--retries <n>] [--observations <csv>] [--issues <csv>] [--metrics-json <json>]` - record an immutable bounded observation for that session.
- `apkit task verify <task-id> [--check-files-only] [--profile <profile|all>] [--owner <agent-id>]` - check task file scope, run eligible checks, and append candidate-bound evidence.
- `apkit task verify <task-id> --record --owner <agent-id> --check <check-id> --result <pass|fail> --evidence <reference> [--summary <text>]` - record an externally observed manual/live result for a declared check.
- `apkit task create --title <title> --scope <csv> --allowed <csv> [--type <name>|--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--forbidden <csv>] [--depends <csv>] [--parallel] [--tags <csv>] [--verification <csv>] [--verification-json <json>] [--goal <text>] [--steps <csv>] [--acceptance <csv>] [--docs <csv>] [--notes <csv>] [--assumptions <csv>] [--invariants <csv>] [--required-evidence <csv>] [--review-questions <csv>] [--counterexample-searches <csv>]` - generate a validated task file; explicit values override typed template defaults.
- `apkit tasks [--all] [--state <state>] [--owner <agent-id>]` - list active tasks or filter the complete lifecycle set.
- `apkit work <task-id> --owner <agent-id> --target <agent> [--resource <worker-id>] [--role implement|review|fix|verify] [--level 1|2|3|auto] [--write-session] [--json]` - claim or continue a task and persist an `apk-worker-v1` package; this does not launch an agent.
- `apkit work result <task-id> --owner <agent-id> --run-id <run-id> --role <implement|review|fix|verify> --status <completed|failed|changes_requested> [--result-json <json>] [--commit-id <sha>] [--diff-id <id>] [--evidence-json <json>] [--finding <text>] [--reason <text>] [--json]` - submit a result for the exact activated worker run; results do not replace canonical verification or review evidence.
- `apkit work result <task-id> --owner <agent-id> --result-json <json> [--json]` - submit the complete JSON-compatible result instead of individual result fields.
- `apkit workers [--json]` - project declared availability/capacity and canonical issued sessions; does not claim live process state.
- `apkit workspaces create --task <task-id> --owner <agent-id> [--resource <worker-id>] [--run <run-id>] [--branch <name>] [--name <dir>] [--baseline <ref>] [--base <dir>] [--json]` - create a worktree after validating task/run/resource binding and path ownership.
- `apkit workspaces list [--json]` - list bounded APK-managed workspace state.
- `apkit workspaces status [--json]` - inspect one or all managed workspace states.
- `apkit workspaces cleanup <workspace-id> [--apply] [--json]` - preview cleanup by default; apply removes only a proven clean, inactive APK-owned worktree.
<!-- END GENERATED CLI COMMAND REFERENCE -->

## Example usage

```bash
pnpm exec apkit init
pnpm exec apkit agent register --id codex-a --developer alice --platform codex --model gpt-5.5
pnpm exec apkit mode mvp
pnpm exec apkit next-task
pnpm exec apkit claim 0001 --owner codex-a
pnpm exec apkit context 0001
pnpm exec apkit prompt codex --task 0001
pnpm exec apkit review 0001 --owner codex-a
pnpm exec apkit done 0001 --owner codex-a
pnpm exec apkit tasks --all
pnpm exec apkit export cursor --force
pnpm exec apkit audit
pnpm exec apkit lint --json
pnpm exec apkit context 0067 --budget 12000
pnpm exec apkit doctor
pnpm exec apkit quality detect --json
pnpm exec apkit sync cursor
pnpm exec apkit status
pnpm exec apkit suggest-context "Add auth middleware"
pnpm exec apkit work 0043 --owner codex-a --target codex
pnpm exec apkit workspaces create --task 0043 --owner codex-a --resource local-worker --run run-123
pnpm exec apkit workspaces status --json
pnpm exec apkit workspaces cleanup ws-abc123
pnpm exec apkit workspaces cleanup ws-abc123 --apply
pnpm exec apkit analytics summary --month 2026-05 --write
pnpm exec apkit task deps 0043
pnpm exec apkit task verify 0043 --owner codex-a
pnpm exec apkit task archive 0001
pnpm exec apkit task archive --all
pnpm exec apkit task create --title "Add Feature" --goal "Implement the smallest useful feature slice." --mode mvp --lane implementation --scope api,docs --risk low --context "AGENTS.md,docs/task-system.md" --allowed "src/api/index.ts" --verification "pnpm test"
pnpm exec apkit task create --template bugfix --title "Fix Parser" --scope cli --allowed src/cli/index.ts
```

`apkit export` skips existing files by default. Use `--force` to overwrite generated instruction files.
`apkit sync` is check-only by default. Use `--write` to update missing or stale generated files.
`apkit adopt --preview`/`--dry-run` reports compatibility, legacy versus gated task contracts, and every proposed create/update without writing. `apkit adopt --apply` explicitly adds the current config schema marker to a legacy config while preserving all keys, creates only missing kit files, and is idempotent. Existing customized instructions and task Markdown are never overwritten; unsupported future config schemas fail closed.
`apkit lint` composes task/parser, dependency, path/policy, state/owner, and check-only sync findings without writing reports or generated files. Use `--json` for stable CI output; structural or generated-file errors return exit code 1. It also reports bounded advisory context-hygiene estimates and deterministic repetition/legacy/missing-reference findings; those are always `info`/warning-only and never set `hasErrors`.
`apkit context` and `apkit prompt` retain existing `--level` behavior when no budget is supplied. With `--budget`, units approximate tokens as `ceil(UTF-8 bytes / 4)`, required files are never dropped, and an oversized required tier returns a diagnostic and exit code 1. Relevant files use task paths plus explicit changed/dependency/recent signals; no network or model is used.
`apkit work` accepts `--role implement|review|fix|verify` and returns an `apk-worker-v1` package with task context, constraints, output/evidence expectations, and run identity. Every issued package is written in a private temporary directory and atomically renamed under `.agentic/sessions/work/<task-id>/<run-id>/`; an existing run ID is immutable and causes a collision diagnostic. `metadata.json` preserves the issued/input subject and package hash; `activation.json` is written last, after issuance completes, and is required for result submission. `--json` exposes the same serialized package and paths to external harnesses. Worker results are accepted only for that exact issued task/run/owner/role/protocol. Worker results use the same role-independent contract across exporters; APK does not launch or depend on a vendor runtime.

`--role review` prepares the canonical revision-bound review session and puts its `reviewRunId`, reviewer, baseline/HEAD, candidate, worktree, and changed files in the package. The persisted preparation is marked `origin=worker`; standalone `apkit review --prompt` preparations are marked `origin=standalone`. The prompt is an inspection prompt. A newly issued review reports `pending review result`; only the result submission is unconditional, with PASS→gate and changes_requested/fail→fix guidance. Recording a worker-origin review requires the active worker session and exact package/reviewer binding; standalone review remains independent of worker activation. Both paths retain stale-subject rejection. A `completed` review maps to `pass`, `changes_requested` stays `changes_requested`, and `failed` maps to `fail`.

Worker lifecycle records are diagnostic-only (`gateEligible=false`) and cannot satisfy report/live/benchmark/manual/CI/artifact/evidence categories. Implement/fix results capture the output candidate produced by the worker, preserving the issued candidate in package metadata; review results must still match the issued/current candidate. A verify worker result only points back to canonical `apkit task verify`; review is offered after current check-specific verification evidence exists. Issuing review automatically moves `doing` to `review` after preconditions pass, so `changes_requested` can issue `fix` without a hidden manual transition. Same-worktree warnings ignore unactivated/orphan sessions and retain warnings for activated unsettled mutable sessions. No result response invents a next issued package; the next actor must call `apkit work` explicitly. Guidance uses the task owner for verification/gate/done and an independent reviewer/fixer placeholder where ownership must change.

Concurrent terminal submissions for one worker/review run are serialized with evidence append and only one is accepted. If review issuance fails before activation, its exact worker-origin preparation is removed without deleting standalone, successor, or activated state. Standalone review findings recorded while a task is still `doing` produce the exact owner transition command (`apkit review <task-id> --owner <implementation-owner>`) before fixer issuance; no task state is changed implicitly.
`apkit analytics summary` includes active and archived task metadata when grouping task risk, mode, and lane.
`apkit task create` uses the task lock while allocating ids and writing files so concurrent creates cannot leave duplicate task ids.
`apkit task lock status [--kind task|evidence] [--json]` classifies task/evidence locks as absent, live, dead, malformed, or uncertain using the shared local ownership rules. Old age is diagnostic only. `apkit task lock recover --kind <task|evidence>` recovers a confirmed-dead owner; `--force` is required for malformed/uncertain metadata and still refuses a confirmed-live local owner. Normal mutations automatically recover confirmed-dead owners without manual file deletion.
`apkit task create --type` supports `feature`, `bugfix`, `refactor`, `migration`, `async-worker`, `provider-integration`, `deployment`, `benchmark`, `security`, and `release`, plus the existing `docs`, `audit`, and `test` templates. `--template` is an equivalent alias; `provider`/`integration` and `async` are accepted aliases. Typed defaults persist `Type`, structured verification, domain guardrails, and policy tags. Explicit flags override defaults, and generated task files remain editable.
`--verification` keeps the legacy comma-separated command input and normalizes each command to a required local deterministic automated check. `--verification-json` accepts structured checks with `type`, `required`, `environment`, `profile`, `command` or `instruction`, and optional `artifact`/`evidence` fields. `evidenceType: "benchmark"` explicitly declares a local/static automated check as benchmark evidence; ordinary command text does not. A benchmark result may be executed with normal `apkit task verify` or recorded from an external run with `apkit task verify <id> --record --owner <owner> --check <check-id> --result pass|fail --evidence <reference>`. The external path rejects checks without an explicit benchmark declaration (except existing manual/live/CI checks), requires the registered task owner and a bounded reference, and binds the result to the current candidate. Legacy `## Verification commands` task files remain readable without migration.
`--assumptions`, `--invariants`, `--required-evidence`, `--review-questions`, and `--counterexample-searches` populate optional correctness-contract sections. They are preserved through task parsing/rendering and included in implementation/review prompts only when non-empty.
`apkit task evidence <task-id>` reads `.agentic/evidence.jsonl`, filters by task ID, and prints bounded references and subject identities without command output blobs.
`apkit task dogfood start` writes a reproducible session prompt and metadata, registers the session/run through the existing agent/run infrastructure, and never launches a model. `apkit task dogfood result` appends a separate vendor-neutral `dogfood` record with bounded observations, failures, retries, discovered issues, and optional metrics (`actionCount`, `toolCallCount`, `contextUnits`, `durationMs`, `latencyMs`). Results are immutable per session: a failed result remains `fail` and cannot be overwritten with `pass`.
`apkit task verify` checks `git diff` changed files against task allowed/forbidden files, then runs task verification commands unless `--check-files-only` is set.
`apkit task verify --profile` selects `deterministic`, `integration`, `trusted`, or `report` checks. Manual/live checks are reported as unavailable, unselected checks as not-run, and required non-pass results return exit code 1. Each check appends a revision-bound record to `.agentic/evidence.jsonl`; command output is never stored.
`apkit task verify <task-id> --record --owner <task-owner> --check <check-id> --result <pass|fail> --evidence <reference> [--summary <text>]` records an externally-observed result for a declared manual or `live` check. It requires the registered task owner, a bounded (240-character) non-empty observer evidence reference, and a `doing`/`review` task; it binds the current baseline/candidate subject and appends a typed gate-eligible record. If the check declares `artifact`, that exact single-line (maximum 240 characters) artifact reference is copied separately into the record; APK does not validate external artifact existence or integrity. Automated checks are rejected (run `apkit task verify` instead), so the surface cannot launder automated verification. Record-only flags are rejected unless `--record` is present, and a later `apkit task verify` shadows the recorded observation until it is recorded again.
After `apkit claim`, verification compares changed paths with the claim baseline in `.agentic/task-baselines.jsonl`, excludes unchanged pre-existing dirty files and workflow bookkeeping, and reports attributed scope violations. Baseline diagnostics are included in the machine-readable `verifyTask` result.
`apkit task policy <task-id>` resolves low/medium/high risk defaults and additive classification tags. It prints automated verification, scope, review, and evidence requirements plus actionable blockers and diagnostics; it does not enforce completion or mutate the task.
`apkit review` with `--reviewer` creates a separate `review-...` run, rejects self-review by the implementation owner, and records `pass`, `changes_requested`, or `fail` with optional findings. `--prompt` prints the evaluated HEAD, baseline/candidate/worktree identity, changed paths, acceptance criteria, scope, and adversarial inspection guidance without writing evidence.
`apkit task gate <task-id>` and `apkit done <task-id> --owner <agent-id>` use the same evaluator. The gate rejects unfinished dependencies, scope violations, unresolved policy blockers, and missing/failed/stale/different-candidate verification or independent-review evidence. A successful done transition records a completion evidence set; there is no `--force` bypass. When the semantic-review budget is exhausted, the gate reports `Review budget exhausted` plus the structured budget/decision state (`Human decision: ...` when one exists); record an operator decision with `apkit task decision`.

Task policy output explains canonical assurance (`none`, `self-check`, `fresh-context`, `independent`, `diverse`), stable escalation triggers, and bounded review budgets. Budget exhaustion is a visible gate/status blocker; it never silently downgrades assurance.
`apkit audit` uses static inspection only. It reports lightweight readiness facts such as package scripts, lockfiles, CI presence, env examples, tests, license, README, Docker files, monorepo indicators, and TypeScript strict mode.
`apkit quality detect` reports stable capability IDs (`typecheck`, `lint`, `tests`, `build`, `coverage`, `hooks`, `ci`) with sorted evidence and policy disposition. Configure only explicit `quality.required` or `quality.recommended` IDs in `.agentic/config.json`; defaults require nothing. Missing optional capabilities produce recommendations and a successful diagnostic, while missing or unknown required capabilities fail. The detector never executes package scripts, installs dependencies, or writes repository files.
`apkit suggest-context` is heuristic and local. It scans bounded project paths and suggests candidates; it does not guarantee deep code understanding.
It also reads local Git changes and simple relative JavaScript/TypeScript imports when available, then ranks affected modules and related tests ahead of unrelated lexical matches. Unsupported project shapes use deterministic path/keyword fallback. Output separates context suggestions from edit targets and never emits task-forbidden files as edit targets.

## Supported values

Operating modes:

- `discovery`
- `mvp`
- `product`
- `production`
- `maintenance`
- `audit`
- `adopt`

Prompt agents:

- `agents`
- `claude`
- `codex`
- `gemini`
- `opencode`
- `cursor`

Task states:

- `todo`
- `doing`
- `review`
- `done`
- `blocked`
- `canceled`

Export targets:

- `agents` - full common policy (`AGENTS.md`).
- `claude` - writes `AGENTS.md` plus a thin `CLAUDE.md` import.
- `gemini` - writes `AGENTS.md` plus a thin `GEMINI.md` import.
- `codex`, `opencode`, `cursor` - compatibility aliases that write `AGENTS.md`, which those harnesses read directly.

Only `AGENTS.md` contains the full common policy. `CLAUDE.md` and `GEMINI.md`
are thin `@AGENTS.md` imports. Legacy `.codex/instructions.md`,
`.opencode/AGENTS.md`, and `.cursor/rules/*.mdc` files are no longer generated;
`apkit export --report-legacy` previews them and `apkit export --cleanup-legacy`
removes only exact unmodified generated files while preserving customized ones.

Sync targets:

- `agents`
- `claude`
- `codex`
- `gemini`
- `opencode`
- `cursor`

Sync targets use the same canonical set and aliasing as export targets.

`apkit task provenance <task-id>` is read-only. Human output summarizes participants, runs, commits, changed files, evidence freshness, superseding links, and the exact completion evidence set. `--json` emits the same bounded fields for automation; unavailable Git or historical links appear in `diagnostics` rather than causing non-code task history to disappear.

`apkit status` keeps the existing repository counts and latest-run summary, then lists active tasks with owner, risk/effective policy, dependency readiness, verification progress, scope, review, evidence, gate state, and a bounded next action. `apkit status --detail` adds blocker reasons, candidate/provenance identities, and bounded diagnostics. Status reuses the completion gate and provenance reader; it does not resolve policy independently.

## Behavior principles

- Commands should be deterministic.
- Commands should read the repository state, not chat history.
- Commands should make the selected context explicit.
- Commands should be usable in both greenfield and brownfield repos.
- Commands should not imply deep code understanding, web UI, SaaS, or autonomous agent execution unless that behavior is implemented.
