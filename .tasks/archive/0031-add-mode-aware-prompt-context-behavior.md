# Task 0031 - Add Mode Aware Prompt Context Behavior

State: done
Owner: codex-a
Mode: product
Lane: prompts
Scope: modes,prompt,context
Risk: medium
Parallel: true
Depends on: 0028
Tags: modes,prompt,context,v0.3

## Goal

Make prompt and context output reflect the active operating mode more clearly.

## Context files

- AGENTS.md
- docs/modes.md
- docs/context-system.md
- src/core/docs/prompt.ts
- src/core/docs/context.ts
- src/core/modes/index.ts

## Files allowed to edit

- src/core/docs/prompt.ts
- src/core/docs/context.ts
- src/core/docs/prompt.test.ts
- docs/modes.md
- docs/progress.md

## Files forbidden to edit

- application source files
- task state commands

## Steps

1. Read active mode for prompt and context generation where useful.
2. Include concise mode-specific guidance.
3. Keep prompt output compact.

## Acceptance criteria

- Prompt output includes useful mode guidance.
- Context output remains deterministic.
- Existing prompt agents keep supported values.

## Verification commands

- pnpm test
- pnpm lint

## Documentation updates

- Update docs/modes.md.
- Update docs/progress.md.

## Notes

- Preserve caveman style when configured.
