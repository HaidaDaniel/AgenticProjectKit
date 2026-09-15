# Task 0139 - Release v0.4.5 with project-level grill

State: doing
Owner: code-owner-0139
Mode: production
Lane: release
Type: release
Scope: release,versioning,packaging,skills,docs
Risk: high
Parallel: false
Depends on: 0137,0138
Tags: release,dogfood

## Goal

Publish a small stable patch release, `v0.4.5`, whose primary user-visible addition is the optional, manually invoked `apk-project-grill` skill, and whose release evidence obeys a strict pre-tag/post-tag ordering contract so it never repeats the v0.4.4/0133 defect. This release intentionally does not pull unrelated roadmap features.

### Version and scope

Recheck real local and origin SemVer/tag history at execution. Target `v0.4.5`; it must be free. If it is already taken or version rules changed, stop and update this task's release/evidence paths before any edit; never move or rewrite an existing tag. Existing `v0.4.4` (and all earlier tags) must remain untouched.

In scope:

- the completed Task 0137 `apk-project-grill` optional manual asset and its packaging/tests/docs;
- the completed Task 0138 release-evidence ordering correction (declarative only);
- strictly necessary packaging, generated-instruction, committed `dist`, README and release-note updates;
- one representative disposable downstream pre-tag smoke, because APK supports non-Node application stacks (prefer a Go or Python app with the Node tooling layer).

Out of scope: any other feature, refactor, dependency upgrade, non-Node distribution model, upgrade engine, or unrelated corrective. Blocked historical tasks (0133, 0120) are not force-completed, rewound, or laundered; any operator decision they need is surfaced separately and is not a release dependency.

### Pre-tag / post-tag evidence ordering

- Everything claimed as PRE-TAG evidence must actually run against the exact frozen candidate SHA/tree before tag creation: `pnpm quality`, `pnpm test:coverage`, `pnpm build`, `pnpm release:check`, `git diff --check`, committed-`dist` currency, package/bin/portable-asset payload inspection, canonical `lint`/`sync`/`doctor`/`audit`, the declared downstream compatibility smoke, and real exact-SHA hosted CI.
- Only after all required pre-tag criteria pass may the annotated tag be created, pointing to the exact validated candidate SHA. Verify the peel equals that SHA.
- POST-TAG checks are a distinct class: actual immutable-tag cold install with a fresh store, tag-peel verification, released package/bin identity, install from the tag, and post-release self-adoption. They are recorded in `docs/delivery/workflow-v0.4.5-self-dogfood.md` on `main` after publication.
- The release-note file `docs/releases/v0.4.5.md` committed inside the tag contains only facts knowable before tagging. It must not fabricate its own commit SHA, the later tag object, the hosted CI run identity, or cold-install results, and it must not be backfilled later with post-tag facts as if they were pre-tag. A release-note file cannot contain its own commit SHA; record the candidate/tag/CI identities in the post-release artifact instead.
- If hosted CI for the exact candidate fails, do not tag; fix through a separate bounded correction, produce a new candidate SHA, and rerun all freshness-sensitive checks.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- README.md
- SPEC.md
- docs/progress.md
- docs/cli-commands.md
- docs/agent-exporters.md
- docs/engineering/testing-strategy.md
- docs/engineering/template-system.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/releases/v0.4.4.md
- .github/workflows/quality.yml
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .gitignore
- scripts/copy-template-assets.mjs
- src/cli/index.ts
- src/core/config/compatibility.ts
- src/core/docs/adopt.ts
- src/core/sync/index.ts
- .tasks/0137-add-optional-project-level-grill-skill.md
- .tasks/0138-correct-release-evidence-ordering-in-release-task-template-and-release-docs.md
- .tasks/0133-release-v044-and-adopt-released-workflow-rules-in-apk-itself.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- README.md
- docs/releases/v0.4.5.md
- docs/delivery/workflow-v0.4.5-self-dogfood.md
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

