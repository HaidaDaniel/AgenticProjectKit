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

## APK installation diagnostics

Doctor and adoption preview use the same read-only installation projection.
It separates `declared` (exact pin, unfixed declaration, absent, unknown, or APK
source checkout), `locked` (matched, mismatch, absent, unknown, or not applicable),
and local CLI `present` status. A matched declaration/lock is reproducible
metadata; it does not certify an installation, successful CLI launch, remote tag,
or package integrity. Installed package-version mismatches are separate warnings.

The supported lock inspection is the conventional pnpm v9 root importer with one
APK dependency, literal specifier/version fields, and either an exact version or
GitHub codeload resolution at a full commit. The resolution must identify the
same declared repository. Other lock formats, competing lockfiles, YAML aliases,
duplicate roots/keys, and unsupported syntax remain unresolved/unknown.

Inspection reads bounded `package.json`, installed package metadata, `README.md`,
`AGENTS.md`, and `scripts/apk.sh` (64 KiB each), plus `pnpm-lock.yaml` (1 MiB).
It recognizes explicit separate-installation prerequisites and `pnpm exec`
invocations conservatively, without interpreting arbitrary prose. Only a wrapper
containing one literal `node <path>` command (optionally `exec` and `"$@"`) has
its payload inspected. Variables, multiple commands, external targets, unreadable
files, and oversized inputs remain unknown. No wrappers/bootstrap commands or
project scripts are executed; no package, lock, instruction, or config is changed.

Use the evidence paths to reconcile declarations, lock entries, installed version,
and documented launcher manually. A separate installation can be an intentional
prerequisite; document its exact source/version and acquisition steps. Node
application ownership remains independent: these warnings do not turn a Python
or Go application into a Node application or install Node dependencies for it.


## Task compatibility and manual repair

Adoption preview and `apk lint` share canonical task-parser inspection across the configured active and archive directories. Heading-family counts (`legacy`, `gated`, `unknown`) retain their original meaning; neither a structured heading nor a config schema marker proves that State, Mode, sections, or the rest of a contract can be parsed. Valid `Verification commands` contracts remain supported. Preview distinguishes config schema-marker migration from known task-contract repair, and lists paths, available raw IDs/State/Mode, and bounded parser issues in its structured compatibility report. Text output includes per-file issues and the migration sequence; lint retains `task-malformed` findings.

Inspection distinguishes `parseable`, `incompatible`, `unreadable` (including non-UTF8 and non-regular inputs), and `not-inspected` (size or file budget). Bounds are 4,096 directory entries per active/archive directory, 1,024 inspected files, 256 KiB per file, 32 issues per file and 512 characters per issue. Raw metadata is capped at 128 characters. Omitted issue counts and truncated text are disclosed. File enumeration limits make discovered counts lower bounds; unreadable, oversized or omitted files make coverage incomplete. A parseable result is syntactic compatibility, not a successful lifecycle gate or dependency audit. Symlink task files are not followed. Reports do not rewrite task bytes, evidence, baselines, ownership or history. `adopt --apply` may migrate the config marker and add normal missing scaffolding, but it does not repair existing task contracts.

For an incompatible or incomplete inventory:

1. Preserve original task bytes and Git history; back up local evidence and baselines.
2. Classify each active and archived file. A supported legacy verification heading needs no repair.
3. Obtain explicit owner, state and project-mode decisions. Do not map `in_progress` to `doing` or assume `bugfix` is a Mode without a semantic decision.
4. Prepare narrowly scoped edits on a branch, preserving historical references and completion claims without inventing proof.
5. Rerun lint and preview until coverage is complete and incompatibilities are resolved; separately review duplicate IDs and dependencies.
6. Independently revalidate affected candidate/baseline-bound verification and review evidence. Contract changes can invalidate old proof; copying PASS records cannot restore trust.

Changing `schemaVersion` alone never repairs invalid task content. The status/attention resilience described in the [task system](task-system.md) keeps healthy parsed tasks visible while incomplete inventories have unavailable gates; this is diagnostic behavior, not automatic migration.


## Tracked operational artifacts

Doctor, init and adoption use the same operational-path policy and read-only Git report. It distinguishes agent records, run logs, evidence, baselines, reviews, sessions, generated reports, and other operational files (locks, profiler/workspace records). Intentional `.gitkeep` placeholders and ignored untracked records are excluded. A staged deletion is absent from the index inventory even if the worktree file remains.

Counts describe unique paths in the observed index. Sizes are **indexed blob bytes**, summed per path, not current worktree sizes or historical repository storage. A symlink contributes its indexed link-text size; the inspector never follows its worktree target or prints record contents. Unmerged entries, non-blob objects and missing objects have unknown byte totals. Other fully inspected categories retain exact totals. Complete zero, non-Git not-applicable, incomplete, and unknown/error are distinct outcomes. Tracked artifacts are advisory warnings, not failed completion gates.

Git queries have a five-second timeout and 4 MiB output bound; index inspection allows at most 4,096 matching entries (including merge stages/placeholders before filtering). Exceeding a bound cannot establish a clean zero. Category samples include at most eight paths, each capped at 256 characters, with omitted counts; unusual names are JSON-escaped for display. The path-only compatibility API cannot express coverage; callers needing absence/size claims must inspect the full report. Git object lazy fetching and replacement-object interpretation are disabled for these queries. This is an observation of the index at inspection time, not an atomic snapshot against other writers.

Untracking is a deliberate repository decision:

1. Inventory and back up local operational records, especially evidence/baselines needed by unfinished work. Decide which records must remain portable and which are intentionally committed.
2. Check effective ignore rules. Adding `.gitignore` does not stop tracking an existing file.
3. Preview only reviewed, exact paths, for example `git rm -n --cached -- '.agentic/runs/example.jsonl'`. For unusual names, preserve each literal argument; do not paste rendered JSON as shell quoting or use broad globs.
4. If the decision is to untrack, run the corresponding exact `git rm --cached --` command yourself. Do not force a refusal without understanding staged/local differences. Review `git diff --cached --name-status` and the local backup before committing deliberately.
5. Confirm local task operations still have the required context. Untracking preserves the worktree file, but ordinary clones will no longer carry it. It does not erase past history or automatically invalidate/revalidate evidence.

APK does not execute removal, staging, cleanup or history-rewrite commands. The diagnostics do not grant permission to remove intentionally portable records.
