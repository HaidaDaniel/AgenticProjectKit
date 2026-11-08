# Document proposals and reliability release readiness

Status: release-candidate evidence record, read-only findings.

Candidate version: `0.6.0` (pre-tag, unpublished). Latest validated tagged release remains
`v0.5.2`. The final candidate SHA, exact hosted-CI status, and worktree state are recorded in the
milestone handoff after the candidate is frozen; this record is part of that candidate.

## Scope

This candidate includes:

- the final `.agentic` runtime-containment correction (successor Task 0275; predecessor 0268 was
  canceled because its claim baseline predated the milestone planning commit and its Allowed
  Files omitted `src/core/work/session.ts`);
- document-proposal storage, schema, identity, validation, CLI lifecycle, validated canonical
  and backlog linkage, and an explicit proposal-only local Git commit workflow (Tasks 0269-0273);
- planning-agent guidance distinguishing proposals, backlog items, executable tasks, ADRs, and
  canonical documentation;
- this integrated regression, performance, and release-readiness task (0274).

Historical Tasks 0252, 0256, 0260, and 0261 retain the classifications in the
[corrective provenance audit](corrective-provenance-audit.md). Tasks 0256 and 0260 still require
explicit operator decisions; this candidate does not self-accept them.

## Proposal behavior

- Storage: `<docsDirectory>/proposals/<slug>.md`, Git-tracked Markdown, no database, daemon,
  background service, RAG index, or application-runtime dependency.
- Identity: opaque `Proposal-Id` independent of filename; creation allocates no task ID.
- Schema: required `Proposal-Id`, `Kind`, `Status`, `Created`, and `## Summary`; optional
  differentiated sections for context, observations, hypotheses, proposed direction, evidence,
  open questions, related work, and decision history.
- Lifecycle: `proposed -> accepted|rejected|superseded`, explicit actor and reason, revision-bound
  decision history, stale-revision refusal, and no automatic task creation or canonical promotion.
- Git: `apk proposal commit` uses an isolated index, a pinned-parent diff-tree allowlist,
  `commit-tree`, CAS `update-ref`, and a path-scoped real-index synchronization. It never pushes,
  force-pushes, merges, or rewrites history.
- Linking: canonical documents and backlog cards must already contain a verifiable proposal
  reference; APK never edits those destinations.

## Regression coverage

Focused proposal tests cover new and existing proposals, duplicate stable IDs, duplicate slugs,
Unicode titles, invalid UTF-8, unsupported schema and metadata, truncated and oversized files,
symlinked files and directories, custom nested docs directories, concurrent edit revisions,
unrelated-data preservation, every lifecycle transition and invalid transition, missing reason,
stale revision, canonical/backlog linkage, symlinked canonical files, ID/slug collisions, clean
and dirty Git state, unrelated staged/untracked files, staged proposal conflict, detached HEAD,
two worktrees, mid-operation mutation, moved-branch CAS, and end-to-end proposal-to-commit flow.
Downstream-shaped Go, Python, and Node fixtures create/read/validate proposals without a task
directory.

Existing task, backlog, provenance, generated-instruction, and release tests remain in the
canonical suite. The full `pnpm release:check` composition is the authoritative evidence for the
final candidate, and no task provenance rule was changed for this feature.

## Performance evidence

Measured with `strace -f -e trace=openat,newfstatat,stat,execve` on disposable Linux fixtures.
"Proposal stats" counts trace lines whose path contains `docs/proposals`. No proposal parser is
invoked by ordinary commands; proposal files that are untracked appear in generic Git untracked
directory traversal, and committed proposal files are stat'ed by the existing repository-wide
snapshot witness exactly like any other tracked file.

| Fixture | Command | Trace lines | Proposal stats | Git execs |
| --- | --- | ---: | ---: | ---: |
| 0 proposals | `status` | 1217 | 0 | 136 |
| 0 proposals | `next-task` | 213 | 0 | 0 |
| 0 proposals | `workers --json` | 210 | 0 | 0 |
| 0 proposals | `attention --json` | 1217 | 0 | 136 |
| 0 proposals | `task gate 0001` | 660 | 0 | 56 |
| 0 proposals | `tasks` | 211 | 0 | 0 |
| 1 untracked proposal | `status` | 1233 | 8 | 136 |
| 1 untracked proposal | `task gate 0001` | 681 | 21 | 56 |
| 100 untracked proposals | `status` | 1233 | 8 | 136 |
| 100 untracked proposals | `task gate 0001` | 771 | 120 | 56 |
| 1000 untracked proposals | `status` | 1234 | 8 | 136 |
| 1000 untracked proposals | `attention --json` | 1234 | 8 | 136 |
| 1000 untracked proposals | `task gate 0001` | 1670 | 1020 | 56 |
| 1000 committed proposals | `status` | 9254 | 6010 | 136 |
| 1000 committed proposals | `task gate 0001` | 4664 | 3005 | 48 |
| 1000 committed control notes | `status` | 9247 | 0 (6000 note stats) | 136 |
| 1000 committed control notes | `task gate 0001` | 4697 | 0 (3000 note stats) | 48 |
| 1000 untracked control notes | `status` | 1216 | 0 | 136 |
| 1000 untracked control notes | `task gate 0001` | 1668 | 0 | 56 |

Conclusion: `next-task`, `workers`, and `tasks` perform zero proposal-specific work at every
inventory size. `status`, `attention`, and `task gate` differ from the committed-note control by a
small constant (directory metadata and Git subprocess variation), not by proposal parsing. No
ordinary command reads or parses proposal Markdown. Existing snapshot and Git-provenance cost is
unchanged in kind and scales with the number of tracked files, not with proposal semantics.

## Release decision

New-work status: ready for release validation (`READY_FOR_RELEASE_VALIDATION`).

Publication status: `BLOCKED_WITH_REASONS` until the operator records explicit decisions on the
historical 0256 dependency correction and 0260 retrospective Allowed Files expansion, and
acknowledges the documented cross-task attribution limitations. This record does not accept those
deviations, does not rewrite history, and does not claim `CLEAN_PROVENANCE_PASS`.

No tag, push, GitHub release, version-sentinel change, or downstream upgrade is part of this
candidate.

## Final candidate verification

The authoritative candidate command is:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm release:check
```

The host has about 7.8 GiB RAM; the first run without the heap override completed all 862 source
tests but the coverage child process reached the default ~2 GiB heap limit and aborted. With the
override the full composition passed: static quality, 862/862 source tests, 30/30 documentation
tests, coverage gates (92.15% statements, 82.39% branches, 98.34% functions, 92.15% lines),
`pnpm build`, `apk lint --json`, `apk sync` (3 current, 0 stale), and `apk audit` (one advisory
warning, no errors). `git diff --check` remains clean.

Additional candidate checks:

```bash
pnpm exec apk lint --json
pnpm exec apk sync
test -z "$(git status --porcelain --untracked-files=all --ignored=matching -- dist)"
```

The exact candidate commit and final worktree state are reported in the milestone handoff. No
tag, push, GitHub release, or downstream upgrade was performed.
