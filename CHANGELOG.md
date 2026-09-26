# Changelog

This file is a short release entrypoint. Per-version notes are the canonical change
summaries; the [release index](docs/releases/index.md) links each retained note, tagged
source, and separate validation record without copying their details here.

## Current validated release

[v0.4.7](docs/releases/v0.4.7.md) is the latest validated installable release. The
package version is `0.4.7`; its tag and post-tag checks are recorded in the [release
index](docs/releases/index.md).

## Unreleased work

There is no `Unreleased` section. Proposed and active work belongs in task contracts and
the [roadmap](docs/roadmap.md), not in shipped-release history. The next version is not
declared until its release task validates the candidate and repository SemVer state.

For a new release, write `docs/releases/vX.Y.Z.md` before creating its tag and keep it to
facts known at that point. Record actual-tag, cold-install, and downstream results in a
separate `docs/delivery/workflow-vX.Y.Z-self-dogfood.md` file after publication; never
backfill those results into the tagged note. See the [release validation strategy](docs/engineering/testing-strategy.md#release-evidence-ordering).
