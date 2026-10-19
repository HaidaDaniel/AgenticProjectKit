# Task 0225 - Release v0.5.1 workflow correctness fixes

State: done
Owner: codex-release-v051
Mode: production
Lane: release
Type: release
Scope: release,packaging,verification
Risk: high
Parallel: false
Depends on: 0217,0219,0220,0222,0224
Tags: release

## Goal

Publish immutable v0.5.1 from the integrated verified main with exact-candidate local and hosted checks, package smoke, and separate actual-tag validation.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/releases/index.md
- docs/releases/v0.5.0.md
- docs/product/maturity-and-compatibility.md
- package.json
- pnpm-lock.yaml
- .github/workflows/quality.yml
- .tasks/0224-finish-audited-task-amendment-epochs-with-bounded-legacy-reader.md

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- dist/**
- docs/releases/v0.5.1.md
- docs/releases/index.md
- docs/progress.md

## Files forbidden to edit

- src/**
- scripts/**
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/v0.5.0.md

## Steps

1. Resolve the free next SemVer target and confirm existing tags are immutable; never move or rewrite a published tag.
2. Freeze the exact candidate SHA/tree and observe every declared PRE-TAG criterion against that exact SHA, including local quality/coverage/build/release checks, committed dist currency, package/bin/asset payload, declared compatibility or downstream smoke, and exact-SHA hosted CI.
3. Create the annotated tag only after all PRE-TAG criteria pass, pointing to the validated candidate SHA, and verify the peeled commit equals that SHA.
4. Run POST-TAG checks separately: actual immutable-tag cold install, tag-peel verification, released package/bin identity, downstream install from the tag, and post-release self-adoption.
5. Record post-tag evidence in a post-release artifact, never backfilled into the release-note file committed inside the tag, and do not mutate the candidate or tag after evidence is captured.

## Acceptance criteria

- The next SemVer target is free and all existing tags remain untouched.
- Every criterion claimed as PRE-TAG evidence actually ran against the exact frozen candidate SHA before tag creation, including exact-SHA hosted CI.
- The annotated tag peels to the validated candidate SHA and is never moved or rewritten afterward.
- POST-TAG evidence (actual-tag cold install, tag peel, released package/bin identity, downstream install, self-adoption) is recorded separately after publication.
- The release-note file committed inside the tag contains only pre-tag-knowable facts and is never backfilled with post-tag identity or results.
- No candidate mutation occurs after final evidence; a changed candidate forces a new freeze, rerun, and CI.

## Correctness assumptions

- Release evidence must identify the exact immutable candidate SHA/tree.
- Some release checks can only execute after publication and must be recorded as post-tag evidence.
- A release-note file committed inside the tag cannot contain its own commit SHA or the later tag/CI/install identity.

## Invariants

- Pre-tag and post-tag evidence are temporally distinct and never conflated.
- A published tag is immutable; the tagged artifact and recorded evidence refer to the same candidate tree.
- Tagged release notes contain only facts knowable before tagging.

## Required evidence

- Pre-tag criteria observed against the frozen candidate SHA, exact-SHA hosted CI, annotated tag peel to that SHA, and a distinct post-tag cold-install/released-consumer record.

## Review questions

- Did every criterion claimed as pre-tag actually run against the exact candidate SHA before tag publication?
- Is post-tag evidence kept separate and never presented as pre-tag?
- Was the published tag left unmoved and the tagged release notes kept free of fabricated future facts?

## Counterexample searches

- Search a release whose downstream or compatibility smoke ran after publication but was claimed pre-tag, a placeholder validation inside the tagged notes, a moved tag, and post-tag install facts written into the immutable tagged file.
- Search a changed candidate that reuses earlier freeze/CI evidence, a tag created on HEAD without an exact-SHA CI pass, and a missing or stale committed dist/asset.

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"package-payload","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Before tagging inspect packed package version 0.5.1, bin aliases, dist and portable assets; install the packed candidate and run CLI smoke."}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Before tagging observe GitHub Actions Quality success for the exact frozen commit SHA; local results cannot substitute."}`
- `{"id":"tag-install","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"After publishing the immutable annotated v0.5.1 tag verify peel, cold install with a fresh store, version 0.5.1, all CLI aliases, representative init/lint/sync and unchanged v0.5.0."}`

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Task 0223 remains todo after this patch release; it is a substantial opt-in parity feature and no release policy makes it mandatory.
- Do not merge old Task 0221 or emergency branches; use integrated main only.
- Record post-tag facts separately; promote stable documentation in a subsequent bounded docs task after release completion.
