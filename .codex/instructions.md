# Codex Instructions

Repository docs and task files are the source of truth.

## Working Rules

- Read relevant docs before coding.
- Work on one task at a time.
- Keep changes small and reviewable.
- Stay inside the task allowed files.
- Do not add dependencies without updating docs/decisions.md.
- Update docs/progress.md when task status changes.

## Task Discipline

- Register agent before task work: apk agent register --id <id> --platform <platform> --model <model>.
- Claim tasks with registered owner: apk claim <task-id> --owner <agent-id>.
- Tasks in `doing` and `review` states require a registered owner.
- Use apk release, apk block, apk review, apk done, apk cancel with --owner.
- Task state changes are protected by .tasks/.apk.lock.
- Use the current task file as the execution contract.
- Read listed context files before editing.
- Do not touch forbidden files.
- Run verification commands before marking work done.
- Update the task if scope must expand.

## Default Style

- Use `caveman` by default.
- Stay terse, technical, and direct.
