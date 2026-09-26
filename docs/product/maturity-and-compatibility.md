# Public Maturity and Compatibility

This policy describes the evidence-backed support boundary for evaluating Agentic Project Kit (APK). It distinguishes a package declaration from a combination that the project actually validates.

## Maturity

The latest validated, installable release at this policy snapshot is `v0.4.7`. It is a pre-1.0 release under active development. “Validated release” means that the tagged candidate passed the release checks documented for that version; it does not promise a stable public API, long-term support (LTS), service-level agreement, or a fixed support period. See the [v0.4.7 release notes](../releases/v0.4.7.md) and [post-tag validation record](../delivery/workflow-v0.4.7-self-dogfood.md).

Do not infer a broader compatibility guarantee from the package's version number alone. Check the release notes for the exact version being installed and the evidence links below.

## Compatibility matrix

| Surface | Current statement | Evidence and limits |
| --- | --- | --- |
| Package release | `v0.4.7` is the latest validated Git-tag release in this repository. Published tags are immutable history; validation applies to each exact candidate. | [Release notes](../releases/v0.4.7.md), [tag and candidate evidence](../delivery/workflow-v0.4.7-self-dogfood.md). |
| Node.js | `package.json` declares `>=22.22.1`. Clean-checkout CI and the v0.4.7 release validation use Node.js `22.22.1`. The declared range is not a test matrix: other Node versions, including later majors, are not individually verified here. | [Package engine](../../package.json), [CI toolchain](../../.github/workflows/quality.yml), [release validation](../releases/v0.4.7.md). |
| pnpm | The repository pins pnpm `10.28.1` in `packageManager`; CI uses that exact version. The lockfile uses format `9.0`. Other pnpm versions and package managers are not declared as supported or verified. | [Package manager pin](../../package.json), [lockfile](../../pnpm-lock.yaml), [CI toolchain](../../.github/workflows/quality.yml). |
| Operating system | The maintained clean-checkout CI target is GitHub Actions `ubuntu-latest`. This is evidence for that Linux runner, not every Linux distribution. macOS and Windows end-to-end install/release support is unverified; code paths or unit tests for individual OS-specific behavior are not a complete platform matrix. | [CI runner](../../.github/workflows/quality.yml), [testing strategy](../engineering/testing-strategy.md#clean-checkout-ci). |
| Installation and package contents | The documented, tested release path is a repository-local Git pin to an immutable tag. v0.4.7 ships committed `dist/` and installs without a build-script allowlist. The README documents Git-based use without npm publication; registry availability and support are unknown. | [Git-based installation guidance](../../README.md#using-it-in-other-repositories), [install instructions](../releases/v0.4.7.md#installation), [cold install evidence](../delivery/workflow-v0.4.7-self-dogfood.md#actual-tag-cold-install), [package metadata](../../package.json). |
| Agent instructions | APK generates canonical `AGENTS.md`; `CLAUDE.md` and `GEMINI.md` are thin imports. Codex, OpenCode, and Cursor are documented as direct `AGENTS.md` consumers, with legacy export targets retained as aliases. APK tests its generated files and aliases; exact external harness versions and native runtime consumption are not covered by a maintained integration matrix. | [Exporter contract](../agent-exporters.md#implemented-outputs), [exporter tests](../engineering/testing-strategy.md#test-layers), [compatibility decision](../decisions.md#adr-0040---canonical-agentsmd-export-with-thin-harness-adapters). |
| Task Markdown | Current structured task contracts are supported. Legacy `Verification commands` remain readable and normalize in memory; legacy task files are not mass-migrated. Unsupported Markdown fails closed when APK cannot preserve it safely. No indefinite compatibility window for every historical task shape is declared. | [Task verification compatibility](../task-system.md#verification-contract), [v0.4.7 compatibility notes](../releases/v0.4.7.md#compatibility). |
| Project configuration | New `init` and applied migration write schema version `2`. A missing marker or version `1` is treated as legacy v0.3.1-style config. `adopt --preview` shows the proposed change; `adopt --apply` explicitly adds the marker, preserves unknown keys/custom files, and is idempotent. Invalid or newer schema versions fail closed for migration. | [Migration decision](../decisions.md#adr-0029---explicit-compatibility-migration-for-gated-workflow-adoption), [task-system compatibility](../task-system.md#verification-contract). |
| Release support window | There is no published N-1 policy, backport commitment, security response SLA, or fixed duration for maintaining an older release. Prefer the latest validated tag for new installs; older tags remain historical artifacts, not a promise of ongoing maintenance. | [Current release](../releases/v0.4.7.md), [release evidence policy](../engineering/testing-strategy.md#release-evidence-ordering). |

“Validated” in this matrix refers to the exact evidence cited. “Declared” refers to package metadata. “Unverified” means this repository does not currently provide enough maintained evidence to claim support; it does not assert that the combination cannot work.

## Deprecation and migration

- No task-format or config-format removal date is currently announced. A compatibility path without a dated notice remains available in the current release, but that does not create a time-based support guarantee.
- Before removing a compatibility path, release documentation must identify the affected format or surface, the first release containing the notice, the replacement if one exists, and a migration or repair route. The notice does not promise a minimum number of releases or months unless it says so explicitly.
- Configuration migration remains opt-in and previewable. APK does not silently rewrite existing task files or customized project documents. A future schema APK cannot interpret safely is rejected rather than guessed.
- Obsolete generated exporter files can be reported and explicitly cleaned up; cleanup removes only exact known generated content and preserves customized files. See [safe exporter migration](../agent-exporters.md#removed-outputs-and-safe-migration).

## Updating this policy

Recheck package metadata, CI, task/config parsing behavior, exporter tests, and the latest exact-tag validation when preparing a release. Change a matrix claim only when its evidence changes, and leave unsupported combinations explicitly marked unverified. Do not convert a local smoke, package engine range, or harness documentation into a wider platform or compatibility guarantee.
