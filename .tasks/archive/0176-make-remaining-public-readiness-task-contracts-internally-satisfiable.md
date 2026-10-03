# Task 0176 - Make remaining public-readiness task contracts internally satisfiable

State: done
Owner: codex-0176
Mode: maintenance
Lane: planning
Type: docs
Scope: documentation,task-contracts,public-readiness
Risk: medium
Parallel: false
Depends on: 0175
Tags: task-contracts,public-readiness

## Goal

Align the remaining public-readiness task contracts with an executable dependency graph, bounded edit scopes, and satisfiable documentation evidence.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- .tasks/0158-add-a-documentation-home.md
- .tasks/0163-redesign-readme-as-the-public-front-door.md
- .tasks/0168-add-deterministic-documentation-consistency-checks.md
- .tasks/0170-publish-a-truthful-security-reporting-policy.md
- .tasks/0173-validate-the-next-public-readiness-release.md

## Files allowed to edit

- .tasks/0158-add-a-documentation-home.md
- .tasks/0168-add-deterministic-documentation-consistency-checks.md
- .tasks/0170-publish-a-truthful-security-reporting-policy.md
- .tasks/0173-validate-the-next-public-readiness-release.md
- .tasks/0176-make-remaining-public-readiness-task-contracts-internally-satisfiable.md
- docs/progress.md

## Files forbidden to edit

- .tasks/archive/**
- README.md
- src/**
- dist/**
- docs/decisions.md
- docs/releases/**
- docs/roadmap.md
- SECURITY.md

## Steps

1. Update Task 0173 to depend on Task 0175 while preserving its Task 0170 security prerequisite. Keep Tasks 0149 and 0150 out of the dependency graph.
2. Make Task 0158's context match the current canonical public documentation: README, Getting Started, Core Concepts, brownfield and constrained-execution guides, CLI reference, maturity policy, release index and v0.4.7 notes, Contributing, Changelog, Architecture, Decisions, and Roadmap. Remove the stale v0.4.6 release-note context. Keep the Security link optional while SECURITY.md is absent, and make required link evidence satisfiable with a per-destination pass/fail checklist.
3. Bound Task 0168's editable documentation to README, docs/index, docs/roadmap, maturity/compatibility, CLI reference, release index, and progress, plus its checker, tests, CI, package script, maintenance guide, and the explicitly named Task 0170 contract. Do not permit arbitrary docs/**, historical release notes, or ADR edits.
4. Specify that Task 0168 compares roadmap task states with task-file metadata discovered from the repository, without hardcoded task IDs. Include a regression for missing README anchors and correct the broken README anchor in the maturity document. The task must tolerate SECURITY.md being absent.
5. Give Task 0168 bounded permission to ensure Task 0170's Verification section contains the exact checker invocation `node scripts/check-docs-consistency.mjs` before Task 0168 completes. Use that command in both task contracts and wire it into local quality and hosted CI.
6. Update Task 0170's dependencies to 0152, 0158, 0163, and 0168; restrict its editable files to SECURITY.md, README.md, docs/index.md, and docs/progress.md. Preserve the operator-confirmed private-reporting-route blocker. After that route is verified, allow only short navigation links from README and docs/index; do not duplicate the policy there or invent contact or handling commitments.
7. Update docs/progress.md to show Task 0175 complete, Task 0176 active, the sequence 0158 -> 0163 -> 0168 -> 0170 -> 0173, and the operator route as the current blocker for 0170.
8. Run the required task lint and diff check, inspect the dependency graph and all edited task contracts, then commit the task-owned contract changes before final verification and review.

## Acceptance criteria

- Task 0173 depends on 0175 and still depends on 0170; neither 0149 nor 0150 is a direct or transitive prerequisite.
- Task 0158 names only current canonical documentation in its context, does not require SECURITY.md, and accepts a per-destination pass/fail checklist as sufficient link evidence.
- Tasks 0158, 0163, and 0168 remain executable without Task 0170; Task 0170 stays blocked only on its operator-confirmed private reporting route after its task dependencies complete.
- Task 0168's editable documentation paths are explicit and bounded; it does not allow arbitrary docs/**, historical release notes, or ADR history. Its roadmap-state check discovers task IDs and states from task files rather than a hardcoded ID list.
- Task 0168 detects a missing README anchor, and its contract allows the maturity document so the existing broken link can be fixed. SECURITY.md is optional while Task 0170 is blocked.
- Task 0168 is explicitly responsible for ensuring Task 0170's Verification section contains the exact `node scripts/check-docs-consistency.mjs` command before Task 0168 is marked done; Task 0170 declares the same command.
- Task 0170's editable files are limited to SECURITY.md, README.md, docs/index.md, and docs/progress.md. README and docs/index changes are limited to minimal navigation links after the private route is verified.
- docs/progress.md reflects the current task state and the dependency-aware order while retaining the known operator blocker.
- `pnpm exec apk lint --json` and `git diff --check` pass on the committed candidate.

## Correctness assumptions

- Task metadata and task dependency declarations are the lifecycle source of truth; progress prose summarizes rather than overrides them.
- A hand-recorded link checklist is verifiable when it enumerates every destination and records pass/fail for each one.
- Task 0168's deterministic checker can discover task IDs and states from structured task files without embedding specific task IDs in code or fixtures.
- Task 0170's private reporting route cannot be inferred or approved by an implementation agent.

## Invariants

- Task 0173 continues to require Task 0170 and additionally waits for Task 0175.
- SECURITY.md remains optional for Tasks 0158 and 0168 while Task 0170 is blocked.
- Historical release notes, ADR history, and unrelated task contracts stay outside Task 0168's edit scope.
- Task 0170 does not publish a policy or link to a public reporting channel before the operator verifies a private route.
- Tasks 0149 and 0150 remain excluded from the public-readiness dependency graph.

## Required evidence

- APK lint output showing the edited task contracts have valid metadata, dependencies, and scopes.
- A dependency summary demonstrating 0158 -> 0163 -> 0168 -> 0170 -> 0173, with 0170 still blocked on the operator route and no 0149/0150 path.
- A per-destination checklist rule in Task 0158 and matching exact docs-check command declarations in Tasks 0168 and 0170.
- A review of the final diff confirming Task 0168's explicit path allowlist and Task 0170's four-file allowlist.

## Review questions

- Can each task run in the stated order without depending on unavailable SECURITY.md or an unverified reporting route?
- Does Task 0168 have enough edit scope to correct checked canonical docs, while preventing historical or unrelated documentation edits?
- Can the roadmap/status check remain current as tasks are added without changing checker code for each new task ID?
- Does the link evidence distinguish the actually checked destinations from an unsupported claim that every repository link was machine-checked?

## Counterexample searches

- Remove SECURITY.md and confirm the Task 0158 and Task 0168 contracts still permit completion.
- Leave the private reporting route unconfirmed and confirm Task 0170 remains blocked and Task 0173 still depends on it.
- Add a new task file with a roadmap status and verify the planned Task 0168 check does not require a code change or hardcoded ID.
- Introduce a broken README anchor used by maturity policy and confirm Task 0168's allowed scope and regression criteria cover detection and correction.
- Attempt to edit a historical release note or an unrelated docs file under Task 0168 and confirm it is outside the explicit allowlist.
- Remove either 0175 or 0170 from Task 0173's dependencies and confirm Task 0176's acceptance criteria catch it.

## Verification

- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/progress.md when task state changes, and record the dependency-aware public-readiness sequence and current operator blocker.

## Notes

- Do not change source code unless explicitly required.
