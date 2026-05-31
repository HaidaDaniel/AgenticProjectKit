# Task System

The task system is the unit of execution for Agentic Project Kit.

Tasks use compact metadata so agents can coordinate without spending much context.

## Compact task layout

```md
# Task 0001 - Title

State: todo
Owner: none
Mode: mvp
Lane: implementation
Scope: api,docs
Risk: low
Parallel: true
Depends on: none
Tags: mvp,api

## Goal

## Context files

## Files allowed to edit

## Files forbidden to edit

## Steps

## Acceptance criteria

## Verification commands

## Documentation updates

## Notes
```

## States

- `todo` - ready to claim.
- `doing` - claimed by one registered agent.
- `review` - implementation done, waiting for review.
- `done` - verified and complete.
- `blocked` - waiting on a decision or dependency.
- `canceled` - no longer planned.

## Owner rules

- `Owner` is a compact registered agent id.
- `Owner: none` is allowed for `todo`, `blocked`, and `canceled`.
- `doing` and `review` require a registered owner.
- `claim`, `release`, `block`, `review`, `done`, and `cancel` require `--owner`.
- Task state changes are protected by transient `.tasks/.apk.lock`.

## Agent registry

Agents register before task work:

```bash
apk agent register --id codex-a --developer alice --platform codex --model gpt-5.5
```

Registry path:

```txt
.agentic/agents/<agent-id>.json
```

Run log path:

```txt
.agentic/runs/YYYY-MM-DD_<developer-id>_<agent-id>.jsonl
```

Run logs are compact JSONL events for later developer/platform/model analysis. They do not store prompts, stdout, stderr, diffs, absolute paths, or context lists.

Legacy `.agentic/agents.jsonl` and `.agentic/runs.jsonl` are migration inputs only and should not be committed.

## Task rules

- Use one task file per unit of work.
- Keep allowed files narrow.
- Keep forbidden files explicit.
- Include exact context files.
- Include concrete verification commands.
- Do not mark a task done until verification passes.
- Update `docs/progress.md` when task status changes.
- Use `Lane`, `Scope`, `Tags`, and `Parallel` to split work across agents.

## Dependency graph rules

- Every `Depends on` id must reference an existing task file.
- Dependency edges must not contain cycles.
- Missing dependencies are reported as audit warnings.
- Cycles are reported as audit errors.
- A task with a higher-numbered dependency is valid when that dependency exists.
- Run `apk audit` to validate the dependency graph.

## Task creation

Use `apk task create` to generate new task files with validated metadata:

```bash
apk task create \
  --title "Add Feature" \
  --mode mvp \
  --lane implementation \
  --scope cli,docs \
  --risk low \
  --context "AGENTS.md,docs/task-system.md" \
  --allowed "src/api/index.ts,docs/progress.md" \
  --verification "pnpm test"
```

The command:

- Auto-selects the next numeric task id.
- Generates a slugged filename under the configured task directory.
- Defaults to `State: todo` and `Owner: none`.
- Requires `--scope` and `--allowed` to include at least one value.
- Validates the rendered task against the parser before writing.
- Validates the dependency graph including the new task.
- Rejects duplicate slugs, invalid metadata, missing dependencies, and cycles.

## Task archiving

Completed tasks can be archived to reduce noise in the active task list.

```bash
apk task archive 0001
apk task archive --all
```

Archive rules:

- Only tasks in `done` state can be archived.
- Archived tasks are moved to `.tasks/archive/`.
- `apk tasks` default output shows only active top-level tasks (excludes archive).
- `apk tasks --all` includes both active and archived tasks.
- Dependency resolution treats archived done tasks as completed prerequisites.
- `apk next-task` considers archived done tasks when checking `Depends on`.
- `apk task deps` marks archived prerequisites and dependents with `(archived)` tag.
- `apk task create` includes archived tasks in the id sequence.
- Archived tasks cannot be overwritten; existing archive paths are refused.
