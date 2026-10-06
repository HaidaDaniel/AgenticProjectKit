# Task 0191 - Materialize APK skills into standards-based project skill directories

State: doing
Owner: codex-continue-20261005-2055
Mode: product
Lane: tooling
Type: feature
Scope: skills,export,project-local,agentskills,cli,sync,docs
Risk: high
Parallel: false
Depends on: 0190
Tags: skills,agents,portability,cli,project-local

## Goal

Make APK's packaged portable skills directly discoverable by standards-based agent harnesses without requiring users to find or read `SKILL.md.hbs` inside `node_modules`.

Add one explicit, provider-neutral materialization/export workflow that renders a chosen APK skill into a real project-local `SKILL.md`, with the cross-tool `.agents/skills/<skill>/SKILL.md` layout as the canonical project target. Hermes Agent is a primary dogfood consumer because it natively discovers that layout, but the APK feature must not depend on Hermes runtime internals.

Do not auto-install project skills during init/adopt. Materialization is an explicit user action with preview/check behavior, safe overwrite rules, and canonical packaged skill source ownership.

## Context files

- AGENTS.md
- README.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/engineering/apk-upgrade-workflow.md
- src/core/templates/skills/apk-task-author/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-split/SKILL.md.hbs
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-prototype/SKILL.md.hbs
- src/core/templates/skills/apk-milestone-semantic-audit/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- src/core/exporters/**
- src/core/sync/**
- src/cli/index.ts
- src/cli/commands/**
- .tasks/0190-add-portable-apk-task-author-skill-for-non-coding-planning-agents.md

## Files allowed to edit

- src/core/skills/**
- src/core/templates/renderer.test.ts
- src/cli/index.ts
- src/cli/command-registry.ts
- src/cli/commands/skills.ts
- src/cli/cli.test.ts
- package.json
- dist/**
- README.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/task-system.md
- docs/engineering/template-system.md
- docs/progress.md
- .tasks/0191-materialize-apk-skills-into-standards-based-project-skill-directories.md

## Files forbidden to edit

- src/core/tasks/**
- src/core/scanners/**
- src/core/audit/**
- src/core/execution/**
- src/core/work/**
- src/core/resources/**
- pnpm-lock.yaml
- .github/**
- .agentic/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Inventory packaged APK skills and define one canonical skill registry from existing template assets; do not duplicate each skill body in CLI code.
2. Add a bounded read-only list/show surface if needed so users/agents can discover available packaged skills and their canonical source.
3. Add an explicit materialization/export operation that renders one named skill to `.agents/skills/<skill>/SKILL.md` in the current repository. Prefer preview/check-only by default and require an explicit write/apply flag for mutation, consistent with APK's safe generated-file conventions.
4. Preserve canonical source ownership: the project-local file is a generated/materialized copy of the packaged skill, not a second manually maintained source of truth.
5. Refuse to overwrite a customized project skill silently. Compare normalized content/hash against known APK-generated content and require an explicit force/update path for replacement; report drift clearly.
6. Ensure project-local skill content contains no unresolved Handlebars/template syntax and has an actual `SKILL.md` filename suitable for agentskills-compatible loaders.
7. Support at least `apk-task-author` and all existing packaged APK skills through the same generic mechanism; do not add one command per skill.
8. Keep init/adopt unchanged by default. No project skill appears merely because APK was installed or adopted.
9. Document generic `.agents/skills` usage and a Hermes example: launch Hermes in the repository, trust project skills through Hermes' own trust mechanism, then invoke the materialized skill. APK must not modify Hermes global config or trust state.
10. Add cross-platform path, drift, preview/apply, idempotency, unknown-skill, and customized-file regressions; regenerate committed dist.

## Acceptance criteria

- A user can materialize `apk-task-author` into `.agents/skills/apk-task-author/SKILL.md` through one documented APK command/workflow.
- The same mechanism works for every packaged APK skill without duplicated CLI implementations.
- Preview/check mode reports source, destination, create/update/no-op/customized-conflict status without mutation.
- Apply/write is explicit and idempotent.
- A customized existing project-local skill is never overwritten silently.
- Generated project-local skill content is a real standards-compatible `SKILL.md`, not `SKILL.md.hbs`, and contains no unresolved template markers.
- APK does not write `~/.hermes/skills`, Hermes config, trust databases, or any provider-specific global directory.
- Init/adopt remain unchanged unless a future explicit task decides otherwise.
- Project-local skills are repo-scoped and can be committed or ignored according to repository policy; APK reports what it wrote but does not silently alter ignore rules.
- Canonical packaged sources remain the only APK-owned skill content source of truth.
- CLI help/docs distinguish packaged skill availability from materialized project-local discovery.
- Hermes dogfood instructions rely only on documented project-local `.agents/skills` discovery/trust behavior, not private Hermes APIs.
- No task lifecycle, model routing, provider SDK, or agent runtime is added.

## Correctness assumptions

- Standards-based harness discovery expects a literal `SKILL.md`; APK's packaged `SKILL.md.hbs` source is not by itself a native project skill.
- `.agents/skills` is a better APK-facing target than `.hermes/skills` because it is cross-tool and currently supported by Hermes project-local discovery.
- Skill trust remains the consumer harness's responsibility.

## Invariants

- Explicit write only.
- No silent overwrite of customized skills.
- No provider-specific global state mutation.
- One canonical APK skill source.
- Materialization does not change task/project lifecycle state.

## Required evidence

- Materialize/list/preview/apply/idempotency regression tests.
- Customized-destination refusal test.
- Package-source to project-SKILL.md content-equivalence test.
- Dogfood transcript or deterministic fixture showing Hermes-compatible project path and no unresolved template syntax.

## Review questions

- Is this genuinely generic skill export, or did Hermes-specific behavior leak into APK core?
- Can a package upgrade overwrite a user's customized project skill without explicit consent?
- Does preview exactly predict apply?
- Is the materialized file directly loadable by an agentskills-compatible harness?

## Counterexample searches

- Unknown skill name.
- Destination directory absent.
- Existing identical generated file.
- Existing older APK-generated file.
- Existing customized file.
- Read-only destination.
- Windows path with spaces.
- Skill template later gains actual Handlebars variables.
- Repository contains both `.agents/skills` and harness-specific skill directories.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality:static"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document packaged-skill discovery, project-local materialization, safe update semantics, and a short Hermes trust/invocation example.

## Notes

- Hermes Agent currently documents project-local skills under both `<project-root>/.hermes/skills/` and the cross-tool `<project-root>/.agents/skills/`, with project skills taking highest precedence after the repository is trusted.
- Hermes also documents skills as agentskills.io-compatible and recommends a Skill when instructions wrap an external CLI through terminal access. APK therefore needs no Hermes-specific plugin/tool to enable task authoring.
- Keep Hermes trust/user-global installation outside APK. This task only creates the repo-local standards-based file when explicitly requested.
