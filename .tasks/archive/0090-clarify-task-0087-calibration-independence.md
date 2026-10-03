# Task 0090 - Clarify Task 0087 calibration independence

State: done
Owner: codex-resource-docs
Mode: product
Lane: documentation
Type: docs
Scope: tasks,docs
Risk: low
Parallel: false
Depends on: none
Tags: docs

## Goal

Remove wording that incorrectly orders Task 0087 after calibration while preserving its dependency on 0085 and independence from 0086.

## Context files

- AGENTS.md
- docs/progress.md
- .tasks/0087-worker-attention-and-resource-status.md
- .tasks/0089-correct-resource-aware-dependency-ownership.md

## Files allowed to edit

- .tasks/0087-worker-attention-and-resource-status.md
- docs/progress.md

## Files forbidden to edit

- src/**
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .tasks/000*-*.md
- .tasks/001*-*.md
- .tasks/002*-*.md
- .tasks/003*-*.md
- .tasks/004*-*.md
- .tasks/005*-*.md
- .tasks/006*-*.md
- .tasks/007*-*.md
- .tasks/0080-*.md
- .tasks/0081-*.md
- .tasks/0082-*.md
- .tasks/0083-*.md
- .tasks/0084-*.md
- .tasks/0085-*.md
- .tasks/0086-*.md
- .tasks/0088-*.md
- .tasks/0089-*.md
- .tasks/archive/**

## Steps

1. Clarify the Task 0087 priority note
2. Update progress for the completed correction
3. Run canonical verification and completion gate

## Acceptance criteria

- 0087 wording says it follows registry routing and assurance
- 0087 explicitly remains parallel with calibration after 0085
- Dependencies remain unchanged
- No runtime code changes

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx src/cli/index.ts lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update progress for Task 0090 completion

## Notes

- Wording-only task-contract correction
