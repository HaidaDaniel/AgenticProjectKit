# Tech Stack

The intended implementation stack is:

- Node.js;
- TypeScript;
- pnpm;
- tsx;
- `@inquirer/prompts`;
- Handlebars;
- `fs-extra`;
- `zod`;
- `fast-glob`.

## Why this stack

- Node.js and TypeScript fit a portable CLI.
- pnpm keeps package management fast and reproducible.
- tsx makes local TypeScript execution simple during development.
- `@inquirer/prompts` supports interactive CLI flows.
- Handlebars is a straightforward text template engine.
- `fs-extra` simplifies repository file operations.
- `zod` is a good fit for config and task validation.
- `fast-glob` is useful for repository scanning and file discovery.

## Non-goals in v0.1

- no database;
- no backend service;
- no web UI;
- no cloud sync;
- no auth system.

