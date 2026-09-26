# Safe brownfield adoption

Use this flow to add Agentic Project Kit to a repository that already has code, local changes, project documentation, or agent instructions. Run the commands from that repository after APK is available as a pinned project dependency; `pnpm exec apkit` uses that repository's installed CLI.

For a new or empty repository, use `apkit init`. For an existing repository, use `apkit adopt`: it scans the repository and reports compatibility and missing kit files. It does not rewrite application source.

`init` creates missing starter files and skips paths that already exist; it also adds the APK ignore entries to `.gitignore`. It does not scan the project or produce the adoption report. An existing repository can still be missing starter paths, so use `adopt` when you need the compatibility scan and reviewed-file list.

## 1. Record the starting state

Confirm the target root and inspect any work already in progress before changing files:

```bash
git rev-parse --show-toplevel
git status --short --branch
git diff --stat
git diff
git diff --cached
pnpm exec apkit mode
```

Keep a recoverable copy of valuable work, including uncommitted and untracked files. Use the repository's normal checkpoint or backup process. If this directory is not a Git worktree, make an external copy first; adoption can run without Git, but APK cannot report tracked-file state and Git cannot show the resulting diff.

List existing instruction files and decide which are hand-maintained or generated. Pay particular attention to `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. An existing file can contain local conventions even when it resembles an exported file. If you need to inventory obsolete generated files, `pnpm exec apkit export --report-legacy` is a preview; cleanup is a separate explicit operation.

The mode command without an argument only reports the current mode. `pnpm exec apkit mode adopt` changes `.agentic/config.json`; choose that only if you intend to record adoption as the current workflow mode, then inspect the config diff.

## 2. Preview the adoption plan

```bash
pnpm exec apkit adopt --preview
```

The preview reports detected compatibility, task-contract counts, planned creates or updates, skipped existing files, and tracked APK operational state. It writes no files. You can pass a repository path when invoking APK from another directory:

```bash
pnpm exec apkit adopt path/to/existing-repo --preview
```

Read every proposed `update` and the list of `create` paths. Stop if the target is wrong, the config is invalid or from an unsupported newer schema, a proposed change conflicts with local ownership, or the tracked-state warning needs a repository decision. APK fails closed on an invalid or unsupported config when migration is requested.

## 3. Apply only the reviewed plan

```bash
pnpm exec apkit adopt --apply
```

`--apply` is a write operation. It creates missing kit files such as project docs, an adoption report, a project map, a follow-up documentation task, and missing instruction exports. Existing docs, task files, and instruction files are skipped. It additively appends missing APK ignore entries to `.gitignore` and leaves existing lines in place. It does not stage, commit, delete, or untrack files.

The current candidate set is `.agentic/config.json`, `.agentic/agents/.gitkeep`, `.agentic/runs/.gitkeep`, `docs/project-map.md`, `docs/adoption-report.md`, `docs/project.md`, `docs/scope.md`, `docs/architecture.md`, `docs/progress.md`, `docs/task-system.md`, `docs/context-system.md`, `docs/decisions.md`, one `.tasks/<next-id>-document-adopted-repository.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.gitignore`. Repository contents determine which paths are created, skipped, or updated; use the preview's path-by-path plan as the exact list for your run.

If an existing `.agentic/config.json` uses a supported legacy schema, `--apply` updates its `schemaVersion` to the current version while preserving parsed config keys. The JSON is serialized again, so inspect the diff even when the only semantic change is the schema marker. Without `--apply`, `adopt` still writes missing kit files but does not perform this legacy config migration; always preview before either write path.

Ignore rules do not remove already tracked runtime data. If preview reports tracked `.agentic` or generated report paths, inspect those exact paths and decide manually how the repository should handle them. APK does not change the Git index.

## 4. Review tracked and new files

```bash
git status --short
git diff -- .gitignore .agentic/config.json
git diff --check
```

`git diff` shows changes to tracked files but omits newly created files. Open every new path reported by `git status` and the adoption preview. Check the config migration, `.gitignore` additions, adoption report, project map, placeholder docs, generated instructions, and new task before accepting them. The project map and adoption report describe a bounded scan; correct inaccuracies and fill documentation placeholders with observed facts.

Existing `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and task files are preserved by adoption when present. New exports and docs can still be generic; review them before using them as project policy. Resolve conflicts file by file and keep user-owned instructions when their intent is unclear.

## 5. Check generated instructions before writing them

```bash
pnpm exec apkit sync
```

This is a check-only comparison of generated instruction files. Exit code 1 means files are missing or differ from the current export. A customized `AGENTS.md` may be reported as stale; that result does not mean APK changed it.

Only after reviewing that output and deciding to replace the listed files, write the generated versions:

```bash
pnpm exec apkit sync --write
```

`sync --write` updates missing and stale exports, including `AGENTS.md` when it differs. `apkit export` skips existing files by default; `apkit export --force` overwrites the selected export. These commands do not merge custom text. Keep a backup and inspect the full diff after any write. If custom instructions should remain authoritative, leave them in place and do not run a write/force export.

## 6. Validate the adopted repository

```bash
pnpm exec apkit lint --json
pnpm exec apkit sync
pnpm exec apkit status
```

`lint` and `status` are read-only contract/workflow checks. Resolve findings from their exact paths; they do not repair old tasks or rewrite user files. Re-run `sync` after any deliberate export update. A stale custom instruction file can be an intentional choice, so record that decision for the team rather than overwriting it to silence the check.

`audit` is a separate report-writing scan, not a read-only preflight. It writes or replaces `docs/audit-report.md` and `docs/project-map.md`:

```bash
pnpm exec apkit audit
```

It writes `docs/audit-report.md` and `docs/project-map.md`. Inspect both outputs and the repository status afterward. Audit checks repository shape and declared quality capabilities; it does not run the adopted project's scripts or install tooling. Findings can include errors that return exit code 1, so read the report before deciding what to fix.

Finish with a complete working-tree review, including untracked files, and `git diff --check`. Keep all adoption changes unstaged until the intended files and generated text have been accepted under the repository's normal review process.

## Recovery and stop points

- If preview shows an unsupported or invalid config, stop and resolve the compatibility issue before migration. Do not force a schema change.
- If adoption exits partway through, assume earlier file writes may remain. There is no transaction-wide rollback. Inspect `git status`, the tracked diff, and each new file; restore any incomplete or unwanted file from the backup before retrying. A retry skips files that now exist, so it cannot be relied on to repair a partial file.
- If `sync --write` or `export --force` replaces local instructions, restore or merge them from the backup by hand, then review the result. APK does not merge custom instructions automatically.
- If a tracked-state warning appears, decide separately whether those exact runtime files belong in Git. Adding ignore rules does not untrack or delete them.
- Stop for human review when file ownership, a config migration, generated policy, or a proposed overwrite is unclear. Preserve the state and gather the exact paths and diffs before proceeding.
