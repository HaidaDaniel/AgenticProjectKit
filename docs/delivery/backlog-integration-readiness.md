# Backlog, Scratch, and CI Integration Readiness

Status: integration readiness decision
Task: 0251
Date: 2026-11-05

## Integration readiness decision

The Tasks 0244-0249 candidate is **planning-ready**, but it is **not yet integrated-release-ready**. Functional integration scenarios pass, but the existing diagnostic snapshot performs per-card metadata I/O over `.tasks/backlog` on hot read-only commands. No card content is read, but the metadata cost grows with card count. The readiness decision is therefore downgraded until that limitation is explicitly accepted or fixed in a follow-up task; `src/core/tasks/diagnostics.ts` is outside this task's allowed files.

This record is not a tag, publication, or release approval. A standalone patch release containing only Task 0244 remains independent of this readiness decision.

## Scenario results

| Scenario | Result | Evidence |
| --- | --- | --- |
| New repository: init -> backlog -> promote -> claim -> verify -> done -> archive | Pass | Greenfield integration fixture uses real command handlers and a real Git baseline; promoted Task `0002`, verification PASS, gate PASS, archive, and provenance all succeeded. |
| Existing repository: adopt preview -> apply | Pass | Preview reported the additive `tmp/apk/` directory without writing; apply created it and the `/tmp/apk/` ignore rule. |
| Deferred backlog during ordinary work | Pass | Backlog cards did not appear in `tasks` or `next-task`; blocked Task `0001` remained a normal executable task. |
| Valid and invalid promotion | Pass | Valid promotion created one `todo` task with bidirectional Backlog-Id traceability; unconfirmed criteria and missing fields refused mutation. |
| Scratch and Git ignore semantics | Pass | `git check-ignore` recognized `tmp/apk/note.md`; status output did not include scratch content; existing user files are preserved by the unit tests. |
| MVP CI policy | Pass | Generated instructions contain the stage-aware CI rule; no mandatory CI was added for the fixture MVP. |
| Explicit required CI | Covered by policy tests | `quality.required` and approved contracts remain authoritative in the policy and skill tests. |
| Backlog versus blocked tasks | Pass | Blocked Task `0001` stayed executable; the backlog card stayed outside executable inventories. |
| Task ID allocation and archive | Pass | Init created `0001`; promotion allocated `0002`; archiving the completed promoted task remained safe and re-promotion stayed idempotent. |
| Generated agent instructions | Pass | `sync` reported three current generated files after explicit write; AGENTS.md contains the CI and backlog rules. Scratch behavior is covered by Task 0245 tests. |
| Snapshot/provenance/worker projection | Pass, composed | `task provenance` succeeded after archive; hot read-only commands ran without parse/projection failures. Existing CLI/snapshot tests remain authoritative for deeper projection behavior. |
| Performance | Known limitation | No backlog card content is opened or read, but the existing diagnostic snapshot `lstat`/`stat`-scans each backlog card on every hot command. The integration test measures a higher metadata count with 20 cards than with one or zero. |
| Explicit required CI | Covered by policy tests | `quality.required` and approved-contract precedence are asserted by policy/skill tests; this integration fixture does not add a live hosted-CI run. |
| Installation instructions | Pass | Task 0244's checker validates README and getting-started against the validated-release sentinel. |
| Downstream-shaped fixtures | Pass | Doctor retained Go, Python, and Node application-stack visibility on disposable fixtures. |

## Performance note

The integration fixture counts `readdir`, `open`, `readFile`, `opendir`, `lstat`, `stat`, and `readlink` operations for `status --detail`, `attention --json`, `workers --json`, and `next-task` on byte-identical repositories with zero, one, and twenty backlog cards. No backlog card content is opened or read. The existing diagnostic snapshot does perform per-card metadata checks, so `lstat`/`stat` counts scale with card count. This is a known limitation of the current diagnostics implementation, outside this task's allowed files, not a claim of performance parity.

## Corrective follow-ups

No functional integration defect was found. The metadata-I/O limitation above is the one known follow-up: a later scoped change to diagnostics should avoid recursively witnessing the backlog store, or the repository should explicitly accept the cost for its expected backlog size. No corrective task is filed in this task; the readiness decision is downgraded accordingly.

Other limitations:

- Linux-only acceptance; no Windows junction/reparse-point matrix and no TOCTOU symlink-swap race injection.
- No live private downstream repositories, remote tag resolution, hosted CI, paid LLM, or unavailable external service was used.
- The performance check is operation-count based, not a wall-clock benchmark.
- Migration acceptance (Task 0250) is a separate fixture-backed documentation track and is not duplicated here.

## Release boundary

- Task 0244 may be released as a small standalone patch after its own completion; it does not depend on this readiness task.
- The integrated backlog/scratch/CI/planning work is **not** an integrated minor-release candidate until the per-card metadata limitation is accepted or fixed.
- No tag, push, publication, or deployment is part of this task.
