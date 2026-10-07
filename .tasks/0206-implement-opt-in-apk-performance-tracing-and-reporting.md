# Task 0206 - Implement opt-in APK performance tracing and reporting

State: done
Owner: codex-performance-20261007
Mode: product
Lane: implementation
Type: feature
Scope: performance,cli,execution,privacy,tests,docs
Risk: high
Parallel: false
Depends on: 0205
Tags: performance,profiling,cli,privacy,observability

## Goal

Implement opt-in APK performance tracing and reporting

## Context files

- AGENTS.md
- package.json
- .agentic/config.json
- docs/architecture.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/cli-commands.md
- docs/research/apk-performance-measurement-contract.md
- .tasks/0205-define-apk-performance-measurement-contract.md
- src/cli/command-registry.ts
- src/cli/index.ts
- src/core/tasks/index.ts
- src/core/audit/index.ts
- src/core/status/index.ts

## Files allowed to edit

- src/core/perf/**
- src/cli/commands/perf.ts
- src/cli/command-registry.ts
- src/cli/index.ts
- src/core/agents/index.ts
- src/core/context-suggestions/index.ts
- src/core/docs/context.ts
- src/core/doctor/index.ts
- src/core/init/index.ts
- src/core/quality/index.ts
- src/core/scanners/index.ts
- src/core/tasks/lock.ts
- src/core/tasks/provenance.ts
- src/core/tasks/index.ts
- src/core/workspaces/index.ts
- src/core/doctor/index.ts
- src/core/quality/index.ts
- src/core/audit/index.ts
- src/core/status/index.ts
- src/cli/command.test.ts
- src/cli/cli.test.ts
- src/core/init/init.test.ts
- src/core/tasks/task.test.ts
- src/core/perf/**
- docs/research/**
- docs/cli-commands.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- dist/**
- .gitignore

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .github/**

## Steps

1. Implement bounded local session
2. invocation and span primitives using monotonic timing

## Acceptance criteria

- Profiling is opt-in and off by default with no daemon
- network
- database or LLM

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-perf-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/perf/*.test.ts src/cli/command.test.ts"}`
- `{"id":"cli-smoke","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/cli/cli.test.ts"}`
- `{"id":"build","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm build"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"static","profile":"report","command":"node scripts/check-docs-consistency.mjs","artifact":"docs/cli-commands.md"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the opt-in profiler contract and CLI without adding mandatory workflow steps

## Notes

- Depends on the accepted measurement contract. Trace files must remain local and ignored.
