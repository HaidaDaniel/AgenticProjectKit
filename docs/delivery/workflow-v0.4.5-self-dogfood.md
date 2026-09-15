# v0.4.5 post-release tag validation

This document records the v0.4.5 release evidence on current `main`. It was committed after the
immutable tag was published and is deliberately not part of the tagged commit. The
"Temporal clarification" section below states which evidence is pre-tag, tag-publication, and
post-tag.

## Temporal clarification

This clarification is recorded on current `main`; it does not change the published release.

1. Frozen candidate: `f574ef252342185bc623346461dca8f545adf6a3` (tree `8f0bf45c139d0f9f3639febab185e8aa6ce92279`), committed `2026-09-15T14:08:38Z`.
2. Hosted Quality run: `34980158536`, <https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/34980158536>.
3. That exact-SHA CI started `2026-09-15T14:13:18Z` and completed `success` at `2026-09-15T14:18:25Z`, before annotated tag `v0.4.5` was created at `2026-09-15T14:21:22Z`.
4. The exact-SHA hosted CI is therefore PRE-TAG evidence, not an observation made after publication.
5. The annotated tag object `18d20157e1ccb7bcd5d63b9046bc50f729d1f70e` and its peel to `f574ef252342185bc623346461dca8f545adf6a3` are TAG PUBLICATION identity, created only after that CI passed.
6. The actual-tag cold install and released-consumer checks in this document were performed after tag publication and are POST-TAG evidence.
7. The immutable `docs/releases/v0.4.5.md` inside `v0.4.5` groups the exact-SHA CI run together with the tag identity and the cold install as "observed after publication". That grouping is temporally inaccurate for the exact-SHA CI, which completed before the tag existed.
8. The `v0.4.5` tag is intentionally not rewritten and the published release history is not changed.
9. This is a current-`main` historical correction only; it is not a change to the tagged release artifact. The v0.4.5 release was performed correctly and is not broken.

## Immutable release identity

- Frozen candidate SHA: `f574ef252342185bc623346461dca8f545adf6a3` (tree `8f0bf45c139d0f9f3639febab185e8aa6ce92279`).
- Exact-SHA hosted CI: Quality run `34980158536`, conclusion `success`, `head_sha=f574ef252342185bc623346461dca8f545adf6a3`, <https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/34980158536>.
- Annotated tag `v0.4.5` (tag object `18d20157e1ccb7bcd5d63b9046bc50f729d1f70e`) peels to `f574ef252342185bc623346461dca8f545adf6a3`.
- Previous stable tag `v0.4.4` remains untouched at `50a1f0329c3200bbf84c489ed5d23543d46abb35`.

## Pre-tag validation performed against the frozen candidate

- Full local verification at `f574ef2`: `pnpm quality`, `pnpm test:coverage`, `pnpm build`,
  `pnpm release:check`, committed-`dist` currency, built `lint`/`sync`/`doctor`/`audit`, and
  `git diff --check` all pass.
- Package payload: `agentic-project-kit-0.4.5.tgz` ships version `0.4.5`, bins
  `apk`/`apkit`/`agentic-project-kit`, and five portable skill assets (`apk-project-grill`,
  `apk-task-grill`, `apk-task-split`, `apk-prototype`, `apk-milestone-semantic-audit`).
- Disposable downstream smoke with the candidate tarball: a brownfield Go + Node repository was
  adopted (`adopt --apply`, 17 files created, stack detected as Go + Node.js), `apk lint`
  returned `hasErrors: false`, `apk sync` reported all generated files in sync, and `apk doctor`
  returned `pass`.

## Post-tag cold install from the actual tag

- A fresh pnpm store (no reused cache) installed
  `git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.5` with no build-script
  allowlist and resolved `agentic-project-kit@0.4.5`.
- The generated lockfile resolved the dependency through the tarball URL
  `https://codeload.github.com/HaidaDaniel/AgenticProjectKit/tar.gz/f574ef252342185bc623346461dca8f545adf6a3`,
  proving the installed executable came from the tagged commit rather than `main` or a source
  checkout.
- The installed package `bin` exposes `apk`, `apkit`, and `agentic-project-kit` (all start), and
  all five packaged skill assets are present, including a readable
  `dist/core/templates/skills/apk-project-grill/SKILL.md.hbs`.

## Released-consumer checks

In a fresh disposable consumer repository using the installed tag package:

- `apk --help` starts the released CLI.
- `apk adopt --apply` created 17 files.
- `apk doctor` returned `pass`.
- `apk lint --json` returned `hasErrors: false`.
- `apk sync` reported generated files in sync.

## Limitations

- Post-tag facts above were observed after tag publication and are recorded here only; they are
  not asserted inside the immutable tagged release-note file.
- No broader post-release self-adoption of the AgenticProjectKit root was performed beyond the
  disposable released-consumer checks above; blocked historical tasks `0133` and `0120` were left
  untouched and were not used as a release dependency.
