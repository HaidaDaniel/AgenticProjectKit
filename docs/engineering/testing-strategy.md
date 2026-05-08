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
