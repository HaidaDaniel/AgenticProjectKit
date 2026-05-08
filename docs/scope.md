# Scope

## v0.1

The first version should establish the repository structure and the documentation-driven workflow.

Included:

- TypeScript CLI scaffold;
- `apk init`;
- `apk adopt`;
- `apk mode`;
- `apk next-task`;
- `apk context`;
- `apk prompt`;
- `apk export`;
- minimal templates;
- basic exporters for AGENTS, Codex, Cursor, and OpenCode;
- task file generation;
- project config generation.

## v0.2

The next version should improve task generation and project analysis.

Included:

- richer scanning for existing repositories;
- `apk audit`;
- documentation and generated export gap reports;
- task and config validation surfaced through audit;
- better context selection;
- improved prompt generation.

## v0.3

The third version should focus on workflow quality and broader support.

Included:

- more robust audit and adopt flows;
- better mode-specific behavior;
- additional templates;
- `apk sync` check and write workflow;
- stronger test coverage for the CLI and task pipeline.

## Future scope

Possible later additions:

- web UI;
- SaaS backend;
- cloud sync;
- issue tracker integrations;
- multi-repo orchestration;
- advanced project intelligence.

## Explicit non-goals for v0.1

- no web UI;
- no authentication;
- no database;
- no cloud storage;
- no GitHub Issues sync;
- no Jira or Linear sync;
- no automatic source code rewriting;
- no complex AST analysis;
- no SaaS backend.

## Explicit non-goals for v0.2 and v0.3

- no web UI;
- no authentication;
- no database;
- no cloud sync;
- no issue tracker sync;
- no SaaS backend.
