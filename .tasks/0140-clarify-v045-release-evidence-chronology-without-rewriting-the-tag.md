# Task 0140 - Clarify v0.4.5 release-evidence chronology without rewriting the tag

State: todo
Owner: none
Mode: maintenance
Lane: docs
Type: docs
Scope: release-evidence,docs,history
Risk: low
Parallel: true
Depends on: none
Tags: docs,release-evidence

## Goal

Record, on current `main`, the exact temporal chronology of the v0.4.5 release evidence so the historical record is unambiguous. The exact-SHA hosted CI (Quality run `34980158536`) completed successfully against the frozen candidate `f574ef252342185bc623346461dca8f545adf6a3` at `2026-09-15T14:18:25Z`, before the annotated tag `v0.4.5` was created at `2026-09-15T14:21:22Z`. That CI is therefore PRE-TAG evidence and must not be grouped with post-publication observations. Tag creation/peel is TAG PUBLICATION evidence, and actual-tag cold install plus released-consumer checks are POST-TAG evidence.

This is a documentation-only historical clarification. It fixes wording, not behavior: the v0.4.5 release itself was performed correctly and is not broken. The immutable tag `v0.4.5` and its tagged `docs/releases/v0.4.5.md` are deliberately left unchanged; the correction is recorded in the explicit post-release artifact `docs/delivery/workflow-v0.4.5-self-dogfood.md` on `main`.

### Verified facts

- Candidate commit: `f574ef252342185bc623346461dca8f545adf6a3` (committed `2026-09-15T14:08:38Z`; tree `8f0bf45c139d0f9f3639febab185e8aa6ce92279`).
- Exact-SHA hosted CI: Quality run `34980158536`, `created_at`/`run_started_at` `2026-09-15T14:13:18Z`, `updated_at` (completion) `2026-09-15T14:18:25Z`, conclusion `success`, `head_sha=f574ef252342185bc623346461dca8f545adf6a3`.
- Annotated tag `v0.4.5`: object `18d20157e1ccb7bcd5d63b9046bc50f729d1f70e`, tagger/creation `2026-09-15T14:21:22Z`, peels to `f574ef252342185bc623346461dca8f545adf6a3`.
- Therefore CI completion (`14:18:25Z`) precedes tag creation (`14:21:22Z`) by about three minutes: exact-SHA CI is PRE-TAG evidence.

### Defect being corrected

The immutable file `docs/releases/v0.4.5.md` at tag `v0.4.5` contains a Validation sentence that groups "the exact-SHA hosted CI run, the annotated tag object and peeled commit, and the fresh-store cold install from the published tag" together as "observed after publication". That grouping is temporally inaccurate for the exact-SHA hosted CI, which ran and passed before the tag existed. The current-main delivery document also lists the CI only under "Immutable release identity" without explicitly classifying it as pre-tag evidence.

The tagged file is left as an immutable historical artifact. The correction is written in the post-release evidence document instead, so that history is clarified without being rewritten.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/delivery/workflow-v0.4.5-self-dogfood.md
- docs/releases/v0.4.5.md
- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/decisions.md
- .tasks/0139-release-v045-with-project-level-grill.md

## Files allowed to edit

