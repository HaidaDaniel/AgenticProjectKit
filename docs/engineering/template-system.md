# Template System

The template system is expected to render docs, tasks, prompts, and exported agent files from reusable templates.

## Planned approach

- Use Handlebars templates.
- Keep templates text-first.
- Separate neutral templates from exported tool-specific templates.
- Feed templates from validated config and repository state.

## Template categories

- project docs;
- task files;
- prompt shells;
- exporter outputs;
- mode-specific rule snippets.

## Rules

- Do not hardcode duplicated text in multiple output generators.
- Keep templates easy to review.
- Prefer explicit placeholders over clever template logic.

