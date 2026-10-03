# Task 0034 - Git Hygiene Generated Artifact Policy

State: done
Owner: codex-a
Mode: maintenance
Lane: hygiene
Scope: git,docs,analytics
Risk: low
Parallel: false
Depends on: 0033
Tags: git,hygiene,analytics

## Goal

Define tracked and ignored generated files for team analytics and repo hygiene.

## Context files

- AGENTS.md
- .gitignore
- docs/task-system.md
- docs/context-system.md
- docs/progress.md

## Files allowed to edit

- .gitignore
- docs/task-system.md
- docs/context-system.md
- docs/progress.md
- .tasks/0034-git-hygiene-generated-artifact-policy.md

## Files forbidden to edit

- application source files

## Steps

1. Ignore legacy agent and run JSONL files.
2. Ignore audit report snapshots and local OpenCode dependency files.
3. Document tracked sharded analytics files.

## Acceptance criteria

- Legacy `.agentic/agents.jsonl` and `.agentic/runs.jsonl` are ignored.
- `docs/audit-report.md` and `docs/project-map.md` are ignored.
- Tracked analytics layout is documented.

## Verification commands

- git status --short
- pnpm test
- pnpm lint

## Documentation updates

- Update docs/task-system.md.
- Update docs/context-system.md.
- Update docs/progress.md.

## Notes

- Do not commit legacy operational logs.
