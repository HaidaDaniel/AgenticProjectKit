# Task 0292 - Prove every canonical ignore entry independently in doctor

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: bugfix
Type: security
Scope: doctor,diagnostics,gitignore,tests,docs,delivery
Risk: high
Parallel: false
Depends on: none
Tags: security,diagnostics,gitignore,containment,tests

## Goal

Replace one-probe-per-family inference with an independent effective-ignore determination for every canonical entry, and correct the downstream dogfood record that certified the false pass.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- src/core/init/index.ts
- docs/delivery/downstream-v060-corrective-dogfood.md

## Files allowed to edit

- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- docs/cli-commands.md
- docs/delivery/downstream-v060-corrective-dogfood.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/audit/**
- src/core/init/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce the audit F-003 false pass in an isolated git fixture and on translator-agent at architecture/canonical-v3-plan; verify with a direct git check-ignore invocation that .agentic/perf/* is not ignored.
2. Probe every canonical entry by its own exact path in one bounded git check-ignore --stdin invocation; keep process count, timeout and buffer limits bounded.
3. Treat re-include entries as re-include assertions for the exact .gitkeep path and require the matching negation pattern, not merely any ! prefix.
4. Emit warn when an entry lacks proven effective ignore; emit pass only when every probed entry is proven; never emit a proven pass derived from another entry's probe.
5. Build regression tests with an independently constructed Git oracle: compute expected per-entry ignore status by direct git check-ignore on each canonical path, independently of APK family tables, and assert doctor verdicts equal that oracle.
6. Add a negative control that reproduces the original family false positive and must be reported as warn naming .agentic/perf/*; add re-include false-positive and unavailable-inspection cases.
7. Correct the dogfood report line that records the false pass as a legitimate success, without altering any downstream repository.
8. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- A fixture ignoring only .agentic/agents/* produces a warn naming .agentic/perf/*, not a pass.
- Every canonical entry is evaluated on its own path; no result from one entry proves a different entry.
- Re-include entries are proven for the exact .gitkeep path and matching negation pattern.
- Regression tests use an independently constructed Git oracle rather than reusing APK family mappings or expected strings copied from implementation output.
- Git remains at most one additional check-ignore process with bounded paths, timeout and buffer; exit classes 0, 1, 128 and malformed output are handled as specified.
- doctor remains read-only and never fails overall for an ignore finding.
- The dogfood report no longer presents the false pass as a success and no downstream repository is modified.

## Correctness assumptions

- Git ignore semantics are the external authority and may differ from canonical entry strings

## Invariants

- A security diagnostic must not assert a fact about one path from evidence about another path

## Required evidence

- Independent Git oracle comparison and the negative control result

## Review questions

- Does any family or fallback path still generalize a single probe to multiple patterns

## Counterexample searches

- Broad root pattern masking a missing nested rule; Re-include pattern on the wrong path; Equivalent rule in nested gitignore or info exclude

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/doctor/doctor.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"ignore-oracle-repro","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run the isolated family-false-positive fixture and the real translator-agent branch read-only; record direct git check-ignore results and doctor verdicts side by side."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document per-entry effective-ignore probing in docs/cli-commands.md and correct docs/delivery/downstream-v060-corrective-dogfood.md

## Notes

- Trust boundary: the diagnostic verdict must be derived from an external oracle not APK assumptions
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
