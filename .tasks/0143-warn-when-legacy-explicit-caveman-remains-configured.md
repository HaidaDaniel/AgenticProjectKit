# Task 0143 - Warn when legacy explicit caveman style remains configured after normal became the default

State: todo
Owner: unassigned
Mode: maintenance
Lane: cli
Type: corrective
Scope: config,upgrade,doctor,adopt,agent-style
Risk: low
Parallel: true
Depends on: none
Tags: ux,upgrade,config,agent-style

## Goal

Surface a clear non-destructive advisory when an existing project still explicitly persists `agentStyle: caveman` even though current APK defaults new/omitted configuration to `normal`.

Do not silently migrate or rewrite the project setting. The purpose is to make preserved legacy behavior visible so maintainers understand why a downstream project may still communicate in caveman style after updating APK.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/config/**
- src/cli/**
- doctor/adopt/audit/config validation paths
- docs/engineering/apk-upgrade-workflow.md
- .tasks/0136-validate-and-supersede-canceled-0124-normal-default-behavior.md
- .tasks/0126-research-agent-driven-apk-upgrade-workflow.md

## Problem

Current intended behavior correctly preserves an explicit stored `agentStyle: caveman` rather than silently mutating user configuration. However, that preservation can be surprising during an upgrade.

Downstream dogfood in `translator-agent` demonstrated the confusion:

- APK itself now defaults to `normal`;
- the downstream project still explicitly stored `agentStyle: caveman`;
- updating APK did not remove the explicit setting, by design;
- the resulting terse interaction looked like a regression in the new grill feature even though the real cause was preserved legacy configuration.

The missing piece is observability, not migration.

## Required behavior

When APK encounters an explicit persisted `agentStyle: caveman` in a project under the current normal-default semantics, an appropriate existing diagnostic/upgrade-related surface should emit a concise advisory explaining:

- `caveman` is explicitly configured in this project;
- current APK default is `normal` when the setting is omitted/new;
- the explicit setting was preserved intentionally;
- remove the setting or change it to `normal` if caveman communication is no longer desired.

The advisory must not present the configuration as invalid or broken.

## Design constraints

- Do not silently edit `.agentic/config.json`.
- Do not auto-migrate explicit `caveman` to `normal`.
- Do not fail `doctor`, `adopt`, `audit`, sync, or upgrade-related flows solely because caveman is explicit.
- Reuse the most appropriate existing diagnostic surface after inspecting current CLI architecture.
- Avoid duplicating the same warning noisily across every command invocation.
- The message should be actionable and distinguish an explicit legacy setting from the default.
- Do not invent a new `apk upgrade` command if no first-class upgrade command currently exists.
- Preserve Task 0136 semantics: explicit persisted caveman remains supported and authoritative until the user changes it.

## Suggested advisory semantics

Equivalent wording is acceptable, but it should communicate roughly:

`agentStyle: caveman` is explicitly configured for this project. Current APK defaults to `normal` when this setting is omitted. The explicit value was preserved intentionally. Remove `agentStyle` or set it to `normal` if you no longer want caveman communication.

Do not hard-code a claim that every explicit caveman configuration is old; a user may have intentionally selected it recently. Phrase it as an explicit persisted setting that differs from the current default, with optional legacy context where reliably knowable.

## Required investigation before implementation

Inspect where current APK already reports:

- explained/non-failing warnings;
- config normalization results;
- adopt compatibility findings;
- doctor diagnostics;
- upgrade/release compatibility guidance.

Choose the lowest-noise surface that users naturally encounter after installing/updating APK or validating a downstream project. Prefer extending an existing warning/result model rather than adding a bespoke warning subsystem.

## Acceptance criteria

- A project with explicit `agentStyle: caveman` can receive a clear actionable advisory through an appropriate existing validation/adoption/diagnostic flow.
- The advisory states that current default behavior is `normal` when the explicit setting is absent.
- The advisory states or clearly implies that the explicit value is preserved intentionally.
- The advisory tells the maintainer how to return to normal behavior.
- No project config is mutated automatically.
- Explicit caveman remains valid and functional.
- A project using `normal` or omitting the setting does not receive the caveman advisory.
- The warning does not cause a failing exit code by itself unless an existing warning policy independently requires that behavior.
- Tests cover explicit caveman, explicit normal, and omitted setting cases.

## Correctness assumptions

- Preserving explicit user configuration is correct.
- A changed default can create surprising behavior when an old explicit value remains.
- A targeted advisory is enough to resolve that ambiguity without migration risk.

## Invariants

- No silent config migration.
- No removal of caveman support.
- No false claim that explicit caveman is invalid.
- No new mandatory upgrade command solely for this advisory.
- Existing Task 0136 normal-default behavior remains unchanged.

## Required evidence

- Focused automated tests for diagnostic behavior with explicit caveman, explicit normal, and omitted agentStyle.
- CLI/diagnostic output example showing the advisory text.
- Evidence that running the diagnostic leaves `.agentic/config.json` byte-for-byte unchanged.

## Review questions

- Is the chosen surface visible enough during real downstream upgrade/adopt/doctor usage?
- Is it non-destructive and non-failing?
- Does the message explain preserved explicit state versus current default without implying APK ignored the update?
- Does it avoid noisy repetition on unrelated commands?
- Are Task 0136 semantics preserved exactly?

## Counterexample searches

- `doctor` or `adopt` rewrites caveman to normal.
- Explicit caveman is treated as schema-invalid.
- The warning appears for projects already using normal/default behavior.
- A brand-new upgrade subsystem is introduced just to print one advisory.
- The message says APK "failed to migrate" when preservation is intentional.

## Verification

- `git diff --check`
- `pnpm test`
- `pnpm build`
- `node dist/cli/index.js lint --json`
- focused diagnostics/config tests

## Documentation updates

If needed, add a short note to upgrade/config documentation explaining that explicit `agentStyle` values are preserved across APK updates and that `normal` is only the default for omitted/new configuration.

## Notes

- Root cause was confirmed through `translator-agent` dogfood: the project explicitly retained `agentStyle: caveman` while current APK defaults to normal.
- Keep this task narrow. It is an observability/UX corrective, not another redesign of agent-style policy.
- Backlog task only; no migration or project config edit is part of task creation.
