# Portable context for unfinished tasks

Task 0237 research, observed 2026-10-23 against the development CLI containing Task 0236 (`fad1f86`, package metadata `0.5.1`). This is a design recommendation and executable observation, not a shipped handoff feature or proof of a released-version regression.

**Recommendation: explicit, untrusted context handoff.** A bounded follow-up may export a minimal context document and inspect it at the destination without installing anything into canonical operational stores. Automatic continuation or trust promotion is a no-go for this slice. Git remains the transport and authority for committed task contracts and code; the context document explains unfinished work but cannot authorize it.

## What the executable experiment establishes

Run from the APK checkout with its committed `dist/`, Node 22.22.1 or later, Git, and a POSIX filesystem:

```sh
node experiments/task-handoff/reproduce.mjs
```

The [reproducer](../../experiments/task-handoff/reproduce.mjs) creates disposable source/destination pairs for `doing` and `review`. It resolves this checkout's CLI by absolute path, disables inherited Git overrides/global configuration, uses local clone transport, bounds subprocess time/output, and removes its temporary repositories. It does not inspect downstream repositories or write the host's task/runtime stores. The [captured observations](../../experiments/task-handoff/observations.json) were produced on Node 24.21.0 and Git 2.43.0. Canonical verification reruns assertions and prints fresh observations; it does not overwrite that captured report.

Each source has a clean committed candidate, a registered synthetic owner/reviewer, an issued implementation worker session, passing actual local verification, and prepared review metadata. Preparation does **not** fabricate a review PASS. The medium-risk fixture requires no independent review, so its source gate passes legitimately for that fixture. There are six populated ignored record families: agents, runs, evidence, baselines, reviews, and sessions. A plain clone retains identical task bytes and HEAD but none of those runtime records.

| Observation | `doing` destination | `review` destination |
| --- | --- | --- |
| Tracked State/Owner and contract bytes | Preserved | Preserved |
| Git HEAD | Same as source | Same as source |
| Baseline / evidence / worker binding | Absent / zero / missing | Absent / zero / missing |
| Completion gate | Blocked | Blocked |
| Exact gate blocker | `missing verification evidence for check check-1.` | `missing verification evidence for check check-1.` |
| Owner transition | Exit 1: `Agent is not registered: fixture-owner.` | Same |
| Scope `comparisonKnown` | `true` in this clean legacy-compatible case | Same |

The last row matters: **missing baseline is not universally a current gate blocker**. `captureTaskScope` falls back to current Git changes when no baseline exists. A clean clone can therefore report a known empty comparison without proving the original task's historical attribution. The fixture records no baseline-related diagnostic in this case. It would be incorrect to claim that every missing-baseline operation already fails closed. This research does not change that compatibility behavior, register a destination owner, rerun destination verification to manufacture a new history, or declare the historical work proven. A future continuation design must require an independently validated historical baseline rather than treating this fallback as restoration.

Two additional read-only counterexamples exercise current identity functions:

- Supplying the original baseline **as an in-memory argument only**, with the same task and scoped file, yields current freshness across distinct clone paths. Changing only the record's agent name to `forged-agent` still yields current freshness. This tests the freshness comparator, not the completion gate: no record, registration, or baseline is imported, and the destination gate stays blocked. Matching hashes establish content identity, not authorship or authorization.
- Keeping file bytes identical while changing the executable bit changes candidate identity. A portable handoff cannot normalize modes or substitute a byte-only hash for the existing fingerprint.

These assertions cover clean Git transfer, absent local records, identity comparison and mode identity. Dirty transfer, malicious bundle parsing, network transport, Windows, interrupted imports and concurrent operators are **design obligations below**, not executable validation of an importer. No importer exists in this task.

## Current records and trust boundaries

The implementation references are [task scope/candidate capture](../../src/core/tasks/index.ts), [evidence validation/freshness](../../src/core/tasks/evidence.ts), [completion gating](../../src/core/tasks/gate.ts), [provenance](../../src/core/tasks/provenance.ts), [review preparation/results](../../src/core/tasks/review.ts), [agent registration](../../src/core/agents/index.ts), [worker issuance](../../src/core/work/index.ts), and [canonical session binding](../../src/core/work/session.ts).

