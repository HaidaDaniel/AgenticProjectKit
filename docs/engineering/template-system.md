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

## Packaged instruction assets

Optional, manually invoked instructions ship as plain Markdown templates under
`src/core/templates/skills/<skill>/SKILL.md.hbs`. The recursive `.hbs` asset copier in
`scripts/copy-template-assets.mjs` preserves the nested path and copies them into
`dist/core/templates/skills/<skill>/SKILL.md.hbs`, and the package `files: [dist, README.md]`
rule ships them. Skill assets are packaged as-is for explicit loading; they are not rendered
through the neutral policy pipeline.

Packaged skills are optional and manually invoked. They are never embedded into the
always-active common policy (`AGENTS.md`) and add no CLI command, exporter, or native installer.

- `apk-task-grill` - clarify one existing task before implementation; see `docs/agent-exporters.md`.
- `apk-task-split` - decompose an explicit planning target into proposed vertical-slice tasks; see `docs/agent-exporters.md`.
- `apk-milestone-semantic-audit` - cross-contract semantic audit of a finite completed-task set; see `docs/agent-exporters.md`.

