# CLI Commands

The public CLI name is `apkit`. The shorter `apk` alias is kept for existing local workflows.

When Agentic Project Kit is installed as a repository dev dependency, run commands through `pnpm exec apk` so agents use the project-pinned CLI instead of a global binary.

## Implemented commands

- `apk init` - create the kit structure in a new repository.
- `apk adopt [directory] [--preview|--dry-run|--apply]` - add the kit to an existing repository and optionally preview/apply legacy compatibility migration.
- `apk audit [directory]` - write lightweight kit/workflow and repository-readiness audit reports.
- `apk lint [--json]` - read-only validation of task graph, paths, policy, ownership, and generated instruction drift.
- `apk context <task-id> [--level 1|2|3] [--budget <units>]` - print legacy or budgeted task context.
- `apk doctor` - run read-only local workflow health checks.
- `apk quality detect [directory] [--json]` - detect repository quality capabilities and evaluate explicit policy without executing or mutating repository tooling.
- `apk agent register --id <id> --platform <platform> --model <model> [--developer <id>]` - register an agent.
- `apk agent list` - list registered agents.
- `apk agent migrate-logs [--remove-legacy]` - convert legacy analytics logs to sharded files.
- `apk agent prompt --platform <platform>` - print compact agent setup instructions.
- `apk analytics summary [--month YYYY-MM] [--write]` - summarize team agent analytics.
- `apk mode <mode>` - set or inspect the current operating mode.
- `apk resources [--json]` - render the optional secret-free model, harness, and executable worker registry without probing providers.
- `apk resources detect [--json]` - deterministic read-only inventory of declared resources, local harness markers, and quality capabilities with a stable fingerprint.
- `apk attention [--json]` - bounded, priority-ordered semantic attention queue derived from task/gate/review/policy/resource state; never claims live process facts.
- `apk workers [--json]` - declared workers with semantic `ready`/`busy`/`unknown`/`unavailable` state from declared availability/capacity/occupancy plus canonical issued work sessions; exposes bounded capabilities, effective/declared occupancy, remaining slots, and a proven current task/run when one active session exists.
- `apk execution explain <task-id> --role <planning|implementation|review|fix|documentation|triage|verification> [--profile <local|constrained|balanced|abundant>] [--resource <worker-id>] [--json]` - explain a deterministic resource route without starting a worker.
- `apk execution calibrate [--json]` - emit a bounded `apk-calibration-v1` planner package; `--recommendation <json> [--apply]` validates an external recommendation and applies it only on explicit request, preserving user overrides.
- `apk next-task` - choose the next task to work on.
- `apk tasks` - list active tasks (todo, doing, review, blocked).
- `apk tasks --all` - list all tasks including done, canceled, and archived.
- `apk tasks --state <state>` - filter tasks by exact state.
- `apk tasks --owner <agent-id>` - filter tasks by owner.
- `apk work <task-id> --owner <agent-id> --target <agent> [--resource <worker-id>] [--role implement|review|fix|verify] [--level 1|2|3|auto] [--write-session] [--json]` - issue and persist a vendor-neutral worker package; an optional resource ID must reference the validated registry; omitted role is resolved from canonical workflow state.
- `apk claim <task-id> --owner <agent-id>` - claim a todo task.
- `apk release <task-id> --owner <agent-id>` - release a task back to todo.
- `apk block <task-id> --owner <agent-id> --reason <text>` - block a task.
- `apk review <task-id> --owner <agent-id>` - move a task to review.
- `apk review <task-id> --reviewer <reviewer-id> --result <pass|changes_requested|fail> [--finding <text>] [--implementation-run <run-id>]` - append independent review evidence without changing task state.
- `apk review <task-id> --reviewer <reviewer-id> --prompt` - render the revision-bound inspection prompt for an independent reviewer.
- `apk done <task-id> --owner <agent-id>` - mark a task done.
- `apk cancel <task-id> --owner <agent-id> --reason <text>` - cancel a task.
- `apk context <task-id>` - output the context files needed for a task.
- `apk prompt <agent> --task <task-id> [--level 1|2|3] [--budget <units>]` - generate an agent-specific prompt from legacy or budgeted context.
- `apk export <agent> [--force]` - export instructions for a specific agent tool.
- `apk sync <agent> [--write]` - check or update generated instruction files.
- `apk status [--detail]` - print compact active-task workflow status without writing files; detail adds bounded gate, evidence, and provenance fields.
- `apk suggest-context "<task description>" [--limit <n>]` - suggest context and allowed files with reasons from local dependency/change-aware heuristics.
- `apk task archive <task-id>` - archive a done task by moving it to `.tasks/archive/`.
- `apk task archive --all` - archive all done top-level tasks.
- `apk task deps <task-id>` - inspect task prerequisites, dependents, and graph problems.
- `apk task evidence <task-id>` - list append-only evidence records for a task.
- `apk task dogfood start <task-id> --owner <agent-id> --tool <tool> --scenario <text>` - create a bounded dogfooding prompt/session.
- `apk task dogfood result <task-id> --owner <agent-id> --session <session-id> --outcome <pass|fail>` - record bounded dogfooding evidence.
- `apk task policy <task-id>` - resolve deterministic risk/tag requirements and print blockers without changing task state.
- `apk task gate <task-id>` - preview completion blockers for the current candidate without changing task state.
- `apk task provenance <task-id> [--json]` - reconstruct bounded task runs, worker issued/output subjects, baseline, commits/diff, evidence freshness/supersession, and completion evidence.
- `apk task verify <task-id> [--check-files-only] [--profile <profile|all>] [--owner <agent-id>]` - run eligible verification checks and record evidence.
- `apk task create --title <title> --scope <csv> --allowed <csv> [--type <name>|--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--verification <csv>] [--verification-json <json>] [--goal <text>] [--assumptions <csv>] [--invariants <csv>] [--required-evidence <csv>] [--review-questions <csv>] [--counterexample-searches <csv>]` - generate a new validated task file.

