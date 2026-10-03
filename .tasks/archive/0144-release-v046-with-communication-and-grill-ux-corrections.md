# Task 0144 - Release v0.4.6 with communication and grill UX corrections

State: done
Owner: release-owner-0144
Mode: product
Lane: core
Type: release
Scope: release,distribution,communication-language,grill,doctor
Risk: high
Parallel: false
Depends on: 0140,0141,0142,0143
Tags: release,v0.4.6

## Goal

Publish a small stable patch release, `v0.4.6`, on top of `v0.4.5`. The functional payload is
already-completed work: developer-local human communication language preference (0141), grill
decision-context preservation (0142), explicit-caveman advisory (0143), plus the historical
release-evidence docs correction physically present since 0140. This release intentionally does
not pull unrelated roadmap features and repeats the strict pre-tag/exact-SHA-CI/tag/post-tag
ordering contract fixed by 0138/0140.

### Version and scope

Recheck real local and origin SemVer/tag history at execution. Target `v0.4.6`; it must be free.
If it is already taken or version rules changed, stop and report the actual state before any edit;
never move, delete, force-update, or rewrite an existing tag. Existing `v0.4.5` (and all earlier
tags) must remain untouched.

In scope:

- the completed 0141 developer-local communication-language preference (`apk language`,
  local-preferences storage, `apk prompt --language`, grill guidance);
- the completed 0142 grill decision-context preservation in `apk-project-grill`/`apk-task-grill`;
- the completed 0143 non-failing `doctor` advisory for explicit `agentStyle: caveman`;
- the physically-present 0140 historical release-evidence chronology correction, described as
  historical documentation, never as a new user-facing feature;
- strictly necessary versioning, committed `dist`, README/release-note/upgrade-doc updates;
- one representative disposable downstream pre-tag smoke.

Out of scope: any new feature, refactor, dependency upgrade, communication-language semantics
change, grill architecture change, `agentStyle` policy change, automatic caveman migration, whole
product i18n/localization, an `apk upgrade` command, or unrelated corrective. Any real
release-blocking defect discovered during validation stops the release and is routed to a separate
corrective task; this release task never fixes product code inline.

### Pre-tag / post-tag evidence ordering

- Everything claimed as PRE-TAG evidence must actually run against the exact frozen candidate
  SHA/tree before tag creation: `pnpm quality`, `pnpm test:coverage`, `pnpm build`,
  `pnpm release:check`, `git diff --check`, committed-`dist` currency, package/bin/asset payload
  inspection, canonical `lint`/`sync`/`doctor`/`audit`, focused 0141/0142/0143 regressions, the
  declared downstream smoke, and real exact-SHA hosted CI.
- Only after all required pre-tag criteria pass may the annotated tag be created, pointing to the
  exact validated candidate SHA. Verify the tag object type and that
  `git rev-parse v0.4.6^{}` equals that SHA. Never tag HEAD merely because it is current.
- POST-TAG checks are a distinct class: actual immutable-tag cold install with a fresh store,
  tag-peel verification, released package/bin identity, released-consumer `doctor`/`lint --json`/
  `audit`/`adopt --preview`, and released-payload skill presence. They are recorded in
  `docs/delivery/workflow-v0.4.6-self-dogfood.md` on `main` after publication.
- `docs/releases/v0.4.6.md` committed inside the tag contains only facts knowable before tagging.
  It must not name its own commit SHA, the later tag object, the hosted CI run identity, or
  cold-install results, and it must not be backfilled later with post-tag facts as if pre-tag. It
  must not call the exact-SHA hosted CI "observed after publication": that CI completes before tag
  creation.
- If hosted CI for the exact candidate fails, or the candidate changes after CI, do not tag; fix
  through a separate bounded correction, produce a new candidate SHA, and rerun all
  freshness-sensitive checks.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- README.md
