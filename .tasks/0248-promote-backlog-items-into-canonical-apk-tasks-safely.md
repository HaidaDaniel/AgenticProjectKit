# Task 0248 - Promote backlog items into canonical APK tasks safely

State: done
Owner: opencode-0244-0251
Mode: product
Lane: implementation
Type: feature
Scope: backlog,promotion,tasks,cli,archive
Risk: high
Parallel: false
Depends on: 0247
Tags: p2,backlog,promotion,tasks,cli,archive

## Goal

Implement an explicit preview-and-apply promotion path that converts one backlog card, keyed by its immutable Backlog-Id, into a normal canonical APK task through one serialized canonical task-creation critical section while preserving the source card as history and leaving candidate IDs, verification, evidence, review, gate, claim, and implementation untouched.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/cli-commands.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/commands/task.ts
- src/cli/command-registry.ts
- src/cli/command.test.ts
- .tasks/0247-add-lightweight-backlog-storage-and-cli.md

## Files allowed to edit

- src/core/backlog/**
- src/cli/commands/backlog.ts
- src/cli/command-registry.ts
- src/cli/command.test.ts
- src/cli/cli.test.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- package.json
- docs/cli-commands.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/archive/**
- .agentic/**
- docs/releases/**
- pnpm-lock.yaml
- .github/**
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/tasks/provenance.ts
- src/core/config/**

## Steps

1. Define the read-only preview contract for `apk backlog promote <slug> --preview`: resolve the card by slug, show its immutable Backlog-Id, missing required task fields, unmet machine-checkable criteria, and every human-only criterion with its stable criterion ID.
2. Define the confirmation protocol for human-only criteria: explicit `--confirm <criterion-id>` values plus a bounded reason; `--apply` alone is never confirmation; unknown, duplicate, missing, or stale criterion IDs are refused; the CLI records the confirmation as operator-asserted, not authenticated, and an agent may only relay a confirmation the operator explicitly communicated.
3. Choose one serialization mechanism for the entire apply operation: either extend the existing task mutation lock so the whole validate/create/update sequence runs under one acquisition, or use a dedicated promotion lock or equivalent compare-and-swap protocol with a documented lock order. Do not recursively acquire `.tasks/.apk.lock`; if `createTask` reacquires it, use or extend a lock-scoped internal creation path instead of calling the public creator while already holding that lock.
4. Inside the serialized critical section, re-read the card by Backlog-Id, revalidate criteria, paths, dependencies, and verification, allocate and create the task, and update the card marker. Two concurrent promoters for the same card must not both observe an unpromoted state.
5. After the task write succeeds, atomically update the source card to promoted with a durable task reference; a crash between task creation and card update must be detectable and safely recoverable on rerun.
6. Enforce idempotency by immutable Backlog-Id, not filename: a renamed card with the same Backlog-Id is the same promotion; a missing, duplicate, malformed, or ambiguous Backlog-Id refuses promotion rather than creating a second task.
7. Verify that promotion issues no claim, implementation, review, approval, verification, or provenance record and does not synthesize human consent.
8. Analyze the card backlink against existing archive reference scanning and choose an ID-based or explicitly relocatable reference that keeps canonical archive safe.
9. Add deterministic tests for duplicate promotions, concurrent promoters, lock ordering and deadlock avoidance, ID collisions, unmet criteria, confirmation boundaries, malformed cards, missing dependencies, symlink traversal, interrupted writes, source-card preservation, renamed cards, duplicate Backlog-Ids, archive-after-promotion, and the resulting task graph.

## Acceptance criteria

- This remains a high-risk operation regardless of how small the backlog card appears.
- apk backlog promote --preview is read-only and shows the Backlog-Id, missing mandatory fields, unmet machine-checkable criteria, and every human-only criterion with its stable ID.
- Human-only criteria require explicit `--confirm <criterion-id>` values with a bounded reason; `--apply` alone, card text, dates, or agent output never satisfy them.
- The CLI records confirmations as operator-asserted, not cryptographically authenticated; documentation states that an agent may only relay a confirmation the operator explicitly communicated.
- Unknown, duplicate, missing, or stale criterion IDs are refused before mutation.
- The entire apply operation is serialized as one critical section or an equivalent compare-and-swap protocol; concurrent promoters for the same card cannot both create a task.
- The implementation does not recursively acquire `.tasks/.apk.lock` and proves deadlock avoidance for the chosen lock order.
- apply creates an ordinary .tasks/NNNN-*.md task through canonical ID allocation and the existing task mutation lock or its lock-scoped internal equivalent.
- Path, dependency, and verification validation is preserved.
- The source card remains and records the promoted state plus a durable reference to the new task.
- The new task carries a source-card or Backlog-Id reference, giving bidirectional traceability without creating a second task store.
- A repeated apply creates no duplicate, including after a promoted card is manually renamed.
- A missing, duplicate, malformed, or ambiguous Backlog-Id is refused rather than creating a second task.
- Failure or interruption leaves either a clearly diagnosable recoverable state or no mutation; a crash between task creation and card update is detected and recoverable.
- Promotion does not claim, implement, review, or mark done, and creates no approval, verification, or evidence record.
- The promotion reference does not make later task archive unsafe or silently broken; archive behavior after promotion is tested and documented.
- Malformed or escaping cards are refused before mutation.

## Correctness assumptions

- The canonical createTask path is sufficient for task creation and validation; a backlog card can carry the candidate contract fields needed for preview; operators remain responsible for genuinely human promotion criteria

## Invariants

- One canonical task creator only; no automatic promotion; no second task database or ID allocator; no partial silent corruption; source card history is preserved; no lifecycle transition beyond task creation; no recursive lock acquisition; no split check-then-act window that permits duplicate creation; promotion identity is Backlog-Id, not filename or slug; human confirmation is operator-asserted and never synthesized

## Required evidence

- Focused test output for duplicate promotions, concurrent promoters, lock ordering, deadlock avoidance, ID collisions, unmet criteria, confirmation boundaries, malformed cards, missing dependencies, symlink traversal, interruption, renamed cards, duplicate Backlog-Ids, archive-link behavior, and source-card preservation; evidence that preview changes nothing; evidence that apply reuses canonical task creation and serialization; resulting graph and dependency inspection

## Review questions

- Can concurrent or repeated apply create two tasks or overwrite the card; does the chosen serialization cover the whole validate/create/update sequence without recursively acquiring the task lock; can a lock-order mistake deadlock or silently time out; can a crafted slug or symlink write outside the backlog directory; does interruption after task creation but before card update produce an actionable recovery rather than a silent duplicate; can a renamed card lose identity; can a missing or duplicate Backlog-Id create a second task; can a confirmation be inferred from `--apply` or agent text; can the retained backlink block or misdirect task archive; does preview accidentally mutate anything

## Counterexample searches

- Two promoters run at once; process pauses between check and create; existing task lock is already held; nested createTask lock attempt; task ID already taken; card has unmet promotion criteria; human-only criterion without explicit operator confirmation; unknown, duplicate, or stale criterion ID; card is malformed or has an unknown status; dependency is missing; card path is a symlink; process dies after task write; card already promoted; promoted card manually renamed with the same Backlog-Id; renamed card with a missing or duplicate Backlog-Id; a new card reuses an old slug with a different Backlog-Id; promoted task later archived

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\"","artifact":"dist/"}`

## Documentation updates

- Document preview apply recovery and archive-link behavior in docs/task-system.md docs/cli-commands.md and docs/decisions.md; update docs/progress.md when task state changes

## Notes

- Depends on task 0247 for backlog storage and CLI, including immutable Backlog-Id and stable criterion IDs; do not implement a parallel task creator; the archive backlink must be tested against the existing literal-reference scanning rather than assumed safe; no automatic promotion; treat promotion as high-risk even when the card is small.
- Serialization is part of the contract, not an implementation afterthought: the chosen mechanism must cover the whole check/create/update operation without recursive acquisition of the existing task lock. A separate promotion lock is acceptable only with documented lock ordering and deadlock tests.
- Human confirmation is an operator assertion recorded by the CLI, not authentication. The protocol must be explicit and auditable but must not claim that a command-line flag proves a human typed it.
- Task 0223 is an active todo that shares CLI registry test decision docs and dist paths with this task; blocked Task 0221 would also touch src/core/tasks/index.ts command-registry and task tests if unblocked; sequence the shared CLI and task-file edits rather than running them concurrently in one checkout