## Example usage

```bash
pnpm exec apk init
pnpm exec apk agent register --id codex-a --developer alice --platform codex --model gpt-5.5
pnpm exec apk mode mvp
pnpm exec apk next-task
pnpm exec apk claim 0001 --owner codex-a
pnpm exec apk context 0001
pnpm exec apk prompt codex --task 0001
pnpm exec apk review 0001 --owner codex-a
pnpm exec apk done 0001 --owner codex-a
pnpm exec apk tasks --all
pnpm exec apk export cursor --force
pnpm exec apk audit
pnpm exec apk lint --json
pnpm exec apk context 0067 --budget 12000
pnpm exec apk doctor
pnpm exec apk quality detect --json
pnpm exec apk sync cursor
pnpm exec apk status
pnpm exec apk suggest-context "Add auth middleware"
pnpm exec apk work 0043 --owner codex-a --target codex
pnpm exec apk analytics summary --month 2026-05 --write
pnpm exec apk task deps 0043
pnpm exec apk task verify 0043 --owner codex-a
pnpm exec apk task archive 0001
pnpm exec apk task archive --all
pnpm exec apk task create --title "Add Feature" --goal "Implement the smallest useful feature slice." --mode mvp --lane implementation --scope api,docs --risk low --context "AGENTS.md,docs/task-system.md" --allowed "src/api/index.ts" --verification "pnpm test"
pnpm exec apk task create --template bugfix --title "Fix Parser" --scope cli --allowed src/cli/index.ts
```

`apk export` skips existing files by default. Use `--force` to overwrite generated instruction files.
`apk sync` is check-only by default. Use `--write` to update missing or stale generated files.
`apk adopt --preview`/`--dry-run` reports compatibility, legacy versus gated task contracts, and every proposed create/update without writing. `apk adopt --apply` explicitly adds the current config schema marker to a legacy config while preserving all keys, creates only missing kit files, and is idempotent. Existing customized instructions and task Markdown are never overwritten; unsupported future config schemas fail closed.
`apk lint` composes task/parser, dependency, path/policy, state/owner, and check-only sync findings without writing reports or generated files. Use `--json` for stable CI output; structural or generated-file errors return exit code 1.
`apk context` and `apk prompt` retain existing `--level` behavior when no budget is supplied. With `--budget`, units approximate tokens as `ceil(UTF-8 bytes / 4)`, required files are never dropped, and an oversized required tier returns a diagnostic and exit code 1. Relevant files use task paths plus explicit changed/dependency/recent signals; no network or model is used.
`apk work` accepts `--role implement|review|fix|verify` and returns an `apk-worker-v1` package with task context, constraints, output/evidence expectations, and run identity. Every issued package is written in a private temporary directory and atomically renamed under `.agentic/sessions/work/<task-id>/<run-id>/`; an existing run ID is immutable and causes a collision diagnostic. `metadata.json` preserves the issued/input subject and package hash; `activation.json` is written last, after issuance completes, and is required for result submission. `--json` exposes the same serialized package and paths to external harnesses. Worker results are accepted only for that exact issued task/run/owner/role/protocol. Worker results use the same role-independent contract across exporters; APK does not launch or depend on a vendor runtime.

