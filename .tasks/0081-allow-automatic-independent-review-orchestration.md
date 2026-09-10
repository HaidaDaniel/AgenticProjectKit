# Task 0081 - Allow automatic independent review orchestration

State: done
Owner: codex-quality-plan
Mode: product
Lane: agent-policy
Scope: agent-instructions,review,workflow,docs
Risk: medium
Parallel: false
Depends on: 0076
Tags: agents,review,workflow,automation

## Goal

Permit a primary agent to launch a separate read-only reviewer when policy requires and continue the fix-review-done loop without waiting for user confirmation.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/exporters/index.ts

## Files allowed to edit

- src/core/exporters/index.ts
- src/core/docs/adopt.test.ts
- src/core/sync/sync.test.ts
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .codex/instructions.md
- .opencode/AGENTS.md
- .cursor/rules/*.mdc
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- SPEC.md
- .tasks/0081-allow-automatic-independent-review-orchestration.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**

## Steps

1. Add the neutral orchestration rule to exporter policy
2. Regenerate all agent instructions
3. Document boundaries and verify drift

## Acceptance criteria

- Generated instructions authorize automatic reviewer delegation when policy requires
- The implementation owner cannot certify its own candidate
- The primary agent continues through fixes and done without routine user confirmation
- Generated exports remain in sync

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk sync"}`

## Documentation updates

- Update task-system decisions and progress docs

## Notes

- Review remains revision-bound and separate in identity and context; this does not make APK own model runtime.