- docs/progress.md
- docs/cli-commands.md
- docs/agent-exporters.md
- docs/engineering/testing-strategy.md
- docs/engineering/apk-upgrade-workflow.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/releases/v0.4.5.md
- docs/delivery/workflow-v0.4.5-self-dogfood.md
- .github/workflows/quality.yml
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .gitignore
- scripts/copy-template-assets.mjs
- src/core/config/local-preferences.ts
- src/core/doctor/index.ts
- src/core/docs/prompt.ts
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- .tasks/0140-clarify-v045-release-evidence-chronology-without-rewriting-the-tag.md
- .tasks/0141-add-local-human-communication-language-preference.md
- .tasks/0142-preserve-decision-context-in-interactive-grill-skills.md
- .tasks/0143-warn-when-legacy-explicit-caveman-remains-configured.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- README.md
- docs/releases/v0.4.6.md
- docs/delivery/workflow-v0.4.6-self-dogfood.md
- docs/progress.md
- docs/audit-report.md
- docs/project-map.md
- docs/adoption-report.md
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .agentic/config.json
- .gitignore
- dist/**
- .tasks/0144-release-v046-with-communication-and-grill-ux-corrections.md

## Files forbidden to edit

- src/**
- scripts/**
- .github/**
- SPEC.md
- docs/decisions.md
- .codex/**
- .opencode/**
- .cursor/**
- .tasks/0138-*
- .tasks/0139-*
- .tasks/0140-*
- .tasks/0141-*
- .tasks/0142-*
- .tasks/0143-*

## Steps

1. Confirm 0140, 0141, 0142, and 0143 are `done`; recheck local and origin tags and that `v0.4.6`
2. is free. Confirm the 0138/0140 ordering contract and the pre-tag criteria below.
3. Bump `package.json` version to `0.4.6` with the canonical version primitive
4. (`pnpm version patch --no-git-tag-version`) and confirm `pnpm-lock.yaml` stays consistent with
5. `pnpm install --frozen-lockfile` semantics. Do not change dependency versions.
6. Write `docs/releases/v0.4.6.md` with scope, feature list, compatibility, upgrade notes, and
7. validation, containing only pre-tag-knowable facts and explicitly noting that CI/tag/cold-install
8. identities are recorded post-publication.
9. Update README current-release/install/optional-skill sections and `docs/progress.md`; regenerate
10. committed `dist` and generated instructions through the normal build/sync. Do not edit source.
11. Freeze a clean exact candidate SHA/tree. Run the full pre-tag local set, focused 0141/0142/0143
12. regressions, and a disposable downstream smoke from the exact candidate, then inspect the
13. package payload for the five portable skill assets and working bin aliases.
14. Push the exact candidate SHA to `main` and observe real exact-SHA hosted CI. Record candidate
15. SHA/tree and the CI run id/URL/conclusion/start/finish. Do not tag on local success alone.
16. Only after all pre-tag criteria pass, create annotated tag `v0.4.6` pointing to the exact
17. validated candidate SHA and verify `git rev-parse v0.4.6^{}` equals it. Never force the tag.
18. POST-TAG: in a fresh temp consumer with a fresh pnpm store, install
19. `git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.6`, prove resolved version
20. `0.4.6`, executable/tag identity, all bin aliases, and the five packaged skill assets including
21. readable `apk-project-grill` and `apk-task-grill`.
22. POST-TAG: run released-consumer `apk doctor`, `apk lint --json`, `apk audit`, and if the target
23. is APK-managed `apk adopt --preview`; confirm the release really carries the 0141 language
24. preference, 0142 context preservation, and 0143 caveman advisory.
25. Record post-tag results in `docs/delivery/workflow-v0.4.6-self-dogfood.md` on `main`; commit
26. only task-owned changes and report all SHAs; keep the candidate commit unamended and the tag
27. unmoved.

## Acceptance criteria

- Real tag history is rechecked; `v0.4.6` was free before publication; existing tags including
- `package.json` version is `0.4.6` and `pnpm-lock.yaml` agrees; no dependency versions changed.
- The exact frozen candidate SHA/tree contains the 0.4.6 version, synchronized committed `dist`,
- All pre-tag local checks pass against that exact candidate: `pnpm quality`, `pnpm test:coverage`,
- Focused v0.4.6 regressions pass: language default/persist/override/reset/non-mutation;
- Real exact-SHA hosted CI for the frozen candidate concluded `success` before tag creation; local
- The annotated tag peels to the exact validated candidate SHA and is never moved afterward.
- A fresh-store cold install from the actual tag needs no build-script allowlist, resolves
- Released-consumer `doctor`/`lint --json`/`audit` succeed, and the released payload physically
- Pre-tag and post-tag evidence are temporally distinct: no post-tag fact is written into the
- No new feature work, refactor, dependency upgrade, or inline product fix sneaks into the release;
- The release task is completed only after post-tag validation.

## Correctness assumptions

- `v0.4.6` is free at execution time; otherwise stop and report actual state.
- A separate installed-tag consumer can prove released behavior without installing APK into itself.
- The committed `dist/` and generated instructions can be produced from current source by the
- Some release checks are intrinsically post-publication and belong only in the post-release

## Invariants

- Tag only after all required pre-tag criteria pass against the exact candidate; never move or
- Pre-tag and post-tag evidence never conflate; tagged release notes contain only pre-tag-knowable
- No source, unrelated feature, or historical completed task is modified; manual skills stay
- The candidate commit is never amended, rebased, or squashed once evidence binds to its SHA.
- Preserve unrelated and pre-existing dirty state; report candidate and bookkeeping SHAs exactly.

## Required evidence

- `docs/releases/v0.4.6.md` with pre-tag scope/features/compatibility/upgrade/validation and an
- `docs/delivery/workflow-v0.4.6-self-dogfood.md` on `main` with the frozen candidate SHA/tree,
- Focused regression output for 0141/0142/0143, downstream candidate smoke, and reported

## Review questions

- Was the tag derived from actual release history and created only after exact-candidate pre-tag
- Does the tagged release-note file avoid fabricated future facts, mis-ordered CI chronology, and
- Do the focused regressions actually exercise the 0141/0142/0143 user-facing payload?
- Is the release free of new features, refactors, and inline product fixes?
- Were `v0.4.5` and historical tasks left intact?

## Counterexample searches

- `v0.4.6` already exists or the tag points to a different SHA; a warm cache hides a missing
- Downstream/compat smoke runs after publication but is claimed pre-tag; the release note groups
- Installed consumer resolves source/main/global binary; cold install needs a build allowlist; a
- Tag moved after publication; v0.4.5 history rewritten; a product bug fixed inline in the release

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"docs/releases/v0.4.6.md"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"built-audit","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"released-artifacts","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Observe the real exact-SHA hosted CI result before tag creation, annotated tag peel, fresh empty-store actual-tag install, package version/bin aliases/portable assets, and representative downstream flow. Local quality PASS is not hosted CI proof. Record bounded references to the immutable released SHA and observed outcomes.","evidence":"bounded observed result and artifact reference"}`
- `{"id":"post-release-tag-validation","type":"manual","required":true,"environment":"local","profile":"report","instruction":"After publication, install the actual v0.4.6 tag in a fresh temp consumer with a fresh pnpm store, prove resolved version 0.4.6 and all bin aliases, confirm the five packaged skill assets including readable apk-project-grill/apk-task-grill plus the 0141/0142/0143 behavior, then run released-consumer doctor/lint/audit and adopt --preview. Record in docs/delivery/workflow-v0.4.6-self-dogfood.md on main, separate from the tagged release notes.","evidence":"bounded observed result and artifact reference"}`

## Documentation updates

- README.md
- docs/releases/v0.4.6.md
- docs/delivery/workflow-v0.4.6-self-dogfood.md
- docs/progress.md

## Notes

- Backlog/release task only: no source, feature, refactor, dependency, or inline product fix during
- Intentionally small patch release; do not absorb unrelated roadmap work.
- `v0.4.6` must be free before any edit; never move, delete, or force-update a tag.
- Parallel false: release preparation, dist, and tag operations share the working tree and must not
- The v0.4.5 wording lesson is honored: pre-tag CI, tag-publication identity, and post-tag
