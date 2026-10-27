# Task 0241 - Bound generated worker handoff summaries after review

State: doing
Owner: codex-corrective-0241
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: worker,handoff,serialization,tests
Risk: medium
Parallel: false
Depends on: 0230,0239
Tags: bugfix,worker

## Goal

Issue valid fix-worker packages from canonical review or failed-worker records whose summaries or findings exceed apk-worker-v1 text bounds. Preserve full evidence, provenance and strict external parser validation.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/work/index.ts
- src/core/work/contract.ts
- src/core/tasks/evidence.ts
- src/cli/command.test.ts

## Files allowed to edit

- src/core/work/index.ts
- src/cli/command.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/work/contract.ts
- src/core/tasks/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**

## Steps

1. Reproduce fix-package issuance failure from an oversized canonical review summary in a disposable fixture.
2. Bound generated handoff reason and finding items to the existing 320 UTF-16 code-unit text limit, normalize generated multiline text and visibly identify summaries and omitted findings.
3. Preserve complete canonical records and their fromRunId pointer; retain role/status/provenance and ordinary short text.
4. Cover failed worker and standalone review producers through actual fix-package issuance; keep strict external parser bounds.
5. Commit the final candidate, run canonical checks, record the actual before/after report and obtain independent review before gate and done.

## Acceptance criteria

- Canonical long summaries no longer prevent issuing a fix-worker package.
- Every generated handoff reason and finding is single-line and at most 320 code units; at most 32 findings are emitted.
- Truncation and omitted findings are visible and point to full canonical evidence using fromRunId.
- Ordinary short single-line handoffs remain byte-identical.
- Full source summaries and findings remain unchanged in canonical evidence.
- Boundary, multiline, supplementary Unicode, many-finding and missing-summary cases pass through real worker issuance.
- Standalone review failures and failed-worker records both produce valid fix packages.
- External oversized or malformed handoffs remain rejected by the unchanged parser.
- No trust, review-budget, gate, scope or lifecycle rule changes.

## Correctness assumptions

- Canonical evidence permits summaries and findings larger than worker package text bounds.
- A generated handoff is an execution summary; the referenced canonical record remains authoritative.

## Invariants

- Never change external parser limits or rewrite evidence.
- Never silently lose long text or additional findings.
- Preserve canonical source run, role, status and candidate identity.
- No task-contract amendments or unrelated refactors.

## Required evidence

- Observed pre-fix failure and post-fix package issuance with byte-identical canonical evidence.
- Canonical verification and fresh independent review of the complete candidate.

## Review questions

- Can a valid record still produce an overlong or multiline handoff?
- Can supplementary Unicode be split into an unpaired surrogate?
- Is truncation visible and the complete source still retrievable?
- Are externally supplied bounds unchanged?

## Counterexample searches

- Reasons and findings of 319, 320 and 321 code units.
- Joined short review findings producing an overlong summary.
- Long standalone findings, multiline text, supplementary Unicode and empty optional text.
- More than 32 findings, a missing summary, and worker versus standalone review failures.
- Strict rejection of external oversized reason, findings or list count.

## Verification

- `{"id":"handoff-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record actual fix-worker issuance before and after the fix; check bounded visible summaries, full evidence preservation and unchanged strict external parsing."}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/command.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Explain bounded handoff summaries and canonical source lookup in docs/task-system.md.
- Update docs/progress.md at lifecycle transitions.

## Notes

- Discovered during independent Task 0229 review: valid joined findings produced a 716/845-character summary, and apk work --role fix failed with worker package.handoff.reason must be at most 320 characters.
- Task 0239 fixed task-goal summaries only; its scope explicitly excluded work/index.ts.
- Execute sequentially after Task 0230; do not expand a claimed contract.
