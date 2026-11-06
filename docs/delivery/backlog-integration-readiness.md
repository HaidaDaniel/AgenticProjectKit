# Backlog, Scratch, and CI Integration Readiness

Status: integration readiness decision
Task: 0251
Date: 2026-11-05

## Integration readiness decision

The Tasks 0244-0249 candidate is ready for a planning commit and a subsequent integrated **minor** release candidate after the normal verification/review/gate workflow. The earlier diagnostic-snapshot metadata-I/O limitation was corrected by excluding the backlog subtree from the hot-path witness; the integration fixture now asserts zero backlog operations with 0, 1, 100, and 1000 cards. This record is not a tag, publication, or release approval. A standalone patch release containing only Task 0244 remains independent of this readiness decision.

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
| Performance | Pass | The diagnostic snapshot excludes the backlog subtree. With 0, 1, 100, and 1000 cards, hot commands perform zero backlog `readdir`/`opendir`/`lstat`/`stat`/`readlink`/`open`/`readFile` operations and identical total operation counts. |
| Explicit required CI | Covered by policy tests | `quality.required` and approved-contract precedence are asserted by policy/skill tests; this integration fixture does not add a live hosted-CI run. |
| Installation instructions | Pass | Task 0244's checker validates README and getting-started against the validated-release sentinel. |
| Downstream-shaped fixtures | Pass | Doctor retained Go, Python, and Node application-stack visibility on disposable fixtures. |

## Performance note

The integration fixture counts `readdir`, `open`, `readFile`, `opendir`, `lstat`, `stat`, and `readlink` operations for `status --detail`, `attention --json`, `workers --json`, and `next-task` on byte-identical repositories with zero, one, one hundred, and one thousand backlog cards. The backlog subtree is excluded from the diagnostic witness, so backlog operations are zero and total operation counts match the baseline. Git worktree status is also filtered at the Git level with a `:(top,exclude)<taskDirectory>/backlog` pathspec, so tracked, untracked, and renamed backlog worktree entries do not enter the snapshot identity. A companion snapshot test proves that actual task-file changes are still detected.

The global Git index remains a witnessed input. A staged backlog entry changes the index file and therefore still fails the snapshot closed. This is an intentional documented limit: worktree backlog content is irrelevant to task diagnostics, while staged index mutations remain part of repository-wide consistency.

## Corrective follow-ups

No functional or performance integration defect remains in these scenarios. The earlier backlog metadata-I/O regression is fixed in `src/core/tasks/diagnostics.ts` and covered by focused regression tests.

Other limitations:

- Linux-only acceptance; no Windows junction/reparse-point matrix and no TOCTOU symlink-swap race injection.
- No live private downstream repositories, remote tag resolution, hosted CI, paid LLM, or unavailable external service was used.
- The performance check is operation-count based, not a wall-clock benchmark.
- Migration acceptance (Task 0250) is a separate fixture-backed documentation track and is not duplicated here.

## Release boundary

- Task 0244 may be released as a small standalone patch after its own completion; it does not depend on this readiness task.
- The integrated backlog/scratch/CI/planning work is a **minor** release candidate after the normal verification, review, gate, and release evidence process.
- No tag, push, publication, or deployment is part of this task.
