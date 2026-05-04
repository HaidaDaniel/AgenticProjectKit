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
apk agent register --id codex-a --platform codex --model gpt-5.5
```

Registry path:

```txt
.agentic/agents.jsonl
```

Run log path:

```txt
.agentic/runs.jsonl
```

Run logs are compact JSONL events for later platform/model analysis. They do not store long prompts or context lists.

## Task rules

- Use one task file per unit of work.
- Keep allowed files narrow.
- Keep forbidden files explicit.
- Include exact context files.
- Include concrete verification commands.
- Do not mark a task done until verification passes.
- Update `docs/progress.md` when task status changes.
- Use `Lane`, `Scope`, `Tags`, and `Parallel` to split work across agents.
