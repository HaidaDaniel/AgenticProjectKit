# Agentic Project Kit

Agentic Project Kit is a repository-first CLI for structured AI-assisted development workflows.

It keeps project context, operating rules, task definitions, and agent-specific instructions inside the repository so that work can continue without relying on long chat history.

## What problem it solves

Modern AI coding workflows often break down because important project context lives in prompts, memory, or scattered notes. This kit is meant to make that context durable, reviewable, and easy to export to multiple agent tools.

## How it differs from a simple MVP template

This is not just a starter app template.

It supports lightweight lifecycle modes through repository docs, task metadata, and generated agent instructions:

- new project discovery;
- MVP delivery;
- product hardening;
- production readiness;
- brownfield adoption;
- audit mode for existing repositories;
- task contracts and prompt generation for AI coding agents;
- exports for different coding assistants.

## CLI

The intended command name is:

```bash
apkit
```

`apk` is still shipped as a short alias for existing local workflows, but `apkit` is the safer public command name because `apk` already exists as an unrelated npm package.

During local development, run it through `tsx`:

```bash
pnpm exec tsx src/cli/index.ts --help
```

After building or installing the package, run the CLI as:

```bash
apkit --help
```

Implemented commands:

- `apk init`
- `apk adopt`
- `apk agent register`
- `apk agent list`
- `apk agent migrate-logs`
- `apk analytics summary`
- `apk agent prompt`
- `apk audit`
- `apk lint [--json]`
- `apk tasks`
- `apk resources [--json]`
- `apk resources detect [--json]`
- `apk attention [--json]`
- `apk workers [--json]`
- `apk workspaces <create|list|status|cleanup> [--json] [--apply]` - `create --run` proves the canonical task/run binding before mutation and captures the canonical resource (`--resource` requires `--run` and must match exactly); cleanup re-validates it and fails closed.
- `apk execution explain <task-id> --role <role> [--profile <profile>] [--resource <worker-id>] [--json]` - show effective profile/route source; a current applied calibration (including `wait`/`needs-human` sentinels that pause even deterministic lanes, and `deterministic` under canonical policy) participates, stale calibration is ignored.
- `apk execution calibrate [--recommendation <json>] [--apply] [--json]` - current recommendations influence routing subject to canonical policy; assurance is raise-only.
- `apk work <task-id> --owner <agent-id> --target <agent> [--resource <worker-id>] [--role implement|review|fix|verify] [--json]`
- `apk claim`
- `apk release`
- `apk block`
- `apk review`
- `apk done`
- `apk doctor`
- `apk cancel`
- `apk context <task-id> [--level 1|2|3] [--budget <units>]`
- `apk mode [mode]`
- `apk next-task`
- `apk prompt <agent> --task <task-id> [--level 1|2|3] [--budget <units>]`
- `apk export [agent]`
- `apk sync [agent]`
- `apk status [--detail]`
- `apk suggest-context "<task description>"`
- `apk task deps <task-id>`
- `apk task evidence <task-id>`
- `apk task policy <task-id>`
- `apk task gate <task-id>`
- `apk task provenance <task-id> [--json]`
- `apk task create`

## Using it in other repositories

There are four practical ways to use Agentic Project Kit outside this repository without publishing it to npm.

### Option 1: Pin a stable release tag (recommended)

Best for teams and real projects. Pin a stable tag so every repository uses the exact CLI version it expects.

Use SSH when the machine already has GitHub credentials:

```bash
cd path/to/your-project
pnpm add -D git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.1
pnpm exec apk init
```

For an existing repository:

```bash
pnpm add -D git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.1
pnpm exec apk adopt
```

HTTPS equivalent when GitHub auth is configured for HTTPS:

```bash
pnpm add -D git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.1
```

`#main` tracks unreleased development and is for development/testing only. Do not use `#main` as the stable installation path; pin a tag for repeatable installs.

This is usually better than a global install because every repository pins the exact CLI version it expects.

