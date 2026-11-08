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
A separate explicit local commit operation publishes exactly one validated proposal file through
an isolated Git index, preserving unrelated staged and working-tree state. If the index cannot be
preserved safely, the operation fails closed and recommends a separate Git worktree. Proposal
commits are ordinary Git commits and remain visible to task provenance; they are not an exception
to history or scope checks.

No push, force-push, history rewrite, automatic merge, or branch-protection bypass is performed by
the local workflow. Protected branches require a separate explicit branch and PR handoff.

## CLI

The proposal CLI is implemented by the dependent task. Storage and validation expose the schema,
parser, renderer, exclusive creation, bounded inventory, and duplicate detection used by that CLI.
