# Task 0205 - Define APK performance measurement contract

State: doing
Owner: codex-performance-20261007
Mode: discovery
Lane: architecture
Type: docs
Scope: performance,measurement,benchmark,privacy,docs
Risk: high
Parallel: false
Depends on: none
Tags: performance,measurement,contract,privacy,research

## Goal

Define APK performance measurement contract

## Context files

- AGENTS.md
- package.json
- .agentic/config.json
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/product/maturity-and-compatibility.md
- docs/cli-commands.md
- .tasks/archive/0125-research-non-node-apk-installation-and-distribution.md

## Files allowed to edit

- docs/research/**
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- src/**
- scripts/**
- package.json
- pnpm-lock.yaml
- dist/**
- .github/**
- .agentic/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md

## Steps

1. Trace current execution boundaries and existing benchmark evidence semantics

## Acceptance criteria

- Contract explicitly excludes LLM generation and unobserved gaps

## Verification

- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Add the measurement contract to docs/research and record any accepted architecture boundary in docs/decisions.md

## Notes

- Research only; do not implement tracing or create downstream tasks here.
