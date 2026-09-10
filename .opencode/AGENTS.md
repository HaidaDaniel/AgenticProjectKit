# OpenCode Instructions

Repository docs and task files are the source of truth.

## Rules

- Read relevant docs before coding.
- Work on one task at a time.
- Keep changes small and reviewable.
- Stay inside the task allowed files.
- Do not add dependencies without updating docs/decisions.md.
- Update docs/progress.md when task status changes.

## Task Work

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

## Style

- Default to `caveman`.
- Prefer short, explicit notes.

## Worker Contract

- Use the vendor-neutral apk-worker-v1 package; role is implement, review, fix, or verify.
- Return a JSON-compatible result with runId, status, evidence references, and reason.
- Include commitIds, diffId, provenance identities, and reviewFindings when available.
- Keep vendor or harness identity separate from the worker role.
