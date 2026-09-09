# Task 0075 - Validate next AgenticProjectKit release against gated workflow

State: todo
Owner: none
Mode: production
Lane: release
Scope: release,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0057,0058,0059,0060,0061,0062,0063,0064,0065,0066,0067,0068,0069,0070,0071,0072,0073,0074,0076,0077,0078,0079,0080
Tags: release,e2e,dogfood,gated-workflow,quality,ci

## Goal

Frozen release candidate has reproducible, revision-current end-to-end gated-workflow evidence from APK itself and at least one self-contained fixture/adopted example, with no evidence laundering across candidate revisions.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- package.json
- README.md
- src/cli/cli.test.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.test.ts
- src/core/agents/index.ts
- src/core/work/index.ts
- src/core/status/index.ts
- src/core/quality/index.ts
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts
- .github/workflows/quality.yml
- scripts/clean-dist.mjs
- scripts/copy-template-assets.mjs
- docs/engineering/testing-strategy.md
- docs/delivery/milestones.md
- docs/roadmap.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0059-execute-task-verification-profiles-and-record-evidence.md
- .tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0063-add-independent-task-review-and-review-evidence.md
- .tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md
- .tasks/0065-add-typed-task-templates-with-domain-specific-guardrails.md
- .tasks/0066-add-built-in-repository-and-task-contract-linting.md
- .tasks/0067-generate-budgeted-task-context-packs.md
- .tasks/0068-make-context-suggestions-dependency-and-change-aware.md
- .tasks/0069-add-bounded-agent-dogfooding-evidence.md
- .tasks/0070-add-end-to-end-task-execution-provenance.md
- .tasks/0071-expose-concise-workflow-gate-and-evidence-status.md
- .tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md
- .tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md
- .tasks/0076-recover-stale-task-mutation-locks-safely.md
- .tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md
- .tasks/0078-add-first-class-local-quality-guardrails-for-agenticprojectkit-itself.md
- .tasks/0079-add-minimal-clean-checkout-ci-and-release-quality-proof-for-agenticprojectkit.md
- .tasks/0080-resolve-task-0073-independent-review-reliability-findings.md

## Files allowed to edit

