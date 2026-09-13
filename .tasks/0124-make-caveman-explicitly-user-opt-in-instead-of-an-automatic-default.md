# Task 0124 - Make caveman explicitly user opt-in instead of an automatic default

State: todo
Owner: none
Mode: maintenance
Lane: instructions
Type: feature
Scope: config,instructions,adoption,docs,tests
Risk: medium
Parallel: false
Depends on: 0002,0029,0092
Tags: feature,instructions,docs

## Goal

Make normal, concise, clear communication the APK default. Keep caveman available only when a human explicitly requests that named mode or deliberately configures it as a persistent preference. Installing APK, creating/adopting a repository, having a compatible harness, or having the skill already installed must not constitute a request to use caveman.

### Motivation

Caveman is a presentation preference with model/task-dependent effects, not a prerequisite for reliable APK work. Automatically spreading it into every repository imposes that preference on other users and harnesses and can alter more than visible prose. Keep concise communication without promising universal token savings or unchanged reasoning/quality.

### Scope and existing behavior

APK currently sets caveman in DEFAULT_CONFIG.agentStyle and DEFAULT_AGENT_POLICY.defaultStyle. The config parser uses that default when agentStyle is omitted; init writes it into new config; adopt uses it in newly generated config/exports; export/sync render repository agentStyle into canonical AGENTS.md. This repository also has agentStyle: caveman plus durable docs declaring it the default. APK does not currently install a caveman skill into harness/user skill directories: fix the actual automatic configuration/instruction propagation rather than inventing an installer problem.

Reuse the existing normal/caveman agentStyle values, neutral policy, templates, config-aware export/sync, and non-destructive init/adopt behavior. Default to normal when no preference is authored. Normal policy should ask for concise, readable sentences while preserving material reasons, limitations, and uncertainty; do not render a meaningless instruction to invoke a skill named normal. Caveman-specific policy must distinguish an explicit request such as "use caveman" from generic "be brief", "save tokens", a task's complexity, or merely detecting an installed skill.

Document existing opt-in paths: a direct human request/native skill invocation if their harness has the skill, and deliberate agentStyle: caveman configuration for users who want a persistent repository preference. A one-session request must not silently edit persistent config; stop caveman/normal mode disables that session preference, and persistent reset uses agentStyle: normal plus the existing export/sync write flow. Where a harness lacks the skill, explain that availability/installation is separate and user-controlled; do not add a bundled skill, download, plugin installation, model routing, or new CLI command just for this change.

### Compatibility and documentation ownership

Change this repository's config to normal and regenerate its canonical AGENTS.md through the existing policy/export flow. Update the live project/exporter/README defaults and supersede ADR-0006 with a new decision while preserving the historical decision text. Never edit generated AGENTS.md alone or let check-only sync/audit mutate files.

Existing downstream configs and customized instruction files must remain untouched by installation/init/adopt/check-only commands. An explicit stored agentStyle: caveman remains a valid compatible value and is honored by config-aware export/sync. Older APK also generated that value automatically, so its presence in an old repository cannot prove historical human intent. Document an explicit migration/reset for those repositories; do not silently rewrite all old configs, claim a stronger consent guarantee than the stored data supports, or create a consent/provenance subsystem. The default change affects new/missing preferences; legacy preferences are reset by user action.

### Non-goals

