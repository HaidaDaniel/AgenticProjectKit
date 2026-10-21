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

The generated Project Map and adoption report keep the legacy flat stack for compatibility, but
also report `Application Runtime`, `Repository Tooling`, `Ambiguous Runtime Evidence`, and
bounded `Runtime Components`. A root APK/pnpm manifest in a Python or Go repository is tooling
evidence; a real Node CLI or nested React/Vite component remains an application runtime. Runtime
script evidence is command-aware, and bounded discovery reports when its result may be incomplete.
When
automatic ownership is genuinely ambiguous, the root `.agentic/config.json` may use one bounded
override:

```json
{
  "runtimeManifestRole": "tooling"
}
```

The override accepts only `application`, `tooling`, or `mixed` and changes ownership semantics,
not detected capabilities or APK's repository-local installation model.

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

## Application diagnostics and Python builds

Doctor uses the scanner's bounded runtime ownership projection (including
`runtimeManifestRole` and nested components). It checks Node scripts only at
manifests classified as application or mixed. An APK-only root manifest in a
Python/Go repository no longer produces missing Node script warnings. A real
Node frontend retains checks at its own manifest, with its path in each label.
Ambiguous ownership, malformed manifests, and discovery limits remain explicit
warnings. Python `pyproject.toml` evidence requires a recognized table rather
than just the filename; existing requirements/setup markers remain supported.

Quality detection reads at most 256 KiB of `pyproject.toml` and inventories
literal table declarations without interpreting strings/comments as tables.
A `[build-system]` with a literal `build-backend` and a string-array `requires`
provides build capability evidence. This includes `setuptools.build_meta`,
`hatchling.build`, `poetry.core.masonry.api`, `flit_core.buildapi`, `pdm.backend`,
and `maturin`; other valid module/object backend names remain declared evidence.
The optional `backend-path` must be a literal string array. Configuration does
not prove that a backend is installed or a build succeeds. Detection executes
no project commands and does not install Python or Node tools.

This is a conservative inventory, not a full TOML parser: duplicate build tables
or keys, incomplete strings/arrays, unsupported escaped/complex build values,
and oversized/unreadable files produce bounded diagnostics with no Python build
claim. Unrelated whole-document TOML validity is not certified. Pytest, Ruff,
typecheck, and coverage tables retain independent capability evidence.
