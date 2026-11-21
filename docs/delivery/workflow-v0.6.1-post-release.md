# v0.6.1 post-release validation

This record was prepared after publication on 2026-11-21. It supplements the immutable
[pre-tag candidate note](../releases/v0.6.1.md). No post-tag fact was backfilled into the
tagged note.

## Immutable identities

| Subject | Identity |
| --- | --- |
| Annotated tag | `v0.6.1` |
| Local/remote tag object | `afc6f0f82058af1235918a9a1f2926736655aa2b` |
| Reviewed candidate / tag peel | `2892d70c646a4cb2a5fc00967733b7f2993eab3a` |
| Candidate tree | `978571d7f295420a08362d26838a7e01ee61e9a9` |
| Tag creation time | `2026-11-21T10:16:46Z` |
| Remote `main` at tag publication | `2892d70c646a4cb2a5fc00967733b7f2993eab3a` |
| Installed package | `agentic-project-kit@0.6.1` |
| Hosted CI | [Quality 44892547471](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/44892547471), success |
| Local pre-tag toolchain | Node.js `24.22.3`, pnpm `10.28.1` |
| Cold-install / post-tag host | Node.js `24.22.3`, pnpm `10.30.3` |
| Independent reviewer | `release-reviewer-0306`, run `review-1795256165610-3qxjnn`, PASS |

The candidate commit was pushed with an ordinary non-force push before its exact-SHA hosted
checks. The annotated tag was created only after local frozen-candidate checks, exact-SHA
hosted CI, independent review, and the APK gate pre-tag criteria passed. Local and remote tag
objects agree, and the tag peels to the published candidate. No tag was moved or rewritten;
v0.6.0 remains immutable at object `d83d069f...`, peeling to `88fc21e0...`.

## Pre-tag verification

The frozen candidate `2892d70` passed the authoritative command in a clean detached worktree:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm release:check
```

It reported 926/926 source tests, 31/31 documentation tests, coverage gates (92.05% statements,
82.53% branches, 98.2% functions, 92.05% lines), build, APK lint, read-only sync (current:3),
and audit with quality policy pass. The tracked tree and committed `dist/` were unchanged
afterward. Focused mutation-boundary and verdict-oracle suites passed 9/9. The packed payload
contained 114 entries with correct version, three bin aliases, engine, runtime dependency, and
current `dist`. A fresh-store cold install of the exact pushed commit SHA reported 0.6.1 on all
three aliases and passed the documented `init` → `sync --write` → `lint` → `sync` sequence.

Exact-SHA hosted [Quality 44892547471](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/44892547471)
completed successfully before tag creation. The independent reviewer inspected the exact diff,
metadata, clean-checkout evidence, CI identity, and immutability guarantees and returned PASS.
APK gate evidence identities: `evidence-1795256180186-605bj1` (review), plus recorded per-check
evidence for all eleven declared checks.

## Actual-tag cold install and smoke

A fresh clone of the published tag (`git clone --branch v0.6.1 --depth 1`) reported tag object
`afc6f0f...` peeling to `2892d70...` with a clean tree. Cold installation used the actual tag:

```bash
pnpm add -D "agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.6.1"
```

The install resolved `agentic-project-kit 0.6.1` with a fresh store; all three aliases report
`agentic-project-kit 0.6.1`, and the resolved executable is the installed `node_modules/.bin/apk`.
Tag-source regressions (9/9), documentation consistency, and a clean tracked tree were confirmed
from the clone.

| Check | Result |
| --- | --- |
| `doctor`, `lint`, `status`, `attention`, `workers` | exit 0 |
| `attention --json`, `workers --json`, `lint --json` | exit 0 |
| `sync` (read-only), `adopt --preview`, `quality detect` | exit 0 |
| `tasks --json`, `next-task` | exit 0 |
| `init` + `sync --write` then `lint` / `sync` | exit 0; generated files current:3 |
| Symlinked `AGENTS.md` with `sync --write` and `export agents --force` | exit 1, containment refusal, outside marker unchanged |
| `init` into symlinked destination | exit 1, outside marker unchanged |
| GitHub Release | not applicable; this project does not publish GitHub Releases |

## Downstream validation

Installations used the published tag in disposable clones; no production downstream working
tree was modified.

| Downstream | Source branch | Exact SHA | Installed version | Read-only command matrix |
| --- | --- | --- | --- | --- |
| translator-agent | `architecture/canonical-v3-plan` | `3efa33897464aeb63b0bb88e9f35d569f87461ec` | 0.6.1 | doctor, lint, status, status --detail, attention, attention --json, workers, workers --json, sync, adopt --preview, quality detect — all exit 0 |
| media-core | `main` | `768292632025a554aa34a5e2efa13e04d37a2116` | 0.6.1 | same matrix — all exit 0 |
| context-forge | `main` | `9ff7c12e34c8fbd2c5a1a2f749e8e468f2c30ece` | 0.6.1 | same matrix — all exit 0 |

A symlinked generated file in the translator-agent disposable clone was refused by
`sync --write` with the outside marker unchanged. All three production downstream HEADs and
clean/dirty states were identical before and after validation.

## Limitations and follow-ups

- The cold-install host used Node.js `24.22.3` and pnpm `10.30.3`; hosted CI uses Node.js
  `22.22.1` and pnpm `10.28.1`. The declared engine range is `>=22.22.1`; other versions are not
  individually verified.
- `apk init` intentionally creates a starter agent file; the documented `apk sync --write` step
  materializes canonical generated instructions. The smoke followed that sequence.
- The candidate note retains its pre-tag status and v0.6.0 validation reference because it is
  immutable inside the tag; all post-tag identities and results live only in this record.
- Residual pre-mutation TOCTOU, uncertain cross-host lock ownership, and untested Windows
  symlink privilege behavior remain documented boundaries of the containment work.
- No npm registry publication is claimed; the supported install path is the immutable Git tag.

## Release result

v0.6.1 is published as an immutable annotated Git tag and passed pre-tag local/hosted/review/gate
checks plus post-tag actual-tag installation, alias, CLI, downstream, and fail-closed write-safety
checks. The validated-release sentinel and stable install guidance are promoted to v0.6.1 in a
separate bookkeeping change on `main`; the tagged candidate and its note were not changed.
