# CLI Commands

The public CLI name is `apkit`. The shorter `apk` alias is kept for existing local workflows.

## Implemented commands

- `apk init` - create the kit structure in a new repository.
- `apk adopt` - add the kit to an existing repository.
- `apk audit [directory]` - write repository audit reports.
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
- `apk claim <task-id> --owner <agent-id>` - claim a todo task.
- `apk release <task-id> --owner <agent-id>` - release a task back to todo.
- `apk block <task-id> --owner <agent-id> --reason <text>` - block a task.
- `apk review <task-id> --owner <agent-id>` - move a task to review.
- `apk done <task-id> --owner <agent-id>` - mark a task done.
- `apk cancel <task-id> --owner <agent-id> --reason <text>` - cancel a task.
- `apk context <task-id>` - output the context files needed for a task.
- `apk prompt <agent> --task <task-id>` - generate an agent-specific prompt.
- `apk export <agent> [--force]` - export instructions for a specific agent tool.
- `apk sync <agent> [--write]` - check or update generated instruction files.
- `apk task archive <task-id>` - archive a done task by moving it to `.tasks/archive/`.
- `apk task archive --all` - archive all done top-level tasks.
- `apk task deps <task-id>` - inspect task prerequisites, dependents, and graph problems.
- `apk task create --title <title> --mode <mode> --lane <lane> --scope <csv> --risk <risk> --context <csv> --allowed <csv> --verification <csv>` - generate a new validated task file.

## Example usage

```bash
apk init
apk agent register --id codex-a --developer alice --platform codex --model gpt-5.5
apk mode mvp
apk next-task
apk claim 0001 --owner codex-a
apk context 0001
apk prompt codex --task 0001
apk review 0001 --owner codex-a
apk done 0001 --owner codex-a
apk tasks --all
apk export cursor --force
apk audit
apk sync cursor
apk analytics summary --month 2026-05 --write
apk task deps 0043
apk task archive 0001
apk task archive --all
apk task create --title "Add Feature" --mode mvp --lane implementation --scope api,docs --risk low --context "AGENTS.md,docs/task-system.md" --allowed "src/api/index.ts" --verification "pnpm test"
```

`apk export` skips existing files by default. Use `--force` to overwrite generated instruction files.
`apk sync` is check-only by default. Use `--write` to update missing or stale generated files.

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
