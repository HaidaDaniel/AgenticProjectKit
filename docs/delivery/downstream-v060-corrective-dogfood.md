# Downstream dogfood of the corrected v0.6.0 APK candidate

Task 0289 records a read-only workflow matrix, write-safety checks, and release validation for the combined corrective candidate. No release, tag, or publication was created, and no production downstream repository was modified.

## Identities

APK candidate:

- Exact recorded HEAD: `03649b23c36d99968f7ade863de38ac75a446143`.
- Material implementation commits: `0bca258b18a95bff128d511ce46a19c435a9ce34` (0286 sync/export containment), `4526736c8949f488a54174166775e95f9a4874bf` (0287 init/gitignore containment), `6743c19baa68eb1bd946454f54f727b6ebcf2447` (0288 doctor ignore diagnostic). `03649b2` changes only task Markdown lifecycle state; source and committed dist are those of `6743c19`.
- Immutable v0.6.0 annotated tag object: `d83d069f5309ca2b963f8939a2626d771265979a`; peeled release commit: `88fc21e0b6523808cb627d2707354f1d8d2128db`. The tag object is not a commit and was not used as a commit.
- Isolated candidate checkout: `/tmp/opencode/apk-0289-candidate` (`git worktree add --detach` at `03649b2`), with an offline frozen-lockfile install. Installed CLI reports `agentic-project-kit 0.6.0`.
- Installed dist/package identity in each downstream copy: `node_modules/agentic-project-kit/dist/cli/index.js`, package version `0.6.0`, aggregate SHA-256 over installed `dist/**` = `ce7695c67729a953ffdb9f5b5e1f70bde179cf98872d23ca6d7f0acb8a0ce283`, identical to the exact candidate checkout. The previously pinned v0.6.0 installation hashed to `27a2426b417dffd862a7b4829abb75ba056d548789594a42659d3eed31e14138`, showing the candidate actually replaced it.

Downstream copies (disposable `cp -a` copies of local clones; production repositories untouched):

- `HaidaDaniel/translator-agent`, remote `git@github.com:HaidaDaniel/translator-agent.git`, branch `architecture/canonical-v3-plan`, real HEAD `3efa33897464aeb63b0bb88e9f35d569f87461ec`. Copy: `/tmp/opencode/apk-0289-downstream/translator-agent`.
- `HaidaDaniel/media-core`, remote `git@github.com:HaidaDaniel/media-core.git`, branch `main`, real HEAD `768292632025a554aa34a5e2efa13e04d37a2116`. Copy: `/tmp/opencode/apk-0289-downstream/media-core`.
- Production HEADs were recorded before and after the copies and remained exactly the values above; both production worktrees were clean.

Environment: Linux, Node `v24.22.3`, pnpm `10.28.1`, local git. GitHub HTTPS access was unavailable in this environment (`could not read Username`), so the exact candidate was installed from the local isolated checkout rather than a registry or GitHub cold install. This is a stated limitation, not a claim of registry validation.

## Command matrix

Every command ran from the disposable copy through the installed candidate CLI. Exit codes:

| Command | translator-agent | media-core |
| --- | --- | --- |
| `doctor` | 0 | 0 |
| `adopt --preview` | 0 | 0 |
| `sync` (read-only) | 0 | 0 |
| `lint` | 0 | 0 |
| `status --detail` | 0 | 0 |
| `attention --json` | 0 | 0 |
| `workers --json` | 0 | 0 |

Git status stayed at zero entries in both copies across the whole read-only matrix. Pre-existing diagnostics were reported honestly:

- translator-agent `doctor`: `fail: 0`, `warn: 5`, `pass: 15`. Warnings: bounded application discovery, three missing scripts in a nested `narou-text-downloader` component, and quality 5/7. Its `ignore-entries` check is an informational pass: the canonical strings are absent, but effective ignore is proven via `.gitignore:34:.agentic/agents/*` for `.agentic/perf/*` and `.git/info/exclude:9:/tmp/apk/` for `/tmp/apk/`. This is exactly the canonical-string-absent / effectively-ignored case and produced no leak warning.
- media-core `doctor`: `fail: 0`, `warn: 4`, `pass: 16`. Warnings: bounded application discovery, quality 4/7, missing `LICENSE`, missing `.env.example`. Its `ignore-entries` check passes with canonical strings present.
- Both `adopt --preview` runs were gated v2 with complete parseability coverage (translator-agent 378 parseable tasks, media-core 76) and no writes. `lint` reported only bounded context-hygiene/overlap advisories. JSON outputs were parsed as local semantic state; no live process or hosted CI claim is made.

## Write-safety checks

Artificial marker files were created outside the disposable repositories under `/tmp/opencode/apk-0289-markers/`. For each case an artificial symlink was inserted into the disposable copy, the candidate CLI command was run, the symlink was removed, and both marker bytes and Git status were compared.

| Copy | Case | Exit | Outside marker | Git status |
| --- | --- | --- | --- | --- |
| translator-agent | `sync --write` to symlinked `AGENTS.md` | 1 | `OUTSIDE-ORIGINAL` unchanged | unchanged |
| translator-agent | `export agents --force` to symlinked `AGENTS.md` | 1 | unchanged | unchanged |
| translator-agent | `init .` with symlinked `.gitignore` | 1 | unchanged | unchanged |
| media-core | `sync --write` to symlinked `AGENTS.md` | 1 | unchanged | unchanged |
| media-core | `export agents --force` to symlinked `AGENTS.md` | 1 | unchanged | unchanged |
| media-core | `init .` with symlinked `.gitignore` | 1 | unchanged | unchanged |

Each refusal printed an actionable `Refusing to use ... symbolic link` containment error. Final Git status was zero entries in both disposable copies; no outside marker was created, rewritten, or appended.

## Release validation at the exact candidate

`pnpm release:check` ran in the isolated checkout at `03649b23c36d99968f7ade863de38ac75a446143`.

- First attempt with default Node heap: tests passed (`906` source tests, `0` fail; `30` documentation tests), then c8 exhausted the V8 heap and the command aborted with exit 134. This is an environment heap limit, not a code failure.
- Authoritative attempt: `NODE_OPTIONS=--max-old-space-size=4096 pnpm release:check` exited 0. It covered 906 source tests, 30 documentation tests, coverage gates (92.19% lines, 98.36% functions, 82.55% branches), `pnpm build`, built-CLI `lint`, read-only `sync`, and `audit`. Checkout SHA: `03649b23c36d99968f7ade863de38ac75a446143`.

This is local evidence. No hosted CI run was performed for the candidate, so no hosted-CI claim is made here.

## Temporary-install scope and limitations

- Disposable copies were created from the named local clones of the exact downstream branches at the recorded real HEAD SHAs. No production downstream file, index, HEAD, or commit changed; nothing was committed to downstream.
- Candidate installation replaced only `node_modules/agentic-project-kit` inside the disposable copies with the exact candidate's `dist/`, `package.json`, and `README.md`. Its runtime dependency `handlebars@4.7.9` was resolved by a package-manager-artifact symlink to the local pnpm store copy, because registry access was unavailable. This local install is not a registry cold-install proof.
- All artificial symlinks and markers used by the safety checks were removed from the disposable copies afterward; only the installed candidate and its dependency artifact remain there. APK-generated operational output from the checks did not alter tracked files.
- Node 24 / Linux only; Windows symlink privilege behavior and other OS launchers were not exercised. `attention --json` and `workers --json` describe local semantic state, not live process claims. No release was published, tagged, or backfilled, and no source, dist, task file, or committed evidence was changed by this task beyond its own report and progress note.
