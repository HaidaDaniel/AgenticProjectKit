# Task 0232 - Add package-metadata CLI version output for all public aliases

State: done
Owner: codex-corrective-0232
Mode: maintenance
Lane: cli
Type: feature
Scope: cli,version,packaging,docs,tests
Risk: low
Parallel: true
Depends on: 0227
Tags: cli,version,packaging,tests

## Goal

Make `apk --version`, `apkit --version`, and `agentic-project-kit --version` print the installed APK package version from package metadata. The command must work in a downstream repository, outside Git, and from a repo-local or Git-tag installation without reading the downstream project's `package.json` or running project diagnostics.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- src/cli/index.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- package.json

## Files allowed to edit

- src/cli/index.ts
- src/cli/version.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- dist/**
- docs/cli-commands.md
- README.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/**
- src/cli/commands/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce the current failure before editing: run `node dist/cli/index.js --version` (or the source entrypoint) in the repository and in an empty temporary directory. Record exit code 1 and `Unknown command: --version`.
2. Add a small resolver in `src/cli/version.ts` that reads the APK package metadata relative to the CLI module URL, not `process.cwd()`. Walk upward from the module directory to the package root and stop at a bounded depth. Validate the package name and a non-empty SemVer-looking version before using them.
3. Make the resolver work for both the source entrypoint and the packaged entrypoint. For `src/cli/index.ts`, the package root is the repository root. For `dist/cli/index.js`, it is two directories above `dist/cli`. Do not use a hardcoded version string.
4. Handle `--version` in `src/cli/index.ts` before any command dispatch, performance wrapper, repository read, Git call, or generated-file check. Support it as a standalone argument. Do not treat it as a task command.
5. Print a stable single-line identity containing the package name and version, for example `agentic-project-kit 0.5.1`. All three public bin aliases must produce the same identity because they share one entrypoint.
6. Fail closed with a bounded error and exit code 1 if package metadata is missing, unreadable, malformed, or has no usable version. Do not fall back to the downstream project's version and do not print a fabricated version.
7. Keep `--help`, `-h`, no-argument help, and every existing command unchanged. If a global-options line is added to help, keep it consistent with the canonical command reference tests.
8. Add tests in `src/cli/cli.test.ts` for source and packaged entrypoints, all three alias names where practical, a downstream `package.json` with a different version, a directory outside Git, a missing or malformed APK manifest, side-effect freedom, and unchanged help behavior.
9. Document the version command in `docs/cli-commands.md` and the README usage section. Note that the value comes from installed APK package metadata, not from the host repository.
10. Run the focused CLI tests, typecheck, lint, APK task lint, docs consistency, diff check, and committed-dist check. Also run the built entrypoint directly to confirm its version.

## Acceptance criteria

- `apk --version`, `apkit --version`, and `agentic-project-kit --version` exit 0 and print the same installed APK name and version.
- The reported version equals the version in the installed APK package metadata; no hardcoded version literal is used for the output.
- The command works when the current directory is outside a Git repository.
- The command works from a repo-local source invocation and from the packaged `dist/cli/index.js` entrypoint.
- A downstream project `package.json` with a different name or version does not affect the output.
- The command does not read task files, configuration, evidence, run logs, or generated instructions, and does not run project diagnostics.
- The command creates no files and mutates no state.
- Missing, unreadable, or malformed APK package metadata produces a bounded error and exit code 1 without a fabricated version.
- `apk --help`, `apkit --help`, and no-argument help still work and do not regress.
- Existing commands and aliases continue to dispatch normally.
- Documentation describes the version source and the downstream-use case.
- The focused tests, typecheck, lint, APK lint, docs consistency, diff check, and committed-dist checks pass.

## Correctness assumptions

- The installed package manifest is the authoritative release identity for a packaged CLI.
- The CLI module location is a reliable anchor for locating the package root in both source and packaged layouts.
- A downstream repository can contain its own `package.json`; that file is not APK metadata.
- Adding `--version` does not change the meaning of any existing command.
- The package name and version are already present in the package manifest and do not require a generated version module.

## Invariants

- Never hardcode the version or duplicate it in a second tracked source.
- Never read the downstream project's manifest for the version.
- Never run diagnostics, Git, task parsing, or generated-file checks for `--version`.
- Never create files or mutate state.
- Never change or remove an existing public command or alias.
- Never change release-version semantics or `package.json`.
- Never print a plausible version when metadata is unavailable; fail closed.

## Required evidence

- Pre-fix reproduction showing `Unknown command: --version`.
- Post-fix output for all three aliases from source and packaged entrypoints.
- Output from an empty directory outside Git and from a directory with a conflicting downstream `package.json`.
- Missing or malformed manifest failure output.
- Focused test output, typecheck, lint, APK lint, docs consistency, diff check, and committed-dist result.

## Review questions

- Does the resolver locate APK package metadata rather than the current working directory?
- Can a downstream `package.json` or an unrelated parent manifest change the reported version?
- Is any version literal still hardcoded in source or generated files?
- Does `--version` avoid all diagnostic and repository work?
- Are all three aliases routed through the same version path?
- Does malformed or missing metadata fail closed rather than printing a fallback?
- Do help and existing commands remain unchanged?

## Counterexample searches

- Running from a directory with a `package.json` whose version is `999.0.0`.
- Running outside Git and outside any APK project.
- Running the source entrypoint and the built `dist` entrypoint.
- A package manifest with a missing version, an empty version, or malformed JSON.
- A moved or copied `dist` directory without its package manifest.
- `--version` combined with an unknown command or extra arguments.
- `--help`, `-h`, and no arguments.
- A workspace or symlinked install path.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document `--version` and its package-metadata source in `docs/cli-commands.md`.
- Add the version check to the README usage/install verification guidance.
- Update `docs/progress.md` when the task state changes.

## Notes

- Confirmed defect in APK v0.5.1: `pnpm exec apk --version` exits 1 with `Unknown command: --version`; there is no version branch in `src/cli/index.ts`.
- The downstream audit had to read the package manifest and lockfile manually to identify the installed version, which is exactly the diagnostic overhead this task removes.
- Keep the scope to the version flag. Do not add build metadata, commit identity, package-path diagnostics, runtime-version reporting, or a new command family unless a test proves the version requirement cannot be met otherwise.
- The audit also mentioned that root help does not list nested `task epoch` and `task amendment preview` entries. That help-registry consistency issue is out of scope for this task and must not be bundled into it.
- This task depends on Task 0227 because both edit `src/cli/cli.test.ts`. The formal dependency prevents concurrent work on that test file. After 0227 is done, 0232 can run in parallel with unrelated tasks such as 0228, 0229, 0230, and 0231 when they use separate worktrees.
- Todo Task 0223 also allows `src/cli/command-registry.ts`, `src/cli/cli.test.ts`, and `docs/cli-commands.md`. Do not run 0223 concurrently with this task. Implement 0232 before 0223 on a clean baseline, or rebase 0223 after 0232. Blocked Task 0221 also lists `src/cli/command-registry.ts` if it is ever unblocked.
