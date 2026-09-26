# v0.4.7 post-release tag validation

This record contains observations made after immutable tag publication. It is committed separately on `main`; it is not part of the tagged candidate and does not modify `docs/releases/v0.4.7.md` or the tag.

## Immutable release identity

- Frozen release candidate: `2797556344eb25cc34d3f51afbe10532147aca85` (tree `45b61982b67a8a1dab0bf92dea861ccde267add9`).
- Exact-SHA GitHub Actions Quality run `36233459321` completed `success` for that same candidate SHA. It started at `2026-09-26T09:39:55Z` and completed at `2026-09-26T09:47:42Z`: <https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/36233459321>.
- Annotated tag `v0.4.7` is tag object `29b3152ae29916d58bceee90239f225699650a13`; its remote and local peel is exactly `2797556344eb25cc34d3f51afbe10532147aca85`.
- `package.json` reports `0.4.7`. `pnpm-lock.yaml` has no root package-version field and dependency versions did not change.

## Actual-tag cold install

- Installed `git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.7` into a fresh temporary consumer using fresh pnpm store `/tmp/apk-v047-store.BC7YRn`.
- The install resolved `agentic-project-kit@0.4.7`, downloaded 10 packages with zero store reuse, and completed without a build-script allowlist.
- The generated lockfile resolved the package tarball to `https://codeload.github.com/HaidaDaniel/AgenticProjectKit/tar.gz/2797556344eb25cc34d3f51afbe10532147aca85`, matching the immutable tag peel.
- Installed metadata exposes `apkit`, `apk`, and `agentic-project-kit`, all mapped to `dist/cli/index.js`. Each command's `--help` exited successfully.
- The installed payload includes `LICENSE`, `dist/cli/index.js`, and the five portable assets: `apk-milestone-semantic-audit`, `apk-project-grill`, `apk-prototype`, `apk-task-grill`, and `apk-task-split`.

## Disposable downstream Go application

A disposable Go repository at `/tmp/apk-v047-goapp.iMxCKJ` contained `go.mod` and `main.go` and had no application `package.json`. The installed v0.4.7 CLI was invoked from that repository:

- `adopt --preview` listed the planned adoption files and confirmed it wrote nothing.
- `adopt --apply` reported `Detected stack: Go`, created 17 files, and updated none.
- `sync` reported all three generated files current; `lint --json` returned `hasErrors: false` with no findings; `audit` reported three warnings and quality policy pass; `status` listed the adoption task; `doctor` returned pass with environment warnings expected for a minimal Go repository.
- The generated adoption task parsed, was claimed by a registered smoke agent, and passed `task verify` (`verify-1790416356714-4lvbit`) with clean file scope and lineage. `task gate` passed with current evidence.

This smoke verifies that the released APK workflow can adopt, inspect, and verify work in a non-Node application repository. It does not claim to compile or test the sample Go application itself.

## AgenticProjectKit self-adoption

A second disposable clone was checked out from the actual `v0.4.7` tag at frozen SHA `2797556344eb25cc34d3f51afbe10532147aca85`. The actual-tag-installed CLI from the fresh consumer above was invoked in that clone:

- `adopt --preview` detected the existing gated AgenticProjectKit repository and proposed `docs/project-map.md`, `docs/adoption-report.md`, and `.tasks/0175-document-adopted-repository.md`; it confirmed that preview wrote nothing.
- `adopt --apply` detected Node.js, TypeScript, and pnpm, created those three files, updated none, and skipped 13 existing files.
- `sync` found all three generated files current. `lint --json` returned `hasErrors: false`. `audit` reported one warning with quality policy pass; `status --detail` displayed the existing task inventory and next task 0151; `doctor` passed with two expected environment warnings (no registered agents and no `.env.example`).
- These adoption outputs were confined to the disposable tag clone. They do not alter the published tag, its release note, or the main checkout.

## Temporal boundary

The release note contains only pre-tag-known scope and validation requirements. Candidate/tree/CI/tag identities and all cold-install/downstream facts above are post-tag observations recorded here; the annotated tag and tagged release note remain unchanged.
