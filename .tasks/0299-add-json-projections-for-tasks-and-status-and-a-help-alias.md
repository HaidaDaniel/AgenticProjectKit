# Task 0299 - Add JSON projections for tasks and status and a help alias

State: done
Owner: opencode-corrective-impl
Mode: product
Lane: feature
Type: feature
Scope: cli,status,tasks,docs
Risk: low
Parallel: false
Depends on: none
Tags: developer-experience,cli,json

## Goal

Make public task and status projections consistently machine-readable and make command discovery tolerant of a help subcommand.

## Context files

- AGENTS.md
- docs/cli-commands.md
- src/cli/command-registry.ts
- src/cli/commands/tasks.ts
- src/cli/commands/status.ts

## Files allowed to edit

- src/cli/command-registry.ts
- src/cli/commands/tasks.ts
- src/cli/commands/status.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/doctor/**
- src/core/audit/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Record current exit codes and output shapes for tasks --json, status --json and help.
2. Add deterministic --json output for tasks and status consistent with attention --json and lint --json conventions.
3. Map the help subcommand to the existing --help behavior without removing the existing error for unknown commands.
4. Add CLI tests for parseable JSON, stable exit codes and human output compatibility.
5. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- tasks --json and status --json exit zero and emit parseable JSON.
- Human output for tasks and status remains unchanged without --json.
- help and --help produce equivalent output and unknown commands still exit non-zero.
- JSON field names follow existing projection conventions.

## Correctness assumptions

- Agents consume JSON projections programmatically

## Invariants

- Existing human output remains stable

## Required evidence

- CLI exit code and JSON parse results

## Review questions

- Does any new JSON field leak process liveness details

## Counterexample searches

- Malformed JSON; Mixed human and JSON output; Unknown command treated as help

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/cli/cli.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document new JSON options in docs/cli-commands.md

## Notes

- Developer-experience improvement not a correctness fix
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
