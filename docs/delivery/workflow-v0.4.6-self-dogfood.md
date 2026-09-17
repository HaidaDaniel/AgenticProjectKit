# v0.4.6 post-release tag validation

This document records the v0.4.6 release evidence on current `main`. It was committed after the
immutable tag was published and is deliberately not part of the tagged commit. The "Temporal
clarification" section below states which evidence is pre-tag, tag-publication, and post-tag.

## Temporal clarification

This clarification is recorded on current `main`; it does not change the published release.

1. Frozen candidate: `d3cef7b1991d6b2ae2fcedcb0e529aae12043b59` (tree
   `56b1483b5ceb74f7f9b58fd2d3f1de11d95a4a6b`), committed `2026-09-17T10:25:10Z`.
2. The candidate was pushed to `main` at `2026-09-17T10:25:51Z`, triggering hosted Quality run
   `35210440058`.
3. That exact-SHA CI ran against `d3cef7b1991d6b2ae2fcedcb0e529aae12043b59`, started
   `2026-09-17T10:25:54Z`, and completed `success` at `2026-09-17T10:32:55Z`.
4. The exact-SHA hosted CI is therefore PRE-TAG evidence: it completed before annotated tag
   `v0.4.6` was created at `2026-09-17T10:33:10Z`.
5. The annotated tag object `50a71025eba6cd21d88c5dc5dbe904ff2861fa1d` and its peel to
   `d3cef7b1991d6b2ae2fcedcb0e529aae12043b59` are TAG PUBLICATION identity, created only after that
   CI passed.
6. The actual-tag cold install and released-consumer checks in this document were performed after
   tag publication and are POST-TAG evidence.
7. Unlike the v0.4.5 release note before its 0140 clarification, the tagged
   `docs/releases/v0.4.6.md` does not group the exact-SHA CI with post-publication identity; it
   states that a passing exact-SHA CI is pre-tag evidence and records identities in this
   post-release artifact.

## Immutable release identity

- Frozen candidate SHA: `d3cef7b1991d6b2ae2fcedcb0e529aae12043b59` (tree
  `56b1483b5ceb74f7f9b58fd2d3f1de11d95a4a6b`).
- Exact-SHA hosted CI: Quality run `35210440058` (run 64), conclusion `success`,
  `head_sha=d3cef7b1991d6b2ae2fcedcb0e529aae12043b59`, started `2026-09-17T10:25:54Z`, completed
  `2026-09-17T10:32:55Z`, <https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/35210440058>.
- Annotated tag `v0.4.6` (tag object `50a71025eba6cd21d88c5dc5dbe904ff2861fa1d`, created
  `2026-09-17T10:33:10Z`) peels to `d3cef7b1991d6b2ae2fcedcb0e529aae12043b59`.
- Previous stable tag `v0.4.5` remains untouched at tag object
  `18d20157e1ccb7bcd5d63b9046bc50f729d1f70e` peeling to
  `f574ef252342185bc623346461dca8f545adf6a3`; `v0.4.4` still peels to
  `50a1f0329c3200bbf84c489ed5d23543d46abb35`.

## Pre-tag validation performed against the frozen candidate

- Full local verification at `d3cef7b`: `pnpm typecheck`, `pnpm lint`, `pnpm test` (445 pass),
  `pnpm test:coverage`, `pnpm build`, `pnpm release:check` (quality + coverage + build + sync +
  audit), committed-`dist` currency, built `lint`/`sync`/`doctor`/`audit`, and `git diff --check`
  all pass. Coverage totals: 91.9% lines/statements, 97.69% functions, 81.2% branches.
- Focused v0.4.6 regressions at `d3cef7b`: language default/persist/explicit-override/reset and
  repository non-mutation; grill established-fact + ambiguity + consequence under terse styles for
  both skills; explicit-caveman advisory present and non-failing with byte-for-byte config
  non-mutation, and absent for explicit `normal` and omitted `agentStyle`.
- Package payload: `agentic-project-kit-0.4.6.tgz` ships version `0.4.6`, bins
  `apk`/`apkit`/`agentic-project-kit`, and five portable skill assets (`apk-project-grill`,
  `apk-task-grill`, `apk-task-split`, `apk-prototype`, `apk-milestone-semantic-audit`).
- Disposable downstream candidate smoke with the candidate tarball: a brownfield Go + Node
  repository was adopted (`adopt --apply`, 16 files created, stack detected as Go/Node.js/pnpm),
  `apk lint --json` returned `hasErrors: false`, `apk sync` reported generated files in sync, and
  `apk doctor` returned `pass`.

## Post-tag cold install from the actual tag

- A fresh pnpm store (`/tmp/opencode/apk-v046-posttag/store`, no reused cache) installed
  `git+ssh://git@github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.6` with no build-script
  allowlist and resolved `agentic-project-kit@0.4.6`.
- The generated lockfile resolved the dependency through the tarball URL
  `https://codeload.github.com/HaidaDaniel/AgenticProjectKit/tar.gz/d3cef7b1991d6b2ae2fcedcb0e529aae12043b59`,
  proving the installed executable came from the tagged commit rather than `main` or a source
  checkout.
- The installed package `bin` exposes `apk`, `apkit`, and `agentic-project-kit` (all start), and
  all five packaged skill assets are present, including readable
  `dist/core/templates/skills/apk-project-grill/SKILL.md.hbs` and
  `dist/core/templates/skills/apk-task-grill/SKILL.md.hbs`.

## Released-consumer checks

In a fresh disposable consumer repository using the installed tag package:

- `apk doctor` returned `pass`.
- `apk lint --json` returned `hasErrors: false` after adoption (the raw, unadopted repository
  reports contract errors, as expected).
- `apk audit` reported warnings only; quality policy `pass`.
- `apk adopt --preview` listed the planned files and wrote nothing; `apk adopt --apply` on the
  throwaway consumer created 16 files; `apk sync` reported generated files in sync.
- `apk language show` fell back to `en`, `apk language set ru` persisted a developer-local
  preference, an explicit `APK_COMMUNICATION_LANGUAGE=uk` override won without persisting, and
  `apk prompt` carried the resolved language; `apk language reset` restored the English fallback.
- Both shipped grill assets contain the 0142 established-fact/ambiguity/consequence wording, and
  `apk doctor` emitted the 0143 explicit-caveman advisory (exit 0, `Result: pass`, config
  byte-for-byte unchanged).

## Limitations

- Post-tag facts above were observed after tag publication and are recorded here only; they are
  not asserted inside the immutable tagged release-note file.
- No broader post-release self-adoption of the AgenticProjectKit root was performed beyond the
  disposable released-consumer checks above.