`--role review` prepares the canonical revision-bound review session and puts its `reviewRunId`, reviewer, baseline/HEAD, candidate, worktree, and changed files in the package. The persisted preparation is marked `origin=worker`; standalone `apk review --prompt` preparations are marked `origin=standalone`. The prompt is an inspection prompt. A newly issued review reports `pending review result`; only the result submission is unconditional, with PASS→gate and changes_requested/fail→fix guidance. Recording a worker-origin review requires the active worker session and exact package/reviewer binding; standalone review remains independent of worker activation. Both paths retain stale-subject rejection. A `completed` review maps to `pass`, `changes_requested` stays `changes_requested`, and `failed` maps to `fail`.

Worker lifecycle records are diagnostic-only (`gateEligible=false`) and cannot satisfy report/live/benchmark/manual/CI/artifact/evidence categories. Implement/fix results capture the output candidate produced by the worker, preserving the issued candidate in package metadata; review results must still match the issued/current candidate. A verify worker result only points back to canonical `apk task verify`; review is offered after current check-specific verification evidence exists. Issuing review automatically moves `doing` to `review` after preconditions pass, so `changes_requested` can issue `fix` without a hidden manual transition. Same-worktree warnings ignore unactivated/orphan sessions and retain warnings for activated unsettled mutable sessions. No result response invents a next issued package; the next actor must call `apk work` explicitly. Guidance uses the task owner for verification/gate/done and an independent reviewer/fixer placeholder where ownership must change.

Concurrent terminal submissions for one worker/review run are serialized with evidence append and only one is accepted. If review issuance fails before activation, its exact worker-origin preparation is removed without deleting standalone, successor, or activated state. Standalone review findings recorded while a task is still `doing` produce the exact owner transition command (`apk review <task-id> --owner <implementation-owner>`) before fixer issuance; no task state is changed implicitly.
`apk analytics summary` includes active and archived task metadata when grouping task risk, mode, and lane.
`apk task create` uses the task lock while allocating ids and writing files so concurrent creates cannot leave duplicate task ids.
`apk task lock status [--kind task|evidence] [--json]` classifies task/evidence locks as absent, live, dead, malformed, or uncertain using the shared local ownership rules. Old age is diagnostic only. `apk task lock recover --kind <task|evidence>` recovers a confirmed-dead owner; `--force` is required for malformed/uncertain metadata and still refuses a confirmed-live local owner. Normal mutations automatically recover confirmed-dead owners without manual file deletion.
`apk task create --type` supports `feature`, `bugfix`, `refactor`, `migration`, `async-worker`, `provider-integration`, `deployment`, `benchmark`, `security`, and `release`, plus the existing `docs`, `audit`, and `test` templates. `--template` is an equivalent alias; `provider`/`integration` and `async` are accepted aliases. Typed defaults persist `Type`, structured verification, domain guardrails, and policy tags. Explicit flags override defaults, and generated task files remain editable.
`--verification` keeps the legacy comma-separated command input and normalizes each command to a required local deterministic automated check. `--verification-json` accepts structured checks with `type`, `required`, `environment`, `profile`, `command` or `instruction`, and optional `artifact`/`evidence` fields. Legacy `## Verification commands` task files remain readable without migration.
`--assumptions`, `--invariants`, `--required-evidence`, `--review-questions`, and `--counterexample-searches` populate optional correctness-contract sections. They are preserved through task parsing/rendering and included in implementation/review prompts only when non-empty.
`apk task evidence <task-id>` reads `.agentic/evidence.jsonl`, filters by task ID, and prints bounded references and subject identities without command output blobs.
`apk task dogfood start` writes a reproducible session prompt and metadata, registers the session/run through the existing agent/run infrastructure, and never launches a model. `apk task dogfood result` appends a separate vendor-neutral `dogfood` record with bounded observations, failures, retries, discovered issues, and optional metrics (`actionCount`, `toolCallCount`, `contextUnits`, `durationMs`, `latencyMs`). Results are immutable per session: a failed result remains `fail` and cannot be overwritten with `pass`.
`apk task verify` checks `git diff` changed files against task allowed/forbidden files, then runs task verification commands unless `--check-files-only` is set.
`apk task verify --profile` selects `deterministic`, `integration`, `trusted`, or `report` checks. Manual/live checks are reported as unavailable, unselected checks as not-run, and required non-pass results return exit code 1. Each check appends a revision-bound record to `.agentic/evidence.jsonl`; command output is never stored.
`apk task verify <task-id> --record --owner <task-owner> --check <check-id> --result <pass|fail> --evidence <reference> [--summary <text>]` records an externally-observed result for a declared manual or `live` check. It requires the registered task owner, a bounded (240-character) non-empty evidence reference, and a `doing`/`review` task; it binds the current baseline/candidate subject and appends a typed gate-eligible record. Automated checks are rejected (run `apk task verify` instead), so the surface cannot launder automated verification. Record-only flags are rejected unless `--record` is present, and a later `apk task verify` shadows the recorded observation until it is recorded again.
After `apk claim`, verification compares changed paths with the claim baseline in `.agentic/task-baselines.jsonl`, excludes unchanged pre-existing dirty files and workflow bookkeeping, and reports attributed scope violations. Baseline diagnostics are included in the machine-readable `verifyTask` result.
`apk task policy <task-id>` resolves low/medium/high risk defaults and additive classification tags. It prints automated verification, scope, review, and evidence requirements plus actionable blockers and diagnostics; it does not enforce completion or mutate the task.
`apk review` with `--reviewer` creates a separate `review-...` run, rejects self-review by the implementation owner, and records `pass`, `changes_requested`, or `fail` with optional findings. `--prompt` prints the evaluated HEAD, baseline/candidate/worktree identity, changed paths, acceptance criteria, scope, and adversarial inspection guidance without writing evidence.
`apk task gate <task-id>` and `apk done <task-id> --owner <agent-id>` use the same evaluator. The gate rejects unfinished dependencies, scope violations, unresolved policy blockers, and missing/failed/stale/different-candidate verification or independent-review evidence. A successful done transition records a completion evidence set; there is no `--force` bypass.

