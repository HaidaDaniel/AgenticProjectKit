# Agentic Project Kit

Agentic Project Kit is a repository-based operating system for AI-assisted software development.

It keeps project context, operating rules, task definitions, and agent-specific instructions inside the repository so that work can continue without relying on long chat history.

## What problem it solves

Modern AI coding workflows often break down because important project context lives in prompts, memory, or scattered notes. This kit is meant to make that context durable, reviewable, and easy to export to multiple agent tools.

## How it differs from a simple MVP template

This is not just a starter app template.

It is intended to manage the whole project lifecycle:

- new project discovery;
- MVP delivery;
- product hardening;
- production readiness;
- brownfield adoption;
- audit mode for existing repositories;
- task generation for AI agents;
- exports for different coding assistants.

## CLI

The intended command name is:

```bash
apk
```

During local development, run it through `tsx`:

```bash
pnpm exec tsx src/cli/index.ts --help
```

After building or installing the package, run the CLI as:

```bash
apk --help
```

Implemented commands:

- `apk init`
- `apk adopt`
- `apk agent register`
- `apk agent list`
- `apk agent prompt`
- `apk tasks`
- `apk claim`
- `apk release`
- `apk block`
- `apk review`
- `apk done`
- `apk cancel`
- `apk context <task-id>`
- `apk mode [mode]`
- `apk next-task`
- `apk prompt <agent> --task <task-id>`
- `apk export [agent]`

Planned later commands include `apk audit` and `apk sync`.

## Using it in other repositories

There are four practical ways to use Agentic Project Kit outside this repository.

### Option 1: Use a pinned dev dependency

Best for teams and real projects.

After the package is published:

```bash
cd path/to/your-project
pnpm add -D agentic-project-kit
pnpm exec apk init
```

For an existing repository:

```bash
pnpm add -D agentic-project-kit
pnpm exec apk adopt
```

This is usually better than a global install because every repository pins the exact CLI version it expects.

### Option 2: Use one-shot execution with `pnpm dlx` or `npx`

Best for quick bootstrap commands.

After the package is published:

```bash
cd path/to/your-project
pnpm dlx agentic-project-kit init
```

or:

```bash
npx agentic-project-kit init
```

For adoption:

```bash
pnpm dlx agentic-project-kit adopt
npx agentic-project-kit adopt
```

This is valid. The tradeoff: every run may resolve the latest package unless you pin a version:

```bash
pnpm dlx agentic-project-kit@0.1.0 init
npx agentic-project-kit@0.1.0 init
```

Use this for one-off setup. Use a dev dependency when repeatability matters.

### Option 3: Install globally

Best for personal use across many local repositories.

After the package is published:

```bash
npm install -g agentic-project-kit
apk --help
```

or:

```bash
pnpm add -g agentic-project-kit
apk --help
```

This is convenient, but less reproducible for teams because each developer may have a different global version.

### Option 4: Link this local checkout while developing the CLI

Best while working on Agentic Project Kit itself.

From this repository:

```bash
pnpm install
pnpm build
pnpm link --global
```

Then from any target repository:

```bash
apk init
apk next-task
```

When you change CLI source code, rebuild:

```bash
pnpm build
```

The package bin points to `dist/cli/index.js`, so global/package usage depends on the build output.

## Quickstart

Install dependencies:

```bash
pnpm install
```

Show help:

```bash
pnpm exec tsx src/cli/index.ts --help
```

If installed as a package:

```bash
apk --help
```

Create starter kit files in the current repository:

```bash
pnpm exec tsx src/cli/index.ts init
```

Create starter kit files in another repository:

```bash
pnpm exec tsx src/cli/index.ts init path/to/project
```

Adopt an existing repository without rewriting application code:

```bash
pnpm exec tsx src/cli/index.ts adopt path/to/existing-repo
```

Print the files an agent should read for a task:

```bash
pnpm exec tsx src/cli/index.ts context 0008 --level 2
```

Use `--level 1` for minimum project context, `--level 2` for task docs, and `--level 3` when source or support files are needed.

Print or set the operating mode:

```bash
pnpm exec tsx src/cli/index.ts mode
pnpm exec tsx src/cli/index.ts mode product
```

Pick the lowest-numbered todo task:

```bash
pnpm exec tsx src/cli/index.ts next-task
```

Generate a task prompt for a supported agent:

```bash
pnpm exec tsx src/cli/index.ts prompt codex --task 0014 --level 2
```

Supported prompt agents: `agents`, `codex`, `opencode`, `cursor`.

Export generated agent instructions:

```bash
pnpm exec tsx src/cli/index.ts export
pnpm exec tsx src/cli/index.ts export codex --force
```

Supported export targets: `agents`, `codex`, `opencode`, `cursor`.

`export` skips existing files by default. Use `--force` to overwrite generated instruction files.

## Example workflow

1. Start a new repository with `apk init`, or add the kit to an existing repository with `apk adopt`.
2. Register the working agent with `apk agent register`.
3. Run `apk next-task` to pick the next todo task.
4. Claim it with `apk claim <task-id> --owner <agent-id>`.
5. Run `apk context <task-id>` and `apk prompt <agent> --task <task-id>`.
6. Work one task at a time.
7. Move the task through `review` and `done`.
8. Run `apk export` when agent instruction files need regeneration.

## Agent workflow

