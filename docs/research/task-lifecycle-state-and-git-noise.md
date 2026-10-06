# Task lifecycle state and Git noise

## Scope and question

Task 0187 investigates whether APK can remove the recurring completion/bookkeeping
commit after a candidate has already been committed, verified, reviewed, and gated.
The question is deliberately about repository truth and candidate-bound evidence, not
about making `git log` look shorter on one workstation.

The current workflow is:

```text
implementation/fix commits -> candidate commit -> verify -> independent review -> gate
  -> apk done changes tracked task state -> lifecycle/bookkeeping commit
```

The candidate must remain immutable once verification or review evidence is bound to
it. `apk done` happens after the gate and changes the task's tracked `State` (and may
change `Owner`), so it cannot safely be folded into the already-reviewed candidate by
amending that candidate.

## Evidence from real repositories

### APK itself

Task 0121 records the current architecture and explicitly distinguishes the candidate
implementation commit from the later completion/bookkeeping commit. The recent APK
traces reproduce it:

| Task | Candidate-side history | Lifecycle-only commit | Observed effect |
| --- | --- | --- | --- |
| 0185 | `aec1b91`, `3632388`, `47b71f0`, `31e91c3`, `4d1ecab` | `d81831e` | Candidate fixes were committed before verify/review/gate; the final commit only marked the task done. |
| 0186 | `8c4bdb3`, `a95f3dc`, `851958d`, `ea6151e`, `b222c95`, `041f69e` | `4219d30` | Multiple correction commits were bound to fresh evidence; the final commit changed only `State: doing` to `State: done`. |

For 0186, the passing gate reported the current candidate and six candidate-bound
verification records plus independent review before `4219d30` was created. The
completion commit was therefore bookkeeping, not an implementation correction.

### translator-agent

The local downstream repository has the same shape. Task 0158 has the implementation
commit `7e889e2`, a behavior correction `d67252e`, and two subsequent task-contract
scope commits (`18813f7` and `244f1d4`). The repository then records
`d667084` (`chore: mark task 0158 done`), whose diff changes only the task Markdown
state. Task 0157 shows the same final `20ad2b1` completion pattern after its
implementation/fix history.

This is not a hypothetical cost: implementation and contract corrections remain
separate candidate history, while the state transition is intentionally visible in a
later commit.

### ResLedger

ResLedger supplies several independent traces:

| Task | Candidate-side commits | Lifecycle-only commit |
| --- | --- | --- |
| 0105 | `4f24c03` implementation, `ca40ba8` fix, `ce24dbe` path-contract correction | `524f58d` (`docs(0105): record task completion lifecycle state`) |
| 0106 | `e3ebbb5` implementation, `85ebb90` evidence/documentation correction | `dff6832` (`docs(0106): record task completion lifecycle state`) |
| 0107 | `acc81e1` implementation, `910149b` behavioral harness, `70189e0` evidence-bound correction | `5c481b1` (`docs(0107): record task completion lifecycle state`) |

The completion diffs for these commits are task-file state updates, not hidden
implementation work. They demonstrate both the noise and the value: a fresh clone can
see task completion without access to an operator's machine or an untracked runtime
directory.

## Constraints that a redesign must preserve

The current task/evidence modules provide separate but connected facts:

- The task Markdown is the readable contract and carries state, owner, allowed paths,
  dependencies, verification declarations, and archive identity.
- Claim/baseline and verification subject records carry baseline, candidate, and
  worktree identities. Task 0183 adds append-only epochs; Task 0184 adds bounded DAG
  attribution. Neither permits a silent baseline reset or ownership guess.
- The append-only evidence store records verification, review, and decision outcomes,
  but an evidence pass is not the same fact as an operator's lifecycle intent. A task
  can have passing checks while still being in review, blocked, released, or canceled.
- Gate freshness is candidate-bound. Rewriting or amending the candidate after the
  evidence set is recorded changes the identity that the evidence proves.

