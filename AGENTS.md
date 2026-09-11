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
