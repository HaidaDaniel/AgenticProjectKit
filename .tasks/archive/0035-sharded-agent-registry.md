# Task 0035 - Sharded Agent Registry

State: done
Owner: codex-a
Mode: product
Lane: analytics
Scope: agents,registry,team
Risk: medium
Parallel: false
Depends on: 0034
Tags: agents,analytics,team

## Goal

Store registered agents as git-friendly per-agent JSON files with developer identity.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/agents/index.ts
- src/cli/commands/agent.ts

## Files allowed to edit

- src/core/agents/index.ts
- src/cli/commands/agent.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- docs/progress.md
- .tasks/0035-sharded-agent-registry.md

## Files forbidden to edit

- application source files

## Steps

1. Add `developer` to registered agents.
2. Read developer from `--developer` or git config.
3. Write agents to `.agentic/agents/<agent-id>.json`.
4. Preserve legacy `.agentic/agents.jsonl` read support.

## Acceptance criteria

- `apk agent register --developer <id>` writes sharded agent JSON.
- Duplicate ids reject across sharded and legacy stores.
- `apk agent list` reads sharded and legacy agents.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/task-system.md.
- Update docs/progress.md.

## Notes

- Developer ids use compact lowercase form.
