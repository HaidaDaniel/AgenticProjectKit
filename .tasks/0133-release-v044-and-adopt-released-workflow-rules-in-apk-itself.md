# Task 0133 - Release v0.4.4 and adopt released workflow rules in APK itself

State: todo
Owner: none
Mode: production
Lane: release
Type: release
Scope: release,versioning,packaging,skills,self-adoption,dogfood,docs
Risk: high
Parallel: false
Depends on: 0118,0123,0127,0134,0135,0136,0128,0129,0130,0131,0132
Tags: release,dogfood

## Goal

Finish the lightweight workflow milestone in two ordered phases: (1) validate and publish the next stable tag; (2) migrate/adopt AgenticProjectKit itself as a consumer of that released behavior and produce bounded self-dogfood proof. Source-tree availability alone is not completion.

### Version and scope

Planning on 2026-09-14 verified local and origin tags: latest stable v0.4.3 peels to 0d56d074e01163a5b184fb247a254e4ee719a625; v0.4.4 is free. Target v0.4.4. Recheck real SemVer/tag history at execution; if the target is taken or version rules changed, update the task title/goal/exact release/evidence paths before edits. Never move/rewrite an existing tag.

Include existing 0123 manual task-grill, completed 0127 optional manual milestone semantic audit, completed 0134 generated normal-default artifacts, and 0128-0132 repro-first, manual task-split, one-review/two-axis presentation, advisory context hygiene and P2 prototype. The normal-default/explicit-caveman behavior originally tracked by canceled 0124 is validated and superseded by completed 0136 (canceled 0124 is not a dependency). Corrective 0135 (canonical Git ignore semantics for Go test discovery) is included for release safety. Their independent correctness/review/gates precede release. Non-Node distribution research 0125 and agent-driven upgrade research 0126 remain outside this release. 0127 is included as a completed, optional/manual-only, non-gating shipped asset. No Wayfinder, generic Handoff, mandatory grill/spec/tickets lifecycle or orchestration framework.

### Phase 1 - Released artifact

Prepare version/lock/README/release docs and current committed dist through existing commands. Freeze a clean release candidate SHA/tree. Full deterministic quality/coverage/build/release checks, exact-SHA hosted CI, package/bin payload and cold installability, canonical generated instructions, legacy-task compatibility and at least one representative disposable downstream flow must pass before annotated tag publication. Check all included portable assets, including the packaged `apk-task-grill` and `apk-milestone-semantic-audit` `.hbs` assets, and confirm skills remain optional and non-gating. Reuse 0105/0110/0118 evidence discipline; local command success is never hosted CI proof. A candidate install may establish pre-tag package feasibility; after publication also cold-install from the actual immutable tag in an empty consumer directory with a fresh pnpm store and no build-script allowlist.

### Phase 2 - Actual self-adoption after release

Inspect canonical self-development architecture: the root package builds its own dist and cannot safely add itself as a dependency. Prefer the already documented explicit Node entrypoint from a separate temporary consumer installation of the released tag. Resolve its installed package/CLI/asset paths and package version/tag SHA, then invoke that released entrypoint with the AgenticProjectKit repository as cwd. This is a proof harness for existing distribution, not a new installation model or upgrade engine.

Run a human-visible bounded adoption/sync plan using actual released help/interfaces: adopt --preview, applicable adopt --apply, sync check and explicitly intended sync --write, export --report-legacy (only proven/authorized cleanup if needed), audit, lint --json and doctor. Audit writes generated reports; respect their canonical ownership/ignore rules. Preserve custom policy, unknown config keys, authored preferences, historical task/evidence/provenance and unrelated dirty state. Root AGENTS/adapters/config may change only through canonical generation/applicable adoption. Record a no-op when already current; absence of a diff does not excuse skipping the released-consumer pass.

Verify root generated policy/config/manual skill discovery matches the released tag: concise normal default, optional grill/split/prototype, one-review/two-axis guidance, repro-first bugfix defaults, advisory hygiene visibility, no obsolete duplicated full policy, current generated exports and passing expected doctor/audit diagnostics. Do not hack a recursive dependency, install a provider runtime or silently upgrade downstream projects.