Any alternative must support all of the following in a fresh clone and on an offline
machine that later pushes normally:

- two developers completing different tasks concurrently;
- task dependencies, `next-task`, status, and archive lookup;
- current versus stale evidence and review subjects;
- release/reclaim and 0183 epoch history;
- 0184 merge/DAG attribution without hiding lifecycle-only children;
- readable reviewable history and backward compatibility for existing task files.

## Options

| Design | Commit shape | Fresh clone, collaboration, and offline use | Archive/dependency/status behavior | Candidate/evidence integrity | Migration and disposition |
| --- | --- | --- | --- | --- | --- |
| **KEEP TRACKED MARKDOWN** | Two commits remain: immutable candidate, then tracked `apk done` bookkeeping. | Strong. Normal clone/fetch contains the authoritative task state; concurrent changes are ordinary Git conflicts; offline work is safe until push. | Existing parser and task paths remain authoritative. Archive and dependency lookup need no projection or replay. | Strongest current fit. Final review/gate happen before the tracked state mutation; no amend or rebind is needed. | Zero migration and zero new state protocol. The noise is real but bounded and explainable. |
| **TRACKED LIFECYCLE JOURNAL** | Candidate plus an append-only journal entry still requires a tracked commit unless the journal is untracked. It can reduce Markdown churn, not commit count. | Strong only if the journal is committed and fetched. Offline append conflicts, ordering, and duplicate/retry handling become a new protocol. | Every reader must replay the journal, handle missing/corrupt entries, and retain a legacy Markdown projection for old tasks and archives. | Possible, but the journal event must carry candidate/epoch identity and lifecycle ordering; it adds another authoritative-looking record family beside evidence. | High migration cost across parser, status, next-task, archive, gate, provenance, and tooling. It does not meet the primary goal of fewer commits. |
| **GIT NOTES/REFS** | Can hide lifecycle changes from the task tree and perhaps avoid ordinary task commits, but requires a separate notes/ref push. | Weak by default. Normal clones do not reliably fetch custom notes/refs; collaboration and forks need explicit fetch/push configuration. Offline state is local until a special publication step. | Archive and dependency consumers need Git-specific ref lookup and behavior for missing notes, rewritten commits, and remote disagreement. | A note can point at a candidate SHA, but notes/refs are not automatically present in every clone and can be lost from normal review/export paths. | High operational and compatibility cost; fails local-first and fresh-clone expectations unless it recreates a second publication workflow. |
| **DERIVED LIFECYCLE** | No explicit lifecycle commit if state is inferred from evidence/run records. | Weak and ambiguous. Existing runtime records may be absent from a fresh clone; even committed records show checks, not necessarily done/released/canceled intent. | `next-task`, archive, and dependency state would need heuristics for incomplete or conflicting records. A pass cannot distinguish done from review or blocked. | Unsafe as the sole source: evidence freshness can prove a candidate, but cannot safely encode all lifecycle transitions. It risks treating a stale or unrelated pass as completion. | High semantic migration cost and a second implicit state machine. Not compatible with fail-closed lifecycle semantics. |
| **LOCAL RUNTIME + PUBLISHED COMPLETION SNAPSHOT** | Local state is quiet, but publishing a shared snapshot still creates a tracked commit or an equivalent publication event. | Local UX is good, shared truth is not available until publication. A fresh clone without the snapshot cannot know completion; offline completion remains unpublished. | Snapshot schema, replay, archive, and legacy fallback are required. The design only relocates the current bookkeeping boundary. | Safe only after an explicit published snapshot remains candidate-bound. It cannot remove the final shared-state publication step. | Medium/high migration cost with no demonstrated commit reduction. |
| **COMBINED CANDIDATE/COMPLETION COMMIT** | Attempts one commit containing implementation and `State: done`. | Readable in a clone, but it requires treating a task as done before final review/gate or rerunning evidence after the state mutation. | Existing commands would need a new pre-done or post-commit lifecycle and archive contract. | Unsafe under current rules: review/gate evidence binds the pre-completion candidate, while the combined commit changes the tracked task contract. Amending after evidence changes the SHA and invalidates the evidence. | A substantial candidate/evidence protocol redesign, not a bookkeeping optimization. Do not adopt as a default. |