On a new server for a repository that already has Agentic Project Kit in `devDependencies`, bootstrap with the project lockfile:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec apk doctor
```

### Option 2: Install globally from GitHub

Best for personal use across many local repositories. Repository-local pinning is still preferred for reproducibility.

```bash
npm install -g git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.1
apk --help
```

or:

```bash
pnpm add -g git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.1
apk --help
```

If `apk` is not found after a pnpm global install:

```bash
pnpm bin -g
pnpm setup
source ~/.bashrc
```

This is convenient, but less reproducible for teams because each developer may have a different global version.

### Option 3: Link a local checkout while developing the CLI

Best while working on Agentic Project Kit itself.

Clone the repository on the target machine:

```bash
git clone git@github.com:HaidaDaniel/AgenticProjectKit.git ~/tools/AgenticProjectKit
cd ~/tools/AgenticProjectKit
corepack enable
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
cd ~/tools/AgenticProjectKit
pnpm build
```

The package bin points to `dist/cli/index.js`, so global/package usage depends on the build output.

### Option 4: Run from a local checkout without global install

Best when PATH/global package setup is inconvenient.

Build the CLI once:

```bash
git clone git@github.com:HaidaDaniel/AgenticProjectKit.git ~/tools/AgenticProjectKit
cd ~/tools/AgenticProjectKit
corepack enable
pnpm install
pnpm build
```

Run it from another repository:

```bash
cd path/to/your-project
node ~/tools/AgenticProjectKit/dist/cli/index.js adopt
```

Optional shell alias for personal use:

```bash
echo 'alias apk="node ~/tools/AgenticProjectKit/dist/cli/index.js"' >> ~/.bashrc
source ~/.bashrc
apk adopt
```

## Dogfood workflow (Codex/OpenCode from VS Code)

APK is the repository control plane; it keeps task contracts, verification, review, and gated completion in the repository.

- Codex and OpenCode are used normally from VS Code.
- Codex and OpenCode read the canonical `AGENTS.md`; no redundant Codex/OpenCode common-policy files are required.
- APK does not need to launch, supervise, or proxy Codex or OpenCode.
- External terminal/session runtimes (for example a persistent dev host or Herdr) are optional and deferred; they are not required for this workflow. APK adds no Herdr dependency, adapter, PTY, SSH, process supervisor, scheduler, or runtime orchestration.

A typical loop in a repository that pins a stable tag:

```bash
pnpm exec apk doctor
pnpm exec apk next-task
pnpm exec apk context 0001
pnpm exec apk prompt codex --task 0001
pnpm exec apk prompt opencode --task 0001
```

Implement with Codex or OpenCode in VS Code, then:

```bash
pnpm exec apk task verify 0001 --owner <agent-id>
pnpm exec apk task gate 0001
pnpm exec apk done 0001 --owner <agent-id>
```

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

Adopt an existing repository with a lightweight scan and without rewriting application code:

```bash
pnpm exec tsx src/cli/index.ts adopt path/to/existing-repo
```

Print the files an agent should read for a task:

```bash
pnpm exec tsx src/cli/index.ts context 0008 --level 2
```

Use `--level 1` for minimum project context, `--level 2` for task docs, and `--level 3` to include source or support files explicitly named by the task contract.
Use `--budget <units>` for a deterministic required/relevant/optional pack. Units approximate tokens as `ceil(UTF-8 bytes / 4)`; required files are never evicted, and an oversized required tier returns a diagnostic.

Suggest candidate context before writing a task:

```bash
pnpm exec tsx src/cli/index.ts suggest-context "Add auth middleware"
```

Suggestions are deterministic local heuristics, not deep code understanding.

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

Supported prompt agents: `agents`, `claude`, `codex`, `gemini`, `opencode`, `cursor`.

Export generated agent instructions:

```bash
pnpm exec tsx src/cli/index.ts export
pnpm exec tsx src/cli/index.ts export codex --force
```

Supported export targets: `agents`, `claude`, `gemini`, plus `codex`, `opencode`, and `cursor` compatibility aliases. `AGENTS.md` is the only full common-policy export. `CLAUDE.md` and `GEMINI.md` are thin `@AGENTS.md` imports; Codex, OpenCode, and Cursor read `AGENTS.md` directly. Legacy generated files can be previewed with `pnpm exec apk export --report-legacy` and cleaned up explicitly with `pnpm exec apk export --cleanup-legacy`, which removes only exact unmodified generated files.

`export` skips existing files by default. Use `--force` to overwrite generated instruction files. The core exporter API uses the same safe default unless `force` is explicitly true.

Audit kit/workflow readiness and generated instruction coverage:

```bash
pnpm exec tsx src/cli/index.ts audit
```

Check generated instruction drift, then write missing or stale files when intended:

```bash
pnpm exec tsx src/cli/index.ts sync
pnpm exec tsx src/cli/index.ts sync cursor --write
```

Create a new task file with validated metadata:

```bash
pnpm exec tsx src/cli/index.ts task create \
  --title "Add Feature" \
  --goal "Implement the smallest useful feature slice." \
  --mode mvp \
  --lane implementation \
  --scope cli,docs \
  --risk low \
  --context "AGENTS.md,docs/task-system.md" \
  --allowed "src/api/index.ts,docs/progress.md" \
  --verification "pnpm test"
