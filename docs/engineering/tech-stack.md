# Tech Stack

The intended implementation stack is:

- Node.js;
- Supported runtime: Node.js `>=22.22.1` for the APK-local guardrail toolchain;
- TypeScript;
- pnpm;
- tsx;
- Handlebars.
- ESLint with `typescript-eslint` for APK-local TypeScript source lint;
- c8 for deterministic V8 coverage reports;
- Husky with lint-staged for APK-local developer hooks.

## Why this stack

- Node.js and TypeScript fit a portable CLI.
- pnpm keeps package management fast and reproducible.
- tsx makes local TypeScript execution simple during development.
- Handlebars is a straightforward text template engine.
- ESLint keeps source lint separate from the existing TypeScript compiler check.
- c8 emits both human-readable and machine-readable coverage from the existing test runner.
- Husky/lint-staged provide local feedback only and are not adopted-repository requirements.
- Node.js `>=22.22.1` is declared because the maintained local lint/hook toolchain requires it.

## Non-goals in v0.1

- no database;
- no backend service;
- no web UI;
- no cloud sync;
- no auth system.
