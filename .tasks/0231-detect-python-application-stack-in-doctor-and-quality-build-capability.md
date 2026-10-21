# Task 0231 - Detect Python application stack in doctor and quality build capability

State: doing
Owner: codex-fixes-0231
Mode: maintenance
Lane: bugfix
Type: bugfix
Scope: doctor,quality,python,detection,docs,tests
Risk: medium
Parallel: true
Depends on: none
Tags: doctor,quality,python,detection,tests

## Goal

Recognize Python application and PEP 517 build-system evidence without treating an APK-only `package.json` as a Node application. `doctor` must stop requesting Node scripts from a Python application that only uses Node for APK tooling, and `quality detect` must recognize declared Python build configuration without claiming that a build succeeds.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/adoption-flow.md
- src/core/doctor/index.ts
- src/core/quality/index.ts
- src/core/quality/quality.test.ts

## Files allowed to edit

- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- src/core/quality/index.ts
- src/core/quality/quality.test.ts
- package.json
- dist/**
- docs/adoption-flow.md
- docs/progress.md

## Files forbidden to edit

- src/cli/**
- src/core/tasks/**
- src/core/scanners/**
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce both defects before editing using disposable fixtures. For the first, create a Python project with `pyproject.toml`, a root `package.json` that only pins APK/Husky tooling, and no Node scripts; record the four `script:*: missing` doctor warnings. For the second, add `[build-system]` with `setuptools.build_meta`; record `quality detect --json` reporting `build: missing`.
2. Define a bounded, read-only application-stack inventory in the doctor/quality layer. Use reliable markers: Python `pyproject.toml` with `[project]`, `[build-system]`, or recognized tool tables; Go `go.mod`; and Node runtime ownership through `main`, `bin`, `exports`, non-APK `dependencies`, or a non-tooling application entrypoint. Do not infer a Node application from the mere presence of `package.json`.
3. Distinguish a tooling-only root `package.json` from a Node application manifest. Treat APK, Husky, and similar development-only tooling with no runtime entrypoint and no non-tooling dependencies as tooling. Preserve legitimate Node applications and mixed repositories.
4. Update `doctor` so Node script checks are evaluated only when a Node application (or an explicitly mixed Node application) is present. For a Python-only or Go-only application with a tooling-only manifest, report the detected application stack and do not emit four misleading missing-script warnings. Do not hide a real Node-script problem in a real Node application.
5. Update `quality detect` to parse `[build-system]` from `pyproject.toml`. Recognize common PEP 517 backends, including `setuptools.build_meta`, `hatchling.build`, `poetry.core.masonry.api`, `flit_core.buildapi`, `pdm.backend`, and `maturin`. Record the evidence source and declared backend. Report configuration as detected capability, never as a successful build.
6. Keep Python lint, test, typecheck, and coverage detection based on existing structured tables. Do not add a full TOML or CI parser. Do not execute `uv`, `pip`, `pytest`, `ruff`, `hatch`, `poetry`, or any project command.
7. Preserve existing quality policy and JSON contracts. Additive evidence or diagnostics are allowed; existing capability IDs and policy status must not change meaning.
8. Handle an incomplete, malformed, or empty `pyproject.toml` without crashing. Missing build-system configuration remains `build: missing`; a malformed table yields a bounded diagnostic or no evidence, not a false detected claim.
9. Add regression fixtures for all ten scenarios in this contract. Add `src/core/doctor/doctor.test.ts` to the `test:source` list in `package.json` so canonical CI runs it.
10. Run the focused doctor/quality tests, typecheck, lint, APK task lint, docs consistency, diff check, and committed-dist check on the final candidate.

## Acceptance criteria

- A Python application with `[build-system]` and `setuptools.build_meta` reports `build` as detected with `pyproject.toml` evidence and a declared-backend detail.
- The same is true for `hatchling.build`, `poetry.core.masonry.api`, `flit_core.buildapi`, `pdm.backend`, and `maturin` fixtures.
- A Python project with pytest and Ruff configuration continues to report `tests` and `lint` as detected, and its build capability is reported independently.
- A Python application whose root `package.json` only pins APK/Husky tooling does not produce four misleading missing Node-script warnings in `doctor`; the detected application stack is reported.
- A Go application with an APK-only root `package.json` does not produce false missing Node-script warnings.
- A normal Node or TypeScript application still reports missing Node scripts when scripts are genuinely absent; the fix does not hide real Node defects.
- A mixed Python and Node repository checks Node scripts when a Node application is present and still reports Python build capability.
- An incomplete or malformed `pyproject.toml` does not crash; valid declared markers are used, and absent build configuration remains missing.
- No project build, test, lint, typecheck, or install command is executed during detection.
- Existing `quality detect --json` capability IDs, statuses, dispositions, and policy fields remain compatible; any new fields are additive.
- `doctor` remains read-only and does not create files or run project commands.
- The new doctor test is included in the canonical `test:source` command.

## Correctness assumptions

- APK installation can legitimately add a root Node manifest to a non-Node application.
- Declared PEP 517 build-system configuration proves a build/package boundary exists, not that the backend is installed or that a build succeeds.
- `pyproject.toml` and `go.mod` are stronger application-stack evidence than the presence of a `package.json`.
- A mixed repository can own more than one application stack and must not have either stack silently discarded.
- Existing detector outputs are consumed by audit, resources, calibration, and doctor; additive changes are safer than renaming or removing fields.

## Invariants

- No project commands are executed during doctor or quality detection.
- No new dependency, TOML parser, CI parser, or external service is added.
- No existing capability ID or policy meaning is removed or weakened.
- Real Node script gaps in genuine Node applications remain visible.
- Python build detection reports configuration, never successful build evidence.
- Read-only detection creates no files and mutates no project state.
- Manual or live verification is not fabricated by detection.

## Required evidence

- Pre-fix doctor output for the Python plus APK-tooling fixture showing the false missing-script warnings.
- Pre-fix `quality detect --json` output showing `build: missing` despite `[build-system]`.
- Post-fix output for all ten fixtures.
- Focused tests, typecheck, lint, APK lint, docs consistency, diff check, and committed-dist result.

## Review questions

- Can a tooling-only `package.json` be mistaken for a Node application, or a real Node application be mistaken for tooling?
- Does Python build detection rely on structured `[build-system]` evidence rather than a filename or substring guess?
- Are detection results honestly limited to declared configuration rather than successful builds?
- Are mixed Python and Node repositories handled without dropping either stack?
- Does malformed or incomplete configuration fail safely without a false detected capability?
- Are existing public JSON fields and quality policy semantics preserved?

## Counterexample searches

- Python with setuptools, hatchling, poetry-core, flit-core, PDM, and maturin backends.
- Python with pytest and Ruff but no build-system.
- Python runtime plus a root package.json containing only APK and Husky dev tooling.
- Go plus a root package.json containing only APK tooling.
- Ordinary Node/TypeScript with no test or lint script.
- Monorepo with a Python service and a Node application.
- `pyproject.toml` with `[build-system]` but no `build-backend`.
- Empty, truncated, duplicate, or invalid `pyproject.toml`.
- No build configuration at all.
- A package.json with `dependencies` unrelated to APK.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/doctor/doctor.test.ts src/core/quality/quality.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document Python/Go application-stack detection, tooling-only `package.json` handling, and declared PEP 517 build capability in `docs/adoption-flow.md`.
- Update `docs/progress.md` when the task state changes.

## Notes

- Confirmed downstream defects in APK v0.5.1. `src/core/doctor/index.ts` unconditionally checks `test`, `lint`, `typecheck`, and `build` scripts from the root `package.json`. `src/core/quality/index.ts` recognizes Python lint, tests, typecheck, and coverage tables but not `[build-system]`.
- The audit fixture copied translator-agent's root `package.json` and `pyproject.toml` into a disposable directory. `quality detect --json` reported `build: missing` with `setuptools.build_meta` present, and `doctor` reported all four Node scripts missing.
- Do not use the downstream repositories for this task and do not add pytest, Ruff, uv, or Python runtime dependencies to APK. All fixtures are disposable text files.
- Keep this task independent of the status, worker, evidence, and version tasks. It changes only doctor/quality detection and its tests/documentation.