| Data | Portable explanation | Authority and proposed treatment |
| --- | --- | --- |
| Tracked task path, ID, State, Owner, contract and dependency graph | Travels in ordinary Git | Existing Markdown remains authoritative; never overwrite it from a bundle. State is not deployment proof. |
| Git object format, source HEAD, baseline commit, task path and contract digest | Compare against destination objects obtained through normal Git | `repository: "git"` is a kind, not a unique repository identity. A matching task ID, remote URL, or copied history does not authenticate a sender. Require explicit destination repository selection and report binding separately from trust. Do not export credential-bearing remote URLs. |
| `baselineId`, phase, epoch/predecessor IDs, contract hash/snapshot, dirty-path fingerprints, carried paths | Explain claim and scope history | Claimed metadata only. Immutable baseline/epoch lineage and every path/mode/contract must be independently proven before any future continuation. Missing original proof is not repaired by a new claim or edited timestamp. |
| `candidateId`, `worktreeId`, `headSha`, scoped paths and fingerprints | Explain the evaluated content | Current `worktreeId` hashes paths/fingerprints; it is not a machine ID or an absolute checkout path. Candidate identity includes the normalized material task contract and scoped fingerprints. HEAD remains provenance; equal content can stay fresh across different HEADs. Reuse canonical identity semantics, not a simplified SHA-only rule. |
| Evidence/check ID, type, result, profile, subject, artifact references | Minimal optional summary of what the source claims | `gateEligible`, PASS, reviewer and actor fields are not transferable grants. Freshness compares task/repository-kind/baseline/candidate/worktree identity; eligibility also uses local registration and record semantics. Local stores are a trust boundary, not a cryptographically authenticated import format. Never append copied summaries to `.agentic/evidence.jsonl`. |
| Agent ID, developer, platform, model, label, created time | Optional role label only; identity data can be private | Registration is local operational identity, not a cross-host credential or proof of independent review. Never import registrations or silently reuse an owner identity. |
| Review run origin, reviewer, prepared subject, baseline HEAD, changed paths, result and budgets | Explain pending review and cited observations | Existing preparation/run binding and current independent review requirements remain. No imported prepared session, PASS, `accept-current`, attribution approval or budget grant becomes effective. Only actual out-of-band operator decisions may be recorded locally. |
| Run logs, prompts, command output, environment, model/host metadata | Can contain context and secrets | Excluded by default; do not recursively copy logs. Transfer only explicitly selected bounded summaries after preview. Never promise that pattern-based redaction makes arbitrary logs safe. |
| Sessions, activation/package hashes, resource IDs, workspace paths, locks/PIDs | Historical description at most | Exclude raw files, active ownership and process claims. Reissue work locally if authorized; never resurrect a lock/session or count an imported session as current capacity/occupancy. |

`apk-worker-v1` is an execution contract with task, role, context, constraints, expectations and provenance. It does not carry a complete authenticated baseline/epoch/evidence store. An activated issued session must match APK's local immutable package/metadata/activation binding; copying a package to another machine does not create that binding. A worker package is therefore useful explanatory input but is not a cross-machine lifecycle restore protocol.

