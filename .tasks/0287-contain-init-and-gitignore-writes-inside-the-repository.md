# Task 0287 - Contain init and gitignore writes inside the repository

State: todo
Owner: none
Mode: maintenance
Lane: bugfix
Scope: init,gitignore,containment,security,tests
Risk: high
Parallel: false
Depends on: 0286
Tags: p1,security,containment,init,gitignore,symlink,tests

## Goal

Apply the same fail-closed containment to every file created by initProject and to the .gitignore writer, preserving additive idempotent ignore updates and existing user files.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/getting-started.md
- docs/adoption-flow.md
- src/core/config/paths.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts
- src/core/init/init.test.ts
- .tasks/0245-add-canonical-repository-local-agent-scratch-directory.md
- .tasks/0265-contain-configured-task-and-docs-mutations-inside-the-repository.md

## Files allowed to edit

- src/core/init/index.ts
- src/core/init/init.test.ts
- dist/**

## Files forbidden to edit

- src/core/config/**
- src/core/sync/**
- src/core/exporters/**
- src/core/doctor/**
- src/core/docs/**
- src/cli/**
- .tasks/**
- .agentic/**
- docs/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Reproduce B1-B7 with the built CLI from the peeled v0.6.0 release commit in isolated temporary repositories: symlinked .gitignore, existing symlink with a live target, dangling starter-file symlink outside .agentic, symlinked parent directory of starter files, ordinary init, repeated init, existing .agentic symlink protection, and adopt --apply with a symlinked .gitignore.
2. Import and reuse the batch containment helper delivered by Task A; do not duplicate or modify the shared path guard.
3. Define one unambiguous rule for every path init touches: an existing regular user file is skipped byte-for-byte; an existing symlink (target present or dangling) at a starter or .gitignore final component is refused before any mutation and never treated as an existing file through a following read; a symlinked ancestor directory is refused; only a missing regular path is created. Establish this with lstat-based containment over all STARTER_FILES and .gitignore before any write, replacing the following fileExists check, and keep the stricter .agentic refusal behavior.
4. Route ensureApkGitignore through the contained path while keeping renderApkGitignoreUpdate additive, byte-preserving, EOL-preserving and idempotent.
5. Extend init tests for an existing symlink with a live target, a dangling starter symlink, a symlinked parent directory, a symlinked .gitignore, existing regular user files, ordinary init, repeated init with user files preserved, and the already-protected .agentic path; assert no outside marker is created or changed in every refusal case and record Windows symlink privilege caveats.
6. Confirm adopt --apply remains unchanged and still refuses a symlinked .gitignore; do not rewrite it without a reproduced defect.
7. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- CONFIRMED repro B1-B3 no longer write outside the repository: symlinked .gitignore, dangling starter symlink and symlinked starter parent are all refused before any write.
- Every path init touches follows one rule: existing regular user files are skipped byte-for-byte; existing symlinks with a live target are refused and never silently skipped through a following read; dangling symlinks are refused with no outside target created; symlinked ancestors are refused; only missing regular paths are created.
- Containment checks cover every file created by initProject, including non-.agentic starters and .gitignore, before the first mutation of the batch.
- .gitignore updates remain safe and additive: canonical entries are appended only once, user rules and EOL style are preserved, and a repeated init is idempotent.
- Existing user files and ignore rules are preserved according to the init skip contract and no ignore rule is overwritten without that contract basis.
- Containment errors are understandable and produce a non-zero CLI exit through the existing command error path.
- Tests cover Linux behavior and document Windows symlink creation caveats; repeated init stays safe and idempotent.
- The already-protected .agentic path behavior and adopt --apply containment remain unchanged with no reproduced defect rewritten.
- No changes outside src/core/init/index.ts and src/core/init/init.test.ts (plus generated dist); the shared path guard from Task A is reused.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/init/init.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"init-repro-report","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Run isolated init symlink repros and record exit codes, whether outside markers changed, .gitignore bytes before/after, and the repeated-init idempotence result."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- No new user documentation is required; the behavior matches the containment contract already documented in docs/task-system.md and docs/adoption-flow.md.

## Notes

- Depends on Task A: this task imports the batch containment helper added there, so A must be done first.
- Reproduced at /tmp/opencode/apk-v060-repro/B1-gitignore-symlink, B2-starter-dangling-symlink, B3-starter-parent-symlink; B6-agentic-symlink-protected and B7-adopt-gitignore-symlink already fail closed. These temporary artifacts are advisory only and are not required evidence; required evidence comes from the committed regression tests and the recorded repro report.
- Baseline: immutable annotated tag object v0.6.0 = d83d069f5309ca2b963f8939a2626d771265979a; peeled release commit = 88fc21e0b6523808cb627d2707354f1d8d2128db. Never call the tag object SHA a commit; use the peeled commit for checkout, comparison and source reproduction. HEAD was 556daeacbb54f93353297245614b78891291f671 when the repro ran and 0abc6c29fded4bcde925900e69895a3b6a58fba4 when this contract was corrected; intervening commits are docs/task-only, and source/dist match the peeled release commit.
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated dirty state and must not be touched.
