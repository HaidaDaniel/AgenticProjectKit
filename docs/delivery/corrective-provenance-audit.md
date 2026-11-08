# Corrective provenance audit: tasks 0252, 0256, 0260, 0261

Status: audit report, read-only findings

Audit capture: `2026-11-08`, repository HEAD `29ade3120f6eccaefdb476f6a291df4db6eb5567` before this report was committed. All SHAs, hashes, and evidence identifiers below were read from Git, `.agentic/task-baselines.jsonl`, and `pnpm exec apk task provenance` output; no task contract, baseline, evidence record, or commit was rewritten.

## Method

- Located each task's creation commit with `git log --diff-filter=A`.
- Read the recorded claim baseline head and contract hash from the append-only baseline journal.
- Recomputed the current material contract hash with `taskContractHash`, which excludes `State`, `Owner`, and freeform `Notes`.
- Inspected candidate and completion commits with `git show --name-status`.
- Read completion and review records, epochs, and provenance diagnostics through `apk task provenance <id> --json`.
- Compared changed paths with the allowed and forbidden file lists recorded at the task's claim baseline.

Environment and limits: local Linux checkout, Node `v24.21.0`, pnpm `10.28.1`. Recomputing a historical contract hash assumes the current parser interprets the historical Markdown the same way it did at claim time; the append-only baseline hash remains the authority for what was recorded then. No cryptographic authentication of human intent is available. Attribution can be ambiguous when two tasks touch the same generated `dist/**` path.

## Summary

| Task | Created | Claim baseline | Baseline material hash | Candidate/completion | Current material hash | Epochs | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0252 | `f4139fd` | `f4139fd` at `17:30:52Z` | `c631eac5d45edd027d6033cdc3505b7b0282af7c94c37cb4a2fbecf865c80472` | `2bb7f57`, `27f5cb6`, `a972ad9`; canceled by `f779b41` | `c631eac5...` (equal) | none | Correct history; provenance-exclusion limitation |
| 0256 | `f4139fd` | `aa7935a` at `18:41:44Z` | `ad476fdfbc40fbbe487dfee67acac40c41fbb13d951cca3eaa8837ffaea5b177` | `363d006`; completion `3a2569e` | `fc804a8f2bcfb64f043367c8875d73928eb930829a41f8c7685415c56f6fabc5` (changed) | none | Explicit operator decision required |
| 0260 | `f4139fd` | `4fcfc2f` at `19:04:53Z` | `cc799f41a04db104fc3069a1ea7f57f7f43dcfbee3c14a566966fad748b8c210` | `3382b95`; completion `42259a8` | `04cd0761d8d87ec6865d861ac430754e044326337b36f5632f9ee9aa99d66375` (changed) | none | Explicit operator decision required; later 0266 same-file overlap |
| 0261 | `2bf1ea6` | `2bf1ea6` at `17:55:50Z` | `f99c0eba72b8a7c0f114b91b5a225dd9eca02646056ba3b1102ea34e7aac1997` | `4382336`; completion `970fd89` | `f99c0eba...` (equal) | none | Correct history; provenance-exclusion limitation |

All four tasks have `epochs: []`. No audited amendment epoch exists for any post-claim material change.

## Task 0252 - Validate configured repository paths

- Creation: `f4139fd` at `2026-11-06T17:30:33Z`.
- Claim baseline: head `f4139fd`, recorded at `17:30:52Z`, material hash `c631eac5d45edd027d6033cdc3505b7b0282af7c94c37cb4a2fbecf865c80472`.
- Baseline allowed files: `src/core/config/schema.ts`, `src/core/config/schema.test.ts`, `src/core/config/types.ts`, `src/core/config/file.ts`, `src/core/config/paths.ts`, `docs/decisions.md`, `docs/progress.md`, `dist/**`; `src/core/tasks/**` and `src/core/backlog/**` were forbidden.
- Implementation commits: `2bb7f57` (config path rejection, docs, dist), `27f5cb6` (test diagnostics), `a972ad9` (path hardening, dist). Every changed path was within the baseline allowed list.
- Cancellation: `f779b41` at `17:54:23Z` changed only the task file's terminal state and note. Current material hash equals the baseline hash.
- Evidence: automated verification records exist for all three implementation heads. Two `review-v1` request records exist under `.agentic/reviews/0252/` (`review-1793986882377-igtgni` prepared at `27f5cb6`, `review-1793987390349-av71eu` prepared at `a972ad9`), but neither has a recorded result. There is no completed review evidence, completion record, or gate decision because the task was canceled before completion.
- Provenance: APK lists 0261 commit `4382336` under `excludedCommits` and `excludedFiles`, and reports `lineageStatus: intervening`. The actual common changed path between 0252 commit `2bb7f57` and 0261 commit `4382336` is `docs/decisions.md`. The exclusion is a cross-task attribution limitation, not a 0252 contract change.
- Classification: **correct history** for 0252; **documented limitation** for the cross-task provenance exclusion.

