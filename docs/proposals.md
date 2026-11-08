# Document Proposals

Document proposals are lightweight, Git-tracked Markdown documents for engineering ideas,
research notes, experiment observations, adapter sketches, optimization hypotheses, and future
documentation plans. They preserve information without creating an executable task, backlog card,
ADR, canonical specification, or verification evidence.

A proposal is deliberately not authoritative. Recording one does not mean its architecture was
accepted, its workaround was implemented, its measurements were independently verified, or its
product behavior is production-ready.

## Storage

Proposals live under the configured documentation directory:

```text
<docsDirectory>/proposals/<slug>.md
```

The default is `docs/proposals/<slug>.md`. A custom `docsDirectory` from `.agentic/config.json`
is honored. The layer is plain Markdown in Git: there is no database, daemon, background service,
persistent model memory, vector index, or application-runtime dependency.

The stable identity is an opaque `Proposal-Id`, independent of the filename. A renamed file keeps
the same identity. Slugs are deterministic ASCII filename components; Unicode titles are
transliterated or fall back to a digest. Proposal creation never allocates a task ID.

## Schema

The storage contract is intentionally small:

```markdown
# Hover GPU operator benchmark idea

Proposal-Schema: 1
Proposal-Id: 0c2f5d9e-6f1a-4ff7-9f2e-2bd5a8e1c3d4
Kind: experiment
Status: proposed
Created: 2026-11-08T13:00:00.000Z
Related: task:0275, backlog:gpu-operator-benchmark

## Summary

Measure whether ROCm SDPA is stable enough for a repeatable operator benchmark.

## Context

The local ComfyUI experiment used an AMD RX 6900 XT.

## Observations

One short generation run completed successfully.

## Hypotheses

The observed workaround may generalize to other attention kernels.

## Proposed direction

Define a bounded benchmark before any production adapter work.

## Evidence and references

- Local observation only; no independent verification.

## Open questions

- Is the observation reproducible across driver versions?

## Decision history
```

Required metadata: `Proposal-Id`, `Kind`, `Status`, and `Created`. `Proposal-Schema` is optional
and defaults to `1`; an unsupported version fails closed and is never rewritten. Optional metadata:
`Updated`, `Superseded-By`, `Canonical`, `Backlog`, and `Related`.

Kinds: `idea`, `research`, `experiment`, `adapter-design`, `architecture`, `optimization`,
`documentation`. Statuses: `proposed`, `accepted`, `rejected`, `superseded`.

The only required section is `## Summary`, so a short idea stays short. Optional sections keep
observations, hypotheses, proposed direction, evidence, open questions, related work, and decision
history visibly separate instead of blending into one undifferentiated note.

## Safety and limits

- Reads and writes stay inside the repository and refuse symlinked proposal directories and files.
- Files are bounded by size, line length, section size, inventory count, and reference count.
- Reads require strict UTF-8 and detect files that change or are truncated while being read.
- Duplicate stable IDs are reported by validation; filename collisions are refused.
- Existing proposal bytes are never silently overwritten.
- Unknown metadata or sections fail closed and are left unchanged.
- Concurrent edits are detected through a content revision hash before a lifecycle decision is
  recorded.
- No task claim, verification, review, or gate is required to save an ordinary idea.

## Lifecycle boundary

A proposal starts as `proposed`. Only an explicit operator action may change it to `accepted`,
`rejected`, or `superseded`. Acceptance records an operator assertion about a verified proposal
revision; it is not cryptographic identity authentication, implementation, deployment, or
canonical documentation. Prior decisions remain in the decision-history section.

Rejected and superseded proposals remain readable. A superseded proposal records a traceable
successor ID.

## Planning use

Planning agents create a proposal only when the human explicitly asks to preserve technical
information. They do not create a proposal from every message, do not accept one without an
operator decision, and do not move an observation into authoritative documentation as an
established fact. Before authoring a task, an agent may inspect a proposal the human names or a
bounded filtered lookup; ordinary implementation, verification, review, status, gate, and
next-task work does not scan proposals. A relevant accepted proposal can inform planning without
being copied into a task automatically.

## Relationship to other APK artifacts

| Artifact | Purpose | Authority |
| --- | --- | --- |
| Document proposal | Preserve an idea, observation, hypothesis, or plan | Not authoritative |
| Backlog item | Record potential future work with why-not-now and promotion criteria | Planning only |
| Executable task | Perform bounded work with a contract, owner, verification, and gate | Execution source of truth |
| ADR | Record an accepted architecture decision | Authoritative decision record |
| Verification evidence | Prove a declared check ran for a candidate | Task gate input |
| Canonical documentation | Describe accepted current behavior | Authoritative current truth |