No feature implementation during creation of this backlog task. The future task adds no dependencies, new lifecycle states, gates, provider/harness orchestration, skill registry/installer, new command, or generic preference framework. No automatic installation or activation of caveman, no heuristic activation on brevity/token-efficiency requests, and no modification/removal of user-global skills or unrelated repositories. Task 0123's optional task-grill skill is separate and is not a dependency. Historical task contracts and legacy exporter templates used for exact-content migration recognition must not be mechanically rewritten.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/project-map.md
- docs/task-system.md
- docs/context-system.md
- docs/agent-exporters.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- README.md
- .agentic/config.json
- src/core/config/defaults.ts
- src/core/config/types.ts
- src/core/config/schema.ts
- src/core/config/schema.test.ts
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/templates/renderer.test.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/cli/commands/export.ts
- src/cli/commands/sync.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/core/config/defaults.ts
- src/core/config/schema.test.ts
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/templates/renderer.test.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/cli/cli.test.ts
- .agentic/config.json
- AGENTS.md
- README.md
- docs/project.md
- docs/agent-exporters.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/cli/index.ts
- src/cli/commands/**
- src/core/config/types.ts
- src/core/config/schema.ts
- src/core/tasks/**
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/templates/exporters/codex.md.hbs
- src/core/templates/exporters/opencode.md.hbs
- src/core/templates/exporters/cursor-project-overview.mdc.hbs
- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/**

## Steps

1. Trace missing/default/explicit agentStyle through config parsing, init/adopt, direct neutral rendering, export, and sync. Confirm that the current defect is automatic style propagation, not an existing skill installer.
2. Set DEFAULT_CONFIG.agentStyle and DEFAULT_AGENT_POLICY.defaultStyle to normal. Render concise natural-language normal policy and make caveman-specific activation depend on explicit named human intent or deliberate persisted preference, not availability or generic brevity/token-saving intent.
3. Keep normal/caveman schema compatibility and existing config-aware generation paths. Fresh init/adopt must emit normal config and normal canonical policy; repeated init/adopt and check-only commands must preserve existing/customized files.
4. Document direct/native named caveman requests, separation of skill availability from activation, deliberate persistent config opt-in, session opt-out, and persistent reset. Do not write persistent preferences from a transient conversational request or add a command/installer.
5. Document that legacy agentStyle: caveman may be an inherited old default, cannot prove prior human consent, and requires an explicit user reset; preserve it on downstream compatibility paths rather than silently migrating it.
6. Update this repository config and live default-style documentation; supersede ADR-0006 without erasing its history. Regenerate AGENTS.md and dist using existing commands; preserve common workflow policy and thin Claude/Gemini adapters.
7. Add deterministic regression coverage for defaults, omitted preference, explicit normal/caveman values, fresh init/adopt, preserved old/customized state, config-aware export/sync, no installation writes, and manual-only activation wording. Verify switching back to normal removes generated default caveman activation instructions.
8. Commit task-owned changes, run declared verification, and complete the existing policy-driven review/gate/done workflow. Update progress only for actual task status changes.

## Acceptance criteria

- Empty/missing agentStyle resolves to normal; DEFAULT_CONFIG and direct DEFAULT_AGENT_POLICY rendering agree on that default.
- Installing APK or running fresh init/adopt requires no caveman skill and generates normal config plus concise readable canonical AGENTS.md instructions; it does not install/download skills or write harness/user skill directories.
- Normal exported policy does not order default caveman usage, activate it when supported/installed, or ask a harness to invoke a nonexistent normal skill.
- Caveman remains explicitly opt-in through a named human request/native skill invocation when available, or deliberate persistent agentStyle: caveman configuration; generic brevity/token-efficiency requests are not caveman opt-in under APK policy.
- Transient opt-in does not silently persist to repository/global config; named opt-out restores normal session communication, and documented persistent reset uses normal config and existing sync/export behavior.
- Explicit normal and caveman config values remain schema-valid; config-aware export/sync honor the authored value without a new preference/state/provenance model.
- Existing downstream configs, inherited legacy caveman values, customized AGENTS.md/adapters, and user-installed/global skills are not overwritten, removed, or migrated automatically by install/init/adopt/check-only operations.
- Docs explain the legacy ambiguity: old autogenerated caveman values are not proof of historical human consent, and users reset them explicitly; no automatic migration pretends to infer that intent.
- This repository config, live project/exporter/README guidance, superseding decision, and generated AGENTS.md agree on normal by default and caveman as an optional user preference; ADR-0006 remains readable as history.
- Codex/OpenCode/Cursor still consume one neutral canonical AGENTS.md and Claude/Gemini remain thin imports; no provider-specific policy duplication or new exporter target is added.
- Caveman wording does not promise universal 65-75% coding-task savings, preserved hidden reasoning, or guaranteed unchanged quality. Concise normal guidance preserves important limitations and uncertainty without reducing necessary task verification.
- Deterministic fixtures assert fresh generation, omitted/explicit preferences, opt-in/opt-out text, config reset with sync, compatibility/non-destructive writes, and no extra installation paths, without model calls.
- Normal task claim/work/verification/review/gate/done behavior and legacy exact-content exporter recognition remain unchanged; no CLI command, dependency, mandatory skill, state, or gate is introduced.

## Correctness assumptions

- normal and caveman are already supported config values; changing fallback/defaults needs no schema expansion.
- APK controls its generated policy/config, not independent user-global skill descriptions or arbitrary external harness activation behavior.
- Legacy persisted caveman cannot be reliably distinguished as authored versus autogenerated; non-destructive compatibility and explicit reset are required.

## Invariants

- No caveman activation or installation by default in new APK-generated repository artifacts.
- Human opt-in is explicit and scoped; skill availability and a request for concision alone are not authorization.
- Existing downstream state and user-global installations remain untouched; shared policy has one canonical source.
- Existing APK task/work/review/evidence/gate contracts are unchanged.

## Review questions

- Can fresh init/adopt, missing config, or direct neutral export still accidentally select caveman?
- Does explicit persistent caveman remain compatible, and does switching config to normal generate the correct policy?
- Does any wording convert "be brief" or installed-skill availability into opt-in?
- Do compatibility docs honestly acknowledge inherited legacy defaults without silently changing user files?

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- README.md
- docs/project.md
- docs/agent-exporters.md
- docs/decisions.md
- docs/progress.md

## Notes

- This is a backlog-only request. Do not change caveman defaults or install/uninstall a skill while adding this task.
- Supersedes automatic default-style guidance, not the availability of caveman for users who explicitly prefer it. Keep the implementation small: defaults, neutral policy, accurate docs, and relevant tests.
- Do not infer consent from APK installation, an installed external skill, task complexity, or generic requests to save tokens. Independent user/global instructions are outside APK control and should be documented honestly.
- Task 0123 concerns a separate optional design-clarification skill; no new skill packaging or dependency on that task is necessary here.