## Task 0256 - Honor a custom task directory during adoption

- Creation: `f4139fd` at `2026-11-06T17:30:33Z`.
- Claim baseline: head `aa7935a`, recorded at `18:41:44Z`, material hash `ad476fdfbc40fbbe487dfee67acac40c41fbb13d951cca3eaa8837ffaea5b177`; the baseline contract declared `Depends on: 0252,0253`.
- Candidate: `363d006` at `18:43:21Z` changed `src/core/docs/adopt.ts`, `src/core/docs/adopt.test.ts`, `docs/adoption-flow.md`, and `dist/core/docs/adopt.js`. All four paths were allowed.
- Completion: `3a2569e` at `18:50:15Z`. It changed `State`/`Owner` and, materially, replaced `Depends on: 0252,0253` with `Depends on: 0253,0261`, and added a successor note. 0252 had already been canceled and 0261 was the config-safety successor.
- Current material hash `fc804a8f2bcfb64f043367c8875d73928eb930829a41f8c7685415c56f6fabc5` differs from the baseline hash. No amendment epoch exists.
- Evidence: two automated verification runs passed for candidate `363d006`; a completion record passed. The task was medium risk and has no independent review record.
- Provenance: APK lists 0257 commit `0a6519f` under `excludedCommits` and `excludedFiles`, and reports `lineageStatus: intervening`. No changed path is common between 0256 `363d006` and 0257 `0a6519f`; the exclusion is a conservative cross-task accounting limitation, not evidence that 0256 edited 0257's files.
- Classification: **explicit operator decision required** for the post-claim material dependency edit. The provenance exclusion is a separate **documented limitation**. The dependency edit occurred after claim and was never covered by a pre-commit audited amendment epoch. Epochs append rather than rewrite the original claim, but epoch start requires an active `doing` or `review` task; 0256 is already `done`, so a retrospective epoch is not available. The missing control was operator approval and `apk task epoch` before the completion commit.

## Task 0260 - Support task IDs beyond 9999 consistently

- Creation: `f4139fd` at `2026-11-06T17:30:33Z`.
- Claim baseline: head `4fcfc2f`, recorded at `19:04:53Z`, material hash `cc799f41a04db104fc3069a1ea7f57f7f43dcfbee3c14a566966fad748b8c210`.
- Baseline allowed files did **not** include `scripts/check-docs-consistency.test.mjs`.
- Candidate: `3382b95` at `19:05:19Z` changed `dist/core/backlog/index.js`, `docs/task-system.md`, `scripts/check-docs-consistency.mjs`, `scripts/check-docs-consistency.test.mjs`, `src/core/backlog/backlog.test.ts`, `src/core/backlog/index.ts`, and `src/core/tasks/task.test.ts`. The docs-consistency test file was outside the baseline allowed list.
- Completion: `42259a8` at `19:08:58Z` changed `State`/`Owner` and materially added `scripts/check-docs-consistency.test.mjs` to `Files allowed to edit`, retrospectively legalizing the already-committed change.
- Current material hash `04cd0761d8d87ec6865d861ac430754e044326337b36f5632f9ee9aa99d66375` differs from the baseline hash. No amendment epoch exists.
- Provenance: task 0266 candidate `0bbe41a` later changed the same files `docs/task-system.md` and `src/core/tasks/task.test.ts`. APK lists `0bbe41a` under `excludedCommits` and reports `lineageStatus: intervening`; the actual same-file intersection is those two files.
- Evidence: two verification runs recorded `not-run` results, then one run passed for candidate `3382b95`, followed by a completion record. The task was medium risk and has no independent review record.
- Classification: **explicit operator decision required** for the post-claim scope expansion, plus **documented limitation** for the later 0266 same-file overlap. The scope expansion happened after the file was committed; accepting it would accept the procedural deviation, not prove the original edit was pre-authorized.

