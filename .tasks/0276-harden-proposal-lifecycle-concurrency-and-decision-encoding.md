# Task 0276 - Harden proposal lifecycle concurrency and decision encoding

State: doing
Owner: opencode-milestone
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: proposals,lifecycle,concurrency,cli,correctness
Risk: high
Parallel: false
Depends on: 0274
Tags: p1,proposals,concurrency,cli,correctness

## Goal

Make proposal accept reject supersede and link serialized across processes canonicalize successor identity reject self-supersede encode free-text decision reasons safely and surface transition errors through the normal CLI error contract.

## Context files

- AGENTS.md
- docs/decisions.md
- docs/proposals.md
- src/core/proposals/index.ts
- src/core/proposals/git.ts
- src/cli/commands/proposal.ts
- src/core/tasks/lock.ts
- .tasks/0270-add-document-proposal-cli-and-explicit-lifecycle-transitions.md
- .tasks/0272-add-validated-canonical-document-and-backlog-linkage-for-proposals.md

## Files allowed to edit

- src/core/proposals/index.ts
- src/core/proposals/proposals.test.ts
- src/cli/commands/proposal.ts
- src/cli/cli.test.ts
- docs/proposals.md
- docs/decisions.md
- docs/progress.md
- docs/delivery/document-proposals-readiness.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/core/backlog/**
- src/core/config/**
- src/core/proposals/git.ts

## Steps

1. Reproduce the four final-review findings on disposable fixtures: concurrent accept/reject both returning success while one decision is lost; supersede by the same slug succeeding and storing a slug; a reason containing pipe delimiters corrupting history; and transition failures emitting an uncaught stack trace instead of the normal CLI error path.
2. Serialize transition and link read-check-write sequences with the existing local mutation lock, using a deterministic OS-temp lock keyed by repository and proposal slug; re-read the proposal after acquiring the lock.
3. Resolve --by through the proposal lookup, reject self-supersede by stable ID, and store the successor stable Proposal-Id in both Superseded-By and the decision history.
4. Escape and unescape decision-history text fields so free-text reasons containing pipe delimiters or backslashes round-trip without corruption, and reject malformed history lines.
5. Await lifecycle transitions so all failures use the normal human and JSON CLI error handler; include the verified revision in show --json for expect-revision workflows.
6. Add focused concurrency and regression tests, document the serialization and decision-encoding contract, update docs/progress.md, and rebuild committed dist.

## Acceptance criteria

- Concurrent accept/reject or supersede commands cannot both report success while only one decision remains.
- A proposal cannot supersede itself by slug or stable ID, and Superseded-By plus decision history store the successor stable ID.
- Decision reasons containing pipe delimiters and backslashes parse and render unchanged without changing the decision or successor.
- accept reject and supersede failures use the normal CLI error handler and --json produces a structured error.
- show --json exposes the revision needed for --expect-revision.
- Focused tests pass and existing proposal storage commit and link behavior remain intact.

## Correctness assumptions

- Concurrent proposal lifecycle commands in one host must not silently lose a decision.; A successor link must store the stable Proposal-Id rather than the user-supplied slug.

## Invariants

- Two concurrent lifecycle commands cannot both report success while only one decision remains.; A proposal cannot supersede itself by slug or ID.; Free-text reasons containing delimiter-like text survive parse and render unchanged.; Every transition failure follows the existing human/JSON CLI error path.

## Required evidence

- Concurrent accept/reject reproducer output and focused regression tests for self-supersede canonicalization pipe-containing reasons and JSON errors.

## Review questions

- Is the read-check-write sequence serialized across processes?; Is the stored successor the stable ID?; Can a pipe-containing reason corrupt decision history?; Do accept/reject/supersede failures use the normal error handler?

## Counterexample searches

- Search concurrent accept/reject
- self-supersede by slug and ID
- another proposal slug as successor
- reasons containing pipe text and backslashes
- missing actor/reason
- invalid transition
- and JSON error output.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"proposal-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts"}`
- `{"id":"lifecycle-report","type":"automated","required":true,"environment":"local","profile":"report","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts","evidenceRef":"tmp/apk/proposal-lifecycle-fixes.txt"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document lifecycle serialization and decision encoding in docs/proposals.md and docs/decisions.md.
- Update docs/progress.md when task state changes.

## Notes

- Found by the final milestone-level review after Tasks 0269-0274 were completed.
- Reuse the existing local mutation lock via a lazy import so ordinary command startup does not gain proposal-specific work.
