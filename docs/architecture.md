# Architecture

Agentic Project Kit is intended to use a layered architecture:

1. CLI entrypoints.
2. Command handlers.
3. Core domain services.
4. Template and exporter system.
5. Repository scanners and context selection.
6. Internal docs and config as the source of truth.

## Core ideas

- Keep the human-readable policy in the repository.
- Generate agent-specific instruction files from one neutral source.
- Use tasks as the primary unit of work.
- Select context explicitly rather than loading the whole repository.
- Keep commands thin and predictable.

## Proposed internal layout

```txt
.agentic/
  config.json
  modes/
  policies/
  templates/
  exporters/
```

## Generated outputs

The tool may generate or maintain:

```txt
AGENTS.md
CLAUDE.md
GEMINI.md
.cursor/rules/*.mdc
.codex/instructions.md
.opencode/AGENTS.md
.github/copilot-instructions.md
docs/**
.tasks/**
```

## Flow

- `init` creates the repository structure.
- `adopt` inspects an existing project and adds kit files.
- `mode` changes the active operating rules.
- `next-task` selects the next actionable item.
- `context` resolves what files an agent should read.
- `prompt` generates a tool-specific prompt from the neutral rules.
- `export` writes agent-specific instruction files.
- `audit` (planned) reads the repository and produces a documentation gap map.
- `sync` (planned) synchronizes generated files from internal policy.

