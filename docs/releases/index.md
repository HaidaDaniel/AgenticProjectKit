# Release index

<!-- APK_VALIDATED_RELEASE: v0.4.8 -->

The current package/candidate version is `0.4.9`.
Its pre-tag note is [v0.4.9 candidate](v0.4.9.md).
The latest validated tagged release is [v0.4.8](v0.4.8.md). Its annotated tag peels to
candidate `c0d1e27b958f3543f4a8746b6a269dad275f400e`.

This index lists tags and committed release documentation; the documentation consistency
checker does not query GitHub, the network, or repository tags. Its validated-release
sentinel records the last published release that passed post-tag validation. The package
version may move ahead while a pre-tag candidate is prepared. In that state, keep stable
release claims and install guidance on the sentinel version, and keep the candidate note
separate until publication and post-tag validation succeed. Promote the sentinel later in a
separate bookkeeping change on `main`; never backfill the immutable tagged candidate.

For each release, `docs/releases/vX.Y.Z.md` is its canonical narrative note. A separate
`docs/delivery/workflow-vX.Y.Z-self-dogfood.md` may record candidate, publication, and
post-tag validation evidence; it supplements the note and does not repeat its change list.
The tagged note contains only facts known before publication and is never backfilled with
post-tag results.

## Versioned release records

| Tag | Tagged source | Canonical detailed note or retained historical detail | Additional delivery/evidence record |
| --- | --- | --- | --- |
| `v0.4.9` | Candidate; tag pending validation | [v0.4.9 candidate note](v0.4.9.md) | Post-tag record will be added after publication |
| `v0.4.8` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.8) | [v0.4.8 release note](v0.4.8.md) | [post-tag validation](../delivery/workflow-v0.4.8-post-release.md) |
| `v0.4.7` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.7) | [v0.4.7 release note](v0.4.7.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.7-self-dogfood.md) |
| `v0.4.6` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.6) | [v0.4.6 release note](v0.4.6.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.6-self-dogfood.md) |
| `v0.4.5` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.5) | [v0.4.5 release note](v0.4.5.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.5-self-dogfood.md) |
| `v0.4.4` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.4) | [v0.4.4 release note](v0.4.4.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.4-self-dogfood.md) |
| `v0.4.3` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.3) | No versioned release note is retained. Corrective details are in [Task 0118](../../.tasks/0118-release-v043-corrective-dogfood-fixes.md) and the [v0.4.2 → v0.4.3 upgrade record](../engineering/apk-upgrade-workflow.md#resledger-v042---v043). | No separate versioned delivery record is retained. |
| `v0.4.2` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.2) | [v0.4.2 release note](v0.4.2.md) | No separate versioned delivery record is retained. |
| `v0.4.1` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.1) | [v0.4.1 release note](v0.4.1.md) | No separate versioned delivery record is retained. |
| `v0.4.0` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.0) | [v0.4.0 release note](v0.4.0.md) | No separate versioned delivery record is retained. |
| `v0.3.1` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.3.1) | The [gated-workflow release evidence](../delivery/gated-workflow-release-evidence.md) is the retained detailed release record. | The same file is the retained evidence record. |
| `v0.3.0` | [tagged source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.3.0) | No per-version narrative note or validation report is retained; the source tag is the release artifact. See the [historical milestone record](../delivery/milestones.md) for planning context. | No separate versioned delivery record is retained. |
| `v0.2.0` | [tagged source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.2.0) | No per-version narrative note or validation report is retained; the source tag is the release artifact. See the [historical milestone record](../delivery/milestones.md) for planning context. | No separate versioned delivery record is retained. |
| `v0.1.0` | [tagged source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.1.0) | No per-version narrative note or validation report is retained; the source tag is the release artifact. See the [historical milestone record](../delivery/milestones.md) for planning context. | No separate versioned delivery record is retained. |

The rows reflect repository tags observed on 2026-09-26. Before each release, recheck
`package.json`, existing local and remote tags, and the exact candidate; do not infer a next
version from this historical list.
