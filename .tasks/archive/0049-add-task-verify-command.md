# Task 0049 - Add Task Verify Command

State: done
Owner: codex-plan-47
Mode: product
Lane: verification
Scope: cli,tasks,git,docs,tests
Risk: high
Parallel: false
Depends on: 0048
Tags: verify,guardrails,git,tasks,workflow

## Goal

Add a CLI verification command that turns task allowed/forbidden file lists from prompt guidance into an enforceable local guardrail.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/context-system.md
- docs/cli-commands.md
- README.md
- src/cli/index.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/agents/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts

## Files allowed to edit

- .tasks/0049-add-task-verify-command.md
- README.md
- docs/cli-commands.md
- docs/task-system.md
- docs/progress.md
- src/cli/index.ts
- src/cli/commands/task.ts
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/agents/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- exporter templates
- web UI files or web UI plans

## Steps

1. Add `apk task verify <task-id>` help and routing.
2. Load the task by id, including the configured task directory.
3. Read changed files from Git using deterministic commands, starting with `git diff --name-only` and including staged changes.
4. Treat paths as repo-relative normalized POSIX-style strings for matching.
5. Check that each changed file is covered by task `Files allowed to edit`.
6. Check that no changed file matches task `Files forbidden to edit`.
7. Support exact paths first; add simple glob support only if it can be tested without adding dependencies.
8. Run the task `Verification commands` in order unless `--check-files-only` is supplied.
9. Stop on first failed verification command and return non-zero.
10. Write a compact run-log event for verification pass/fail when an `--owner <agent-id>` is supplied.
11. Print concise output suitable for humans and CI logs.
12. Add tests for clean pass, forbidden touch, out-of-allowed touch, verification command failure, and help output.

## Acceptance criteria

- `apk task verify <task-id>` exits 0 when changed files are allowed, forbidden files are untouched, and verification commands pass.
- `apk task verify <task-id>` exits 1 when any changed file is outside allowed files.
- `apk task verify <task-id>` exits 1 when any forbidden file is changed, even if it is also listed as allowed.
- `apk task verify <task-id> --check-files-only` checks file scope without running task verification commands.
- `apk task verify <task-id> --owner <agent-id>` records pass/fail in the sharded run log without storing stdout, stderr, diffs, or absolute paths.
- Output includes task id, changed file count, file-scope result, command result, and next suggested task state.
- No web UI or agent runner is added.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js task verify --help
- node dist/cli/index.js audit

## Documentation updates

- Update docs/cli-commands.md with `apk task verify <task-id>`.
- Update docs/task-system.md to say allowed/forbidden files can be enforced with verify.
- Update README workflow examples to run verify before review/done.
- Update docs/progress.md when task state changes.

## Notes

- This is the highest-value guardrail from the analysis.
- Avoid adding a dependency for globbing unless exact path matching is clearly insufficient for current task contracts.
- Keep command execution conservative; do not invent shell behavior beyond the existing verification command strings.
