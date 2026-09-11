# Gated-workflow release evidence

Task 0075 validates one frozen AgenticProjectKit candidate. This file defines the evidence shape before freeze; exact results are appended only after the candidate passes verification, independent review, gate, and `done`.

## Candidate boundary

- Candidate inputs: every tracked file at frozen `HEAD`; worktree must have no candidate-controlled changes.
- Candidate identity: package version, `HEAD`, Git tree, APK baseline/candidate/worktree IDs.
- Non-candidate outputs: ignored `dist/**`, `coverage/**`, and `.agentic/**` runtime evidence/session records.
- This report and `docs/analytics/gated-workflow-dogfood.md` receive their final result blocks after `done`. That evidence-only commit is not the validated release candidate and must name the earlier frozen SHA explicitly.
- Any pre-gate tracked or unexpected untracked mutation invalidates the freeze and requires a new baseline plus affected verification/review/CI.

## Required proof

- dependency closure and clean freeze;
- real CLI low/high-risk success plus required rejection paths in isolated repositories;
- legacy v0.3.1 adoption compatibility and vendor-neutral quality detection;
- stale-lock/review-concurrency regression coverage;
- typecheck, source lint, tests, coverage, quality, build, release checks, contract lint, sync, doctor, and status;
- bounded dogfood evidence;
- independent review and completion gate;
- green hosted clean-checkout CI for the exact frozen SHA.

## Frozen result

Status: pending post-gate evidence append.

