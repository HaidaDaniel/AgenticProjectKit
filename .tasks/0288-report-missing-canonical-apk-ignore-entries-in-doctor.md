# Task 0288 - Report missing canonical APK ignore entries in doctor

State: done
Owner: opencode-impl
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

1. Confirm repro C with the built CLI from the peeled v0.6.0 release commit: doctor on a repository whose .gitignore lacks the canonical entries reports Result: pass with no ignore-related check.
2. Define and document the exact contract in docs/cli-commands.md. Classify each canonical entry separately by canonical-string presence and by effective Git ignore behavior. A missing canonical string with proven effective ignore is an informational pass, not a leak warning; a missing canonical string without proven effective ignore is a warn naming that entry and the safe fix path through apk init or apk adopt; never fail. Treat the two !.agentic/.../.gitkeep entries as re-include rules whose effective assertion is that the corresponding .gitkeep is not ignored.
3. Bound the probe: at most eight representative paths covering the distinct ignore-rule families and at most one additional git check-ignore process per doctor run. Use --no-index --verbose --non-matching -z, pass probe paths as stdin only, validate four NUL-delimited fields per path, and interpret exit 0 as at least one match, exit 1 as no match, and exit 128, malformed output or spawn failure as inspection unavailable. Reuse doctor's existing git and tracked-operational inspection results; do not call planApkGitignore or inspectApkGitignore and do not add a second git ls-files index walk.
4. Add one read-only check in doctor that consumes the already-computed tracked-operational report. Emit warn only for an unproven effective ignore; include the proven source:line:pattern in a pass-level informational note when an equivalent nested .gitignore, .git/info/exclude or global rule exists; doctor must never write .gitignore or any other file.
5. Use warn or unavailable, never pass, when Git is absent, check-ignore returns 128, or its output is malformed, so an unavailable inspection is not rendered as a false PASS or a leak claim.
6. Add tests for clean config, partially missing entries, fully current .gitignore, missing .gitignore, equivalent ignore rules including a broad root pattern and .git/info/exclude, negation re-include entries, each check-ignore exit-code class, absent Git, and byte-for-byte no file changes after doctor.
7. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- CONFIRMED repro C now produces a doctor check naming the missing canonical entries, including /tmp/apk/ and .agentic/perf/* for the downstream example when they are not effectively ignored.
- The check distinguishes a missing canonical string from missing effective Git ignore behavior: an equivalent proven rule yields no leak warning, and a warn is emitted only when effective ignore is unproven or inspection is unavailable.
- Negation entries are evaluated as re-include rules, not as missing ignore rules, and broad or nested equivalent patterns are not reported as failures.
- Git work is bounded to at most one additional check-ignore process and at most eight probe paths, reuses the existing tracked-operational inspection, and adds no second full git ls-files index walk; exit 0/1/128 and malformed output are handled as specified.
- doctor remains read-only: no .gitignore or other file is created, modified or deleted by the command.
- An unavailable Git or failed inspection is surfaced as warn or unavailable with an honest reason, never as PASS and never as a proven leak.
- The check reports a safe remediation path via existing apk init / apk adopt commands and never edits .gitignore itself.
- Existing doctor output compatibility is preserved: the new check is warn/pass/unavailable, never fail, and Result: pass is unchanged for otherwise healthy repositories.
- Tests cover every scenario listed in Step 6, with no changes outside doctor source/tests and docs/cli-commands.md (plus generated dist).

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/doctor/doctor.test.ts"}`
- `{"id":"docs-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the read-only ignore diagnostic contract and output in docs/cli-commands.md.

## Notes

- Baseline: immutable annotated tag object v0.6.0 = d83d069f5309ca2b963f8939a2626d771265979a; peeled release commit = 88fc21e0b6523808cb627d2707354f1d8d2128db. Never call the tag object SHA a commit; use the peeled commit for checkout, comparison and source reproduction. HEAD was 556daeacbb54f93353297245614b78891291f671 when the repro ran and 0abc6c29fded4bcde925900e69895a3b6a58fba4 when this contract was corrected; intervening commits are docs/task-only, and source/dist match the peeled release commit. Temporary /tmp/opencode repro artifacts are advisory only and are not required evidence.
- Downstream example: HaidaDaniel/translator-agent branch architecture/canonical-v3-plan lacks /tmp/apk/ and .agentic/perf/*; HaidaDaniel/media-core main has both. Do not treat downstream v0.5.2-pinned behavior as v0.6.0 evidence.
- Canonical entries are APK_OPERATIONAL_IGNORE_ENTRIES in src/core/init/index.ts:29-48; reuse the export, do not copy the list.
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated dirty state and must not be touched.
