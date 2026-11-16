# Task 0289 - Dogfood the corrective APK candidate in disposable downstream copies

State: todo
Owner: none
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

1. Wait until the three corrective tasks are done, then freeze and record the exact candidate commit SHA and committed dist state; do not use a v0.6.0 or v0.5.2 pinned CLI as the tested candidate.
2. Create disposable copies or worktrees of HaidaDaniel/translator-agent at architecture/canonical-v3-plan and HaidaDaniel/media-core at main; install the exact candidate there and never modify the production downstream repositories.
3. Run doctor, adopt --preview, sync in read-only mode, lint, status --detail, attention --json and workers --json; record command outcomes, exit codes and any pre-existing failures honestly.
4. Run the safety checks for sync --write, export agents --force and init using artificial symlink markers outside the disposable repository; confirm no outside write and non-zero exit where containment refuses.
5. Diff each disposable copy before and after every mutating check and confirm no unexpected changes to user files, task files, .gitignore rules or evidence; report unavailable branches or missing prerequisites rather than claiming verification.
6. Record a bounded downstream report in docs/progress.md with exact candidate SHA, downstream SHAs, command matrix, safety outcomes and limitations.
7. Run verification and complete this task without publishing or tagging any release.

## Acceptance criteria

- All requested commands are observed against the exact recorded corrective candidate SHA in disposable copies; no claim is based on a downstream v0.5.2 pin.
- doctor, adopt --preview, read-only sync, lint, status --detail, attention --json and workers --json outcomes are recorded with exit codes and honest pre-existing failures.
- sync --write, export agents --force and init refuse artificial symlink escapes and leave no write outside the disposable repository.
- No unexpected changes to user files, tasks, .gitignore or evidence are observed in any disposable copy.
- Production downstream repositories remain untouched and any unavailable branch or prerequisite is reported as such.
- The report in docs/progress.md names exact source and downstream identities and keeps post-release or unavailable facts clearly qualified.
- No release publication, tag, candidate commit rewrite, or change to source, dist, task files or evidence is performed by this task.

## Verification

- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"downstream-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Install the exact corrective candidate into disposable downstream copies and record the full command matrix, symlink-safety outcomes, file diffs, exact identities and any unavailable prerequisites."}`

## Documentation updates

- Record the bounded downstream dogfood result and exact identities in docs/progress.md.

## Notes

- Separate integration task is justified because the downstream command matrix spans all three corrective changes and is not adequately covered by any single task's acceptance criteria. Do not duplicate the individual unit/regression checks.
- Local read-only copies observed during planning: /tmp/opencode/translator-agent-inspect is on master (not the named branch) and /tmp/opencode/media-core-scratch is on main; named branches may need fresh disposable clones and must be reported if unavailable.
- Dependencies: 0286, 0287, 0288 must be done before the exact candidate can be installed and validated.
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated dirty state and must not be touched.
