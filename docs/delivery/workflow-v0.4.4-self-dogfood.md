# v0.4.4 post-release self-adoption and self-dogfood

## Immutable release identity

- Frozen candidate SHA: `50a1f0329c3200bbf84c489ed5d23543d46abb35` (tree `b827d8d89fcee066d2f43878f0177bff1a2c0765`).
- Exact-SHA hosted CI: Quality run `34959795566`, conclusion `success`, <https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/34959795566>.
- Annotated tag `v0.4.4` (tag object `4dd0bd09211fb796329dc2a9f750c1de0206e62f`) peels to `50a1f0329c3200bbf84c489ed5d23543d46abb35`.
- Cold install: a fresh store (`/tmp/opencode/v044-store`) installed `git+ssh://...#v0.4.4` with no build-script allowlist. Installed `agentic-project-kit@0.4.4`; `bin` exposes `apkit`/`apk`/`agentic-project-kit`; all four packaged skill assets (`apk-task-grill`, `apk-task-split`, `apk-prototype`, `apk-milestone-semantic-audit`) are present, and the built CLI starts.

## Released-consumer root pass

The released v0.4.4 CLI was run with the AgenticProjectKit root as cwd:

- `adopt --preview`: compatibility `legacy`, config `legacy v1`; proposed a config `schemaVersion` migration, `docs/adoption-report.md`, and `.tasks/0137-document-adopted-repository.md`; no files written.
- `sync`: 3 generated files current.
- `export --report-legacy`: 0 obsolete generated files.
- `doctor`: pass (14 checks; one `.env.example` warning).
- `audit`: warnings, quality policy pass.
- `lint`: exit 0; advisory context-hygiene findings only.

Live-root `adopt --apply` was intentionally not executed: it would create a `.tasks/**` file that is forbidden under Task 0133's scope. Its effect was proven in the disposable clone below.

## Disposable-clone self-adoption and self-dogfood

- Cloned the migrated root at `50a1f03`.
- Ran the released CLI `adopt --apply`: created `docs/adoption-report.md` and `.tasks/0137-document-adopted-repository.md` and marked the config gated `schemaVersion: 2` while preserving existing keys (clone commit `a500796`).
- Ran one bounded self-dogfood task `0138` (`create -> claim -> implement -> canonical verify -> one prepared two-axis review by a separate registered identity -> gate -> done`, plus a separate completion/bookkeeping commit):
  - implement commit `9f42535`;
  - canonical verification `marker` pass (candidate-bound);
  - prepared review `review-1789469958279-e8zx5v` by `dogfood-reviewer` (distinct from owner `dogfood-owner`), outcome `pass`, with axis-labelled `Spec:`/`Engineering:` findings;
  - gate `pass`; `done`; bookkeeping commit `8092f42`.

## Limitations

- The human-readable `apk lint` context-hygiene `overlap` line can be long in a large backlog; JSON remains the machine interface. Recommended follow-up: cap the human `overlap`/`missing`/`unavailable` lists.
- Phase-2 evidence comes from a disposable clone and the separate released-CLI consumer, not from the live root's tracked files.