After root adoption, use one small safe task in an isolated worktree/disposable clone of the migrated APK repository with the same released CLI. Prove task create -> bounded context -> work -> canonical verify -> one prepared two-axis review by a separate registered identity -> gate -> done, plus commit/bookkeeping discipline and provenance. Ordinary task work must not require an optional skill; manually explore at most one optional skill path if useful, without artificially exercising every skill. This fixture must identify its relationship to the adopted root/tag; a generic brownfield smoke alone is not root self-adoption proof.

### Two-phase evidence and recovery

Release evidence identifies the immutable tag/release SHA/tree. Post-release adoption/dogfood evidence identifies the later root/fixture candidate and released executable identity. If tracked phase-2 changes supersede the task candidate, preserve phase-1 records as historical, never relabel/transplant them into current PASS, and run/record current check-specific verification referencing observed immutable release facts honestly. The final independent review/gate covers the final task candidate and both phase results; do not require task done before a tag-dependent check can run. Phase-1 success alone cannot complete this task.

If tag publication, actual-tag install or self-adoption fails, retain the validated/tagged history and an explicit resume/recovery path; do not move the tag, force-done, reset baselines, fabricate approval/evidence or call the milestone fully adopted. Any new release-safety source fix gets a separately bounded corrective contract/dependency and fresh candidate validation; this release task is not a catch-all implementation container.

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
- docs/adoption-flow.md
- docs/engineering/testing-strategy.md
- docs/engineering/template-system.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/releases/v0.4.2.md
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
- .tasks/0105-prepare-v040-dogfood-release.md
- .tasks/0110-make-git-tag-distribution-self-contained-and-prepare-v042.md
- .tasks/0118-release-v043-corrective-dogfood-fixes.md
- .tasks/0123-add-optional-manually-invoked-apk-task-grill-skill.md
- .tasks/0127-add-optional-manually-invoked-milestone-semantic-integrity-audit.md
- .tasks/0134-regenerate-agentsmd-and-committed-dist-for-the-normal-default-style.md
- .tasks/0135-make-go-test-discovery-honor-canonical-git-ignore-semantics.md
- .tasks/0136-validate-and-supersede-canceled-0124-normal-default-behavior.md
- .tasks/0124-make-caveman-explicitly-user-opt-in-instead-of-an-automatic-default.md
- .tasks/0128-add-repro-first-guidance-to-bugfix-task-contracts.md
- .tasks/0129-add-optional-tracer-bullet-task-decomposition-skill.md
- .tasks/0130-present-spec-correctness-and-engineering-quality-in-one-task-review.md
- .tasks/0131-add-advisory-agent-context-hygiene-estimates-to-apk-lint.md
- .tasks/0132-add-optional-bounded-throwaway-prototype-skill.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- README.md
- docs/releases/v0.4.4.md
- docs/delivery/workflow-v0.4.4-self-dogfood.md
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

1. Confirm all included feature/default-style tasks and mandatory safety corrections are done; recheck local/origin SemVer tags and exact target paths. Inspect self-development/package invocation and define the separate released-consumer entrypoint without a recursive dependency.
2. Phase 1: bump version with existing version/release primitives, write bounded release notes/README, generate and commit dist, inspect package/bin and skill payload and freeze a clean candidate SHA/tree. Preserve pre-existing/foreign changes.
3. Run full deterministic quality/coverage/release checks, current built exports, legacy task compatibility and candidate-package/downstream smoke. Observe real exact-SHA hosted CI. Publish the annotated next tag only after these criteria pass, then prove a fresh-store actual-tag install and executable/assets.
4. Phase 2: from the separate actual-tag consumer installation run released help and preview against the real APK root; apply only applicable canonical adoption/sync and proven approved cleanup, then audit/lint/doctor. Inspect generated/config delta and preserve root customization/preferences/history.
5. Verify root policy/assets/discovery/defaults reflect the released version and all skills remain manual/optional. Record executed consumer identity and no-op steps honestly in bounded self-adoption evidence.
6. Run one safe representative task in an isolated clone/worktree of adopted APK with the released CLI: creation/context/work/verify/one two-axis independent review/gate/done and candidate/bookkeeping commits. Optional manual skill evidence is limited to one useful path.
7. Commit only task-owned adoption/report changes; preserve phase-1 evidence identities, refresh final-candidate check-specific evidence and obtain the existing required independent review. Gate/done only after both phases pass; commit tracked completion bookkeeping separately when needed and report all SHAs.

