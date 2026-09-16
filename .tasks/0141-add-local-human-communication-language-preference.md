# Task 0141 - Add local human communication language preference without changing repository artifact language

State: todo
Owner: unassigned
Mode: product
Lane: core
Type: feature
Scope: config,interaction,developer-preferences,generated-instructions
Risk: medium
Parallel: true
Depends on: none
Tags: ux,config,local-preferences,language

## Goal

Add a first-class per-developer language preference for APK's human-facing interaction while preserving English as the canonical language of repository-owned artifacts and generated project state.

The preference must be local/user-level state outside Git-tracked project configuration so different developers can use the same repository with different interaction languages without creating config churn or translating shared artifacts.

The intended semantic split is:

- repository-owned and persisted project artifacts remain English by default;
- source code identifiers, paths, CLI commands, configuration keys, task metadata, generated project instructions, durable docs, machine-readable output, and errors keep their canonical form unless a separate feature explicitly defines otherwise;
- conversational explanations, interactive questions, grill sessions, clarifications, summaries, and similar human-facing output may use the developer's preferred language;
- the preference is developer-local and must not normally be committed to the application repository.

Do not add `interaction.language` to the ordinary Git-tracked `.agentic/config.json` project contract as the primary storage location.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/engineering/**
- src/core/config/**
- src/core/templates/**
- src/cli/**
- package.json
- .tasks/0136-validate-and-supersede-canceled-0124-normal-default-behavior.md
- .tasks/0137-add-optional-project-level-grill-skill.md

## Problem

Current APK interaction effectively defaults to English and has no first-class developer-local communication-language preference. A project-level persisted language setting would be the wrong ownership boundary because it would make an individual developer preference part of shared project state.

Example failure mode:

- Developer A prefers Russian for interactive questions.
- Developer B prefers English.
- Both work in the same repository.
- If the preference lives in tracked `.agentic/config.json`, changing personal UX creates Git diffs and forces the team to share one language.

The language choice therefore belongs to local APK/user preferences, not project truth.

## Design constraints

1. English remains the canonical default for shared repository artifacts.
2. The language preference is local to the developer/workstation/account context and is not committed by normal APK workflows.
3. The implementation should provide one obvious supported way to set/read the preference rather than requiring ad-hoc prompt text in every invocation.
4. The preference should be available to interactive skills such as `apk-project-grill` and `apk-task-grill` and to other human-facing APK output where appropriate.
5. Machine-facing output, code, file names, config keys, commands, identifiers, task files, and durable generated documentation must not be automatically translated merely because the interaction language is non-English.
6. Missing preference resolves to English.
7. Explicit language requested in the current invocation/session may override the stored local preference for that interaction without mutating persisted local state unless explicitly requested.
8. Project repositories must not need a new tracked local-language file.
9. Existing projects and existing `.agentic/config.json` files remain valid without migration.

## Required investigation before implementation

Before choosing a concrete storage mechanism, inspect the current APK configuration/discovery architecture and existing conventions for user-level or machine-local state. Prefer an existing suitable mechanism if one exists.

Compare reasonable local storage options such as user config directory, environment-backed preference, CLI-managed local config, or another already-established APK local-state mechanism. Select the smallest cross-platform approach that has clear discovery precedence and does not contaminate repository state.

Do not introduce a large settings subsystem solely for this feature.

## Expected precedence

The implementation should preserve this semantic precedence unless repository architecture provides a clearly better equivalent:

1. explicit language requested for the current command/session;
2. persisted developer-local APK communication-language preference;
3. English fallback.

Do not infer a durable project language from the language of source files or repository documentation.

## Expected user experience

Provide a low-friction way for a developer to inspect and change the local preference. The exact CLI shape should follow existing APK command conventions rather than being invented in isolation.

Conceptually, the UX should support operations equivalent to:

- show current communication language;
- set it to a language such as `ru`, `uk`, or `en`;
- reset to the default English behavior.

The task should decide the exact command/config surface after inspecting current CLI architecture.

## Acceptance criteria

- A developer can persist a preferred human communication language locally without editing Git-tracked project configuration.
- Two developers using the same repository can have different local communication languages with no project diff.
- Missing preference results in English human-facing interaction.
- An explicit per-invocation/session language can override the local default without implicitly persisting it.
- `apk-project-grill` and `apk-task-grill` can consume the resolved interaction language.
- Shared task files, generated repository instructions, durable docs, config keys, paths, source identifiers, commands, and machine-readable output remain canonical/English unless an existing contract explicitly says otherwise.
- Existing project configs require no migration.
- The local preference storage location is documented and excluded from accidental repository persistence by design.
- Cross-platform behavior is defined for at least Windows, Linux, and macOS according to the mechanism selected.
- Tests cover discovery/precedence/default/reset and prove project config is not mutated.

## Correctness assumptions

- Human communication language is a developer preference, not project truth.
- English is the stable canonical language for APK repository artifacts.
- Translating conversational explanation does not require translating technical tokens embedded in that explanation.

## Invariants

- No personal language preference becomes mandatory shared repository state.
- No automatic mass-translation of task files, docs, generated instructions, code, config keys, paths, commands, or machine-readable output.
- Existing repositories remain usable without migration.
- Local preference must not silently override an explicit language request for the current interaction.

## Required evidence

- Automated tests for local preference discovery and precedence.
- Evidence that setting/changing the language produces no diff in a clean downstream repository.
- One downstream/manual example showing two different local preference values against the same project checkout.
- Grill invocation demonstrating human-facing questions in the selected local language while repository artifacts remain English.

## Review questions

- Is the preference truly developer-local rather than project-shared?
- Can two developers use different languages without Git churn?
- Does the implementation keep technical and durable project artifacts canonical?
- Is the storage/discovery mechanism smaller than a general settings framework and aligned with existing APK architecture?
- Is English the deterministic fallback?

## Counterexample searches

- `.agentic/config.json` gains a mandatory or primary tracked `language` setting.
- Running a grill in Russian rewrites task files or generated repository instructions into Russian.
- Setting the local language dirties the downstream Git worktree.
- A developer-local preference silently becomes team-wide project state.
- Missing preference starts guessing language from repository content instead of falling back to English.

## Verification

- `git diff --check`
- `pnpm test`
- `pnpm build`
- `node dist/cli/index.js lint --json`
- focused tests added for local language preference resolution and repository non-mutation

## Documentation updates

Document:

- where the local preference is stored;
- how to inspect/set/reset it;
- precedence rules;
- the distinction between human-facing interaction language and canonical repository artifact language.

## Notes

- This task comes from downstream dogfood in `translator-agent`, where English interactive grill questions combined with terse/caveman phrasing were difficult to follow.
- Keep this feature small and local-first. Do not turn it into localization/i18n of the whole APK product.
- Backlog task only; do not couple implementation to Task 0142 or 0143 beyond consuming the resolved preference through a clean interface.
