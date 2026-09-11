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

Status: validated by the evidence-only commit that follows the frozen candidate. This commit is not a release candidate.

- Package version: `0.3.1`
- Frozen HEAD: `5f65faa6a46c0e48e9586540b943898269fb78f7`
- Git tree: `64c335f0707fc8519f0254812368b959abfb9a74`
- Baseline: `baseline:dd5763be834a2d87deaf3c75941587906dc20a23dcb380818632b247787e259f`
- Candidate: `candidate:eb36a50e44b1f75ca5cd96bc5a3570cb125003d48bcf141f604a61abb1458446`
- Worktree: `worktree:41b7d7dcb4bee871914c38d14c086e2014edb65d2964435b100c97358109d78c`
- Verification run: `verify-1789142545920-uya416` (13/13 required checks current PASS; `clean-checkout-ci` recorded live as `evidence-1789143061860-w82v50`).
- Hosted clean-checkout CI: [run 34619628681](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/34619628681), run 10, `head_sha=5f65faa6...`, conclusion `success` for the exact frozen SHA.
- Bounded dogfood: session `dogfood-1789143142042-z5b60l`, outcome `pass`, evidence `evidence-1789143148803-5dy8gu`.
- Independent review: `review-1789143155525-1fc910`, reviewer `local-reviewer-0075`, outcome `pass`, evidence `evidence-1789143649796-abdrb8`.
- Gate: PASS. Completion evidence set: `evidence-1789143050407-o4aa90`, `evidence-1789143050416-6b8y1o`, `evidence-1789143050421-ji3c2v`, `evidence-1789143050426-j26q8t`, `evidence-1789143050430-qajqjf`, `evidence-1789143050435-xhxsip`, `evidence-1789143050440-sz912j`, `evidence-1789143050462-t7fioz`, `evidence-1789143050467-x4y3y4`, `evidence-1789143050472-ij3onj`, `evidence-1789143050476-grfma4`, `evidence-1789143050481-cwqjnn`, `evidence-1789143061860-w82v50`, `evidence-1789143649796-abdrb8`.

Corrective prerequisite Task 0096 (`apk task verify --record`) was required because a required `manual`/`live` check had no supported recording surface and made this contract unsatisfiable; it is `done` on its own distinct candidate (`candidate:0fe6d447...` at `5745c34`) and is not conflated with this candidate.