- docs/delivery/workflow-v0.4.5-self-dogfood.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- scripts/**
- .github/**
- .tasks/**
- AGENTS.md
- docs/releases/v0.4.5.md
- docs/decisions.md
- docs/engineering/**
- docs/delivery/gated-workflow-release-evidence.md

## Steps

1. Re-verify repository truth and the real timestamps: the frozen candidate commit/tree, hosted CI run `34980158536` start/completion/conclusion, and the annotated tag `v0.4.5` object and tagger time. Stop and report if the facts contradict the expected chronology instead of guessing.
2. Add a short, factual "Temporal clarification" section to `docs/delivery/workflow-v0.4.5-self-dogfood.md` stating: the frozen candidate; the hosted Quality run id; that this exact-SHA CI completed successfully before tag creation and is therefore PRE-TAG evidence; that tag object/peel is publication identity; that actual-tag cold install and released-consumer checks are POST-TAG evidence; that the immutable tagged `docs/releases/v0.4.5.md` wording is the inaccurate grouping; and that the tag is intentionally not rewritten.
3. Ensure the document reads as a current-main historical correction, not as a change to the published release, and does not claim the tagged file was edited or that the release was broken.
4. Optionally add one clarifying line to `docs/progress.md` only if the current status would otherwise be ambiguous; otherwise leave it unchanged.
5. Run the declared verification, obtain the policy-required review if any, and finish the normal task workflow without touching the tag, the candidate, or historical release commits.

## Acceptance criteria

- The documented chronology matches the real timestamps: candidate commit, CI start/completion, and tag creation.
- The exact-SHA hosted CI is classified unambiguously as PRE-TAG evidence.
- Tag publication (tag object and peel) is stated separately from pre-tag validation.
- Actual-tag cold install and released-consumer checks are classified as POST-TAG evidence.
- No statement claims the tagged release note was rewritten or corrected in place.
- The `v0.4.5` tag, its object, and its peeled commit are unchanged; the candidate commit is unchanged.
- Task 0139 is not reopened or its evidence rewritten; no new release is created.
- The release template/corrective from Task 0138 is not changed because it is already correct.
- No product/runtime code, dependency, config, or generated artifact is changed.

## Correctness assumptions

- GitHub API run metadata (`created_at`/`run_started_at`/`updated_at`) is authoritative for CI timing, and the tag tagger timestamp is authoritative for tag creation.
- The tag and candidate commit are immutable for this correction; only current-main Markdown may change.
- The tagged release note is a historical artifact whose wording is inaccurate but whose release outcome was correct.

## Invariants

- `v0.4.5` is immutable: tag object, peeled commit, and candidate commit do not change; no force-tag, no tag move, no amend/rebase/squash of historical release commits.
- No new release and no v0.4.6.
- PRE-TAG, TAG, and POST-TAG evidence remain temporally distinct and are never conflated.
- Task 0139 history and evidence are not rewritten; the correction is a separate task.
- No fake evidence and no product/runtime/package change.

## Required evidence

- The added "Temporal clarification" section in `docs/delivery/workflow-v0.4.5-self-dogfood.md` with the candidate SHA, CI run id, CI completion time before tag creation time, and the PRE-TAG / TAG / POST-TAG separation.
- Passing `tag-note-untouched` and `tag-peel-unchanged` checks proving the tagged release note and tag peel are unchanged.

## Review questions

- Does the clarification classify the exact-SHA hosted CI as PRE-TAG and avoid implying it was post-publication?
- Are tag publication and actual-tag install separated correctly from pre-tag validation?
- Is it explicit that the immutable tagged release note was not rewritten and that the release itself was not broken?
- Were the tag, candidate, and Task 0139 left untouched?

## Counterexample searches

- A clarification that still groups CI with post-publication observations, or that claims the tagged file was edited.
- A tag move, force-tag, or rewritten release commit; a reopened Task 0139.
- A new release or v0.4.6 created for a docs correction.
- A product/runtime/package or generated-`dist` change smuggled in with the docs correction.

## Verification

- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"tag-note-untouched","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff v0.4.5 -- docs/releases/v0.4.5.md"}`
- `{"id":"tag-peel-unchanged","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test \"$(git rev-parse v0.4.5^{commit})\" = \"f574ef252342185bc623346461dca8f545adf6a3\""}`

## Documentation updates

- docs/delivery/workflow-v0.4.5-self-dogfood.md

## Notes

- Backlog creation only in this planning pass: no implementation, claim, tag operation, or release.
- Docs-only historical correction. Do not edit `docs/releases/v0.4.5.md`; keep its tagged copy as the immutable artifact and record the correction in the post-release evidence document.
- The release template and `docs/engineering/testing-strategy.md` already encode the correct PRE-TAG → tag → POST-TAG order (Task 0138); do not create another release-process corrective.
- Do not reopen Task 0139 and do not rewrite its historical evidence.
- Risk is low and the change is Markdown-only; the declared verification is intentionally lightweight rather than a ritual full build.
