# Adoption Flow

Adoption is the process of introducing Agentic Project Kit into an existing repository.

## Goals

- preserve existing code;
- observe the current stack and structure;
- create documentation that matches reality;
- establish task discipline;
- create agent instructions without rewriting the project.

## Suggested flow

1. Scan the repository structure.
2. Detect the current stack and conventions.
3. Generate a project map.
4. Record pre-adoption gaps for kit docs, generated agent exports, config, and task files.
5. Add or update `AGENTS.md`.
6. Create initial docs that reflect the observed project.
7. Create cleanup or documentation tasks.
8. Add exporter files where appropriate.

## Guardrails

- Do not rewrite existing application code.
- Do not force a new architecture on the project.
- Keep generated docs consistent with observed structure.
- Prefer documentation cleanup before code changes.
- Use scanner facts in adoption reports; do not run audit as a separate write step.
