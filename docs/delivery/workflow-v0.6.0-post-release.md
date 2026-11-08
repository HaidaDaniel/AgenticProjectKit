# v0.6.0 post-release validation

This record was prepared after publication on 2026-11-08. It supplements the immutable
[pre-tag candidate note](../releases/v0.6.0.md). No post-tag fact was backfilled into the tagged note.

## Immutable identities

| Subject | Identity |
| --- | --- |
| Annotated tag | `v0.6.0` |
| Local/remote tag object | `d83d069f5309ca2b963f8939a2626d771265979a` |
| Reviewed candidate / tag peel | `88fc21e0b6523808cb627d2707354f1d8d2128db` |
| Candidate tree | `8351542d5905b7fddd17744980c60a1117cc6725` |
| Tag creation time | `2026-11-08T19:19:34Z` |
| Remote `main` at tag publication | `88fc21e0b6523808cb627d2707354f1d8d2128db` |
| Installed package | `agentic-project-kit@0.6.0` |
| Hosted CI | [Quality 42514163588](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/42514163588), success |
| Local release toolchain | Node.js `24.21.0`, pnpm `10.28.1` |
| Cold-install host | Node.js `24.21.0`, pnpm `10.30.3` |

The candidate was pushed before its exact-SHA hosted checks. The annotated tag was created only
after the local frozen-candidate checks and exact-SHA hosted CI passed. Local and remote tag objects
agree, and the tag peels to the published candidate. The tag was not moved or rewritten.

## Candidate verification

The frozen candidate `88fc21e` passed the local authoritative command:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm release:check
```

It reported 879/879 source tests, 30/30 documentation tests, coverage gates (92.17% statements,
82.49% branches, 98.35% functions, 92.17% lines), build, APK lint with 0 errors, sync with 3 current
files, and audit completion. `git diff --check` was clean and committed `dist/` was current.

A clean checkout of `88fc21e` installed dependencies with `pnpm install --frozen-lockfile` and
repeated the full release check successfully (879/879 source tests, 30/30 documentation tests,
92.16% statements, 82.44% branches, 98.35% functions, 92.16% lines). The checkout remained clean.

## Actual-tag cold install and smoke

Cold installation used the actual GitHub tag:

```bash
pnpm add -D "agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.6.0"
```

The install resolved `agentic-project-kit 0.6.0` and exposed all three aliases. No package build was
required.

| Check | Result |
| --- | --- |
| `apkit --version` | `agentic-project-kit 0.6.0` |
| `apk --version` | `agentic-project-kit 0.6.0` |
| `agentic-project-kit --version` | `agentic-project-kit 0.6.0` |
| `apk proposal --help` | help lists add/list/show/validate/accept/reject/supersede/link/commit |
| `apk proposal add/list/show/validate` | passed; one proposal, no diagnostics, revision exposed by `show --json` |
| Proposal-only local commit | passed in a disposable Git repository; commit contained only `docs/proposals/post-tag-smoke-proposal.md` |
| `apk init` + documented `apk sync --write` + `apk sync` | passed; generated instructions current:3 |
| Agent registration, task create/claim/release | passed |
| Backlog add/list/show/validate | passed |
| Self-adoption `--preview` and `--apply` | passed in an existing Node-shaped repository; detected stack Node.js; generated files current |
| Go/Python/Node downstream-shaped fixtures | `adopt --preview` and `quality detect` exited successfully |
| GitHub Release | not applicable; this project does not publish GitHub Releases |

## Limitations and follow-ups

- The tag cold install used Node.js `24.21.0` and pnpm `10.30.3`; hosted CI uses Node.js `22.22.1`
  and pnpm `10.28.1`. The declared engine range is `>=22.22.1`; other versions are not individually
  verified.
- `apk init` intentionally creates a starter agent file; the documented `apk sync --write` step
  materializes the canonical generated instructions. The post-tag smoke followed that sequence and
  then reported all three generated files current.
- Historical Tasks 0256 and 0260 were accepted by the operator with documented limitations; the
  cross-task and 0268/0275 attribution limitations were acknowledged. This is not a clean-provenance
  claim and no historical artifact was rewritten.
- No downstream production repository was modified and no npm registry publication is claimed.

## Release result

v0.6.0 is published as an immutable annotated Git tag and passed post-tag installation, alias,
proposal, task, backlog, adoption, and cross-stack smoke checks. The validated-release sentinel is
promoted to v0.6.0 in a separate bookkeeping commit after this record.