- src/cli/cli.test.ts
- src/core/tasks/task.test.ts
- src/core/tasks/fixtures/**
- src/core/init/init.test.ts
- src/core/docs/adopt.test.ts
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts
- docs/delivery/gated-workflow-release-evidence.md
- docs/analytics/gated-workflow-dogfood.md
- docs/delivery/milestones.md
- docs/roadmap.md
- docs/engineering/testing-strategy.md
- README.md
- docs/progress.md
- docs/decisions.md
- .tasks/0075-validate-next-agenticprojectkit-release-against-gated-workflow.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Preparation: refresh generated artifacts, sync writes, formatting/generated docs and preparation scripts before freeze within allowed scope; consume 0074 upgrade fixture, 0077 capability contract, 0078 quality surface, 0079 CI workflow and 0080 reliability regressions. Resolve generated changes by acceptance/commit or include them in candidate identity.
2. Freeze: verify expected worktree state; record exact version, HEAD SHA and candidate tree/worktree identity. Declare candidate-controlled inputs and non-candidate build/evidence output locations before validation.
3. Validation: run non-mutating checks against frozen candidate, including 0066 contract lint, 0077 capability detection, 0078 typecheck/lint/test/coverage/build surface, real CLI success/rejection scenarios, 0076 crash recovery and 0080 review reliability. Use isolated repositories for scenario mutations.
4. Record bounded dogfood/review/e2e outcomes plus 0079 clean-checkout CI status for exact candidate where technically available. If validation changes candidate inputs, invalidate current evidence, prepare and freeze new candidate, then rerun relevant validation.
5. Produce release report with exact SHA/tree/version and evidence set. Candidate-controlled documentation or post-validation changes require new freeze/revalidation; only predeclared non-candidate evidence artifacts may be appended without changing subject.

## Acceptance criteria

- All prerequisite tasks 0057-0074 and 0076-0080 complete before final release gate.
- Low-risk scenario covers claim, fixture implementation, verification and done.
- High-risk scenario covers claim, verification, scope, independent review, evidence and done.
- Scope violation and failed required verification each reject completion.
- Missing live/manual evidence rejects completion when policy requires it; fixture pass cannot substitute for live evidence.
- Failed review rejects completion; fixer iteration, re-verification and new independent review can then pass while preserving history.
- v0.3.1-style fixture upgrades and old tasks remain readable.
- Adopted repositories remain usable without APK's ESLint, hook, test, coverage or GitHub Actions choices; detection reports/recommends and setup remains explicit opt-in.
- Capability detection distinguishes typecheck/static analysis, source lint, tests, build/package validation, coverage, hooks and CI; missing optional capabilities do not become global failures.
- Alternate agent/export format preserves task/context/review contract.
- Lock crash/recovery scenario preserves mutual exclusion; live owner cannot be stolen and concurrent stale recovery remains safe.
- 0073 P2 regressions prove atomic duplicate results, worker-review cleanup and actionable standalone-review fixer progression.
- APK `typecheck`, real source `lint`, deterministic tests, coverage thresholds, fast quality, release checks and package build pass; real CLI workflow evidence accompanies unit fixtures.
- Clean-checkout CI workflow exists and is green for exact release candidate where hosted status is technically available; recorded run URL/status/SHA remains separate release evidence if APK cannot consume it directly.
- CI success cannot replace missing/stale APK verification, scope, independent-review, task-gate or candidate-bound evidence.
- Local hook success is developer feedback only and never authoritative release evidence.
- Bounded dogfood session is recorded; failure cannot be relabeled as pass.
- Mutating preparation completes before freeze; expected worktree state documented and accepted generated changes committed or included in candidate identity.
- Final release evidence and report bind exact version, HEAD SHA and candidate tree/worktree identity, including dirty state where present.
- Post-freeze checks that satisfy release evidence are non-mutating with respect to candidate-controlled inputs; final lint/audit uses read-only surface supplied by 0066.
- Build output locations and candidate-input boundary declared before freeze. Build that changes tracked candidate inputs belongs in preparation or invalidates freeze; isolated/non-candidate outputs cannot hide source changes.
- Any validation or post-validation mutation of candidate-controlled files invalidates current release evidence; candidate must be frozen again and relevant checks rerun. Regression covers freeze A -> mutating check -> A evidence rejected for changed candidate B.
- Fixture/live/dogfood/review evidence must identify same release candidate and evaluated scenario subject; evidence from another revision cannot satisfy release gate. No evidence laundering across candidate revisions.
- Evidence recording/bookkeeping exclusions are declared before freeze and cannot exclude implementation, requirements or other candidate inputs merely to keep stale PASS valid.
- Docs accurately describe implemented behavior; release evidence records commands, outcomes, candidate identity and fixture versus real-session limits.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"quality","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"release-check","type":"automated","required":true,"environment":"ci","profile":"report","command":"pnpm release:check","artifact":"docs/delivery/gated-workflow-release-evidence.md"}`
- `{"id":"quality-detect","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk quality detect --json"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk sync"}`
- `{"id":"doctor","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk doctor"}`
- `{"id":"status","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk status"}`
- `{"id":"clean-checkout-ci","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Record green clean-checkout CI run for exact frozen candidate SHA, or explicit technically-unavailable evidence without substituting another revision.","evidence":"CI run URL/status/exact SHA or bounded unavailability record"}`

## Documentation updates

- Update docs/delivery/milestones.md for implemented behavior and examples.
- Update docs/roadmap.md for implemented behavior and examples.
- Update docs/engineering/testing-strategy.md for implemented behavior and examples.
- Update README.md for implemented behavior and examples.
- Update docs/decisions.md for contract/storage decisions.
- Update docs/progress.md when task state changes.

## Notes

- Backlog reference: APK-RELEASE-02. Milestone 5.
- Release validation task only; feature defects return to owning task with explicit scope update rather than expanding this task into implementation.
- Existing pnpm release:check includes report-writing audit; do not use it as frozen-candidate validation. If used for preparation, run only within allowed scope or isolated preparation checkout; it provides no final frozen-candidate evidence. No publish, push or version bump authorized by this task.
- Verification entries consume scripts/contracts delivered by prerequisites; they are not permission to implement missing features in 0075. Build is conditional on declared non-mutating candidate semantics; mutating build runs before freeze.
- No GitHub API/provider coupling required. Record hosted CI status as separate exact-SHA release evidence when direct APK consumption would add platform coupling or API complexity.
- Hooks and CI remain non-authoritative for task-level proof. Neither may launder stale/missing APK evidence or bypass independent review/gate requirements.
- APK-owned ESLint/hooks/coverage/GitHub tooling stays repository-local; no downstream repository mutation or mandatory tooling adoption.
- Evidence report paths are planned new outputs; declare their treatment before freeze. Report-writing audit outputs are neither automatically permitted candidate mutations nor release proof. Refresh candidate-controlled docs during preparation; later edits require revalidation.
- No downstream repository re-audit; use APK and controlled fixture/adopted example.
- Context lists current files and prerequisite task contracts. Before implementation, read prerequisite changes and amend this task with their actual module paths if needed; do not invent missing Context files.
- Allowed new helper modules stay inside listed module patterns. Other task files and unrelated modules remain outside scope. If scope must expand, amend task before editing.
- Use existing test files included in pnpm test; no dependency or package-script change planned. Update docs/decisions.md for chosen architecture.
