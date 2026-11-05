# Backlog, Scratch, and CI Integration Readiness

Status: integration readiness decision
Task: 0251
Date: 2026-11-05

## Integration readiness decision

The Tasks 0244-0249 candidate is ready for a planning commit and a subsequent integrated **minor** release candidate after the normal verification/review/gate workflow. This record is not a tag, publication, or release approval. A standalone patch release containing only Task 0244 remains independent of this readiness decision.

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
| Generated agent instructions | Pass | `sync` reported three current generated files after explicit write; AGENTS.md contains the scratch, CI, and backlog rules. |
| Snapshot/provenance/worker projection | Pass | `task provenance` succeeded after archive; hot read-only commands ran without parse/projection failures. |
| Performance parity | Pass, bounded | Compared identical fixtures with and without a backlog card. No backlog card content was opened or read. At most one backlog-directory enumeration per command came from the existing diagnostic snapshot; no per-card scan was introduced. |
| Installation instructions | Pass | Task 0244's checker validates README and getting-started against the validated-release sentinel. |
| Downstream-shaped fixtures | Pass | Doctor retained Go, Python, and Node application-stack visibility on disposable fixtures. |

## Performance note

The integration fixture counts `readdir`, `open`, `readFile`, and `opendir` operations for `status --detail`, `attention --json`, `workers --json`, and `next-task` on byte-identical repositories with and without a backlog card. The only difference is at most one backlog-directory enumeration per invocation from the existing diagnostic snapshot; no card content is opened or read, and no new per-command expensive check or aggregate rerun was added.

## Corrective follow-ups

No blocking integration defect was found in these scenarios, so no corrective task is required before the planning commit. Recorded non-blocking limitations:

- Linux-only acceptance; no Windows junction/reparse-point matrix and no TOCTOU symlink-swap race injection.
- No live private downstream repositories, remote tag resolution, hosted CI, paid LLM, or unavailable external service was used.
- The performance check is operation-count based, not a wall-clock benchmark.
- Migration acceptance (Task 0250) is a separate fixture-backed documentation track and is not duplicated here.

## Release boundary

- Task 0244 may be released as a small standalone patch after its own completion; it does not depend on this readiness task.
- The integrated backlog/scratch/CI/planning work is a **minor** release candidate only after the normal task verification, review, gate, and release evidence process.
- No tag, push, publication, or deployment is part of this task.