### Why relocating the field is not enough

Moving `State` and `Owner` from the task file to another tracked file preserves the
same commit requirement: a shared state change must be committed and pushed for a
fresh clone to see it. It may reduce line-level churn in the task contract, but it
does not reduce Git commit count.

Moving the state to an ignored machine-local file does reduce visible commits, but it
loses distributed truth. Another developer, a CI checkout, an archive consumer, and a
fresh clone cannot distinguish done from doing without the original machine. A later
snapshot then becomes the real source of truth and restores the commit/publication
boundary that the move was intended to remove.

Git notes and custom refs are shared in some workflows, but not in the normal clone
contract. They require explicit remote configuration, do not naturally travel with a
patch or archive, and complicate review of a task in a detached or exported checkout.
They are therefore a transport mechanism, not a safe default source of lifecycle
truth for APK.

## Can existing evidence derive lifecycle state?

No, not without creating an incomplete and implicit state machine. Existing records can
answer questions such as:

- Did a required verification check pass for the current candidate?
- Did an independent review pass for that candidate?
- Is a record stale after a candidate, epoch, or baseline change?
- Did an explicit operator decision resolve a review-budget condition?

They cannot, by themselves, distinguish all of these valid states:

- review passed but `apk done` has not been authorized/executed;
- implementation is blocked after a failed review;
- a task was released and later reclaimed;
- a task was canceled intentionally;
- a done task is eligible for archive while its dependent is not;
- a completion state was published by one developer while another candidate is active.

Deriving state from “latest passing evidence” would also couple lifecycle semantics to
the evidence append log and invite stale-record precedence bugs. Task 0181 exists
because current operator decisions must be selected before stale history; a derived
state design would need to reproduce the same ordering and freshness rules for every
transition. That is a second lifecycle engine, not a removal of state.

## Migration and compatibility cost

Keeping tracked Markdown requires no migration. Existing tasks, archived tasks, task
IDs, dependencies, status, and downstream repository conventions remain readable byte
for byte. The only operational rule is to classify the post-gate task-state commit as
bookkeeping and report it separately from the candidate commit.

A journal, derived store, notes/ref system, or combined commit would require at least:

1. a versioned schema and one authoritative ordering rule;
2. read/write compatibility for every existing Markdown task;
3. updates to claim/release/block/review/done/cancel/archive and dependency lookup;
4. current/stale subject binding across 0183 epochs and 0184 merge attribution;
5. fresh-clone, offline, concurrent-writer, and partial-publication handling;
6. migration and rollback rules that never reinterpret old evidence as new completion;
7. new lint, status, provenance, and archive diagnostics.

That cost is justified only if a prototype demonstrates fewer shared commits while
preserving all of the constraints above. The current traces demonstrate noise, but not
that an alternative can remove the shared publication event safely.

## Operational conclusion

The two-commit pattern is a repository-readability cost, not a provenance defect. It
can be made less noisy in projections and release notes by classifying commits as
candidate implementation/fix versus lifecycle bookkeeping, but those presentation
improvements do not change the authoritative storage model.

No implementation task is created by this research. A future redesign would need an
explicit operator-approved task whose contract proves a lower commit count in a fresh
clone, exact candidate/evidence binding, offline publication, concurrent task safety,
archive/dependency compatibility, and backward-compatible rollback. This task does
not preselect or implement such a redesign.

## Final recommendation

**KEEP TRACKED MARKDOWN.** Retain `State`/`Owner` in the tracked task contract and the
candidate-then-lifecycle-commit workflow. Treat the second commit as normal bounded
bookkeeping, report both SHAs, and do not amend, rebase, or squash a candidate after
candidate-bound verification or review evidence has been recorded.
