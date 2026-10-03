# Task 0138 - Correct release evidence ordering in release task template and release docs

State: done
Owner: code-owner-0138
Mode: maintenance
Lane: task-authoring
Type: feature
Scope: release-evidence,release-template,docs,tests
Risk: medium
Parallel: true
Depends on: 0121,0128
Tags: feature,templates,docs

## Goal

Encode a reusable pre-tag/post-tag release-evidence ordering contract so a future release cannot repeat the v0.4.4/0133 defect, where pre-tag downstream/legacy smoke was actually executed after tag publication, the tagged release-note file carried a placeholder Validation section, and post-tag facts risked being presented as pre-tag.

Core invariant: everything a release claims as PRE-TAG evidence must really happen against the exact candidate SHA before tag publication. Post-tag checks are a distinct class: actual immutable-tag cold install, tag-peel verification, released package/bin identity, downstream install from the tag, and post-release self-adoption. A release-note file committed inside the tag must contain only facts knowable before tagging, must never fabricate a future tag/CI/install identity, and must never be backfilled on `main` with post-tag evidence that did not exist in that tag. A published tag is immutable and is never moved or rewritten.

Apply the fix in the canonical owners, not a new document: (1) the `release` typed template in `src/core/templates/task-templates.ts` (its default steps, acceptance criteria, correctness assumptions, invariants, required evidence, review questions, counterexample searches, and notes); (2) the "Frozen release validation" guidance in `docs/engineering/testing-strategy.md`; (3) a deterministic regression test in `src/core/tasks/task.test.ts`; and (4) a short ADR in `docs/decisions.md`. Keep this a small corrective: no release is performed, no tag is touched, and the existing `release` template's declarative nature and user overrides are preserved.

Do not: move or rewrite `v0.4.4`; force-complete blocked Task 0133; launder historical evidence; or turn the `release` template into an automated release runtime. This is declarative task guidance and canonical release documentation only.

## Context files

- AGENTS.md
- docs/project.md
- docs/architecture.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/releases/v0.4.4.md
- docs/delivery/workflow-v0.4.4-self-dogfood.md
- docs/decisions.md
- src/core/templates/task-templates.ts
- src/core/tasks/task.test.ts
- .tasks/0133-release-v044-and-adopt-released-workflow-rules-in-apk-itself.md
- .tasks/0128-add-repro-first-guidance-to-bugfix-task-contracts.md

## Files allowed to edit

- src/core/templates/task-templates.ts
- src/core/tasks/task.test.ts
- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .agentic/**
- .tasks/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- src/cli/**
- src/core/tasks/index.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/evidence.ts
- src/core/tasks/review.ts
- src/core/work/**
- src/core/resources/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/exporters/**
- src/core/templates/skills/**

## Steps

1. Compare the current `release` template guidance and canonical release docs against the v0.4.4/0133 defect; identify the exact wording whose ambiguity let post-tag smoke appear pre-tag and let tagged release notes carry placeholder validation.
2. Rewrite the `release` template defaults to order: resolve the free next SemVer target and confirm existing tags are immutable; freeze the exact candidate SHA/tree; observe every declared PRE-TAG criterion against that exact SHA including exact-SHA hosted CI; create an annotated tag pointing to the validated SHA and verify the peel; then run distinct POST-TAG checks and record them in a separate post-release artifact.
3. State explicitly that a tagged release-note file contains only pre-tag-knowable facts, that post-tag evidence is never backfilled into it, that a published tag is never moved, and that a changed candidate requires a new freeze/rerun/CI.
4. Add focused deterministic template tests asserting pre-tag-before-tag ordering, pre/post separation, tag immutability, and no fabricated future identity; preserve template overrides and other typed defaults.
5. Update the "Frozen release validation" canonical guidance and add a short ADR; commit the delta, build dist normally, run verification, and finish the normal task policy workflow.

## Acceptance criteria

- The `release` template guidance requires all PRE-TAG evidence to be observed against the exact frozen candidate SHA before tag creation, including exact-SHA hosted CI.
- The guidance defines POST-TAG checks as a distinct class (actual-tag cold install, tag peel, released package/bin identity, downstream install, post-release self-adoption) recorded separately.
- The guidance states that a release-note file committed inside the tag contains only pre-tag-knowable facts, that post-tag evidence is never backfilled into the tagged file, and that a published tag is never moved or rewritten.
- The guidance states that a changed candidate invalidates the freeze and forces a new baseline plus affected verification and CI.
- Canonical release documentation (`docs/engineering/testing-strategy.md`, `docs/delivery/gated-workflow-release-evidence.md`) agrees with the template and does not introduce a second release process.
- Deterministic tests assert the ordering/separation/immutability contract, and existing template behavior, aliases, overrides, and other typed defaults remain compatible.
- No runtime release automation, new command, tag mutation, or historical-history change is introduced.

## Correctness assumptions

- Declarative `release` template fields reach task contracts and prompts without new enforcement code.
- Some release checks are intrinsically post-publication and must be recorded as post-tag.
- A release-note file inside a tag cannot contain its own commit SHA or the later tag/CI/install identity.

## Invariants

- Pre-tag and post-tag evidence are temporally distinct and never conflated.
- A published tag is immutable; the tagged artifact and recorded evidence refer to the same candidate tree.
- Tagged release notes contain only facts knowable before tagging.

## Required evidence

- Generated `release` contract test output showing pre-tag-before-tag ordering, distinct post-tag checks, tag-immutability, and no fabricated future identity.
- Updated canonical release documentation consistent with the template, and confirmation that no tag or historical evidence changed.

## Review questions

- Did every criterion the guidance calls pre-tag actually run against the exact candidate SHA before tag creation?
- Is post-tag evidence kept separate and never presented as pre-tag?
- Was the published tag left unmoved and the change kept declarative/doc-only?

## Counterexample searches

- Downstream/compat smoke executed post-publication but claimed pre-tag; placeholder validation inside the tagged notes; tag moved; post-tag install facts written into the immutable tagged file.
- A new release-process document that duplicates the existing canonical owners; automated release runtime added.
- Historical `v0.4.4`/0133 evidence rewritten to look cleaner.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog creation only in this planning pass: no implementation, claim, tag operation, or release.
- This is an independent prerequisite of the v0.4.5 release task, not a dependency on blocked 0133; do not force-complete 0133.
- Keep the `release` template compact; no runtime, schema, gate, or command change; no second release-process doc.
- Parallel denotes semantic independence; shared docs/dist require coordinated integration, never concurrent mutable tasks in one worktree.