Register each agent before task work:

```bash
apk agent register --id codex-a --platform codex --model gpt-5.5
```

List registered agents:

```bash
apk agent list
```

Print compact setup instructions for a platform:

```bash
apk agent prompt --platform codex
```

Claim and complete a task:

```bash
apk tasks --state todo
apk claim 0001 --owner codex-a
apk context 0001 --level 2
apk prompt codex --task 0001 --level 2
pnpm test
pnpm lint
apk review 0001 --owner codex-a
apk done 0001 --owner codex-a
```

If a task cannot continue:

```bash
apk block 0001 --owner codex-a --reason "needs product decision"
apk release 0001 --owner codex-a
apk cancel 0001 --owner codex-a --reason "obsolete"
```

Agent registry lives in `.agentic/agents.jsonl`. Compact run analytics live in `.agentic/runs.jsonl`.

Task files stay compact and only store the current owner id. Platform/model metadata stays in the registry and run log.

## Discovery planning

Discovery mode now has lightweight planning documents:

- `docs/product/requirements.md`
- `docs/engineering/load-profile.md`
- `docs/engineering/tech-options.md`
- `docs/engineering/risk-register.md`

Use them before implementation to record product scope, expected load, data growth, stack choices, rejected alternatives, and future risks.

## Usage scenarios

The scenario commands below assume `apk` is available through a pinned dev dependency, `pnpm dlx`/`npx`, a global install, or a local global link.

### Scenario 1: Start a new project

Use this when the repository is empty or still at the planning stage.

```bash
cd path/to/new-project
apk init
```

The kit creates the base project docs, task directory, config file, and agent instruction files. After that, choose the operating mode:

```bash
apk mode discovery
```

Use `discovery` while the idea, users, and scope are still unclear. Switch to `mvp` when the first deliverable is defined:

```bash
apk mode mvp
```

Then work from task files:

```bash
apk next-task
apk context 0001 --level 2
apk prompt codex --task 0001 --level 2
```

Give the generated prompt to the selected agent, let it work only inside the allowed files, then run the verification commands listed in the task file.

### Scenario 2: Adopt an existing repository

Use this when the app already exists and you want to add repository-first AI workflow rules without rewriting application code.

```bash
cd path/to/existing-repo
apk adopt
```

`adopt` scans the repository shape and writes missing kit files such as docs, config, task files, and agent instructions. It skips existing files instead of overwriting them.

After adoption:

```bash
apk mode adopt
apk next-task
```

Use `adopt` mode while documenting the existing repo and creating cleanup tasks. Move to `maintenance`, `product`, or `production` after the docs and task flow are stable.

### Scenario 3: Give an AI agent exact task context

Use this when you want an agent to work without relying on long chat history.

First pick a task:

```bash
apk next-task
```

Then inspect context:

```bash
apk context 0014 --level 2
```

Context levels:

- `--level 1`: minimum project context and the task file.
- `--level 2`: adds relevant docs and decisions.
- `--level 3`: adds source/support files from the task contract.

Generate the prompt:

```bash
apk prompt codex --task 0014 --level 2
```

Supported prompt agents:

- `agents`
- `codex`
- `opencode`
- `cursor`

The prompt includes the goal, mode, risk, exact context files, allowed files, forbidden files, acceptance criteria, and verification commands.

### Scenario 4: Export instructions for different agent tools

Use this when project rules change and generated agent instruction files need to be refreshed.

Export all supported targets:

```bash
apk export
```

Export one target:

```bash
apk export codex --force
apk export cursor --force
apk export opencode --force
apk export agents --force
```

Generated outputs include:

- `AGENTS.md`
- `.codex/instructions.md`
- `.opencode/AGENTS.md`
- `.cursor/rules/*.mdc`

The source of truth remains the repository docs and neutral policy content; exported files are derived artifacts.

### Scenario 5: Move from MVP to product work

Use this after the first v0.1 scope is ready and the next work should focus on improving the product rather than proving the basic shape.

Check the current mode:

```bash
apk mode
```

Switch from `mvp` to `product`:

```bash
apk mode product
```

Use `product` mode for v0.2 work such as better task generation, richer repository scanning, improved context selection, and stronger validation.

Use `production` only when the project needs release hardening: stricter tests, clearer failure behavior, stronger docs, and safer workflows.

### Scenario 6: Maintain the repository after v0.1

Use this once the command surface is stable and the main work is incremental improvement.

Recommended loop:

```bash
apk mode product
apk next-task
apk context <task-id> --level 2
apk prompt codex --task <task-id> --level 2
pnpm test
pnpm lint
```

For risky changes, use `--level 3` so the agent sees source files and support files named by the task.

When a task is done, update the task status and `docs/progress.md`. If the change affects agent instructions, run:

```bash
apk export --force
```

## Current status

Tasks 0001 through 0022 are complete. v0.1 plus compact agent workflow is ready.

The repository now has a minimal TypeScript CLI scaffold, config schema, `apk init`, `apk adopt`, `apk mode`, `apk next-task`, `apk tasks`, agent registration, task state transitions, run analytics, `apk context`, `apk prompt`, `apk export`, template rendering, doc generation helpers, agent exporters, and compact task parsing support.

Default agent style for this repository: `caveman` when the active tool supports it.

The next step is v0.2 planning from the roadmap and scope docs.
