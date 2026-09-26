# Runnable showcases

The public-readiness smoke runner exercises three isolated workflows against the exact
`v0.4.7` package tag. It requires Node.js `>=22.22.1`, pnpm `10.28.1`, and Git. The first
`pnpm add` for each temporary project may need GitHub and package-registry access when the
tag or dependencies are not cached. The runner then repeats cached dependency installation
with `--offline` and runs APK from the project-local install.

Run all scenarios from the repository checkout:

```sh
node examples/public-readiness/smoke.mjs
```

Run one scenario while inspecting its temporary project:

```sh
node examples/public-readiness/smoke.mjs --scenario brownfield --keep
node examples/public-readiness/smoke.mjs --cleanup "/exact/path/printed-by-previous-command"
```

By default, the runner creates a unique directory under the operating-system temporary
directory and removes only that directory after the smoke. It refuses a temp location
inside the repository or user home. If the system temp directory is inside the home, pass
an existing safe location with `--temp-dir`. `--keep` prints the exact fixture path;
`--cleanup` removes only a marked directory created by this runner (pass the same
`--temp-dir` value if one was used). The checked-in output
snapshots in [`examples/public-readiness/evidence/`](../examples/public-readiness/evidence/)
show the expected state and repeatability result for each scenario.

## Greenfield

The runner installs the exact tag, initializes a new repository, checks the generated
starter paths, syncs the generated instructions, and commits that reviewed baseline. It
then creates and commits a bounded documentation task, registers and claims an example
owner, writes the one allowed note, runs verification and the gate, marks the task done,
and commits lifecycle bookkeeping separately. A second `init` must leave the worktree
unchanged. The initialized `0001 Start Project` planning task remains open; the sample
work task is `0002 Write the first project note`.

For the complete human-guided install and task workflow, see [Getting Started](getting-started.md).
The smoke is a disposable fixture; inspect generated paths before accepting similar
changes in a real project.

## Brownfield

The fixture contains an existing Go source file, README, custom `AGENTS.md`, project notes,
and a user-owned `.gitignore` entry. The smoke proves `adopt --preview` leaves the worktree
unchanged, `adopt --apply` preserves those files while adding missing APK files, and a
second apply creates no additional changes. APK's `.gitignore` migration is additive, so
the original line must remain at the start of that file.

In a real repository, read the preview path by path, review every created or updated file,
and only then apply it. Follow the [safe brownfield guide](guides/brownfield-adoption.md)
for backups, customization boundaries, and recovery steps.

## Local-first

The fixture is a Go repository with APK pinned as a local development dependency at
`v0.4.7`. `pnpm add` is the acquisition step and may need network access; a frozen install
is offline only when the exact tag and dependencies are already cached. The smoke runs
`pnpm install --offline --frozen-lockfile` after acquisition, then exercises local APK
adoption, lint, and status commands and repeats the adoption without extra changes.

This demonstrates an offline-capable path after acquisition, not a complete air-gap
guarantee. APK commands make no network request themselves, but task verification runs the
declared shell commands, which can have their own network requirements. See
[constrained and local-first execution](guides/constrained-local-execution.md) for that
boundary and the [compatibility limits](product/maturity-and-compatibility.md).
