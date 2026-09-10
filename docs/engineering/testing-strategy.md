# Testing Strategy

The implementation should use tests to protect the CLI and repository generation workflows.

## Test layers

- unit tests for config and task parsing;
- unit tests for template rendering;
- unit tests for exporter logic;
- integration tests for CLI commands;
- smoke tests for CLI help, audit, and sync behavior;
- smoke tests for log migration and analytics summary behavior;
- repository fixture tests for scanning and adoption flows.
- cross-tool quality capability fixtures for TypeScript/pnpm, alternative lint/test commands, missing optional coverage/hooks/CI, and unsupported repositories.
- bounded dogfooding fixtures for prompt/session/result lifecycle, failure preservation, and optional usability metrics.

## v0.1 focus

- ensure the CLI can start;
- ensure config and task schemas validate correctly;
- ensure task and context generation logic is stable;
- ensure exported instruction files match the neutral policy.

## Test rules

- keep tests close to the behavior they verify;
- test task and context contracts explicitly;
- include regression coverage for exporter output where practical.
- keep CLI smoke tests temp-directory based and deterministic.
- verify team analytics with sharded log fixtures.
- keep dogfooding evidence separate from automated tests and benchmark fixtures; never treat a failed session as a pass.
- assert that typecheck-only lint scripts are not source-lint evidence and that quality JSON is deterministic and mutation-free.