## Task 0261 - Fail closed on invalid config in compatibility and adoption

- Creation: `2bf1ea6` at `2026-11-06T17:55:48Z`.
- Claim baseline: head `2bf1ea6`, recorded at `17:55:50Z`, material hash `f99c0eba72b8a7c0f114b91b5a225dd9eca02646056ba3b1102ea34e7aac1997`.
- Candidate: `4382336` at `17:56:15Z` changed `src/core/config/compatibility.ts`, `src/core/docs/adopt.ts`, `src/core/docs/adopt.test.ts`, `docs/decisions.md`, and `dist/**`. All paths were allowed.
- Completion: `970fd89` at `18:11:00Z` changed the task file's lifecycle fields and `docs/progress.md` only. Current material hash equals the baseline hash.
- Evidence: automated verification passed, an independent review by `review-0261` passed, and a completion record passed.
- Provenance: APK lists 0253 commit `dec7ce7d` under `excludedCommits` and `excludedFiles`, and reports `lineageStatus: intervening`. No changed path is common between 0261 `4382336` and 0253 `dec7ce7d`; the exclusion is a conservative cross-task accounting limitation, not evidence that 0261 edited 0253's files.
- Classification: **correct history** for 0261; **documented limitation** for the cross-task provenance exclusion.

## Operator decisions requested

1. **Accept or reject task 0256's post-claim dependency edit.** The request is to accept that `Depends on: 0252,0253` was changed to `Depends on: 0253,0261` in completion commit `3a2569e` without an audited epoch, as a historical bookkeeping correction from a canceled dependency to its successor. Accepting this does not create an epoch, does not prove the edit was authorized before commit, and does not authenticate human intent.
2. **Accept or reject task 0260's retrospective scope expansion.** The request is to accept that `scripts/check-docs-consistency.test.mjs` was changed in candidate `3382b95` before being added to allowed files in completion `42259a8`. Accepting this does not prove the file was pre-authorized and does not convert the missing amendment into an audited epoch.
3. **Acknowledge the cross-task provenance exclusions and same-file limitations.** For 0252, the actual intersection with 0261 `4382336` is `docs/decisions.md`; for 0261, no changed path is common with 0253 `dec7ce7d`; for 0260, the actual intersection with 0266 `0bbe41a` is `docs/task-system.md` and `src/core/tasks/task.test.ts`; for 0256, no changed path is common with 0257 `0a6519f`. These are cross-task attribution limitations, not evidence of an out-of-scope source edit by the audited task.

Rejecting either acceptance request leaves the corresponding historical deviation unresolved. It must not be repaired by editing `.tasks/`, `.agentic/task-baselines.jsonl`, evidence, or Git history.

## Release-readiness impact

The corrected code tasks 0265 and 0266 are separate candidates and are not evidence for these historical contracts. For a release claim about this audit:

- 0252 and 0261 can be described as correct history with documented cross-task provenance-exclusion limitations.
- 0256 and 0260 cannot be described as cleanly audited without the operator decisions above; 0260 also has a real later same-file overlap with 0266 `0bbe41a`.
- A release may proceed only as **ready with documented limitations**, after explicit operator acceptance of the two historical deviations and acknowledgment of the attribution limitations. It must not be labeled a clean provenance PASS.
- A future material task-contract change must use `apk task amendment preview`, an exact operator approval digest, and `apk task epoch` before the change is committed.

## Evidence limits and non-claims

- This audit does not rewrite or "restore" history.
- It does not claim that a missing amendment epoch existed.
- It does not authenticate the human identity behind any operator decision.
- It does not resolve cross-task provenance exclusions or same-file attribution.
- It does not re-run historical verification or claim current gate eligibility for completed tasks.
- It does not evaluate tasks outside 0252, 0256, 0260, and 0261.