Promotion is explicit and manual: a proposal may be linked to a canonical document or backlog
card only when that destination already contains a verifiable reference. An accepted proposal is
still not an implemented feature. The supported path is:

```text
proposal -> backlog -> canonical task
```

and the final step happens only when the operator actually requests implementation.

## Git workflow

`apk proposal add` creates the document but never runs `git add`, `git commit`, or `git push`.

`apk proposal commit <slug-or-id>` is the separate explicit local publication step. It:

1. revalidates the proposal and its current content revision;
2. requires the repository root and an attached branch;
3. refuses an ignored proposal path or a proposal path that is staged differently from the
   validated working-tree content;
4. builds the commit from an isolated temporary Git index seeded from `HEAD`, adds exactly the
   selected proposal path, writes the tree, creates a normal commit with `git commit-tree`, and
   advances the current branch with a compare-and-swap `git update-ref`;
5. synchronizes only that path in the caller's real index so it does not appear as a phantom
   staged deletion, leaving unrelated staged entries and working-tree changes intact;
6. prints the commit SHA and explicit manual push or PR handoff guidance.

The command never pushes, force-pushes, rewrites history, merges automatically, or bypasses branch
protection. Unrelated staged files, untracked files, and dirty working-tree files do not enter the
proposal commit. If the proposal path itself has conflicting staged state, or an isolated index
cannot be used safely, the operation fails closed and recommends a separate Git worktree.

Proposal commits are ordinary Git commits. They remain visible to task provenance and are not an
exception to scope or candidate-freshness checks. For parallel work, use a separate Git worktree:
one worktree may hold an unfinished executable task while another creates and commits proposals.
A remote branch update is not fetched or merged by this command; push or open a pull request only
through an explicit, policy-approved manual step. Protected `main` requires a separate branch and
PR handoff.

## CLI

```bash
pnpm exec apk proposal add --title "ComfyUI ROCm adapter sketch" --kind adapter-design --summary "A possible direction."
pnpm exec apk proposal list [--status proposed] [--kind research] [--json]
pnpm exec apk proposal show <slug-or-id> [--json]
pnpm exec apk proposal validate [--json]
pnpm exec apk proposal accept <slug-or-id> --actor <operator-id> --reason "Accept for planning."
pnpm exec apk proposal reject <slug-or-id> --actor <operator-id> --reason "Out of scope."
pnpm exec apk proposal supersede <slug-or-id> --by <successor-id> --actor <operator-id> --reason "Replaced."
pnpm exec apk proposal link <slug-or-id> --canonical <path> [--backlog <slug>] [--expect-revision <sha256>]
pnpm exec apk proposal commit <slug-or-id> [--message <text>] [--expect-revision <sha256>]
```

`add` creates only one proposal document. It never runs `git add`, `git commit`, or `git push`,
creates no executable task, and allocates no task ID. `list`, `show`, and `validate` are read-only.

`accept`, `reject`, and `supersede` require an explicit actor and reason. They bind the decision to
the verified current proposal revision and optionally accept `--expect-revision <sha256>` to refuse
a stale edit. The decision-history entry records the time, decision, actor, verified revision, and
reason. A stale revision or invalid transition fails closed without changing the file.

Lifecycle mutations are serialized across processes with the existing local mutation lock, keyed by
the real repository, configured proposal directory, and slug. Concurrent commands re-read the
proposal after acquiring the lock, so one operator decision cannot silently overwrite another.
Supersede resolves the successor through the proposal lookup and stores its stable `Proposal-Id`,
not the user-supplied slug; a proposal cannot supersede itself by either form. Decision reasons
escape backslashes and pipe delimiters so free-text text round-trips without corrupting history.
`show --json` includes the current revision for `--expect-revision`. Transition failures use the
same human/JSON CLI error handler as the other proposal commands.

Acceptance records an operator assertion. It does not authenticate the operator cryptographically,
prove implementation, deploy anything, or make the proposal canonical.

`link` records a canonical-document path or backlog slug on the proposal only when that destination
already exists inside the repository and already contains a verifiable reference to the proposal
(the stable ID, the proposal path, or `proposals/<slug>.md`). It never edits the canonical document
or backlog card, creates a task, or promotes the proposal automatically. Rejected and superseded
proposals remain readable and linkable. The recorded links are additive metadata, not proof that the
destination has adopted the proposal as authoritative truth.
