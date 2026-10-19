# v0.5.1 post-release validation

This report was prepared after tag publication on 2026-10-19. It is separate from
the immutable [candidate note](../releases/v0.5.1.md). Task 0225 released the frozen
candidate; Task 0226 records these results and promotes stable documentation.

## Immutable identities

| Subject | Identity |
| --- | --- |
| Annotated tag | `v0.5.1` |
| Tag object | `b5e5e12c6cdd4d053953de8afed5749f6538652e` |
| Candidate / tag peel | `e45760b8d68c0d5955e99b50a6ac9ca064952524` |
| Candidate tree | `204fa98f261416005c56bf4d855ab7b71ecc2a7a` |
| Tag creation time | `2026-10-19T06:14:47Z` |
| Installed package | `agentic-project-kit@0.5.1` |
| Validation toolchain | Node.js `22.22.1`, pnpm `10.28.1` |

Local and remote tag object/peel matched. The preserved v0.5.0 tag object remains
`9992ca013d71c8fdd1c2bd845d622200cec98db6`, peeling to
`5a9e1a150a0715900942e60f47ae215b6fec07f8`. Neither tag was moved or rewritten.

## Integration and task proof

| Task / boundary | Candidate or merge | Evidence |
| --- | --- | --- |
| 0220 approved amendment | `a60b8567009d8d567daa287c4fa7bc7e849ebbf8` | Exact preview digest `1f3edee299e5a6f095f0c19d0556003e708b75f13104f8e839bfccbb5ccc7e3b`; append-only epoch; all five canonical checks and gate passed. |
| PR #8 merge | `8f7f1fd90af5c0a17f4ce8b0c651eac112fe0006` | PR Quality [39143245950](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/39143245950) and main Quality [39143501523](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/39143501523): success. |
| 0224 bounded reader | `2253cbf7de54abdb3eec956e69791dde70751c2f` | Canonical verification, hosted [39143874835](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/39143874835), fresh independent review, and gate passed. |
| PR #9 merge | `6910e5bda3f0d5e40c7f3c2f325ac3ee22f7d1bb` | Closeout PR Quality [39161201986](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/39161201986) and main Quality [39161457906](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/39161457906): success. |
| Release Task 0225 | `e45760b8d68c0d5955e99b50a6ac9ca064952524` | All six required checks, independent release review, and completion gate passed; lifecycle-only closeout is `24a89df513338fc760c7ae587f6720132ec3751d`. |

Task 0220 did not require independent review under its low-risk policy. Task 0224
reviewer `codex-review-0224-r1` inspected the complete candidate and trusted evidence,
then passed six independent counterexamples. The reader accepted all 273 preserved
records, including six historical epochs, and rejected a changed carried hash.
The preserved journal SHA-256 stayed
`427519f0d8209a02222fa19f36485abaa8982c83b8a29470631534abae743ceb`.
PR #4 was not merged; blocked Task 0221 was not retroactively certified.

## Pre-tag validation

The committed release candidate was clean before canonical verification. Node and
pnpm versions were asserted explicitly. The full `pnpm release:check`, committed
dist currency, and `git diff --check` passed on that frozen SHA. The lockfile and
dependencies did not change; package metadata changed only from version 0.5.0 to
0.5.1. The verification run was `verify-1792354021391-0lrdwy`. Its first aggregate
status remained incomplete while manual/report/live profiles awaited real observations;
the deterministic commands all passed. Later external records satisfied those checks.

GitHub Actions Quality [39162049879](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/39162049879)
was a **main push** run for the exact candidate SHA, completed with `success` on
2026-10-18 before tagging. It asserted the checkout SHA and pinned toolchain, installed
frozen dependencies, ran the full release aggregate, and passed dist and clean-tree
drift guards. Local checks were not substituted for hosted CI.

The packed payload contained 102 files and six portable skill assets, with all three
bin aliases and version 0.5.1. It excluded task/runtime history and source files.
The tarball SHA-256 was
`4cec0830aaa08249c6d849e2c9ca755475bd172cf36487333f214647820c670e`.
An initial consumer used Corepack's default pnpm 10.30.3; the reviewer identified this
gap. Only consumer smoke was repeated before tagging, with an explicit
`packageManager: pnpm@10.28.1`, a fresh store, and recorded Node/pnpm assertions.
That corrected run passed at `2026-10-19T06:14:06Z`; the original unpinned run is not
toolchain proof. Independent pre-tag inspection then reported no remaining blocker.

## Actual-tag cold install

After publication, a new consumer and fresh store installed:

```bash
pnpm add -D agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.5.1
```

The consumer pinned pnpm 10.28.1 and asserted Node v22.22.1. The run started at
`2026-10-19T06:14:55Z` and completed successfully at `06:15:02Z`. Its lockfile resolved
the Git tag to the exact candidate `e45760b8d68c0d5955e99b50a6ac9ca064952524`.
Installed metadata reported 0.5.1; `apkit`, `apk`, and `agentic-project-kit` all ran
successfully. Six portable skill assets were present.

In a disposable Git project, the installed CLI passed `init`, `sync --write`,
check-only `sync`, `lint --json`, `doctor`, and `status`. No downstream working
repository was modified.

## Disposable self-adoption

The installed actual-tag CLI ran against a separate detached checkout of the tagged
candidate. `adopt --preview` left it unchanged. `adopt --apply`, `sync`, `lint --json`,
`doctor`, and `status` succeeded. Source, package metadata, lockfile, and dist remained
unchanged. The only new outputs were a disposable adoption task and
`docs/adoption-report.md`; these were not imported into main. The self-adoption run
completed at `2026-10-19T06:15:23Z`.

## Final review and remaining work

Reviewer `codex-review-v051-r1` checked the full release diff, current deterministic
and external evidence, payload bytes, pinned consumer results, immutable tag chronology,
actual-tag installation, and self-adoption. Review evidence
`evidence-1792390603324-jqyc3v` recorded PASS with no blocking findings. The release
gate passed with all required checks current and zero policy blockers, then Task 0225
was closed. The immutable candidate note was not backfilled with these later facts.

Tasks 0216 (bounded Go startup prototype), 0218 (historical provenance recovery
research), and 0223 (opt-in exact-push CI parity) remain todo. Task 0223 requires a
separate config/CLI/worktree/process implementation, negative-case matrix, and timing
measurements; release policy does not require it for this patch. Task 0221 remains
blocked historical attribution. Product identity Tasks 0149 and 0150 remain blocked.
