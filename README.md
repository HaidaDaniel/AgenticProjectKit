# Agentic Project Kit

Agentic Project Kit (APK) is a repository-local CLI for structured AI-assisted development. It helps individual developers and teams keep project context, bounded tasks, and review evidence available across coding agents and sessions.

APK gives maintainers a repeatable way to describe work, limit the files a task may change, verify a committed candidate, and see whether required review and evidence are current. Repository documents and configuration remain the source of truth.

## Quickstart

Install the validated release tag in the repository where you want to use APK:

```bash
pnpm add -D agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.7
pnpm exec apkit --help
```

For a new project, create the starter files:

```bash
pnpm exec apkit init
```

For an existing project, preview adoption first with `pnpm exec apkit adopt --preview`. Review the proposed changes before applying them. The [Getting Started guide](docs/getting-started.md) covers the full workflow; the [brownfield guide](docs/guides/brownfield-adoption.md) explains safe adoption.

## What APK provides

- `init` and conservative `adopt` commands for repository-local project context.
- Task contracts with dependencies, allowed paths, acceptance criteria, and declared verification.
- Bounded context selection and prompts for external coding agents.
- Candidate-bound verification, review, evidence, and a completion gate that checks scope and freshness.
- Generated agent instructions from shared repository policy, contract lint, readiness reports, and a quality inventory.
- Optional packaged planning skills, including `apk-task-author`, `apk-task-split`, and task/project clarification assets; they are manually invoked and never replace the task lifecycle.
- `apkit skills` lists and previews packaged skills; `apkit skills materialize <skill> --apply` explicitly writes a project-local `.agents/skills/<skill>/SKILL.md` without touching provider-global state.

Skill apply uses descriptor-relative traversal with no-follow flags where Node exposes it. On
Windows and other platforms without that API, APK uses a bounded path-based fallback: it rejects
pre-existing symlink/junction/reparse redirects, validates the canonical parent immediately before
mutation, creates files exclusively, and replaces updates through a same-parent temporary file.
Node cannot prevent a hostile concurrent namespace replacement in that fallback, so the guarantee
does not cover that threat model. Preview and show remain available on every supported platform.

APK prepares and records the workflow around coding agents; it does not launch or supervise their models, sessions, or processes. It has no hosted account or project database. The task system keeps unavailable or stale evidence visible instead of treating it as a pass.

## Maturity and compatibility

The current validated installable release is [v0.4.7](docs/releases/v0.4.7.md). A newer package version may be a pre-tag candidate; stable install guidance remains on the validated tag until post-tag validation finishes. The package declares Node.js `>=22.22.1`; release validation used Node.js `22.22.1`, pnpm `10.28.1`, and an Ubuntu runner. Other Node.js or pnpm versions and end-to-end macOS or Windows installs are unverified. A first Git-tag install requires Git and network access; offline use requires the release and dependencies to be cached.

See the [maturity and compatibility policy](docs/product/maturity-and-compatibility.md) for the evidence and support limits.

## Explore the documentation

- [Documentation home](docs/index.md) — choose a guide by audience and question.
- [Core concepts](docs/concepts.md) — understand tasks, repository context, evidence, and gates.
- [CLI and configuration reference](docs/cli-commands.md) — find command syntax and workflow settings.
- [Constrained and local-first execution](docs/guides/constrained-local-execution.md) — review offline and limited-environment guidance.
- [Release index](docs/releases/index.md) — browse versioned release notes and validation records.
- [Roadmap](docs/roadmap.md) — distinguish shipped capabilities, current readiness work, and deferred plans.

## Open source

- [GitHub repository](https://github.com/HaidaDaniel/AgenticProjectKit)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [MIT License](LICENSE)

## Install APK in another repository

APK is distributed as a repository-local development dependency pinned to a validated Git tag. `pnpm exec apkit` selects that repository's installed executable; the `apk` and `agentic-project-kit` names remain compatibility aliases. This tooling dependency does not make the application itself a Node.js project.

For upgrades, use a validated release tag and review both `package.json` and `pnpm-lock.yaml`. Do not use `#main` for a reproducible project pin. See the [install and recovery instructions](docs/getting-started.md) and [distribution research](docs/research/non-node-apk-installation-and-distribution.md).