Task policy output explains canonical assurance (`none`, `self-check`, `fresh-context`, `independent`, `diverse`), stable escalation triggers, and bounded review budgets. Budget exhaustion is a visible gate/status blocker; it never silently downgrades assurance.
`apk audit` uses static inspection only. It reports lightweight readiness facts such as package scripts, lockfiles, CI presence, env examples, tests, license, README, Docker files, monorepo indicators, and TypeScript strict mode.
`apk quality detect` reports stable capability IDs (`typecheck`, `lint`, `tests`, `build`, `coverage`, `hooks`, `ci`) with sorted evidence and policy disposition. Configure only explicit `quality.required` or `quality.recommended` IDs in `.agentic/config.json`; defaults require nothing. Missing optional capabilities produce recommendations and a successful diagnostic, while missing or unknown required capabilities fail. The detector never executes package scripts, installs dependencies, or writes repository files.
`apk suggest-context` is heuristic and local. It scans bounded project paths and suggests candidates; it does not guarantee deep code understanding.
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
`apk export --report-legacy` previews them and `apk export --cleanup-legacy`
removes only exact unmodified generated files while preserving customized ones.

Sync targets:

- `agents`
- `claude`
- `codex`
- `gemini`
- `opencode`
- `cursor`

Sync targets use the same canonical set and aliasing as export targets.

`apk task provenance <task-id>` is read-only. Human output summarizes participants, runs, commits, changed files, evidence freshness, superseding links, and the exact completion evidence set. `--json` emits the same bounded fields for automation; unavailable Git or historical links appear in `diagnostics` rather than causing non-code task history to disappear.

`apk status` keeps the existing repository counts and latest-run summary, then lists active tasks with owner, risk/effective policy, dependency readiness, verification progress, scope, review, evidence, gate state, and a bounded next action. `apk status --detail` adds blocker reasons, candidate/provenance identities, and bounded diagnostics. Status reuses the completion gate and provenance reader; it does not resolve policy independently.

## Behavior principles

- Commands should be deterministic.
- Commands should read the repository state, not chat history.
- Commands should make the selected context explicit.
- Commands should be usable in both greenfield and brownfield repos.
- Commands should not imply deep code understanding, web UI, SaaS, or autonomous agent execution unless that behavior is implemented.
