# Task 0289 - Dogfood the corrective APK candidate in disposable downstream copies

State: done
Owner: opencode-impl
Mode: maintenance
Lane: verification
Scope: downstream,integration,verification,doctor,adopt,sync,cli
Risk: medium
Parallel: false
Depends on: 0286,0287,0288
Tags: p2,integration,downstream,dogfood,verification,report

## Goal

Validate the exact combined corrective candidate in disposable copies of the named downstream repositories and record read-only workflow results, write-safety checks, and absence of unexpected user-file changes.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/adoption-flow.md
- docs/delivery/workflow-v0.6.0-post-release.md
- docs/delivery/downstream-upgrade-acceptance.md
- .tasks/0242-validate-the-v052-patch-release-candidate-before-publication.md
- .tasks/0250-validate-safe-downstream-upgrade-and-legacy-migration-guidance.md
- package.json

## Files allowed to edit

- docs/delivery/downstream-v060-corrective-dogfood.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/**
- .agentic/**
- docs/releases/**
- docs/decisions.md
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Wait until the three corrective tasks are done, then freeze and record the exact APK candidate commit SHA and committed dist state; do not test a v0.6.0 or v0.5.2 pinned CLI as if it were the candidate. The immutable v0.6.0 annotated tag object is d83d069f5309ca2b963f8939a2626d771265979a and its peeled release commit is 88fc21e0b6523808cb627d2707354f1d8d2128db; use the peeled commit for any comparison.
2. Create disposable copies or worktrees of HaidaDaniel/translator-agent at architecture/canonical-v3-plan and HaidaDaniel/media-core at main, recording each real downstream HEAD SHA; install the exact candidate there and never modify the production downstream repositories. Temporary changes inside disposable copies are limited to installing the candidate CLI and its package-manager artifacts and to APK-generated operational output from the checks; none may be committed to downstream.
3. Run doctor, adopt --preview, sync in read-only mode, lint, status --detail, attention --json and workers --json; record command outcomes, exit codes and any pre-existing failures honestly. Identify the installed CLI by version, resolved binary path and installed dist/package identity tied to the exact candidate SHA.
4. Run safety checks for sync --write, export agents --force and init using artificial marker files and symlinks created solely for this test outside the disposable repository; never use real user files or evidence as markers, and confirm no outside write and non-zero exit where containment refuses.
5. Diff each disposable copy before and after every mutating check and confirm no unexpected changes to user files, tasks, .gitignore rules or evidence; report unavailable branches or missing prerequisites rather than claiming verification.
6. In an isolated checkout of the exact candidate, run the full pre-release gate pnpm release:check (quality:ci, build, APK lint, sync check, audit) and record the result with the checkout SHA.
7. Write the durable downstream dogfood report at docs/delivery/downstream-v060-corrective-dogfood.md with exact identities, the per-command matrix, safety outcomes, temporary-install scope and limitations; leave only a short summary with a link in docs/progress.md.
8. Run verification and complete this task without publishing or tagging any release.

## Acceptance criteria

- All requested commands are observed against the exact recorded APK candidate commit SHA in disposable copies of translator-agent/architecture/canonical-v3-plan and media-core/main; no claim is based on a downstream v0.5.2 pin.
- The report records each real downstream SHA and identifies the installed CLI by version, resolved binary path and installed dist/package identity bound to the exact candidate SHA.
- doctor, adopt --preview, read-only sync, lint, status --detail, attention --json and workers --json outcomes are recorded with exit codes and honest pre-existing failures.
- sync --write, export agents --force and init refuse artificial symlink escapes created from disposable marker files and leave no write outside the disposable repository; no user file or evidence is used as a marker.
- Temporary changes in disposable copies are limited to installing the exact candidate and APK-generated operational output and are documented; no user file, task, .gitignore rule or evidence is unexpectedly changed, and nothing is committed to downstream.
- Production downstream repositories remain untouched and any unavailable branch or prerequisite is reported as such.
- pnpm release:check passes in an isolated checkout of the exact candidate and its checkout SHA is recorded with the result.
- The durable report lives at docs/delivery/downstream-v060-corrective-dogfood.md and docs/progress.md contains only a short summary linking to it, with exact source and downstream identities and qualified unavailable facts.
- No release publication, tag, candidate commit rewrite, or change to source, dist, task files or evidence is performed by this task.

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"downstream-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Install the exact corrective candidate into disposable downstream copies and record the full command matrix, symlink-safety outcomes, file diffs, exact identities and any unavailable prerequisites."}`

## Documentation updates

- Create docs/delivery/downstream-v060-corrective-dogfood.md as the durable dogfood report.
- Add only a short summary with a link in docs/progress.md.

## Notes

- Baseline: immutable annotated tag object v0.6.0 = d83d069f5309ca2b963f8939a2626d771265979a; peeled release commit = 88fc21e0b6523808cb627d2707354f1d8d2128db. Never call the tag object SHA a commit; use the peeled commit for checkout and comparison. Temporary /tmp/opencode planning artifacts are advisory only and are not required evidence.
- Separate integration task is justified because the downstream command matrix spans all three corrective changes and is not adequately covered by any single task's acceptance criteria. Do not duplicate the individual unit/regression checks.
- Local read-only copies observed during planning: /tmp/opencode/translator-agent-inspect is on master (not the named branch) and /tmp/opencode/media-core-scratch is on main; named branches may need fresh disposable clones and must be reported if unavailable.
- Dependencies: 0286, 0287, 0288 must be done before the exact candidate can be installed and validated.
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated dirty state and must not be touched.
