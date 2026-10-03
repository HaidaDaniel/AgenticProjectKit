# Task 0056 - Use repo-local apk in agent instructions

State: done
Owner: codex-apk-local-cli
Mode: product
Lane: bugfix
Scope: exporters docs tests
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Generated and documented agent instructions must use the project-local APK command via pnpm exec apk so agents do not depend on a global apk binary.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/agent-exporters.md
- docs/cli-commands.md
- README.md
- src/core/exporters/index.ts
- src/core/agents/index.ts
- src/core/work/index.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/core/templates/renderer.test.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/core/templates/exporters/agents.md.hbs
- src/core/templates/exporters/codex.md.hbs
- src/core/templates/exporters/opencode.md.hbs
- src/core/templates/exporters/gemini.md.hbs
- src/core/templates/exporters/claude.md.hbs
- src/core/templates/exporters/cursor-task-workflow.mdc.hbs
- src/core/templates/renderer.test.ts
- src/core/exporters/index.ts
- src/core/agents/index.ts
- src/core/work/index.ts
- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/progress.md
- README.md
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .codex/instructions.md
- .opencode/AGENTS.md
- .cursor/rules/task-workflow.mdc
- .tasks/0056-use-repo-local-apk-in-agent-instructions.md

## Files forbidden to edit



## Steps

1. Reproduce or characterize the bug.
2. Implement the smallest safe fix.
3. Add or update regression coverage.
4. Run verification.

## Acceptance criteria

- Bug is fixed.
- Regression coverage exists.

## Verification commands

- pnpm lint
- pnpm test
- pnpm build
- pnpm exec apk sync
- pnpm exec apk audit

## Documentation updates

- Update docs/progress.md when task state changes.

## Notes

- Keep the fix narrow.
- Bug root cause: generated agent guidance assumed global `apk` instead of project-local `pnpm exec apk`.