```

Use templates to reduce repeated metadata:

```bash
pnpm exec tsx src/cli/index.ts task create --template bugfix --title "Fix Parser" --scope cli --allowed src/cli/index.ts
```

Typed templates add domain guardrails, structured verification, correctness assumptions, and deterministic policy tags:

```bash
pnpm exec tsx src/cli/index.ts task create --type async-worker --title "Harden Worker" --scope worker --allowed src/worker.ts
```

Available typed templates include `feature`, `bugfix`, `refactor`, `migration`, `async-worker`, `provider-integration`, `deployment`, `benchmark`, `security`, and `release`; existing `docs`, `audit`, and `test` templates remain supported. `--template` is an alias for `--type`, and generated task Markdown is editable.

Structured verification supports required automated/manual checks, environment/profile, and optional artifact/evidence requirements:

```bash
pnpm exec tsx src/cli/index.ts task create \
  --title "Release smoke" --mode product --lane release --scope release --risk high \
  --context AGENTS.md --allowed docs/release.md \
  --verification-json '[{"id":"smoke","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Check the deployed release.","evidence":"release URL"}]'
```

Existing `## Verification commands` task files remain readable. Flat commands normalize to required local deterministic automated checks; no migration is required.

For independent review, prepare an inspection prompt and record a separately identified reviewer outcome:

```bash
pnpm exec apk review 0001 --reviewer codex-reviewer --prompt
pnpm exec apk review 0001 --reviewer codex-reviewer --result pass --implementation-run verify-123
```

Review evidence keeps findings and revision-bound freshness; the implementation owner cannot self-certify an independent review.

Preview and enforce completion with the same candidate-aware gate:

```bash
pnpm exec apk task gate 0001
pnpm exec apk done 0001 --owner codex-a
```

`done` rejects missing, failed, stale, or wrong-candidate verification/review evidence and records a completion evidence set on success. There is no force bypass.

The work loop also exposes the vendor-neutral `apk-worker-v1` package/result contract. Select `--role implement|review|fix|verify`, or omit the role for current canonical next-role resolution. Every issued package is atomically persisted under `.agentic/sessions/work/<task-id>/<run-id>/` with immutable `metadata.json`; `activation.json` is written last and is required before a result is accepted; an existing run ID is never overwritten; `--json` returns the exact package and session paths. Results are accepted only when protocol, task, safe run ID, owner, and role match that issued package. Implement/fix results record a recaptured output candidate while package metadata preserves the issued input candidate. Review preparations record `origin=worker` and require the active worker session for standalone API recording; ordinary `apk review --prompt` preparations use `origin=standalone` and remain independent. Issuance reconfirms the candidate after the state transition, and stale or unactivated candidates are rejected. Worker implement/fix/verify records are diagnostic-only and cannot satisfy report/live/benchmark/manual/CI/artifact/evidence policy categories. Canonical `apk task verify` evidence is required before review progression, and issuing review automatically moves `doing` to `review`. `apk task provenance --json` joins each worker run's issued subject to activation/output status, evidence, and agent.

Inspect the active workflow and actionable gate state:

```bash
pnpm exec apk status
pnpm exec apk status --detail
```

The default status is concise. Detail mode adds bounded policy, verification, scope, review, evidence, gate-blocker and provenance summaries without raw logs. Status reuses the same gate evaluator as `apk task gate` and `apk done`.

Run all eligible checks or one verification profile:

```bash
pnpm exec apk task verify 0001 --profile deterministic --owner codex-a
pnpm exec apk task evidence 0001
```

Required manual/live checks stay unresolved and optional failures do not block verification. Every check result is appended to `.agentic/evidence.jsonl` with candidate identity; stale or mixed-revision results cannot be treated as a current pass.

Record an externally-observed manual or live result explicitly when APK cannot execute it:

```bash
pnpm exec apk task verify 0001 --record --owner codex-a \
  --check clean-checkout-ci --result pass --evidence "https://ci.example/runs/42 status=success sha=abc123"
```