## Acceptance criteria

- Real tag history is rechecked; package/version/lock/release notes agree on the free next stable target, currently v0.4.4. Existing tags remain untouched.
- Phase-1 frozen SHA/tree has full quality/coverage/release success, current committed dist, canonical instructions, compatible legacy tasks, actual hosted CI success for that SHA, package/bin/portable-asset checks and representative downstream smoke before tag creation.
- Published annotated tag peels to the validated SHA; fresh-store actual-tag install starts all declared bin aliases, resolves the expected package version/assets and needs no install-time build allowlist.
- After publication, an executable/package proven to come from the actual tag runs the real APK-root canonical adoption/sync/audit/lint/doctor pass. A source-tree test or unrelated consumer smoke cannot substitute for this ordered self-adoption phase.
- Self-consumption uses current documented explicit-entrypoint/package mechanisms without adding APK as its own dependency, a new installer/upgrade engine, runtime or provider integration.
- Root generated AGENTS/config/adapters and documented asset discovery match released defaults/rules; no obsolete automatic caveman default or duplicated full common policy, generated drift, mandatory skill step, mandatory two-provider review or hard hygiene-size gate.
- Root customization/preferences/unknown keys, historical task/evidence/provenance and unrelated dirty work survive. Generated changes use canonical ownership; cleanup never deletes customized legacy content or silently mutates the index.
- Bounded post-adoption APK task proof covers create/context/work/verify/one explicit two-axis review/gate/done with reviewer identity, immutable candidate and commit/provenance evidence. Normal work runs without grill/split/prototype; at most one optional skill path is explored.
- Immutable release and later adoption/fixture identities are distinct in evidence. Phase-2 candidate changes retain old records as history and require current final-candidate checks/review; no stale PASS transplantation or tag movement.
- Both phases, final required review/gate and safe commit/bookkeeping handoff pass before completion; partial publish/install/adoption failure leaves explicit recovery/resume state and is not reported as a completed migration.

## Correctness assumptions

- Latest stable local/origin tag is v0.4.3 at planning, but execution must revalidate availability.
- A separate installed-tag explicit CLI entrypoint can operate with APK root cwd without dependency recursion.
- Root may already have current generated rules; executed post-release no-op adoption still needs artifact identity proof.
- Release and self-adoption occur at different candidates; old evidence must remain historical when final candidate changes.

## Invariants

- Tag only after release criteria; no rewrite of published tags or successful historical evidence.
- Release -> actual released-consumer root adoption -> bounded self-dogfood -> final review/gate; phase 1 alone is incomplete.
- Manual skills and advisory hygiene do not become lifecycle gates; one canonical policy/review/control plane.
- Preserve customization/history/unrelated changes and report committed candidate/bookkeeping identities; no auto-commit/force/recursive install.

## Required evidence

- docs/releases/v0.4.4.md with frozen SHA/tree, exact-SHA hosted CI, tag peel, package/bin/assets (including the packaged `apk-task-grill` and `apk-milestone-semantic-audit` `.hbs` assets), compatibility and cold-install/downstream results.
- docs/delivery/workflow-v0.4.4-self-dogfood.md with actual-tag consumer identity, real root post-release commands/diff, migrated root/fixture provenance and bounded workflow outcomes.
- Current final-candidate verification/review/gate and reported release/adoption/completion commit SHAs; preserve separate immutable phase identities.

## Review questions

