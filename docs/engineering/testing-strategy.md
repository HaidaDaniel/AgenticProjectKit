# Testing Strategy

The implementation should use tests to protect the CLI and repository generation workflows.

## Test layers

- unit tests for config and task parsing;
- unit tests for template rendering;
- unit tests for exporter logic;
- integration tests for CLI commands;
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