## Files forbidden to edit

- src/**
- scripts/**
- .github/**
- .tasks/**
- SPEC.md
- docs/decisions.md
- .codex/**
- .opencode/**
- .cursor/**

## Steps

1. Confirm 0137 and 0138 are `done`; recheck local/origin tags and that `v0.4.5` is free. Confirm the release ordering contract from 0138 and the pre-tag criteria below.
2. Bump `package.json` version to `0.4.5` with the canonical version primitive (`pnpm version patch --no-git-tag-version`) and confirm `pnpm-lock.yaml` agrees. Write `docs/releases/v0.4.5.md` with scope, feature list, compatibility, and installation, containing only pre-tag-knowable facts and explicitly noting that exact-SHA CI/tag/cold-install identities are recorded post-publication.
3. Update README optional-skills/current-release sections for `apk-project-grill` and the five processed skills; regenerate committed `dist` and generated instructions through the normal build/sync. Do not edit source.
4. Freeze a clean exact candidate SHA/tree. Run the full pre-tag local set and a disposable downstream Go/Python + Node smoke from the exact candidate, then inspect the package payload for the five portable skill assets and working bin aliases.
5. Push the exact candidate SHA to `main` and observe real exact-SHA hosted CI. Record candidate SHA/tree and the CI run id/URL/conclusion. Do not tag on local success alone.
6. Only after all pre-tag criteria pass, create annotated tag `v0.4.5` pointing to the exact validated candidate SHA and verify `git rev-parse v0.4.5^{commit}` equals it. Never tag HEAD merely because it is current.
7. POST-TAG: in a fresh temp consumer with a fresh pnpm store, install `git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.5`, prove the resolved version `0.4.5`, executable/tag identity, all bin aliases, and the five packaged skill assets including a readable `apk-project-grill`; run released-consumer `apk --help`, `doctor`, `lint --json`, `sync`.
8. Record the post-tag results in `docs/delivery/workflow-v0.4.5-self-dogfood.md` on `main`; optionally self-dogfood the released CLI without modifying out-of-scope files. Commit only task-owned changes and report all SHAs; keep the candidate commit unamended.

## Acceptance criteria

- Real tag history is rechecked; `v0.4.5` was free before publication; existing tags including `v0.4.4` are untouched.
- The exact frozen candidate SHA/tree contains package version `0.4.5`, lock agreement, the `apk-project-grill` source and built/copied dist asset, finalized pre-tag-only release notes, current README install examples, and current generated instructions.
- All pre-tag local checks pass against that exact candidate: `pnpm quality`, `pnpm test:coverage`, `pnpm build`, `pnpm release:check`, `git diff --check`, committed-`dist` currency, built `lint`/`sync`/`doctor`/`audit`, package payload and bin aliases, and the representative disposable downstream smoke.
- Real exact-SHA hosted CI for the frozen candidate concluded `success` before tag creation; local success is not substituted.
- The annotated tag peels to the exact validated candidate SHA and is never moved afterward.
- A fresh-store cold install from the actual tag needs no build-script allowlist, resolves `agentic-project-kit@0.4.5`, starts all bin aliases, and contains the five expected portable skill assets including `apk-project-grill`.
- `apk-project-grill` is documented as optional/manual/portable with explicit approval before durable writes; existing `apk-task-grill` semantics are unchanged and no skill becomes a mandatory lifecycle step.
- Pre-tag and post-tag evidence are temporally distinct: no post-tag fact is written into the immutable tagged release notes, and no pre-tag claim is actually executed after publication.
- No tag was moved, no blocked historical task was force-completed, and no baseline/evidence/human-approval laundering occurred.

## Correctness assumptions

- `v0.4.5` is free at execution time; otherwise stop and adjust.
- A separate installed-tag consumer can prove released behavior without installing APK into itself.
- The committed `dist/` and generated instructions can be produced from current source by the normal build/sync.
- Some release checks are intrinsically post-publication and belong only in the post-release artifact.

## Invariants

- Tag only after all required pre-tag criteria pass against the exact candidate; never move/rewrite a published tag.
- Pre-tag and post-tag evidence never conflate; tagged release notes contain only pre-tag-knowable facts.
- No source, unrelated feature, or blocked historical task is modified; manual skills stay optional and non-gating.
- Preserve unrelated and pre-existing dirty state; report candidate and bookkeeping SHAs exactly.

## Required evidence

- `docs/releases/v0.4.5.md` with pre-tag scope/features/compatibility/install and an honest statement that exact-SHA CI, tag, and cold-install identities are recorded post-publication.
- `docs/delivery/workflow-v0.4.5-self-dogfood.md` on `main` with the frozen candidate SHA/tree, exact-SHA hosted CI run, annotated tag object and peeled SHA, fresh-store cold-install result, installed bin aliases, and the five packaged skill assets.
- Current final-candidate verification/review/gate and reported candidate/bookkeeping commit SHAs.

## Review questions

- Was the tag derived from actual release history and created only after exact-candidate pre-tag criteria including hosted CI?
- Does the tagged release-note file avoid fabricated future facts, and is post-tag evidence kept separate?
- Is `apk-project-grill` optional/manual/portable with existing task-grill semantics unchanged, without a new command or mandatory step?
- Were `v0.4.4` and blocked historical tasks left intact?

## Counterexample searches

- `v0.4.5` already exists or the tag points to a different SHA; warm cache hides a missing dist/asset/bin.
- Downstream/compat smoke runs after publication but is claimed pre-tag; placeholder or future CI/tag identities written into the tagged notes.
- Installed consumer resolves source/main/global binary; cold install needs a build allowlist; a packaged skill is missing.
- Tag moved after publication; blocked 0133/0120 force-completed or evidence laundered.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"docs/releases/v0.4.5.md"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-audit","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"released-artifacts","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Observe the real exact-SHA hosted CI result, annotated tag peel, fresh empty-store actual-tag install, package version/bin aliases/portable assets, and representative downstream flow. Local quality PASS is not hosted CI proof. Record bounded references to the immutable released SHA and observed outcomes.","evidence":"bounded observed result and artifact reference"}`
- `{"id":"post-release-tag-validation","type":"manual","required":true,"environment":"local","profile":"report","instruction":"After publication, install the actual v0.4.5 tag in a fresh temp consumer with a fresh pnpm store, prove resolved version 0.4.5, all bin aliases, and the five packaged skill assets including a readable apk-project-grill, then run released-consumer doctor/lint/sync. Record in docs/delivery/workflow-v0.4.5-self-dogfood.md on main, separate from the tagged release notes.","evidence":"bounded observed result and artifact reference"}`

## Documentation updates

- README.md
- docs/releases/v0.4.5.md
- docs/delivery/workflow-v0.4.5-self-dogfood.md
- docs/progress.md

## Notes

- Backlog creation only: no implementation, claim, package change, release, or skill invocation during this planning pass.
- Intentionally small release; do not absorb unrelated roadmap work. Blocked 0133/0120 stay blocked; an operator decision for 0133 is surfaced separately and is not a release dependency.
- Milestone boundary: portable skills supply reasoning; APK core supplies deterministic lifecycle/scope/evidence/enforcement; external agents/harnesses execute. No LLM/provider runtime, chat engine, second workflow state machine, hidden planner, or generic Handoff.
- Keep instructions compact and do not inflate always-loaded AGENTS.md. Existing primitives stay canonical; no new schema, command, or mandatory skill registry.
- Parallel false: release preparation, dist, and tag operations share the working tree and must not run concurrently with other mutable tasks.
- Original v0.4.4 evidence ordering defect (0133) is not repeated: pre-tag criteria run before the tag, and post-tag facts are recorded only in the post-release artifact.