- Was the tag derived from actual release history and created after exact-candidate quality/CI criteria?
- Did the real APK root consume actual released behavior after publication, rather than merely test its source?
- Are optional/manual/default/one-review/advisory behaviors verified without another framework or recursive installation?
- Are phase identities/evidence/recovery and final commit scope honest under candidate changes?

## Counterexample searches

- v0.4.4 appeared after planning; tag points to a different CI SHA; warm cache hides missing dist/asset/bin.
- Installed consumer resolves source/main/global binary; root adds itself as dependency; root migration was skipped because sync looked current.
- Duplicate/default policy remains, prototype/split auto-triggers, engineering axis requires a second provider, or context size becomes a gate.
- Phase-2 tracked changes make phase-1 evidence stale; stale PASS is reused, published tag moved, adoption failure masked or unrelated product code repaired.
- Generic downstream fixture is presented as self-adoption; doing-task baseline is reset to absorb tooling migration.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"docs/releases/v0.4.4.md"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node --input-type=module -e \"import { execFileSync } from 'node:child_process'; if(execFileSync('git',['status','--porcelain','--untracked-files=all','--','dist'],{encoding:'utf8'}).trim()) throw new Error('Committed dist differs from current build');\""}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-audit","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"released-artifacts","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Observe the real exact-SHA hosted CI result, annotated tag peel, fresh empty-store actual-tag install, package version/bin aliases/portable assets and representative downstream flow. Local quality PASS is not hosted CI proof. Record bounded references to the immutable released SHA and observed outcomes.","evidence":"bounded observed result and artifact reference"}`
- `{"id":"post-release-root-adoption","type":"manual","required":true,"environment":"local","profile":"report","instruction":"After tag publication execute the actual released consumer entrypoint with APK root cwd: help, adopt preview/apply when applicable, canonical sync, legacy report, audit/lint/doctor. Inspect root generated/default/manual discovery and customization preservation; identify released artifact and adopted root candidate explicitly.","evidence":"bounded observed result and artifact reference"}`
- `{"id":"post-adoption-self-dogfood","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Observe one safe task in an isolated clone/worktree of the adopted APK root using the actual released CLI: create/context/work/verify/one prepared two-axis separate-identity review/gate/done, ordinary no-skill path and safe candidate/bookkeeping commits. At most one optional skill scenario. Record root/tag/fixture identities and bounded evidence.","evidence":"bounded observed result and artifact reference"}`

## Documentation updates

- README.md
- docs/releases/v0.4.4.md
- docs/delivery/workflow-v0.4.4-self-dogfood.md
- docs/progress.md

## Notes

- Backlog creation only: no implementation, claim, package change, release, or skill invocation during this planning pass.
- Milestone boundary: portable skills supply reasoning; APK core supplies deterministic lifecycle/scope/evidence/enforcement; external agents/harnesses execute. No LLM/provider runtime, chat engine, second workflow state machine, hidden planner, workflow DSL, Wayfinder, or generic Handoff.
- Keep instructions compact for local/small models and do not inflate always-loaded AGENTS.md. Existing correctness/Notes/evidence/context/template primitives stay canonical; no new schema, command, state, or mandatory skill registry without a separately justified contract.
- Parallel denotes semantic independence; shared tests/docs/dist require separate worktrees and coordinated integration, never concurrent mutable tasks in one worktree.
- Last task of the milestone. Existing 0123 is a reused completed dependency; canceled 0124 is not a dependency and its already-landed behavior is validated/superseded by completed 0136; 0127 is an included completed optional/manual asset; 0134 and corrective 0135 are completed release-safety prerequisites; research 0125/0126 stay out of scope.
- Final verification commands apply after both phases. Pre-tag criteria can execute directly and be retained in immutable release evidence without claiming the whole task gate/done has passed before tag-dependent checks exist.
- dist/config/AGENTS/adapters/gitignore edits are limited to normal build/version/canonical adoption/generation; no source feature fixes or custom policy deletion. New safety issues need a separate bounded correction and fresh validation.
- Use actual released help; APK has no --version CLI at planning. Detect installed version from package metadata and prove executable/tag ownership rather than inventing syntax. If target advances, update exact release/evidence paths before implementation.