Recording requires the registered task owner, a declared manual or `live` check, and a bounded evidence reference. It binds the current candidate, rejects automated checks, and flows through the same freshness and gate path, so required live observations can be satisfied without weakening automated verification. Record after the final verification run: a later `apk task verify` appends a fresh `unavailable` record for the manual check.

## Example workflow

1. Start a new repository with `pnpm exec apk init`, or add the kit to an existing repository with `pnpm exec apk adopt`.
2. Register the working agent with `pnpm exec apk agent register`.
3. Run `pnpm exec apk status` to inspect current workflow state.
4. Run `pnpm exec apk next-task` to pick the next todo task.
5. Claim it with `pnpm exec apk claim <task-id> --owner <agent-id>`.
6. Run `pnpm exec apk context <task-id>` and `pnpm exec apk prompt <agent> --task <task-id>`.
7. Work one task at a time.
8. Move the task through `review` and `done`.
9. Run `pnpm exec apk sync` to check generated instruction drift.
10. Run `pnpm exec apk export` or `pnpm exec apk sync --write` when generated instructions need regeneration.

## Agent workflow

Register each agent before task work:

```bash
pnpm exec apk agent register --id codex-a --developer alice --platform codex --model gpt-5.5
```

Start or continue a task through the CLI work loop:

```bash
pnpm exec apk work 0001 --owner codex-a --target codex --level auto
```

`work` claims a todo task, renders the prompt, persists the package/metadata, and prints role-valid next commands. Use `--write-session` to store the exact prompt beside the package. It warns when another unsettled mutable run is detected in the same worktree; concurrent mutable tasks should use separate Git worktrees/branches. It does not launch external AI agents.

List registered agents:

```bash
pnpm exec apk agent list
```

Print compact setup instructions for a platform:

```bash
pnpm exec apk agent prompt --platform codex
```

Claim and complete a task:

```bash
pnpm exec apk tasks --state todo
pnpm exec apk claim 0001 --owner codex-a
pnpm exec apk context 0001 --level 2
pnpm exec apk prompt codex --task 0001 --level 2
pnpm exec apk task verify 0001 --owner codex-a
pnpm test
pnpm lint
pnpm exec apk review 0001 --owner codex-a
pnpm exec apk done 0001 --owner codex-a
```

If a task cannot continue:

```bash
pnpm exec apk block 0001 --owner codex-a --reason "needs product decision"
pnpm exec apk release 0001 --owner codex-a
pnpm exec apk cancel 0001 --owner codex-a --reason "obsolete"
```

Task files stay compact and only store the current owner id. Developer/platform/model metadata stays in the registry and run log.

Team analytics use sharded, git-friendly files:

- `.agentic/agents/<agent-id>.json`
- `.agentic/runs/YYYY-MM-DD_<developer-id>_<agent-id>.jsonl`
- `docs/analytics/agent-summary-YYYY-MM.md`

Legacy `.agentic/agents.jsonl` and `.agentic/runs.jsonl` are migration inputs only. Convert them with:

```bash
pnpm exec apk agent migrate-logs --remove-legacy
```

Register a team agent with an explicit developer id when needed:

```bash
pnpm exec apk agent register --id codex-a --developer alice --platform codex --model gpt-5.5
```

Generate a monthly comparison summary:

```bash
pnpm exec apk analytics summary --month 2026-05 --write
```

Analytics summaries include active and archived task metadata when grouping risk, mode, and lane.

## Discovery planning

Discovery mode now has lightweight planning documents:

- `docs/product/requirements.md`
- `docs/engineering/load-profile.md`
- `docs/engineering/tech-options.md`
- `docs/engineering/risk-register.md`

Use them before implementation to record product scope, expected load, data growth, stack choices, rejected alternatives, and future risks.

## Usage scenarios

The scenario commands below assume Agentic Project Kit is installed as a project dev dependency and run through `pnpm exec apk`. If you intentionally use a global install or shell alias, the command body is the same.

### Scenario 1: Start a new project

Use this when the repository is empty or still at the planning stage.

```bash
cd path/to/new-project
pnpm exec apk init
```

The kit creates the base project docs, task directory, config file, and agent instruction files. After that, choose the operating mode:

```bash
pnpm exec apk mode discovery
```

Use `discovery` while the idea, users, and scope are still unclear. Switch to `mvp` when the first deliverable is defined:

```bash
pnpm exec apk mode mvp
```

Then work from task files:

