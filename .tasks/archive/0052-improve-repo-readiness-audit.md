# Task 0052 - Improve Repo Readiness Audit

State: done
Owner: codex-plan-47
Mode: product
Lane: audit
Scope: audit,scanner,docs,tests
Risk: medium
Parallel: false
Depends on: 0051
Tags: audit,readiness,scanner,brownfield

## Goal

Expand `apk audit` from mostly kit/workflow readiness into a more useful lightweight repository readiness report while keeping claims honest and CLI-only.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/cli-commands.md
- docs/decisions.md
- README.md
- src/cli/commands/audit.ts
- src/core/audit/index.ts
- src/core/scanners/index.ts
- src/core/audit/audit.test.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0052-improve-repo-readiness-audit.md
- README.md
- docs/cli-commands.md
- docs/progress.md
- src/cli/commands/audit.ts
- src/core/audit/index.ts
- src/core/scanners/index.ts
- src/core/audit/audit.test.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans

## Steps

1. Extend scanner facts for package manager detection, package scripts, lockfiles, CI presence, env examples, Docker files, README, license, test directories, generated directories, and monorepo indicators.
2. Add TypeScript strict-mode detection when `tsconfig.json` exists.
3. Add audit findings for missing common scripts: `test`, `lint`, `typecheck`, `build`.
4. Add audit findings for lockfile/package manager mismatch.
5. Add audit findings for missing CI, missing `.env.example`, missing tests, missing license, and missing README usage when relevant.
6. Keep findings lightweight and explicit; do not claim security, dependency vulnerability, architecture, or coverage analysis.
7. Update `docs/audit-report.md` output shape only if tests cover deterministic formatting.
8. Add tests for Node-only repo, TypeScript repo, no-package repo, and monorepo-like repo.

## Acceptance criteria

- `apk audit` still validates kit docs, generated exports, config, task parsing, and task dependencies.
- `apk audit` additionally reports lightweight repo readiness facts.
- Audit output distinguishes kit/workflow findings from app/repo readiness findings.
- Audit does not require network access.
- Audit does not run package scripts.
- Audit does not mutate app source beyond its existing report outputs.
- No web UI or SaaS integration is introduced.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js audit
- node dist/cli/index.js status
- node dist/cli/index.js doctor

## Documentation updates

- Update docs/cli-commands.md for expanded audit scope.
- Update README audit wording to "lightweight repository readiness".
- Update docs/progress.md when task state changes.

## Notes

- This task addresses the analysis point that current audit is mostly APK readiness.
- Keep this as static inspection only; deeper security/coverage/architecture checks belong to future tasks.
