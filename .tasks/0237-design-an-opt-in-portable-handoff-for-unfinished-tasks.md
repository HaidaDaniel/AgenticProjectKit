# Task 0237 - Design an opt-in portable handoff for unfinished tasks

State: doing
Owner: codex-research-0237
Mode: discovery
Lane: research
Type: research
Scope: handoff,provenance,portability,research
Risk: high
Parallel: false
Depends on: none
Tags: p2,research,handoff,provenance

## Goal

Research whether a small explicit export/import handoff can safely carry unfinished task context between machines while preserving local verification and trust boundaries; deliver a bounded implementation contract or a reasoned no-go without changing runtime behavior.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/research/task-lifecycle-state-and-git-noise.md
- docs/engineering/apk-upgrade-workflow.md
- .tasks/0187-design-a-lower-noise-task-lifecycle-without-losing-distributed-state.md
- .tasks/0218-design-safe-historical-task-provenance-recovery.md
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/provenance.ts
- src/core/tasks/review.ts
- src/core/agents/index.ts
- src/core/work/index.ts
- src/core/work/session.ts

## Files allowed to edit

- docs/handoff/portable-task-context.md
- experiments/task-handoff/**
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**
- package.json
- src/**
- dist/**
- docs/research/**
- docs/task-recovery/**

## Steps

1. Build a synthetic two-clone fixture with tracked doing/review task contracts and ignored registry; runs; evidence; baseline; review and session files. Observe what a plain clone retains and the exact ownership/provenance/gate blockers on the destination.
2. Trace which records are required to explain task history versus which can authorize operations. Separate repository identity; task contract; candidate/epoch identity; worktree-local paths; agent identity; transient locks and live session claims.
3. Compare no new feature plus documented manual transfer; explicit untrusted context export/import; and a bounded validated continuation protocol. Explain why the existing worker package is not a cross-machine lifecycle-state restore.
4. Define candidate bundle scope and threat model: secret minimization; path containment; symlink/archive traversal; size limits; tampering; replay; collisions; duplicate import; interrupted import and version compatibility. Exclude transient locks and active process/session ownership.
5. Specify that transferred evidence is contextual/untrusted by default. Imported agent registration or a passing JSON record must not automatically become trusted current gate evidence; state which local checks and explicit operator actions would be required for any proposed promotion.
6. Evaluate clean and dirty handoff; divergent Git history; missing candidate objects; absent original baseline; foreign worktree paths and concurrent source/destination work. Clearly identify unsupported cases that must remain blocked.
7. Record current executable observations separately from proposed proof obligations. Select one recommendation and either provide a bounded follow-up implementation contract with rollback and counterexamples or a no-go. Do not create a runtime importer in this task.

## Acceptance criteria

- A repeatable offline fixture demonstrates tracked lifecycle state surviving a clone while local operational context is absent and relevant checks remain blocked.
- The report inventories portable versus nonportable record fields and explicitly distinguishes copied context from trusted evidence and authorization.
- The design preserves candidate-bound and baseline-bound proof; no import automatically repairs provenance; grants review passes or resurrects locks/sessions.
- Tampered; replayed; foreign-repository; incompatible; oversized and traversal-bearing input have explicit reject or quarantine obligations.
- The report compares alternatives and ends with one recommendation plus a concrete bounded follow-up contract or an explicit no-go.
- Only synthetic fixtures and documentation are committed; no real downstream logs; credentials; agent identities or runtime state are copied.
- Current observed results and future protocol claims are clearly separated. The research does not claim to implement cross-machine handoff.

## Correctness assumptions

- Task 0187 keeps tracked Markdown as shared lifecycle truth; portable context must not introduce a competing state database.
- Task 0218 studies reconstruction of historical provenance; this task studies explicit forward transfer with the source context still available.
- Matching candidate hashes alone do not authenticate externally supplied verification or reviewer identities.

## Invariants

- No lifecycle mutation in real repositories; trust promotion; fabricated operator decisions; evidence rewrites or history rewrites.
- No runtime CLI feature; cloud synchronization; SSH manager; dependency or new state store.
- Source and destination fixtures are disposable and use synthetic identities only.

## Required evidence

- Committed synthetic reproducer and bounded two-clone observation report.
- Comparison matrix and trust/field inventory with reject cases and selected recommendation.

## Review questions

- Can a forged bundle manufacture verification; review approval; agent authority or a missing baseline?
- Does the protocol distinguish trusted continuation from simply displaying imported context?
- Does the recommendation preserve both local operation and the tracked shared task contract without promising unsupported dirty transfer?

## Counterexample searches

- Same task ID in an unrelated repository; missing or rewritten candidate; changed task contract; identical bytes but different modes.
- Forged reviewer and PASS record; replayed old epoch; duplicate import; interrupted import; concurrent task owners.
- Absolute paths; parent traversal; symlinks; large payload; secrets in run logs; stale locks and live-session metadata.

## Verification

- `{"id":"handoff-fixture","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node experiments/task-handoff/reproduce.mjs"}`
- `{"id":"research-artifact","type":"automated","required":true,"environment":"local","profile":"report","command":"test -s docs/handoff/portable-task-context.md","evidenceRef":"docs/handoff/portable-task-context.md"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Write docs/handoff/portable-task-context.md with evidence and the recommendation.
- Record the research outcome in docs/decisions.md without treating an unimplemented proposal as shipped.
- Update docs/progress.md when task state changes.

## Notes

- Planning requested by the operator after the read-only downstream audit on 2026-10-20 at APK commit 5891ca51e9b9b7848a4d3237517b1d1ca6052ba0. This contract authorizes only its own future scope; no implementation is claimed.
- Use synthetic disposable repositories. Do not modify downstream repositories or infer consent for their migration.
- Parallel is false. Shared source files and docs/progress.md require sequential work in this checkout; separate worktrees and explicit integration are required for concurrent mutable work. Do not claim while another doing or review task owns this checkout.
- Commit the final candidate before canonical verification. Run the declared verification set once per unchanged candidate; do not prepend overlapping full-suite or release checks.
- Priority P2 research; not a confirmed new runtime regression. Ignore rules were independently confirmed in ResLedger and translator-agent; llama-ops and RigOps were not available in the audit environment.
- The report path docs/handoff/ avoids the broad docs/research/** scope of Task 0216 and docs/task-recovery/** scope of Task 0218. docs/decisions.md and docs/progress.md still require sequential integration.
- Use the current repository CLI through an explicit absolute fixture argument or resolved repository path; never assume a global APK installation. The reproducer must self-contain temporary repos and must not require a preinstalled downstream application.