```bash
pnpm exec apk next-task
pnpm exec apk context 0001 --level 2
pnpm exec apk prompt codex --task 0001 --level 2
```

Give the generated prompt to the selected agent, let it work only inside the allowed files, then run the verification commands listed in the task file.
Use `pnpm exec apk task verify <task-id>` to check changed files against the task's allowed and forbidden file lists before review or done.

### Scenario 2: Adopt an existing repository

Use this when the app already exists and you want to add repository-first AI workflow rules without rewriting application code.

```bash
cd path/to/existing-repo
pnpm exec apk adopt
```

`adopt` performs a lightweight repository-shape scan and writes missing kit files such as docs, config, task files, and agent instructions. It skips existing files instead of overwriting them.

For an existing v0.3.1-style repository, preview compatibility and exact proposed changes before writing:

```bash
pnpm exec apk adopt --preview
```

Apply the compatibility marker and missing kit files explicitly with `pnpm exec apk adopt --apply`. Legacy task Markdown remains readable and is not rewritten; customized instructions and unknown config keys are preserved. Repeating `--apply` is idempotent. Use `--dry-run` as an alias for `--preview`.

After adoption:

```bash
pnpm exec apk mode adopt
pnpm exec apk next-task
```

Use `adopt` mode while documenting the existing repo and creating cleanup tasks. Move to `maintenance`, `product`, or `production` after the docs and task flow are stable.

### Scenario 3: Give an AI agent exact task context

Use this when you want an agent to work without relying on long chat history.

First pick a task:

```bash
pnpm exec apk next-task
```

Then inspect context:

```bash
pnpm exec apk context 0014 --level 2
```

Context levels:

- `--level 1`: minimum project context and the task file.
- `--level 2`: adds relevant docs and decisions.
- `--level 3`: adds source/support files explicitly listed in the task contract.

Generate the prompt:

```bash
pnpm exec apk prompt codex --task 0014 --level 2
```

Supported prompt agents:

- `agents`
- `claude`
- `codex`
- `gemini`
- `opencode`
- `cursor`

The prompt includes the goal, mode, risk, exact context files, allowed files, forbidden files, acceptance criteria, and verification commands.

### Scenario 4: Export instructions for different agent tools

Use this when project rules change and generated agent instruction files need to be refreshed.

Export all supported targets:

```bash
pnpm exec apk export
```

Export one target:

```bash
pnpm exec apk export claude --force
pnpm exec apk export codex --force
pnpm exec apk export gemini --force
pnpm exec apk export cursor --force
pnpm exec apk export opencode --force
pnpm exec apk export agents --force
```

Generated outputs include:

- `AGENTS.md` - the only full common-policy export, read directly by Codex, OpenCode, and Cursor.
- `CLAUDE.md` - thin `@AGENTS.md` import for Claude Code.
- `GEMINI.md` - thin `@./AGENTS.md` import for Gemini CLI.

Obsolete `.codex/instructions.md`, `.opencode/AGENTS.md`, and `.cursor/rules/*.mdc` files are no longer generated. `pnpm exec apk export --report-legacy` reports any that remain; `pnpm exec apk export --cleanup-legacy` removes only exact unmodified generated files and preserves customized content.

The source of truth remains the repository docs and neutral policy content; exported files are derived artifacts.

### Scenario 5: Audit and sync generated instructions

Use this when you want to check kit/workflow readiness without changing application source files.

```bash
pnpm exec apk audit
pnpm exec apk lint --json
pnpm exec apk sync
pnpm exec apk sync codex --write
```

`audit` writes `docs/audit-report.md` and `docs/project-map.md` from lightweight repository and kit checks. It reports static readiness facts such as package scripts, lockfiles, CI presence, env examples, tests, license, README, Docker files, monorepo indicators, and TypeScript strict mode. It does not perform deep application architecture, security, coverage, or production-readiness analysis. `sync` is check-only unless `--write` is present.
`lint` is a read-only contract check for task graph, metadata, paths, policy, ownership, and generated-instruction drift. It never writes audit reports or generated files; `--json` is suitable for CI and structural/sync failures return exit code 1.
`quality detect` is the read-only repository quality inventory. It reports stable `typecheck`, `lint`, `tests`, `build`, `coverage`, `hooks`, and `ci` capabilities with script/config evidence, recommendations, and optional explicit policy evaluation. It does not execute scripts, install packages, or create hooks/workflows. A typecheck-only `tsc --noEmit` lint script counts as typecheck, not lint; CI detection is platform-neutral.