This follows [Task 0187's tracked-Markdown decision](../research/task-lifecycle-state-and-git-noise.md). [Task 0218](../../.tasks/0218-design-safe-historical-task-provenance-recovery.md) separately investigates reconstruction when historical attribution is already incomplete. Forward transfer while source context exists must not silently solve that harder problem by accepting claimed provenance. Installation/update checks remain separate under the [upgrade workflow](../engineering/apk-upgrade-workflow.md).

## Alternatives

| Option | Benefit | Unresolved risk / cost | Disposition |
| --- | --- | --- | --- |
| No new feature; Git plus manual notes/transfer | No new parser or transport; works offline | Manual raw copying into canonical stores can confuse local trust with authenticated transfer; missing context remains hard to explain | Safe fallback when notes stay explanatory; insufficient as the intended usability improvement |
| Explicit untrusted context export and read-only destination inspection | Small, auditable metadata package; explains missing source context without changing gates | Does not resume old work or recover missing proof; requires preview and careful privacy limits | **Selected** first slice |
| Validated continuation/import protocol | Could eventually resume proven unfinished work | Needs authenticated provenance, semantic repository binding, complete baseline/epoch and mode-aware Git proof, local identities, concurrency and crash transactions; hashes alone cannot supply these | No-go for this slice; separate research/authorization before implementation |

The selected option preserves one lifecycle source and does not add a state database. Inspection is stateless; it neither remembers imported approvals nor updates task/evidence/session stores. The word “import” must not imply restoration: accepting a document for display remains untrusted context.

## Proposed document and privacy boundary (not implemented)

A versioned single UTF-8 JSON document, not an archive, would contain:

- A fixed schema/protocol version, export-tool identity, a digest over canonical payload bytes, and an explicit `trust: "untrusted-context"` discriminator. The digest detects accidental alteration; anyone can recompute it, so it is not a signature or authority.
- One task ID and repository-relative task path; claimed Git object format/HEAD/baseline and material contract digest; source State/Owner as display-only claims. No destination action is implied.
- At most 64 claimed scoped path/mode/digest entries and 32 check summaries (ID/type/result/subject only). No executable command text, command output, raw artifact URLs, agent registration, raw review result object, operator decision or `gateEligible` field.
- An optional explicitly selected plain-text handoff note of at most 16 KiB; default empty. This may still contain sensitive information and requires human preview. Treat all prose as untrusted data, never as executable instructions or system policy.

Proposed limits: 256 KiB total input/output, 64 paths, 32 check summaries, 512 characters per identifier/path, 16 KiB notes, maximum nesting depth 8, and bounded JSON key/string counts. Reject unknown fields/versions, duplicate keys, non-finite numbers and malformed UTF-8 before constructing an accepted representation. Digest canonicalization must be specified and fixture-tested; plain `JSON.parse` alone does not reject duplicate keys. No dependency is presumed necessary; a future implementation must either implement a small audited bounded tokenizer or document an explicit dependency decision.

Export only from an explicitly chosen repository/task with complete required local observations and a clean committed tree. Fail with an actionable diagnostic if the requested context cannot be fully inspected within bounds; do not silently omit needed claimed paths. Offer a preview showing exact fields, sizes and exclusions before the user chooses an output path and transfer channel. Do not open network connections or copy anything over SSH.

The output is a new, user-selected artifact: reject existing targets and symlink targets/parents, use restrictive permissions, write a sibling temporary file and publish with a no-clobber operation, then clean up failed temporary output. Do not rely on ordinary rename to refuse overwrite. This export transaction concerns only the artifact, never operational stores. The destination inspector accepts a regular bounded input file and writes nothing.

## Destination decisions and reject cases

These are obligations for a **future implementation**, not tests passed by this research.

| Input or situation | Required disposition |
| --- | --- |
| Malformed/unknown version, duplicate keys, altered digest, oversized/deep payload, unknown fields | Reject before displaying an accepted document; bounded diagnostic, no writes or partial import |
| Self-consistent forged digest, claimed reviewer/PASS, copied agent or operator identity | Remain untrusted; forbidden authority-bearing fields are rejected. Even matching hashes must never produce a gate-eligible record or authorize a transition. |
| Absolute/drive/UNC path, `..`/dot segments, NUL/control separators, ambiguous slash/case collisions, symlink or archive payload/reference | Reject path/reference. The document is not extracted, paths are not opened automatically, and no commands or links are followed. Validate against both source claims and destination filesystem rules. |
| Same task ID in another repository, missing task, changed task contract or unsupported object format | Mark unbound/quarantined for display only; do not merge with the local task. Operator-selected repository and actual object/contract equality are prerequisites for a contextual match, not authority. |
| Missing candidate/baseline objects, shallow history, ambiguous/divergent DAG or unavailable epoch chain | Report the exact missing/ambiguous proof; no automatic fetch, baseline reset, rebase, attribution waiver or continuation |
| Replayed old candidate/epoch, timestamp manipulation | Mark stale/unbound where detectable; timestamps never establish freshness or ownership. A replay that still matches remains equally untrusted and cannot consume or grant a review pass. |
| Identical duplicate document | Same deterministic inspection output; no state changes, duplicate evidence, task transitions or budget effects. Stateless inspection does not claim durable replay prevention. |
| Conflicting documents for the same task or digest collision/mismatch | Display separately as conflicting claims; never last-writer-wins. A digest is not sufficient semantic identity or authenticity. |
| Interrupted export/inspection | Leave canonical stores unchanged; no output publication on failed export; inspect is read-only and safe to repeat. Check cancellation and cleanup failures explicitly. |
| Secrets in selected notes or metadata | Preview and minimize; exclude raw logs/prompts/environment by default. User controls transfer. No automatic claim of secret-free output. |
| Stale locks, active sessions, foreign workspace paths, claimed live process/resource state | Reject authority-bearing fields and ignore them as a source of current local state; never recreate locks, ownership, capacity or activation |
| Concurrent source/destination work | Context is not a lease. Explicit operator coordination and normal tracked ownership/conflict workflow are required; new commits/contract changes invalidate contextual matching. No automatic source release or destination takeover. |

For an eventual trusted-continuation protocol, explicit operator intent would still be necessary but insufficient: authenticate the source out of band; independently bind the intended repository, objects, complete original baseline/epochs, task contract, path content **and mode**; preserve all prior immutable proof; check current ownership and concurrent work; register a genuinely local identity; rerun required local checks and obtain any required fresh independent review. Reissue local worker sessions. Imported operator decisions cannot grant approvals. Missing proof must keep that continuation blocked; a separately scoped successor can own new work but cannot prove or complete the old task. None of these steps is automated or claimed to be available as a complete sequence today.

## Clean, dirty and distributed cases

A clean committed handoff is the only proposed export starting point. Git supplies code/contracts; summaries explain the source's observations. The source is not automatically released and the destination does not automatically acquire the task.

Dirty/untracked changes are unsupported by the first slice: no patches, file payloads or dirty-baseline laundering. The operator must first create an authorized, reviewable source checkpoint within the current task contract, or keep working on the source. That checkpoint is not itself proof of completion. A dirty destination is likewise unsuitable for a contextual match until its unrelated work is preserved and separated.

Divergent or rewritten histories, missing original baselines, missing objects and ambiguous carried paths are unsupported for continuation. A foreign absolute worktree path cannot identify or repair a local checkout; content-derived `worktreeId` may legitimately match across machines. A mode mismatch remains material even if bytes match. For offline use, report missing objects and wait for an explicit ordinary Git transfer, rather than reaching out to a remote.

## Bounded follow-up implementation contract

This is one proposed contract, not a newly created or claimed task and not authorization to implement during 0237.

- **Goal:** implement opt-in `apk handoff export <task-id> --preview` / explicit new-file output, plus `apk handoff inspect <bundle>` that displays untrusted claims and local matching/missing facts. No canonical import/apply/resume command.
- **Risk/mode:** high-risk feature, sequential. Require a fresh independent reviewer and candidate-bound verification. Assign a real task ID and resolve overlap before work begins.
- **Dependencies:** preserve the completed 0187 storage decision and current baseline/epoch/mode semantics. No dependency on completing 0218 is claimed for read-only context; any continuation feature must separately resolve its proof questions.
- **Proposed allowed scope:** a new `src/core/handoff/` bounded codec/export/inspect module and tests, thin `src/cli/commands/handoff.ts`, command registry/reference tests, explicit documentation and generated `dist/**`. Keep integration limited to registering the new read-only/context commands.
- **Forbidden scope:** task parser aliases, lifecycle transitions, gate eligibility/freshness/attribution policy, registration, evidence/baseline/review/session stores, SSH/network transport, `.gitignore` mutation, dependencies without an ADR, automatic task-state migration.
- **Implementation steps:** freeze the exact wire schema and canonical digest format; implement bounded no-follow reads and strict validation; build a minimal task-scoped preview; add exclusive output publication; add read-only contextual matching; document what remains unsupported; prove stores/index/worktree unchanged for every inspector outcome.
- **Acceptance:** every input remains explicitly untrusted; no imported PASS/owner/decision/session becomes effective; clean export rejects incomplete observations; no shell/URL execution; complete bounded output/coverage; no silent truncation; stable duplicate inspection; informative stale/unbound results; export cancellation leaves no published partial artifact.
- **Verification:** focused codec/path/size/duplicate-key/Unicode tests; disposable two-clone CLI tests; forged identity/PASS/decision and replay cases; dirty/divergent/missing-object/mode cases; concurrent output collision and interrupted-write checks; before/after byte and index snapshots of all canonical stores; repository type/lint/docs/committed-dist checks. The review must inspect the full candidate and challenge file containment and trust separation without gratuitously repeating the full suite.
- **Rollback:** disable/remove the new commands and delete only explicitly chosen exported documents. No runtime migration, inverse lifecycle operation, evidence rewrite or history rewrite should be needed because none was performed.

The selected recommendation provides portable explanation first. Validated continuation remains a separate no-go until its authentication and historical-proof obligations have an independently reviewed solution.
