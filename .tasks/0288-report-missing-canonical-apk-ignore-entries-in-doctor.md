# Task 0288 - Report missing canonical APK ignore entries in doctor

State: todo
Owner: none
Mode: maintenance
Lane: diagnostics
Scope: doctor,diagnostics,gitignore,read-only,tests
Risk: medium
Parallel: false
Depends on: none
Tags: p2,doctor,diagnostics,gitignore,read-only,tests

## Goal

Add a read-only doctor diagnostic that reports which canonical APK operational ignore entries are absent from .gitignore, distinguishes canonical-string absence from effective Git ignore behavior, and shows a safe fix path without modifying files.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- docs/decisions.md
- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- src/core/init/index.ts
- src/core/tasks/archive-git-safety.ts
- .tasks/0236-expose-tracked-apk-operational-artifacts-in-doctor-with-migration-guidance.md

## Files allowed to edit

- src/core/doctor/index.ts
- src/core/doctor/doctor.test.ts
- docs/cli-commands.md
- dist/**

## Files forbidden to edit

- src/core/init/**
- src/core/sync/**
- src/core/exporters/**
- src/core/config/**
- src/cli/**
- .tasks/**
- .agentic/**
- docs/releases/**
- docs/decisions.md
- docs/task-system.md
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Confirm repro C: doctor on a repository whose .gitignore lacks the canonical entries reports Result: pass with no ignore-related check.
2. Define and document the exact contract in docs/cli-commands.md: canonical entry string presence is the reported signal, while equivalent Git patterns from nested .gitignore, .git/info/exclude or global excludes are disambiguated with a bounded read-only git check-ignore --no-index --verbose --non-matching probe; never claim a path is unignored without evidence.
3. Add one read-only check in doctor that reuses the already-computed tracked-operational report and never calls planApkGitignore or inspectApkGitignore, so the ls-files index walk is not repeated.
4. Emit warn, not fail, with the specific missing canonical entries, the effective-ignore qualification where available, a note that the two !.agentic/*.gitkeep entries are re-include rules, and a safe fix path through apk init or apk adopt; doctor must never write .gitignore.
5. Use warn or unavailable rather than pass when Git is absent or ignore inspection fails, so an unavailable check is not rendered as a false PASS.
6. Add tests for clean config, partially missing entries, fully current .gitignore, missing .gitignore, equivalent ignore rules, absent Git or inspection error, and byte-for-byte no file changes after doctor.
7. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- CONFIRMED repro C now produces a doctor check naming the missing canonical entries, including /tmp/apk/ and .agentic/perf/* for the downstream example.
- doctor remains read-only: no .gitignore or other file is created, modified or deleted by the command.
- The check reports a safe remediation path via existing apk init / apk adopt commands and never edits .gitignore itself.
- An unavailable Git or failed inspection is not reported as PASS; it is surfaced as warn or unavailable with an honest reason.
- The implementation reuses the tracked-operational Git inspection already performed by doctor and does not add a second full git ls-files index walk.
- Existing doctor output compatibility is preserved: the new check is warn/pass, never fail, and Result: pass is unchanged for otherwise healthy repositories.
- The documented contract distinguishes canonical string absence from effective ignore behavior and does not present an unverified assumption as an error.
- Tests cover all seven scenarios listed in Steps with no changes outside doctor source/tests and docs/cli-commands.md (plus generated dist).

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:source"}`
- `{"id":"docs-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the read-only ignore diagnostic contract and output in docs/cli-commands.md.

## Notes

- Baseline tag v0.6.0 d83d069f5309ca2b963f8939a2626d771265979a; doctor has no ignore check at HEAD 556daeacbb54f93353297245614b78891291f671.
- Downstream example: HaidaDaniel/translator-agent branch architecture/canonical-v3-plan lacks /tmp/apk/ and .agentic/perf/*; HaidaDaniel/media-core main has both. Do not treat downstream v0.5.2-pinned behavior as v0.6.0 evidence.
- Canonical entries are APK_OPERATIONAL_IGNORE_ENTRIES in src/core/init/index.ts:29-48; reuse the export, do not copy the list.
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated dirty state and must not be touched.