### APK-local quality guardrails

AgenticProjectKit keeps its own developer guardrails separate from tooling policy for adopted repositories:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm quality
pnpm test:coverage
pnpm build
pnpm release:check
```

`typecheck` runs the TypeScript compiler; `lint` runs the TypeScript-aware ESLint rules. `quality` is the fast typecheck/lint/test lane and does not run build, coverage, sync, or audit. `test:coverage` emits human-readable output and `coverage/coverage-summary.json`; its measured baseline and thresholds are documented in the testing strategy. `release:check` is the stronger local validation and invokes the built CLI directly for APK-specific sync/audit checks.
The APK-local guardrail toolchain supports Node.js `>=22.22.1`.

Pre-commit runs lint-staged source lint. Pre-push runs fast quality, coverage, and build. Hooks are feedback only: they cannot satisfy `apk task verify`, independent review, CI, release, or the completion gate. For an intentional exceptional bypass use `git commit --no-verify` or Husky's supported `HUSKY=0` disable path.

### Clean-checkout CI

`.github/workflows/quality.yml` runs one bounded Ubuntu job for pull requests and pushes to `main`. It checks out the event SHA, installs Node.js `22.22.1` and pnpm `10.28.1` with `pnpm install --frozen-lockfile`, then runs `pnpm quality`, `pnpm test:coverage`, `pnpm build`, `pnpm release:check`, and the built `node dist/cli/index.js` entrypoint for contract lint, check-only sync, and report-writing audit. The direct built entrypoint avoids relying on an external/global `apk` binary in the clean checkout. The disposable runner rejects tracked or unexpected untracked drift after the checks.

Hosted CI proves clean-checkout reproducibility for its exact SHA. It does not create APK task evidence, replace `apk task verify`/review/gate, or prove the frozen release candidate; Task 0075 records any exact-SHA CI URL/status separately without GitHub API coupling. Adopted repositories receive no workflow from APK.

The frozen release protocol and its final bounded evidence are recorded in [gated-workflow release evidence](docs/delivery/gated-workflow-release-evidence.md). Result reporting is an evidence-only post-gate artifact; it identifies the validated earlier SHA and never silently turns its own documentation commit into a release candidate.

### Scenario 6: Move from MVP to product work

Use this after the first v0.1 scope is ready and the next work should focus on improving the product rather than proving the basic shape.

Check the current mode:

```bash
pnpm exec apk mode
```

Switch from `mvp` to `product`:

```bash
pnpm exec apk mode product
```

Use `product` mode for v0.2 work such as richer lightweight repository scanning, audit reports, improved context selection, and stronger validation.

Use `production` only when the project needs release hardening: stricter tests, clearer failure behavior, stronger docs, and safer workflows.

### Scenario 7: Maintain the repository after v0.1

Use this once the command surface is stable and the main work is incremental improvement.

Recommended loop:

```bash
pnpm exec apk mode product
pnpm exec apk status
pnpm exec apk doctor
pnpm exec apk next-task
pnpm exec apk context <task-id> --level 2
pnpm exec apk prompt codex --task <task-id> --level 2
pnpm test
pnpm lint
```

For risky changes, use `--level 3` so the agent sees source files and support files named by the task.
Run `pnpm exec apk task verify <task-id> --owner <agent-id>` before moving the task to review or done.

When a task is done, update the task status and `docs/progress.md`. If the change affects agent instructions, run:

```bash
pnpm exec apk export --force
```

## Current status

Tasks 0001 through 0070 are complete, and Task 0071 adds concise active-task gate/evidence status with optional bounded detail output.

The repository now has a minimal TypeScript CLI scaffold, config schema, `init`, lightweight `adopt`, kit/workflow `audit`, `analytics summary`, `mode`, `next-task`, `tasks`, agent registration, task state transitions, sharded run analytics, `context`, `prompt`, `export`, `sync`, template rendering, doc generation helpers, Claude/Gemini/Codex/OpenCode/Cursor agent exporters, task archive/dependency commands, compact task parsing, and typed verification requirements.

Default agent style for this repository: `caveman` when the active tool supports it.

Tasks 0072 and 0073 provide the model-agnostic worker boundary and corrective lifecycle safeguards. Task 0074 adds the explicit compatibility preview/apply path for adopting the gated workflow; Task 0075 performs the final frozen-candidate validation.
