# Task 0112 - Detect modern Python and Go repositories during repository scanning

State: doing
Owner: opencode-ds-v41
Mode: maintenance
Lane: adoption
Type: bugfix
Scope: scanner,adoption,audit,python,go,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Detect Python and Go from canonical repository markers during repository scanning so adoption, project-map, and audit do not omit an evidenced primary runtime because a control-plane `package.json`/pnpm tooling exists. Two independent downstream repositories reproduced the same root cause: `translator-agent` (`pyproject.toml` + `requirements-dev.lock` + APK tooling `package.json`) omitted Python, and ResLedger (`go.mod` + APK tooling `package.json`) reported only `Node.js` and `pnpm`. The fix is bounded to Python and Go; it is not a universal ecosystem detector.

Python evidence to recognize at minimum:

- `pyproject.toml`
- `requirements.txt`
- `requirements-*.txt`
- `requirements-*.lock`
- `uv.lock`
- `setup.py`
- `setup.cfg`

Go evidence to recognize:

- `go.mod`

Do not infer Go merely from arbitrary `.go` files when `go.mod` is the canonical marker. Do not try to decide that pnpm is "not real" merely because it is APK tooling; evidence may represent multiple stacks. The bug is omission of an evidenced primary runtime, not the presence of Node.

## Context files

- AGENTS.md
- docs/architecture.md
- src/core/scanners/index.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/audit/audit.test.ts

## Files allowed to edit

- src/core/scanners/index.ts
- src/core/docs/adopt.test.ts
- src/core/audit/audit.test.ts
- src/core/quality/index.ts
- docs/progress.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/workspaces/**
- src/core/tasks/**
- .github/workflows/**

## Steps

1. Reproduce both downstream cases: `translator-agent` Python omission and ResLedger Go omission.
2. Identify the root cause: `package.json`/pnpm markers are detected while canonical primary-runtime markers are not.
3. Add canonical cross-stack marker detection for Python and Go while keeping Node/pnpm detection unchanged.
4. Ensure mixed repositories report multiple evidenced stacks deterministically.
5. Add regression tests covering each marker, the mixed APK-tooling case, and deterministic ordering.
6. Run verification.

## Acceptance criteria

- a `pyproject.toml`-only repository reports Python.
- a requirements-based repository reports Python.
- Python plus APK pnpm tooling reports Python plus Node.js plus pnpm.
- a `go.mod`-only repository reports Go.
- Go plus APK pnpm tooling reports Go plus Node.js plus pnpm.
- an ordinary Node repository is unchanged.
- a minimal repository keeps existing behavior.
- the adoption report uses the corrected detected stack.
- project-map and audit use the corrected detected stack.
- deterministic ordering is tested.

## Correctness assumptions

- ResLedger has `go.mod` and APK tooling `package.json`/`pnpm-lock.yaml` but project-map reported only `Node.js` and `pnpm`.
- `translator-agent` has `pyproject.toml` and `requirements-dev.lock` plus APK tooling `package.json`/`pnpm-lock.yaml` but Python was omitted.
- `detectPackageStack` currently reads only `package.json`, and Python is detected only from `requirements.txt`.

## Invariants

- detection is evidence-based and deterministic.
- no package manager or runtime hierarchy is inferred beyond evidence.
- Node/pnpm detection is unchanged; the bug is omission, not the presence of Node.
- Go is not inferred from arbitrary `.go` files when `go.mod` is the canonical marker.
- no universal ecosystem detector is introduced.
- limited shared marker knowledge with the quality detector is allowed only when it makes the fix smaller and clearer.

## Required evidence

- regression test output for each marker plus the adoption report and project-map stack lines.

## Review questions

- Can Python or Go still be omitted when `package.json` exists?
- Is detection ordering deterministic?
- Do the adoption report and project-map reflect the corrected stack?
- Was the fix bounded to Python and Go rather than a broad ecosystem redesign?

## Counterexample searches

- `pyproject.toml`-only repository
- requirements-dev.lock` without `requirements.txt
- `go.mod`-only repository
- go.mod` plus APK `package.json
- ordinary Node repository
- repository with no markers
- repository with both `pyproject.toml` and `go.mod`

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/progress.md

## Notes

- Keep the fix narrow and limited to Python and Go marker detection.
- Do not redesign quality detection; reuse marker knowledge only if it makes the fix smaller and clearer.
