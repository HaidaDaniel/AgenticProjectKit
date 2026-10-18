# Task 0220 - Reject misleading noncanonical task scope patterns

State: todo
Owner: none
Mode: maintenance
Lane: task-authoring
Type: bugfix
Scope: task-contract,paths,lint,authoring
Risk: low
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Reject noncanonical scope patterns that contain `.` path segments and currently survive path validation but fail to match the corresponding Git paths. Examples include `src/./file.ts` and repeated leading segments such as `././src/file.ts`. Give authors a clear task-creation error and a lint finding on existing contracts without rewriting the pattern or broadening permissions.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- .tasks/0186-harden-task-contract-authoring-evidence-and-path-ergonomics.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- dist/**
- docs/task-system.md
- docs/progress.md

## Files forbidden to edit

- src/core/tasks/gate.ts
- src/core/tasks/evidence.ts
- src/core/tasks/provenance.ts
- src/cli/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Capture current behavior for `src/./file.ts`, `././src/file.ts`, and canonical `src/file.ts` patterns at task-creation and lint boundaries.
2. Trace `taskPathPatternIssue`, task creation preflight, `normalizeRepoPath`, lint path-contract checks, and Git path matching. Confirm why accepted noncanonical patterns fail to match the expected repository path.
3. Add a direct raw-pattern diagnostic for dot segments before normalization can erase or disguise them. Tell authors to use a canonical repository-relative path pattern.
4. Preserve existing glob operators, allowed/forbidden scope meanings, overlap diagnostics, and Task 0186's allowed-child/forbidden-parent handling.
5. Add regression tests proving task creation rejects the pattern before writing a task file and lint reports the same issue for an existing contract.
6. Confirm the error path does not auto-rewrite, normalize, or widen any allowed or forbidden pattern.
7. Regenerate committed dist and document the canonical path rule.

## Acceptance criteria

- A failing signal is captured before any implementation change, or its objective reproduction limits (flaky/UI/provider/unavailable) are documented with attempts, environment, and unknowns.
- The old failing behavior no longer reproduces after the fix, and untested hypotheses are not reported as root-cause facts.
- Minimization and instrumentation are proportional, and regression protection is added where the host project supports it.
- No unrelated refactor is included.
- Task creation rejects patterns containing a `.` segment, including interior `src/./file.ts` and repeated leading `./` forms, before writing a task file.
- Lint reports a specific, actionable path-pattern error for the same malformed patterns in existing task contracts.
- Canonical repository-relative patterns keep their current matching and scope behavior; allowed/forbidden enforcement is not weakened.
- Invalid patterns are reported verbatim and never rewritten or normalized into broader permissions.
- Task 0186's allowed-child/forbidden-parent contradiction remains an error with its existing remediation diagnostic.
- Committed dist matches source.

## Correctness assumptions

- A reproducer or captured failing observation is usually available but not universally deterministic or economical.
- A plausible hypothesis and a successful patch alone do not establish root cause.

## Invariants

- No implementation patch precedes a documented failing-signal attempt; objective reproduction limits stay explicit.
- No forced red test is required for unsupported, flaky, UI-only, or provider-dependent cases.
- The fix preserves behavior outside the reported defect.

## Required evidence

- Pre-fix failing signal or captured best-effort observation with environment and limits, plus the post-fix result and regression output where practical.
- Task-creation regression for an interior dot segment and repeated leading `./`, including proof no task file is written.
- Lint regression for both forms in allowed and forbidden patterns, with diagnostic code and original pattern preserved.
- Canonical pattern matching and Task 0186 contradiction regression output.

## Review questions

- Was a failing signal attempted before the fix, and are hypotheses distinguished from proven root cause?
- Does validation inspect the original pattern before `normalizeRepoPath` removes a leading prefix?
- Could accepting a `.` segment cause a pattern to miss the Git path it appears to name?
- Are canonical patterns and supported `*`/`**` cases semantically unchanged?
- Does the diagnostic identify the original malformed pattern without suggesting a normalization that broadens access?
- Does the existing Task 0186 contradiction check remain unchanged?

## Counterexample searches

- `src/./file.ts`, `src/./**`, `././src/file.ts`, and repeated `./` prefixes.
- `./src/file.ts` as a single leading dot segment and canonical `src/file.ts`.
- Parent traversal `../src/file.ts`, empty segments `src//file.ts`, absolute paths, and backslash separators.
- Canonical `src/*.ts`, `src/**`, and literal paths without dot segments.
- Invalid patterns in both `allowedFiles` and `forbiddenFiles`.
- Allowed child plus forbidden parent, sibling non-overlap, and Task 0186 remediation.
- Confirm neither task creation nor lint runs declared verification commands.

## Verification

- `{"id":"path-contract-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts src/core/audit/audit.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document that task scope patterns use canonical repository-relative paths and that dot segments are rejected.
- Update docs/progress.md when task state changes.

## Notes

- Downstream evidence: ResLedger commits `870b06d2` and `ce24dbeb`; RigOps commits `c3e4b0d7` and `87ca1279`.
- Current source gap: `taskPathPatternIssue` in `src/core/tasks/index.ts` rejects `..` and empty segments but does not reject `.` segments; `createTask` and `lintPathContracts` in `src/core/audit/lint.ts` both rely on this check. `normalizeRepoPath` strips one leading `./`, leaving repeated prefixes unmatched to Git paths.
- Impact: a task can be authored with an allowed/forbidden pattern that looks like it names a Git path but never matches that path, leading to misleading scope diagnostics and wasted correction work.
- Task 0186 already handles allowed-child/forbidden-parent contradictions; this task covers only noncanonical dot segments and must preserve that behavior.
- `src/core/tasks/index.ts`, `src/core/tasks/task.test.ts`, and `dist/**` are shared with Task 0219; do not run this task concurrently with that task.
- Lint remains static and must not execute declared verification commands.
