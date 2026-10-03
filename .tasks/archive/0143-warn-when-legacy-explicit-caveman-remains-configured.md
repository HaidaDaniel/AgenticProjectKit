# Task 0143 - Warn when explicit caveman style remains configured after normal became the default

State: done
Owner: code-owner-0143
Mode: maintenance
Lane: cli
Type: corrective
Scope: config,doctor,adopt,agent-style,upgrade-observability
Risk: low
Parallel: true
Depends on: none
Tags: ux,upgrade,config,agent-style

## Goal

Surface a clear non-destructive advisory when an existing project explicitly persists `agentStyle: caveman` even though current APK defaults omitted/new configuration to `normal`.

Do not silently migrate or rewrite the project setting. The purpose is observability: make preserved explicit behavior visible so a maintainer can distinguish an intentional repository preference from the current APK default.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/apk-upgrade-workflow.md
- src/core/config/defaults.ts
- src/core/config/file.ts
- src/core/config/schema.ts
- src/core/doctor/index.ts
- src/cli/commands/doctor.ts
- src/core/docs/adopt.ts
- src/cli/commands/adopt.ts
- src/cli/cli.test.ts
- .tasks/0136-validate-and-supersede-canceled-0124-normal-default-behavior.md
- .tasks/0126-research-agent-driven-apk-upgrade-workflow.md

## Files allowed to edit

- src/core/doctor/**
- src/cli/commands/doctor.ts
- src/core/docs/adopt.ts
- src/cli/commands/adopt.ts
- src/cli/cli.test.ts
- src/**/*.test.ts
- docs/engineering/apk-upgrade-workflow.md
- docs/progress.md
- dist/**
- .tasks/0143-warn-when-legacy-explicit-caveman-remains-configured.md

## Files forbidden to edit

- src/core/config/defaults.ts
- src/core/config/schema.ts
- src/core/exporters/index.ts
- src/cli/index.ts
- .agentic/config.json
- package.json
- pnpm-lock.yaml
- .tasks/0141-add-local-human-communication-language-preference.md
- .tasks/0142-preserve-decision-context-in-interactive-grill-skills.md

## Steps

1. Inspect the existing non-failing warning surfaces. Prefer the lowest-noise existing path: `doctor` already models `warn` separately from `fail`, while adopt already exposes bounded diagnostics. Do not create a bespoke warning subsystem or a new `apk upgrade` command.
2. Add detection for explicit effective `agentStyle: caveman` using existing project config semantics. Because the current default is `normal`, a normalized caveman value necessarily comes from an explicit persisted project value; do not claim when it was set or that every such value is historically legacy.
3. Emit one concise actionable advisory on the selected diagnostic surface: caveman is explicitly configured, omitted/new config defaults to normal, the explicit value is preserved intentionally, and the maintainer may remove it or set `normal` to return to normal communication.
4. Keep the advisory non-destructive and warning-only. It must not rewrite `.agentic/config.json`, make caveman invalid, or independently turn an otherwise passing doctor/adopt flow into failure.
5. Add focused tests for explicit caveman, explicit normal, and omitted setting, including byte-for-byte config non-mutation and exit/result semantics. If both doctor and adopt surface the advisory, prove this does not create noisy duplicate output in ordinary workflows.
6. Update only the necessary upgrade/config documentation, rebuild committed `dist`, and run the declared verification.

## Acceptance criteria

- A project with explicit `agentStyle: caveman` receives a clear actionable advisory through an appropriate existing diagnostic/adoption surface.
- The advisory explains that current APK defaults omitted/new `agentStyle` to `normal` and preserves explicit caveman intentionally.
- The advisory tells the maintainer to remove the setting or set it to `normal` if caveman communication is no longer desired.
- The message does not assert that the setting is old/legacy unless that fact is independently knowable; recently intentional caveman remains a supported case.
- Explicit caveman remains schema-valid and functional.
- Explicit normal and omitted `agentStyle` do not receive the advisory.
- The advisory is warning-only and does not independently cause a failing exit/result.
- No project config is mutated; tests prove `.agentic/config.json` is unchanged.
- No new `apk upgrade` command, migration engine, warning subsystem, or global style-policy redesign is introduced.
- Tests cover caveman/normal/omitted cases and generated `dist` remains synchronized.

## Correctness assumptions

- Preserving explicit user configuration is correct and already validated by Task 0136.
- The current normalized default is `normal`, so effective caveman indicates an explicit project choice rather than omission fallback.
- Existing doctor/adopt diagnostic models are sufficient for a non-failing advisory.

## Invariants

- No silent config migration.
- No removal or invalidation of caveman support.
- No false claim that explicit caveman is broken or necessarily historical.
- No new mandatory upgrade command or migration engine.
- Task 0136 normal-default and explicit-opt-in semantics remain unchanged.

## Required evidence

- Focused automated tests for explicit caveman, explicit normal, and omitted `agentStyle`.
- CLI/diagnostic output fixture showing the actionable advisory.
- Evidence that the advisory leaves `.agentic/config.json` byte-for-byte unchanged.
- Evidence that warning-only caveman state does not independently change an otherwise passing diagnostic into failure.

## Review questions

- Is the selected warning surface visible in realistic downstream validation/upgrade workflows without appearing on every unrelated command?
- Is the advisory fully read-only and non-failing?
- Does wording distinguish explicit project state from current default without pretending to know when/why the value was set?
- Are normal and omitted configs quiet?
- Did the implementation reuse current diagnostics rather than inventing an upgrade subsystem?

## Counterexample searches

- `doctor` or `adopt` rewrites caveman to normal.
- Explicit caveman becomes schema-invalid or causes failure by itself.
- The warning appears for explicit normal or omitted setting.
- A new `apk upgrade` command or bespoke warning framework is added for this one advisory.
- The message says APK "failed to migrate" or labels every caveman value as legacy history.

## Verification

- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`

## Documentation updates

- If needed, add a short upgrade/config note explaining that explicit `agentStyle` values survive APK updates and that `normal` is the fallback only when the setting is omitted/new.

## Notes

- Origin: `translator-agent` retained explicit `agentStyle: caveman`, which made the new grill appear unexpectedly terse after APK update.
- `docs/engineering/apk-upgrade-workflow.md` already rejects a monolithic `apk upgrade`; preserve that architecture.
- This is an observability corrective, not another redesign of agent-style policy.
