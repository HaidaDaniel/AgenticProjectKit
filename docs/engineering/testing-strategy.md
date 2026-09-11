# Testing Strategy

The implementation should use tests to protect the CLI and repository generation workflows.

## Test layers

- unit tests for config and task parsing;
- unit tests for template rendering;
- unit tests for exporter logic;
- integration tests for CLI commands;
- smoke tests for CLI help, audit, and sync behavior;
- smoke tests for log migration and analytics summary behavior;
- repository fixture tests for scanning and adoption flows.
- cross-tool quality capability fixtures for TypeScript/pnpm, alternative lint/test commands, missing optional coverage/hooks/CI, and unsupported repositories.
- bounded dogfooding fixtures for prompt/session/result lifecycle, failure preservation, and optional usability metrics.

## v0.1 focus

- ensure the CLI can start;
- ensure config and task schemas validate correctly;
- ensure task and context generation logic is stable;
- ensure exported instruction files match the neutral policy.

## Test rules

- keep tests close to the behavior they verify;
- test task and context contracts explicitly;
- include regression coverage for exporter output where practical.
- keep CLI smoke tests temp-directory based and deterministic.
- verify team analytics with sharded log fixtures.
- keep dogfooding evidence separate from automated tests and benchmark fixtures; never treat a failed session as a pass.
- assert that typecheck-only lint scripts are not source-lint evidence and that quality JSON is deterministic and mutation-free.

## APK-local quality guardrails

AgenticProjectKit itself uses separate `pnpm typecheck` and `pnpm lint` commands. `typecheck` runs `tsc --noEmit`; `lint` runs the TypeScript-aware ESLint configuration against `src/`. The fast `pnpm quality` command composes typecheck, source lint, and deterministic tests only.

`pnpm test:coverage` uses c8 with text and `coverage/coverage-summary.json` reporters. The measured pre-guardrail baseline was 91.72% lines/statements, 96.50% functions, and 80.00% branches across 267 tests. Thresholds are 90% lines, 90% statements, 95% functions, and 78% branches: each leaves small measured headroom while preventing regression without demanding arbitrary 100% coverage.

`pnpm release:check` remains the stronger local release validation: fast quality, coverage, build, and APK-specific sync/audit checks. Pre-commit runs lint-staged source lint; pre-push runs fast quality, coverage, and build. Hooks provide developer feedback only and cannot replace candidate-bound `apk task verify`, independent review, or the completion gate.

Hooks can be intentionally bypassed for an exceptional commit with `git commit --no-verify`; Husky's supported disable path is `HUSKY=0` for the command (PowerShell sessions can set `$env:HUSKY=0`).

## Clean-checkout CI

`.github/workflows/quality.yml` uses one bounded Ubuntu job for pull requests and `main` pushes. It asserts the checked-out revision equals `GITHUB_SHA`, installs Node.js `22.22.1` and pnpm `10.28.1` with `pnpm install --frozen-lockfile`, and runs this deterministic sequence:

```text
pnpm quality
pnpm test:coverage
pnpm build
pnpm release:check
node dist/cli/index.js lint --json
node dist/cli/index.js sync
node dist/cli/index.js audit
git diff --check && reject tracked/unexpected untracked drift
```

The runner is disposable, so report-writing audit output cannot affect a developer checkout. Tracked drift still fails visibly. Hosted CI status and URL, together with exact SHA, may be recorded by Task 0075 as separate release evidence; CI does not satisfy APK verification/review/gate or frozen-candidate proof. No retry, matrix, credentials, publish, deployment, or adopted-repository workflow generation belongs in this check.

## Frozen release validation

Task 0075 uses `prepare -> clean HEAD freeze -> non-mutating validation -> exact evidence -> independent review/gate`. Tracked inputs are frozen at HEAD; ignored build, coverage, and `.agentic` runtime records are non-candidate outputs. Final human-readable result blocks are appended after `done` and explicitly refer to the validated earlier SHA; their evidence-only commit is not a new release candidate. Any earlier tracked mutation forces a new freeze and rerun.
