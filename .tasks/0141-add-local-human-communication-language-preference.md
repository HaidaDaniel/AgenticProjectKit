# Task 0141 - Add local human communication language preference without changing repository artifact language

State: done
Owner: code-owner-0141
Mode: product
Lane: core
Type: feature
Scope: config,interaction,developer-preferences,prompting
Risk: medium
Parallel: true
Depends on: none
Tags: ux,config,local-preferences,language

## Goal

Add a first-class per-developer communication-language preference for APK-provided human-facing interaction guidance while preserving English as the canonical language of repository-owned artifacts.

The preference must live outside Git-tracked project configuration so different developers can use the same repository with different interaction languages without config churn. APK does not own the external harness conversation runtime; it must expose the resolved preference through the prompt/instruction surfaces it does own so compatible harnesses and manual skills can follow it.

Do not add a primary `language` setting to tracked `.agentic/config.json`.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/config/file.ts
- src/core/config/types.ts
- src/core/docs/prompt.ts
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/cli/index.ts
- src/cli/commands/prompt.ts
- .tasks/0136-validate-and-supersede-canceled-0124-normal-default-behavior.md
- .tasks/0137-add-optional-project-level-grill-skill.md

## Files allowed to edit

- src/core/config/**
- src/core/docs/prompt.ts
- src/core/templates/skills/**
- src/cli/**
- src/**/*.test.ts
- docs/**
- README.md
- dist/**
- .tasks/0141-add-local-human-communication-language-preference.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .tasks/0142-preserve-decision-context-in-interactive-grill-skills.md
- .tasks/0143-warn-when-legacy-explicit-caveman-remains-configured.md

## Steps

1. Inspect current config/discovery and CLI conventions and choose the smallest cross-platform developer-local storage mechanism; prefer an existing suitable local-state convention if one exists and do not create a general settings subsystem.
2. Define deterministic resolution semantics: explicit current-invocation language override, then persisted developer-local preference, then English fallback.
3. Add a low-friction supported way to inspect, set, and reset the local preference without mutating the repository or tracked `.agentic/config.json`.
4. Expose the resolved preference through APK-owned human-facing prompt/instruction surfaces, including grill guidance where applicable; do not claim APK can directly force language in an arbitrary external harness that ignores those instructions.
5. Keep machine-facing and durable repository artifacts canonical: task files, generated repository instructions, durable docs, code identifiers, paths, config keys, CLI commands, errors, and machine-readable output are not automatically translated by this preference.
6. Add focused cross-platform/discovery/precedence/non-mutation tests, update docs, rebuild committed `dist`, and run the declared verification.

## Acceptance criteria

- A developer can persist a preferred human communication language locally without editing Git-tracked project configuration.
- Two developers using the same repository can use different local language preferences with no repository diff.
- Missing preference resolves deterministically to English.
- An explicit per-invocation/session language can override the local preference without implicitly persisting it.
- APK-owned prompts/instructions can carry the resolved communication-language guidance to compatible harnesses and manual skills.
- `apk-project-grill` and `apk-task-grill` can follow the resolved human communication language without translating technical tokens or durable repository artifacts.
- The implementation does not promise control over external harness output beyond APK-owned prompt/instruction guidance.
- Existing `.agentic/config.json` files require no migration and are not mutated by setting/resetting the local preference.
- Storage/discovery behavior is defined and tested for Windows, Linux, and macOS.
- Shared task files, generated repository instructions, durable docs, config keys, paths, identifiers, commands, errors, and machine-readable output remain canonical/English unless another explicit contract says otherwise.

## Correctness assumptions

- Human communication language is developer-local preference, not project truth.
- English is the stable canonical language for repository-owned APK artifacts.
- APK can reliably control only the prompts/instructions and CLI surfaces it owns; external harness compliance is outside APK runtime authority.

## Invariants

- No personal language preference becomes mandatory shared repository state.
- No automatic mass-translation of task files, docs, generated instructions, code, config keys, paths, commands, errors, or machine-readable output.
- Existing repositories remain usable without migration.
- Local preference never overrides an explicit language request for the current interaction.
- Setting/resetting the preference does not dirty the downstream repository.

## Required evidence

- Focused automated tests for storage discovery, precedence, default, reset, and repository non-mutation.
- Evidence that changing the preference leaves a clean downstream Git worktree clean.
- A fixture/manual example with two different developer-local preference values against the same project checkout.
- A grill or generated-prompt example showing human-facing language guidance while repository artifacts remain English.

## Review questions

- Is the preference truly developer-local rather than project-shared?
- Is the storage/discovery mechanism smaller than a general settings framework and aligned with existing APK architecture?
- Does the implementation correctly distinguish APK-owned prompt guidance from control of an external harness conversation runtime?
- Can two developers use different languages with no Git churn?
- Is English the deterministic fallback and canonical artifact language?

## Counterexample searches

- `.agentic/config.json` gains a primary or mandatory language setting.
- Setting language creates a tracked file or dirty Git worktree.
- Running grill in Russian rewrites task files, generated instructions, or durable docs into Russian.
- APK claims it can force arbitrary external harness output language without passing prompt/instruction guidance.
- Missing preference guesses a language from repository content instead of falling back to English.

## Verification

- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`

## Documentation updates

- Document the selected local storage location and cross-platform discovery.
- Document inspect/set/reset UX and precedence.
- Document the boundary between human-facing communication guidance and canonical repository artifact language.
- Document that external harnesses must honor APK-provided instruction/prompt guidance for the preference to affect their conversational output.

## Notes

- Origin: downstream `translator-agent` dogfood, where English grill questions plus terse/caveman phrasing were difficult to follow.
- Keep this feature small and local-first; it is not whole-product i18n/localization.
- Task 0142 remains independently useful even when no language preference is configured.
