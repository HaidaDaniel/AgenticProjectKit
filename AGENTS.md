# Agent Instructions

Repository docs and task files are the source of truth.

## Core Rules

- Read relevant docs before coding.
- Work on one task at a time.
- Keep changes small and reviewable.
- Stay inside the task allowed files.
- Do not add dependencies without updating docs/decisions.md.
- Update docs/progress.md when task status changes.

## Default Style

- Use `caveman` when supported.
- Keep responses terse, technical, and free of filler.

## Task Workflow

- Register agent before task work: pnpm exec apk agent register --id <id> --platform <platform> --model <model>.
- Claim tasks with registered owner: pnpm exec apk claim <task-id> --owner <agent-id>.
- Tasks in `doing` and `review` states require a registered owner.
- Use pnpm exec apk release, pnpm exec apk block, pnpm exec apk review, pnpm exec apk done, pnpm exec apk cancel with --owner.
- Task state changes are protected by .tasks/.apk.lock.
- Use the current task file as the execution contract.
- Read listed context files before editing.
- Do not touch forbidden files.
- Run verification commands before marking work done.
- Update the task if scope must expand.
- When policy requires review, the primary agent may automatically launch a separate read-only reviewer with a different registered identity and isolated context; do not pause for routine user confirmation.
- The implementation owner cannot certify its own candidate. On changes_requested, continue fix -> verify -> fresh review; on pass, continue gate -> done.
- Commit task-owned implementation and fix changes before final verify/review/gate so candidate-bound evidence refers to the committed candidate; a successful handoff must not leave task-owned changes uncommitted.
- Stage only files attributable to the current task. Never run `git add -A` or `git add .` to absorb unrelated or pre-existing dirty state, and never discard, rewrite, force-push, or amend unrelated work.
- Leave unrelated and pre-existing dirty changes untouched; do not include them in the task commit and do not create an empty commit when the task has no task-owned changes.
- Report the resulting commit SHA(s) in the final handoff. If a required commit fails (hook, conflict, identity, permission), surface the blocker and do not report a clean successful handoff.
- Blocked, released unfinished, canceled, or failed tasks do not require a completion commit; an explicit checkpoint commit is allowed only when policy requires it. APK never runs git commit, add, push, or rm itself.

## Worker Contract

- Use the vendor-neutral apk-worker-v1 package; role is implement, review, fix, or verify.
- Return a JSON-compatible result with runId, status, evidence references, and reason.
- Include commitIds, diffId, provenance identities, and reviewFindings when available.
- Keep vendor or harness identity separate from the worker role.

## Architecture Rules

- Keep source of truth in repository docs and config.
- Generate exported agent files from neutral policy content.
- Keep CLI commands thin and task-driven.
- Avoid tool lock-in.
- Document architecture changes in docs/decisions.md.

## Local Model Guidance

- Provide exact context files.
- Keep allowed files narrow.
- Avoid architectural inference.
- Avoid unrelated refactors.
- Prefer explicit steps and acceptance criteria.

## Context Files

- `AGENTS.md`
- `docs/project.md`
- `docs/scope.md`
- `docs/architecture.md`
- `docs/task-system.md`
- `docs/context-system.md`
- `docs/decisions.md`
