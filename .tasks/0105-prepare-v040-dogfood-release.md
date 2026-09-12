# Task 0105 - Prepare v0.4.0 dogfood release

State: done
Owner: codex-v040
Mode: production
Lane: release
Type: release
Scope: versioning,release,docs,verification,ci
Risk: high
Parallel: false
Depends on: none
Tags: release

## Goal

Turn the completed resource-aware and workspace milestone into a reproducible v0.4.0 dogfood release that downstream repositories can pin.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- .github/workflows/quality.yml
- package.json
- pnpm-lock.yaml

## Files allowed to edit

- package.json
- pnpm-lock.yaml
- docs/releases/v0.4.0.md
- docs/progress.md
- docs/audit-report.md
- docs/project-map.md
- .tasks/0105-prepare-v040-dogfood-release.md

## Files forbidden to edit

- src/**
- scripts/**
- .agentic/config.json
- .github/workflows/**

## Steps

1. Inspect release scripts and repository state
2. Run pnpm release:minor and inspect version diff
3. Write bounded v0.4.0 release notes
4. Run full local and built CLI verification
5. Commit and push exact release candidate
6. Require green hosted CI for exact release SHA
7. Create and push annotated v0.4.0 tag
8. Create GitHub Release when gh authorization permits
9. Complete independent review and release gate

## Acceptance criteria

- Package version is 0.4.0
- Release checks pass on clean HEAD
- Exact-SHA hosted CI is green
- Annotated Git tag v0.4.0 points to validated release commit
- Downstream installation can pin v0.4.0
- Release notes summarize major changes since v0.3.1
- No Herdr dependency or runtime integration is added

## Correctness assumptions

- pnpm release:minor performs checks and version mutation but no commit or tag
- Existing GitHub Actions workflow validates pushed main SHA
- Repository has push and tag authority

## Invariants

- Tag is never created before exact-SHA CI success
- Release commit contains no source changes
- Existing user changes are never discarded
- No Herdr dependency adapter or runtime integration is introduced

## Required evidence

- docs/releases/v0.4.0.md
- GitHub Actions exact-SHA run
- annotated v0.4.0 tag

## Review questions

- Does tag resolve to exact green CI SHA
- Do package and lockfile agree on 0.4.0
- Do notes avoid unsupported Herdr integration claims
- Did verification create tracked drift

## Counterexample searches

- CI success belongs to another SHA
- Tag object peels to another commit
- Generated checks mutate tracked files
- Package lock retains old root version

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"report","command":"pnpm release:check","artifact":"docs/releases/v0.4.0.md"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-audit","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js audit"}`
- `{"id":"built-doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js doctor"}`
- `{"id":"built-status","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js status --detail"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"release-artifacts","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Record green GitHub Actions run for exact release commit and verify pushed annotated v0.4.0 peels to that commit.","evidence":"GitHub Actions URL with head SHA plus annotated tag peeled commit"}`

## Documentation updates

- docs/releases/v0.4.0.md
- docs/progress.md

## Notes

- Minor release only. No speculative features. No Herdr dependency or adapter. External terminal or session runtimes may be used alongside APK.
- block: Await exact-SHA clean-checkout CI; agent registration is intentionally local-only.
