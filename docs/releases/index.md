# Release index

The current package version is `0.4.7`, matching the latest validated tagged release
[`v0.4.7`](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.7). Its annotated
tag peels to candidate `2797556344eb25cc34d3f51afbe10532147aca85`; the release note and
separate post-tag record are linked below.

This index uses repository tags and committed documentation as the release records. For
each new release, `docs/releases/vX.Y.Z.md` is its one canonical narrative note. A separate
`docs/delivery/workflow-vX.Y.Z-self-dogfood.md` may record candidate, publication, and
post-tag validation evidence; it supplements the note and does not repeat its change list.
The tagged note contains only facts known before publication and is never backfilled with
post-tag results.

## Versioned release records

| Tag | Tagged source | Canonical detailed note or retained historical detail | Additional delivery/evidence record |
| --- | --- | --- | --- |
| `v0.4.7` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.7) | [v0.4.7 release note](v0.4.7.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.7-self-dogfood.md) |
| `v0.4.6` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.6) | [v0.4.6 release note](v0.4.6.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.6-self-dogfood.md) |
| `v0.4.5` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.5) | [v0.4.5 release note](v0.4.5.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.5-self-dogfood.md) |
| `v0.4.4` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.4) | [v0.4.4 release note](v0.4.4.md) | [post-tag self-dogfood](../delivery/workflow-v0.4.4-self-dogfood.md) |
| `v0.4.3` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.3) | No versioned release note is retained. Corrective details are in [Task 0118](../../.tasks/0118-release-v043-corrective-dogfood-fixes.md) and the [v0.4.2 → v0.4.3 upgrade record](../engineering/apk-upgrade-workflow.md#resledger-v042-v043). | No separate versioned delivery record is retained. |
| `v0.4.2` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.2) | [v0.4.2 release note](v0.4.2.md) | No separate versioned delivery record is retained. |
| `v0.4.1` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.1) | [v0.4.1 release note](v0.4.1.md) | No separate versioned delivery record is retained. |
| `v0.4.0` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.4.0) | [v0.4.0 release note](v0.4.0.md) | No separate versioned delivery record is retained. |
| `v0.3.1` | [source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.3.1) | The [gated-workflow release evidence](../delivery/gated-workflow-release-evidence.md) is the retained detailed release record. | The same file is the retained evidence record. |
| `v0.3.0` | [tagged source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.3.0) | No per-version narrative note or validation report is retained; the source tag is the release artifact. See the [historical milestone record](../delivery/milestones.md) for planning context. | No separate versioned delivery record is retained. |
| `v0.2.0` | [tagged source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.2.0) | No per-version narrative note or validation report is retained; the source tag is the release artifact. See the [historical milestone record](../delivery/milestones.md) for planning context. | No separate versioned delivery record is retained. |
| `v0.1.0` | [tagged source](https://github.com/HaidaDaniel/AgenticProjectKit/tree/v0.1.0) | No per-version narrative note or validation report is retained; the source tag is the release artifact. See the [historical milestone record](../delivery/milestones.md) for planning context. | No separate versioned delivery record is retained. |

The rows reflect repository tags observed on 2026-09-26 and the package version declared at
that time. Before each release, recheck `package.json`, existing local and remote tags, and
the exact candidate; do not infer a next version from this historical list.
