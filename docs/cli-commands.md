# CLI Commands

The public CLI name is `apkit`. The shorter `apk` alias is kept for existing local workflows.

When Agentic Project Kit is installed as a repository dev dependency, run commands through `pnpm exec apk` so agents use the project-pinned CLI instead of a global binary.

## Implemented commands

- `apk init` - create the kit structure in a new repository.
- `apk adopt` - add the kit to an existing repository after a lightweight scan.
- `apk audit [directory]` - write lightweight kit/workflow and repository-readiness audit reports.
- `apk doctor` - run read-only local workflow health checks.
- `apk agent register --id <id> --platform <platform> --model <model> [--developer <id>]` - register an agent.
- `apk agent list` - list registered agents.
- `apk agent migrate-logs [--remove-legacy]` - convert legacy analytics logs to sharded files.
- `apk agent prompt --platform <platform>` - print compact agent setup instructions.
- `apk analytics summary [--month YYYY-MM] [--write]` - summarize team agent analytics.
- `apk mode <mode>` - set or inspect the current operating mode.
- `apk next-task` - choose the next task to work on.
- `apk tasks` - list active tasks (todo, doing, review, blocked).
- `apk tasks --all` - list all tasks including done, canceled, and archived.
- `apk tasks --state <state>` - filter tasks by exact state.
- `apk tasks --owner <agent-id>` - filter tasks by owner.
- `apk work <task-id> --owner <agent-id> --target <agent> [--level 1|2|3|auto] [--write-session]` - claim or continue a task and render its prompt.
- `apk claim <task-id> --owner <agent-id>` - claim a todo task.
- `apk release <task-id> --owner <agent-id>` - release a task back to todo.
- `apk block <task-id> --owner <agent-id> --reason <text>` - block a task.
- `apk review <task-id> --owner <agent-id>` - move a task to review.
- `apk review <task-id> --reviewer <reviewer-id> --result <pass|changes_requested|fail> [--finding <text>] [--implementation-run <run-id>]` - append independent review evidence without changing task state.
- `apk review <task-id> --reviewer <reviewer-id> --prompt` - render the revision-bound inspection prompt for an independent reviewer.
- `apk done <task-id> --owner <agent-id>` - mark a task done.
- `apk cancel <task-id> --owner <agent-id> --reason <text>` - cancel a task.
- `apk context <task-id>` - output the context files needed for a task.
- `apk prompt <agent> --task <task-id>` - generate an agent-specific prompt.
- `apk export <agent> [--force]` - export instructions for a specific agent tool.
- `apk sync <agent> [--write]` - check or update generated instruction files.
- `apk status` - print compact workflow status without writing files.
- `apk suggest-context "<task description>" [--limit <n>]` - suggest context and allowed files using local heuristics.
- `apk task archive <task-id>` - archive a done task by moving it to `.tasks/archive/`.
- `apk task archive --all` - archive all done top-level tasks.
- `apk task deps <task-id>` - inspect task prerequisites, dependents, and graph problems.
- `apk task evidence <task-id>` - list append-only evidence records for a task.
- `apk task policy <task-id>` - resolve deterministic risk/tag requirements and print blockers without changing task state.
- `apk task gate <task-id>` - preview completion blockers for the current candidate without changing task state.
- `apk task verify <task-id> [--check-files-only] [--profile <profile|all>] [--owner <agent-id>]` - run eligible verification checks and record evidence.
- `apk task create --title <title> --scope <csv> --allowed <csv> [--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--verification <csv>] [--verification-json <json>] [--goal <text>] [--assumptions <csv>] [--invariants <csv>] [--required-evidence <csv>] [--review-questions <csv>] [--counterexample-searches <csv>]` - generate a new validated task file.

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
pnpm exec apk doctor
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
`apk analytics summary` includes active and archived task metadata when grouping task risk, mode, and lane.
`apk task create` uses the task lock while allocating ids and writing files so concurrent creates cannot leave duplicate task ids.
`apk task create --template` supports `bugfix`, `feature`, `refactor`, `docs`, `audit`, and `test`. Explicit flags override template defaults.
`--verification` keeps the legacy comma-separated command input and normalizes each command to a required local deterministic automated check. `--verification-json` accepts structured checks with `type`, `required`, `environment`, `profile`, `command` or `instruction`, and optional `artifact`/`evidence` fields. Legacy `## Verification commands` task files remain readable without migration.
`--assumptions`, `--invariants`, `--required-evidence`, `--review-questions`, and `--counterexample-searches` populate optional correctness-contract sections. They are preserved through task parsing/rendering and included in implementation/review prompts only when non-empty.
`apk task evidence <task-id>` reads `.agentic/evidence.jsonl`, filters by task ID, and prints bounded references and subject identities without command output blobs.
`apk task verify` checks `git diff` changed files against task allowed/forbidden files, then runs task verification commands unless `--check-files-only` is set.
`apk task verify --profile` selects `deterministic`, `integration`, `trusted`, or `report` checks. Manual/live checks are reported as unavailable, unselected checks as not-run, and required non-pass results return exit code 1. Each check appends a revision-bound record to `.agentic/evidence.jsonl`; command output is never stored.
After `apk claim`, verification compares changed paths with the claim baseline in `.agentic/task-baselines.jsonl`, excludes unchanged pre-existing dirty files and workflow bookkeeping, and reports attributed scope violations. Baseline diagnostics are included in the machine-readable `verifyTask` result.
`apk task policy <task-id>` resolves low/medium/high risk defaults and additive classification tags. It prints automated verification, scope, review, and evidence requirements plus actionable blockers and diagnostics; it does not enforce completion or mutate the task.
`apk review` with `--reviewer` creates a separate `review-...` run, rejects self-review by the implementation owner, and records `pass`, `changes_requested`, or `fail` with optional findings. `--prompt` prints the evaluated HEAD, baseline/candidate/worktree identity, changed paths, acceptance criteria, scope, and adversarial inspection guidance without writing evidence.
`apk task gate <task-id>` and `apk done <task-id> --owner <agent-id>` use the same evaluator. The gate rejects unfinished dependencies, scope violations, unresolved policy blockers, and missing/failed/stale/different-candidate verification or independent-review evidence. A successful done transition records a completion evidence set; there is no `--force` bypass.
`apk audit` uses static inspection only. It reports lightweight readiness facts such as package scripts, lockfiles, CI presence, env examples, tests, license, README, Docker files, monorepo indicators, and TypeScript strict mode.
`apk suggest-context` is heuristic and local. It scans bounded project paths and suggests candidates; it does not guarantee deep code understanding.

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

- `agents`
- `claude`
- `codex`
- `gemini`
- `opencode`
- `cursor`

Sync targets:

- `agents`
- `claude`
- `codex`
- `gemini`
- `opencode`
- `cursor`

## Behavior principles

- Commands should be deterministic.
- Commands should read the repository state, not chat history.
- Commands should make the selected context explicit.
- Commands should be usable in both greenfield and brownfield repos.
- Commands should not imply deep code understanding, web UI, SaaS, or autonomous agent execution unless that behavior is implemented.
