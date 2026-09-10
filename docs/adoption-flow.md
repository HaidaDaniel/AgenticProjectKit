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

## Compatibility and migration

New `init` and explicit adoption migrations write `schemaVersion: 2` to `.agentic/config.json`. A config without a marker, or with `schemaVersion: 1`, is treated as a legacy v0.3.1-style config. Legacy task Markdown remains readable: flat `## Verification commands` sections are normalized in memory and are not rewritten automatically. Structured `## Verification` tasks are reported as gated; mixed repositories are reported as mixed.

Preview the exact adoption changes without writing anything:

```bash
pnpm exec apk adopt --preview
# --dry-run is an alias
```

Apply the migration explicitly:

```bash
pnpm exec apk adopt --apply
```

The apply path preserves recognized and unknown config keys, never overwrites existing instructions or task files, and only creates missing kit files plus the explicit config schema marker. Repeating `--apply` is idempotent. An invalid or newer unsupported config schema fails closed instead of rewriting the repository.

The generated `docs/adoption-report.md` records detected compatibility, task-contract counts, and pre-adoption gaps. `doctor`, `lint`, read-only `audit`, and `status` remain usable on legacy repositories before migration; mandatory gates may still report missing current evidence until the repository opts into them.

## Quality capability detection

Run the non-mutating quality inventory before choosing repository tooling:

```bash
pnpm exec apk quality detect --json
```

The detector reports stable capability IDs (`typecheck`, `lint`, `tests`, `build`, `coverage`, `hooks`, and `ci`) with bounded script/config evidence. It recognizes common Node and non-Node markers, but does not execute commands, install packages, create hooks/workflows, or rewrite scripts. Add an explicit `.agentic/config.json` policy only when a capability is required or recommended for this repository:

```json
{
  "quality": {
    "required": ["tests", "typecheck"],
    "recommended": ["ci", "coverage"]
  }
}
```

The flow is detect -> report -> recommend -> explicit opt-in setup. A missing optional capability is diagnostic only; a missing or unknown required capability fails the quality policy with an explicit reason.

## Guardrails

- Do not rewrite existing application code.
- Do not force a new architecture on the project.
- Keep generated docs consistent with observed structure.
- Prefer documentation cleanup before code changes.
- Use scanner facts in adoption reports; do not run audit as a separate write step.
